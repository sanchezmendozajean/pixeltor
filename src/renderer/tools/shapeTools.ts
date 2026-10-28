// Herramientas vectoriales de F2: formas paramétricas, Pluma y Selección (V) de formas.
// Crear una forma = un comando; durante el arrastre solo hay una vista previa transitoria.

import {
  type Anchor,
  type Appearance,
  type Rect,
  type Shape,
  type Vec2,
  ShapeMove,
  addShape,
  hitShape,
  makeAppearance,
  makeEllipse,
  makeLine,
  makePath,
  makePolygon,
  makeRect,
  makeStar,
  selectShapes,
  shapeLines
} from '@core/index'
import type { Workspace } from '@/session/workspace'
import { useColorsStore } from '@/stores/colors'
import { hexToRgba } from '@/stores/colorUtil'
import { useToolsStore } from '@/stores/tools'
import type { ShapeOverlay } from '@/viewport/overlay'

export const SHAPE_TOOLS = new Set(['rect', 'ellipse', 'polygon', 'star', 'line', 'pen', 'sel'])

interface Mods {
  shift: boolean
  alt: boolean
}

const rgba = (n: number) => ({
  r: (n >>> 24) & 255,
  g: (n >>> 16) & 255,
  b: (n >>> 8) & 255,
  a: n & 255
})

function currentAppearance(closed: boolean): Appearance {
  const t = useToolsStore()
  const c = useColorsStore()
  const ap = makeAppearance(
    t.useFill && closed ? rgba(hexToRgba(c.fill)) : null,
    t.useStroke || !closed || !t.useFill ? rgba(hexToRgba(c.stroke)) : null,
    t.strokeWidth
  )
  // Los contornos de formas cerradas quedan dentro del cuadro delimitador.
  if (closed) for (const s of ap.strokes) s.align = 'inside'
  return ap
}

export class ShapeTools {
  private drag: { x0: number; y0: number; x1: number; y1: number; mods: Mods } | null = null
  private moving: { mv: ShapeMove; x0: number; y0: number; started: boolean } | null = null
  private pen: { anchors: Anchor[]; dragging: boolean } | null = null
  hoverId: string | null = null

  constructor(private readonly getWs: () => Workspace | null) {}

  get penActive(): boolean {
    return !!this.pen && this.pen.anchors.length > 0
  }

  private build(tool: string, d: NonNullable<typeof this.drag>): Shape | null {
    const t = useToolsStore()
    const x = Math.min(d.x0, d.x1)
    const y = Math.min(d.y0, d.y1)
    let w = Math.abs(d.x1 - d.x0) + 1
    let h = Math.abs(d.y1 - d.y0) + 1
    if (d.mods.shift && tool !== 'line') w = h = Math.max(w, h)
    const bx = d.x1 < d.x0 && d.mods.shift ? d.x0 - w + 1 : x
    const by = d.y1 < d.y0 && d.mods.shift ? d.y0 - h + 1 : y
    switch (tool) {
      case 'rect': {
        const r = makeRect(bx, by, w, h, currentAppearance(true))
        const rad = Math.min(t.cornerRadius, w / 2, h / 2)
        r.radius = [rad, rad, rad, rad]
        return r
      }
      case 'ellipse':
        return makeEllipse(bx + w / 2, by + h / 2, w / 2, h / 2, currentAppearance(true))
      case 'line': {
        let { x1, y1 } = d
        if (d.mods.shift) {
          const dx = x1 - d.x0
          const dy = y1 - d.y0
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
          const len = Math.hypot(dx, dy)
          x1 = d.x0 + Math.round(Math.cos(ang) * len)
          y1 = d.y0 + Math.round(Math.sin(ang) * len)
        }
        return makeLine(
          { x: d.x0 + 0.5, y: d.y0 + 0.5 },
          { x: x1 + 0.5, y: y1 + 0.5 },
          currentAppearance(false)
        )
      }
      case 'polygon':
      case 'star': {
        const r = Math.round(Math.hypot(d.x1 - d.x0, d.y1 - d.y0))
        if (r < 1) return null
        return tool === 'polygon'
          ? makePolygon(d.x0 + 0.5, d.y0 + 0.5, r, t.polygonSides, currentAppearance(true))
          : makeStar(
              d.x0 + 0.5,
              d.y0 + 0.5,
              r,
              r * t.starRatio,
              t.starPoints,
              currentAppearance(true)
            )
      }
    }
    return null
  }

  private penShape(extra?: Anchor): Shape | null {
    if (!this.pen) return null
    const anchors = extra ? [...this.pen.anchors, extra] : this.pen.anchors
    if (anchors.length < 2) return null
    const closed = false
    return makePath([{ closed, anchors }], currentAppearance(false))
  }

