// Traduce eventos de puntero sobre el visor en operaciones del core (herramientas de F1).
// Una herramienta nunca muta el modelo: crea Strokes/Transactions y el core registra el comando.

import {
  type MaskOp,
  type Rect,
  SelectionMove,
  Stroke,
  brushOffsets,
  bucketFill,
  commitFloating,
  deselect,
  paintBlockReason,
  pickColor,
  selectMask,
  selectRect,
  wandMask
} from '@core/index'
import type { Workspace } from '@/session/workspace'
import { useColorsStore } from '@/stores/colors'
import { hexToRgba, rgbaToHex } from '@/stores/colorUtil'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import type { OverlayState } from '@/viewport/overlay'
import { SHAPE_TOOLS, ShapeTools } from './shapeTools'

/** Controlador del visor activo; lo usan las acciones (Intro/Esc de la Pluma). */
export let activeController: CanvasController | null = null
export function setActiveController(c: CanvasController | null): void {
  activeController = c
}

export type Notice = 'hidden' | 'locked' | 'floating' | null

interface PointerInfo {
  /** Coordenadas de pantalla relativas al visor. */
  sx: number
  sy: number
  button: number
  shift: boolean
  alt: boolean
  ctrl: boolean
}

const PAINT_TOOLS = new Set(['pencil', 'brush', 'eraser'])

export class CanvasController {
  private stroke: Stroke | null = null
  private strokeLast: { x: number; y: number } | null = null
  private panning: { sx: number; sy: number } | null = null
  private marquee: { x0: number; y0: number; x1: number; y1: number; op: MaskOp } | null = null
  private move: { mv: SelectionMove; x0: number; y0: number } | null = null
  private lastPaintPoint = new WeakMap<Workspace, { x: number; y: number }>()
  readonly shapes: ShapeTools
  private shapeActive: string | null = null
  spaceDown = false
  hover: { x: number; y: number } | null = null

  constructor(
    private readonly getWs: () => Workspace | null,
    private readonly onNotice: (n: Notice) => void
  ) {
    this.shapes = new ShapeTools(getWs)
  }

  private get tools() {
    return useToolsStore()
  }

  private colorFor(button: number): number {
    const c = useColorsStore()
    return hexToRgba(button === 2 ? c.stroke : c.fill)
  }

  private setColor(button: number, rgba: number): void {
    const c = useColorsStore()
    if (button === 2) c.stroke = rgbaToHex(rgba)
    else c.fill = rgbaToHex(rgba)
  }

  /** Estado que necesita el overlay para dibujarse. */
  overlayState(dashOffset: number): OverlayState {
    const ws = this.getWs()
    if (!ws) return { mask: null, marquee: null, cursor: null, dashOffset }
    const t = this.tools
    const s = ws.session
    let cursor: OverlayState['cursor'] = null
    if (this.hover && PAINT_TOOLS.has(t.active)) {
      cursor = {
        x: this.hover.x,
        y: this.hover.y,
        offsets: brushOffsets(t.active === 'pencil' ? 1 : t.brushSize, t.brushShape),
        blocked: paintBlockReason(s) !== null
      }
    }
    const m = this.marquee
    return {
      shapes: this.shapes.overlay(),
      mask: s.selection.mask,
      marquee: m ? marqueeRect(m) : null,
      cursor,
      dashOffset
    }
  }

  down(p: PointerInfo): void {
    const ws = this.getWs()
    if (!ws) return
    const vp = ws.viewport
    const pt = vp.toImage(p.sx, p.sy)
    const x = Math.floor(pt.x)
    const y = Math.floor(pt.y)
    const tool = this.tools.active

    if (p.button === 1 || this.spaceDown || tool === 'hand') {
      this.panning = { sx: p.sx, sy: p.sy }
      return
    }
    const s = ws.session

    // Alt mantenido con lápiz/pincel/bote = cuentagotas temporal.
    if (p.alt && (PAINT_TOOLS.has(tool) || tool === 'bucket') && tool !== 'eraser') {
      this.eyedrop(ws, x, y, p.button, p.ctrl)
      return
    }

    if (SHAPE_TOOLS.has(tool)) {
      // V sobre una selección de píxeles mueve los píxeles; en cualquier otro caso trabaja con formas.
      const mask = s.selection.mask
      const onPixels = tool === 'sel' && !!mask && (mask.has(x, y) || !!s.selection.floating)
      if (!onPixels) {
        const near = (q: { x: number; y: number }) => {
          const a = vp.toScreen(q.x, q.y)
          return Math.hypot(a.x - p.sx, a.y - p.sy) < 6
        }
        this.shapeActive = tool
        this.shapes.down(tool, x, y, { shift: p.shift, alt: p.alt }, near)
        return
      }
    }

    switch (tool) {
      case 'pencil':
      case 'brush':
      case 'eraser': {
        const block = paintBlockReason(s)
        this.onNotice(block)
        if (block) return
        const color = this.colorFor(p.button)
        this.stroke = new Stroke(s, {
          tool: tool as 'pencil' | 'brush' | 'eraser',
          color,
          size: this.tools.brushSize,
          shape: this.tools.brushShape
        })
        const last = this.lastPaintPoint.get(ws)
        // Mayús+clic: línea recta desde el último punto.
        if (p.shift && last && tool !== 'eraser') this.stroke.move(last.x, last.y)
        this.strokeLast = { x: x, y: y }
        this.stroke.move(x, y)
        ws.liveDirty(brushBox(x, y, last && p.shift ? last : null, this.radius()))
        break
      }
      case 'bucket': {
        const block = paintBlockReason(s)
        this.onNotice(block)
        if (block) return
        bucketFill(s, x, y, this.colorFor(p.button), {
          tolerance: this.tools.tolerance,
          contiguous: this.tools.contiguous,
          sampleAll: this.tools.sampleAll
        })
        break
      }
      case 'eyedrop':
        this.eyedrop(ws, x, y, p.button, this.tools.sampleAll || p.ctrl)
        break
      case 'zoom': {
        vp.stepZoom(p.alt || p.button === 2 ? -1 : 1, p.sx, p.sy)
        ws.refreshView()
        break
      }
      case 'wand': {
        const op = maskOp(p)
        const mask = wandMask(s, x, y, {
          tolerance: this.tools.tolerance,
          contiguous: this.tools.contiguous,
          sampleAll: this.tools.sampleAll
        })
        selectMask(s, mask, op, 'Varita mágica')
        break
      }
      case 'marquee':
      case 'sel': {
        const inside = !!s.selection.mask?.has(x, y)
        if (inside || (tool === 'sel' && s.selection.mask && s.selection.floating)) {
          // Arrastrar dentro de la selección: V mueve píxeles; el marco solo mueve el contorno
          // (Ctrl mantenido levanta los píxeles).
          const withPixels = tool === 'sel' || p.ctrl || !!s.selection.floating
          const layer = s.activeLayer
          const block: Notice = !withPixels
            ? null
            : layer.locked
              ? 'locked'
              : !layer.visible
                ? 'hidden'
                : null
          this.onNotice(block)
          if (block) return
          this.move = { mv: new SelectionMove(s, withPixels), x0: x, y0: y }
        } else if (tool === 'marquee') {
          this.marquee = { x0: x, y0: y, x1: x, y1: y, op: maskOp(p) }
        } else if (s.selection.mask && !inside) {
          if (s.selection.floating) commitFloating(s)
        }
        break
      }
      default:
        break
    }
  }