  down(
    tool: string,
    x: number,
    y: number,
    mods: Mods,
    screenNearFirst: (p: Vec2) => boolean
  ): void {
    const ws = this.getWs()
    if (!ws) return
    const s = ws.session
    if (tool === 'sel') {
      const id = hitShape(s, x, y)
      if (id) {
        const cur = s.selectedShapes
        if (mods.shift)
          selectShapes(s, cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id])
        else if (!cur.includes(id)) selectShapes(s, [id])
        const layer = s.image.layers.find((l) => l.shapes.some((sh) => sh.id === id))
        if (layer && layer.id !== s.activeLayerId) s.setActiveLayer(layer.id)
        this.moving = { mv: new ShapeMove(s, s.selectedShapes), x0: x, y0: y, started: false }
      } else if (!mods.shift && s.selectedShapes.length) selectShapes(s, [])
      return
    }
    const layer = s.activeLayer
    if (layer.locked || !layer.visible) return
    if (tool === 'pen') {
      const pt = { x: x + 0.5, y: y + 0.5 }
      this.pen ??= { anchors: [], dragging: false }
      const first = this.pen.anchors[0]
      if (first && this.pen.anchors.length >= 3 && screenNearFirst(first.p)) {
        this.finishPen(true)
        return
      }
      this.pen.anchors.push({ p: pt, in: null, out: null, type: 'corner' })
      this.pen.dragging = true
      ws.setPreview(this.penShape())
      return
    }
    this.drag = { x0: x, y0: y, x1: x, y1: y, mods }
    ws.setPreview(this.build(tool, this.drag))
  }

  move(tool: string, x: number, y: number, mods: Mods): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.moving) {
      const m = this.moving
      if (!m.started && (x !== m.x0 || y !== m.y0)) m.started = true
      if (m.started) m.mv.moveBy(x - m.x0, y - m.y0)
      return
    }
    if (this.pen?.dragging) {
      const a = this.pen.anchors[this.pen.anchors.length - 1]!
      const out = { x: x + 0.5, y: y + 0.5 }
      if (Math.hypot(out.x - a.p.x, out.y - a.p.y) >= 1) {
        a.out = out
        // Alt rompe la simetría: el tirador de entrada queda donde estaba, como en Illustrator.
        a.in = mods.alt ? a.in : { x: 2 * a.p.x - out.x, y: 2 * a.p.y - out.y }
        a.type = mods.alt ? 'smooth' : 'symmetric'
      }
      ws.setPreview(this.penShape())
      return
    }
    if (this.drag) {
      this.drag.x1 = x
      this.drag.y1 = y
      this.drag.mods = mods
      ws.setPreview(this.build(tool, this.drag))
    }
  }

  up(tool: string): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.moving) {
      if (this.moving.started) this.moving.mv.end()
      this.moving = null
      return
    }
    if (this.pen) {
      this.pen.dragging = false
      return
    }
    if (this.drag) {
      const shape = this.build(tool, this.drag)
      this.drag = null
      ws.setPreview(null)
      if (shape) addShape(ws.session, shape)
    }
  }

  /** Termina el trazado de la Pluma (Intro = abierto, clic en la primera ancla = cerrado). */
  finishPen(closed: boolean): void {
    const ws = this.getWs()
    const p = this.pen
    this.pen = null
    ws?.setPreview(null)
    if (!ws || !p || p.anchors.length < 2) return
    const shape = makePath([{ closed, anchors: p.anchors }], currentAppearance(closed))
    addShape(ws.session, shape)
  }

  cancelPen(): void {
    this.pen = null
    this.getWs()?.setPreview(null)
  }

  cancel(): void {
    this.drag = null
    this.cancelPen()
    if (this.moving) {
      if (this.moving.started) this.moving.mv.end()
      this.moving = null
    }
  }

  hover(x: number, y: number, tool: string): void {
    const ws = this.getWs()
    this.hoverId = ws && (tool === 'sel' || tool === 'pen') ? hitShape(ws.session, x, y) : null
  }

  /** Datos para dibujar trazados, anclas y cajas delimitadoras. */
  overlay(): ShapeOverlay[] {
    const ws = this.getWs()
    if (!ws) return []
    const s = ws.session
    const out: ShapeOverlay[] = []
    for (const layer of s.image.layers) {
      if (!layer.visible) continue
      for (const sh of layer.shapes) {
        const selected = s.selectedShapes.includes(sh.id)
        if (!selected && sh.id !== this.hoverId) continue
        const lines = shapeLines(sh)
        let box: Rect | null = null
        if (selected) {
          const pts = lines.flatMap((l) => l.pts)
          if (pts.length) {
            const x0 = Math.min(...pts.map((p) => p.x))
            const y0 = Math.min(...pts.map((p) => p.y))
            box = {
              x: x0,
              y: y0,
              w: Math.max(...pts.map((p) => p.x)) - x0,
              h: Math.max(...pts.map((p) => p.y)) - y0
            }
          }
        }
        const anchors =
          selected && sh.kind === 'path'
            ? sh.subpaths.flatMap((sp) => sp.anchors.map((a) => a.p))
            : []
        out.push({ lines, color: layer.color, box, anchors })
      }
    }
    if (this.pen) {
      const shape = this.penShape()
      out.push({
        lines: shape ? shapeLines(shape) : [],
        color: '#3d8bff',
        box: null,
        anchors: this.pen.anchors.map((a) => a.p)
      })
    }
    return out
  }
}