  moveTo(p: PointerInfo): void {
    const ws = this.getWs()
    if (!ws) return
    const vp = ws.viewport
    const pt = vp.toImage(p.sx, p.sy)
    const x = Math.floor(pt.x)
    const y = Math.floor(pt.y)
    this.hover = { x, y }
    this.shapes.hover(x, y, this.tools.active)
    useDocumentsStore().cursor = { x, y }

    if (this.panning) {
      vp.panBy(p.sx - this.panning.sx, p.sy - this.panning.sy)
      this.panning = { sx: p.sx, sy: p.sy }
      ws.refreshView()
      return
    }
    if (this.shapeActive) {
      this.shapes.move(this.shapeActive, x, y, { shift: p.shift, alt: p.alt })
      return
    }
    if (this.stroke && this.strokeLast) {
      const prev = this.strokeLast
      if (prev.x !== x || prev.y !== y) {
        this.stroke.move(x, y)
        ws.liveDirty(brushBox(x, y, prev, this.radius()))
        this.strokeLast = { x, y }
      }
      return
    }
    if (this.marquee) {
      this.marquee.x1 = x
      this.marquee.y1 = y
      return
    }
    if (this.move) {
      this.move.mv.moveBy(x - this.move.x0, y - this.move.y0)
    }
  }

  up(): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.shapeActive) {
      this.shapes.up(this.shapeActive)
      this.shapeActive = null
      return
    }
    if (this.panning) {
      this.panning = null
      return
    }
    if (this.stroke) {
      if (this.strokeLast) this.lastPaintPoint.set(ws, this.strokeLast)
      this.stroke.end()
      this.stroke = null
      this.strokeLast = null
      return
    }
    if (this.marquee) {
      const m = this.marquee
      this.marquee = null
      // Un clic sin arrastre deselecciona; el marco incluye el píxel de inicio y el final.
      if (m.x0 === m.x1 && m.y0 === m.y1) deselect(ws.session)
      else selectRect(ws.session, marqueeRect(m), m.op)
      return
    }
    if (this.move) {
      this.move.mv.end()
      this.move = null
    }
  }

  private radius(): number {
    return this.tools.active === 'pencil' ? 1 : Math.ceil(this.tools.brushSize) + 1
  }

  private eyedrop(ws: Workspace, x: number, y: number, button: number, sampleAll: boolean): void {
    const c = pickColor(ws.session, x, y, sampleAll)
    if (c !== null && (c & 255) !== 0) this.setColor(button, c)
  }

  cancelInteraction(): void {
    this.shapes.cancel()
    this.shapeActive = null
    this.stroke?.end()
    this.stroke = null
    this.marquee = null
    this.panning = null
    if (this.move) {
      this.move.mv.end()
      this.move = null
    }
  }
}

function maskOp(p: PointerInfo): MaskOp {
  if (p.shift && p.alt) return 'intersect'
  if (p.shift) return 'add'
  if (p.alt) return 'subtract'
  return 'replace'
}

/** El marco incluye tanto el píxel de partida como el final. */
function marqueeRect(m: { x0: number; y0: number; x1: number; y1: number }): Rect {
  const x = Math.min(m.x0, m.x1)
  const y = Math.min(m.y0, m.y1)
  return { x, y, w: Math.abs(m.x1 - m.x0) + 1, h: Math.abs(m.y1 - m.y0) + 1 }
}

function brushBox(x: number, y: number, from: { x: number; y: number } | null, r: number): Rect {
  const fx = from?.x ?? x
  const fy = from?.y ?? y
  const x0 = Math.min(x, fx) - r
  const y0 = Math.min(y, fy) - r
  return { x: x0, y: y0, w: Math.abs(x - fx) + 2 * r + 1, h: Math.abs(y - fy) + 2 * r + 1 }
}
