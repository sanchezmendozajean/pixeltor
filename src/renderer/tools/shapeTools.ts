// Herramientas vectoriales: formas paramétricas, Pluma, Selección (V), Selección directa (A)
// y herramientas de anclas. Crear/editar una forma = un comando; durante el arrastre solo hay
// vista previa o edición transitoria dentro de una Transaction.

import {
  type Anchor,
  type AnchorPart,
  type Appearance,
  type GradientPaint,
  type Mat2D,
  type Box,
  type ID,
  type PathShape,
  type Shape,
  type Vec2,
  AnchorDrag,
  ShapeMove,
  RectRadiusDrag,
  ShapeRotate,
  isolateGroup,
  resolveShape,
  computeSnap,
  shapeBounds,
  type SnapLine,
  commitLiveEdit,
  defaultGradient,
  invert,
  liveUpdateShape,
  sortedStops,
  pixelBounds,
  renderShapeRegion,
  ShapeScale,
  addAnchorAt,
  addShape,
  apply,
  convertAnchor,
  convertToPath,
  deleteAnchor,
  getShape,
  hitShape,
  makeAppearance,
  makeEllipse,
  makeLine,
  makePath,
  makePolygon,
  makeRect,
  makeStar,
  selectShapes,
  shapeLines,
  shapesBox,
  toPath
} from '@core/index'
import type { Workspace } from '@/session/workspace'
import { useColorsStore } from '@/stores/colors'
import { useDocumentsStore } from '@/stores/documents'
import { hexToRgba } from '@/stores/colorUtil'
import { useToolsStore } from '@/stores/tools'
import { t } from '@/i18n'
import { useUiStore } from '@/stores/ui'
import { findGradientAttr, type Attr } from './gradientTarget'
import type { OverlayState, ShapeOverlay } from '@/viewport/overlay'

export const SHAPE_TOOLS = new Set([
  'gradient',
  'rect',
  'ellipse',
  'polygon',
  'star',
  'line',
  'pen',
  'sel',
  'dsel',
  'addAnchor',
  'delAnchor',
  'convAnchor'
])

interface Mods {
  shift: boolean
  alt: boolean
}

interface Pointer {
  /** Píxel entero de imagen. */
  x: number
  y: number
  /** Coordenadas de imagen en coma flotante. */
  fx: number
  fy: number
  /** Coordenadas de pantalla relativas al visor. */
  sx: number
  sy: number
}

interface AnchorSel {
  shapeId: ID
  subpath: number
  index: number
}

const HIT = 6 // px de pantalla
const HANDLES: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1]
]

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

/** Trazado visible de una forma: el suyo, o el equivalente si es paramétrica (solo para mostrar). */
function displayPath(sh: Shape): PathShape {
  if (sh.kind === 'group') return { ...sh, kind: 'path', subpaths: [], fillRule: 'nonzero' }
  return sh.kind === 'path' ? sh : toPath(sh)
}

type OverlayGradientBar = NonNullable<OverlayState['gradientBar']>

export class ShapeTools {
  private drag: { x0: number; y0: number; x1: number; y1: number; mods: Mods } | null = null
  private moving: { mv: ShapeMove; x0: number; y0: number; started: boolean } | null = null
  private scaling: {
    sc: ShapeScale
    handle: [number, number]
    box: Box
    mods: Mods
  } | null = null
  private gradDrag: {
    kind: 'from' | 'to' | 'stop' | 'new'
    shapeId: ID
    attrId: string
    /** Local → imagen de la forma (fija durante el arrastre). */
    T: Mat2D
    stopIndex: number
  } | null = null
  private keyCandidate: ID | null = null
  /** Límites de píxeles de la selección al empezar a moverla (para ajustar). */
  private moveBounds: { x: number; y: number; w: number; h: number } | null = null
  /** Líneas de ajuste visibles mientras se arrastra. */
  snapLines: SnapLine[] = []
  private radiusDrag: RectRadiusDrag | null = null
  private rotating: { rot: ShapeRotate; start: number } | null = null
  private anchorDrag: { ad: AnchorDrag; x0: number; y0: number; started: boolean } | null = null
  private pen: { anchors: Anchor[]; dragging: boolean } | null = null
  /** Anclas seleccionadas con la Selección directa. */
  private anchorSel: AnchorSel[] = []
  hoverId: string | null = null

  constructor(private readonly getWs: () => Workspace | null) {}

  /** Muestra la vista previa y publica su tamaño en píxeles para la barra de estado. */
  private setPreview(ws: Workspace, shape: Shape | null): void {
    ws.setPreview(shape)
    const b = shape
      ? pixelBounds(renderShapeRegion(shape, ws.session.image.width, ws.session.image.height))
      : null
    useDocumentsStore().drawingSize = b ? { w: b.w, h: b.h } : null
  }

  get penActive(): boolean {
    return !!this.pen && this.pen.anchors.length > 0
  }

  // ---------- creación ----------

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

  private penShape(): Shape | null {
    if (!this.pen || this.pen.anchors.length < 2) return null
    return makePath([{ closed: false, anchors: this.pen.anchors }], currentAppearance(false))
  }

  // ---------- puntero ----------

  down(tool: string, p: Pointer, mods: Mods): void {
    const ws = this.getWs()
    if (!ws) return
    const s = ws.session
    const vp = ws.viewport
    const near = (q: Vec2) => {
      const a = vp.toScreen(q.x, q.y)
      return Math.hypot(a.x - p.sx, a.y - p.sy) < HIT
    }

    if (tool === 'gradient') return this.downGradient(p)
    if (tool === 'sel') return this.downSelect(p, mods)
    if (tool === 'dsel') return this.downDirect(p, mods)
    if (tool === 'addAnchor') {
      const id = hitShape(s, p.x, p.y, 2) ?? s.selectedShapes.find((i) => getShape(s, i))
      if (id && addAnchorAt(s, id, p.fx, p.fy, 6 / vp.zoom + 1)) selectShapes(s, [id])
      return
    }
    if (tool === 'delAnchor' || tool === 'convAnchor') {
      const hit = this.hitAnchor(p, near)
      if (!hit || hit.part !== 'p') return
      const shape = getShape(s, hit.shapeId)!
      if (tool === 'delAnchor') deleteAnchor(s, hit)
      else {
        const sp = displayPath(shape).subpaths[hit.subpath]!.anchors[hit.index]!
        convertAnchor(s, hit, !(sp.in || sp.out))
      }
      return
    }

    const layer = s.activeLayer
    if (layer.locked || !layer.visible) return
    if (tool === 'pen') {
      const pt = { x: p.x + 0.5, y: p.y + 0.5 }
      this.pen ??= { anchors: [], dragging: false }
      const first = this.pen.anchors[0]
      if (first && this.pen.anchors.length >= 3 && near(first.p)) {
        this.finishPen(true)
        return
      }
      this.pen.anchors.push({ p: pt, in: null, out: null, type: 'corner' })
      this.pen.dragging = true
      this.setPreview(ws, this.penShape())
      return
    }
    this.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, mods }
    this.setPreview(ws, this.build(tool, this.drag))
  }

  /** Tiradores de la caja de selección bajo el cursor. */
  private hitBoxHandle(p: Pointer): { handle: [number, number]; box: Box } | null {
    const ws = this.getWs()
    if (!ws || !ws.session.selectedShapes.length) return null
    const box = shapesBox(ws.session, ws.session.selectedShapes)
    if (!box) return null
    const vp = ws.viewport
    for (const [hx, hy] of HANDLES) {
      const a = vp.toScreen(box.x + hx * box.w, box.y + hy * box.h)
      if (Math.hypot(a.x - p.sx, a.y - p.sy) < HIT) return { handle: [hx, hy], box }
    }
    return null
  }

  /** Posición en imagen del widget de radio del rectángulo seleccionado (esquina superior izquierda). */
  private radiusWidget(): { id: ID; pos: Vec2 } | null {
    const ws = this.getWs()
    if (!ws || ws.session.selectedShapes.length !== 1) return null
    const sh = getShape(ws.session, ws.session.selectedShapes[0]!)
    if (!sh || sh.kind !== 'rect' || sh.locked) return null
    // a 10 px de pantalla como mínimo de la esquina para no tapar el tirador de la caja
    const d = Math.max(sh.radius[0], 10 / ws.viewport.zoom)
    return { id: sh.id, pos: apply(sh.transform, { x: d, y: d }) }
  }

  private radiusWidgetAt(p: Pointer): ID | null {
    const w = this.radiusWidget()
    const ws = this.getWs()
    if (!w || !ws) return null
    const a = ws.viewport.toScreen(w.pos.x, w.pos.y)
    return Math.hypot(a.x - p.sx, a.y - p.sy) < HIT ? w.id : null
  }

  /** Zona de rotación: fuera de la caja, cerca de una esquina (6–26 px de pantalla). */
  private hitRotateZone(p: Pointer): Box | null {
    const ws = this.getWs()
    if (!ws || !ws.session.selectedShapes.length) return null
    const box = shapesBox(ws.session, ws.session.selectedShapes)
    if (!box) return null
    for (const [hx, hy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ] as const) {
      const a = ws.viewport.toScreen(box.x + hx * box.w, box.y + hy * box.h)
      const d = Math.hypot(a.x - p.sx, a.y - p.sy)
      const outside = (hx === 0 ? p.sx < a.x : p.sx > a.x) || (hy === 0 ? p.sy < a.y : p.sy > a.y)
      if (d >= HIT && d <= 26 && outside) return box
    }
    return null
  }

  /** Unión de los límites de píxeles de las formas seleccionadas. */
  private selectionBounds(): { x: number; y: number; w: number; h: number } | null {
    const ws = this.getWs()
    if (!ws) return null
    const list = ws.session.selectedShapes
      .map((id) => shapeBounds(ws.session, id))
      .filter((b): b is NonNullable<typeof b> => !!b)
    if (!list.length) return null
    const x0 = Math.min(...list.map((b) => b.x))
    const y0 = Math.min(...list.map((b) => b.y))
    return {
      x: x0,
      y: y0,
      w: Math.max(...list.map((b) => b.x + b.w)) - x0,
      h: Math.max(...list.map((b) => b.y + b.h)) - y0
    }
  }

  /** Ajuste del desplazamiento (dx, dy) según los interruptores de la barra de estado. */
  private snapMove(dx: number, dy: number): { dx: number; dy: number; lines: SnapLine[] } {
    const ws = this.getWs()
    const b = this.moveBounds
    const ui = useUiStore()
    if (!ws || !b || (!ui.snap.canvas && !ui.snap.smart && !ui.snap.guides)) {
      return { dx: 0, dy: 0, lines: [] }
    }
    const radius = 4 / ws.viewport.zoom
    return computeSnap(
      ws.session,
      { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h },
      ws.session.selectedShapes,
      { canvas: ui.snap.canvas, objects: ui.snap.smart, guides: ui.snap.guides && ui.showGuides },
      radius
    )
  }

  private downSelect(p: Pointer, mods: Mods): void {
    const ws = this.getWs()!
    const s = ws.session
    const rw = this.radiusWidgetAt(p)
    if (rw) {
      this.radiusDrag = new RectRadiusDrag(s, rw)
      return
    }
    const h = this.hitBoxHandle(p)
    const rot = h ? null : this.hitRotateZone(p)
    if (rot) {
      const rt = new ShapeRotate(s, s.selectedShapes, rot)
      this.rotating = { rot: rt, start: Math.atan2(p.fy - rt.center.y, p.fx - rt.center.x) }
      return
    }
    if (h) {
      this.scaling = {
        sc: new ShapeScale(s, s.selectedShapes, h.box),
        handle: h.handle,
        box: h.box,
        mods
      }
      return
    }
    const id = hitShape(s, p.x, p.y)
    if (id) {
      const cur = s.selectedShapes
      // clic sin arrastre en una forma ya seleccionada (entre varias): objeto clave
      this.keyCandidate = cur.length > 1 && cur.includes(id) && !mods.shift ? id : null
      if (mods.shift) selectShapes(s, cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id])
      else if (!cur.includes(id)) selectShapes(s, [id])
      const layer = s.image.layers.find((l) => l.shapes.some((sh) => sh.id === id))
      if (layer && layer.id !== s.activeLayerId) s.setActiveLayer(layer.id)
      this.moving = { mv: new ShapeMove(s, s.selectedShapes), x0: p.x, y0: p.y, started: false }
      this.moveBounds = this.selectionBounds()
    } else if (!mods.shift && s.selectedShapes.length) selectShapes(s, [])
  }

  /** Ancla o tirador bajo el cursor entre las formas seleccionadas. */
  private hitAnchor(
    p: Pointer,
    near: (q: Vec2) => boolean
  ): (AnchorSel & { part: AnchorPart }) | null {
    const ws = this.getWs()!
    const s = ws.session
    const ids = s.selectedShapes.length ? s.selectedShapes : []
    const hovered = hitShape(s, p.x, p.y, 2)
    const candidates = hovered && !ids.includes(hovered) ? [...ids, hovered] : ids
    for (const id of candidates) {
      const sh = getShape(s, id)
      if (!sh) continue
      const path = displayPath(sh)
      for (let si = 0; si < path.subpaths.length; si++) {
        const anchors = path.subpaths[si]!.anchors
        // los tiradores tienen prioridad sobre las anclas que cubren
        for (let i = 0; i < anchors.length; i++) {
          for (const part of ['in', 'out'] as const) {
            const hp = anchors[i]![part]
            if (hp && near(apply(path.transform, hp)) && this.isAnchorSelected(id, si, i))
              return { shapeId: id, subpath: si, index: i, part }
          }
        }
        for (let i = 0; i < anchors.length; i++)
          if (near(apply(path.transform, anchors[i]!.p)))
            return { shapeId: id, subpath: si, index: i, part: 'p' }
      }
    }
    return null
  }

  private isAnchorSelected(shapeId: ID, subpath: number, index: number): boolean {
    return this.anchorSel.some(
      (a) => a.shapeId === shapeId && a.subpath === subpath && a.index === index
    )
  }

  private downDirect(p: Pointer, mods: Mods): void {
    const ws = this.getWs()!
    const s = ws.session
    const vp = ws.viewport
    const near = (q: Vec2) => {
      const a = vp.toScreen(q.x, q.y)
      return Math.hypot(a.x - p.sx, a.y - p.sy) < HIT
    }
    const hit = this.hitAnchor(p, near)
    if (hit) {
      if (!s.selectedShapes.includes(hit.shapeId)) selectShapes(s, [hit.shapeId])
      if (hit.part === 'p') {
        if (mods.shift && this.isAnchorSelected(hit.shapeId, hit.subpath, hit.index))
          this.anchorSel = this.anchorSel.filter(
            (a) =>
              !(a.shapeId === hit.shapeId && a.subpath === hit.subpath && a.index === hit.index)
          )
        else if (mods.shift) this.anchorSel.push({ ...hit })
        else if (!this.isAnchorSelected(hit.shapeId, hit.subpath, hit.index))
          this.anchorSel = [{ shapeId: hit.shapeId, subpath: hit.subpath, index: hit.index }]
      }
      const targets =
        hit.part === 'p'
          ? this.anchorSel
              .filter((a) => a.shapeId === hit.shapeId)
              .map((a) => ({ subpath: a.subpath, index: a.index, part: 'p' as const }))
          : [{ subpath: hit.subpath, index: hit.index, part: hit.part }]
      this.anchorDrag = {
        ad: new AnchorDrag(s, hit.shapeId, targets),
        x0: p.x,
        y0: p.y,
        started: false
      }
      return
    }
    const id = hitShape(s, p.x, p.y)
    this.anchorSel = []
    if (id) selectShapes(s, [id])
    else if (s.selectedShapes.length) selectShapes(s, [])
  }

  move(tool: string, p: Pointer, mods: Mods): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.gradDrag) {
      this.moveGradient(p)
      return
    }
    if (this.radiusDrag) {
      this.radiusDrag.moveTo(p.fx, p.fy, mods.alt)
      return
    }
    if (this.rotating) {
      const r = this.rotating
      let ang = Math.atan2(p.fy - r.rot.center.y, p.fx - r.rot.center.x) - r.start
      // Mayús: pasos de 15°
      if (mods.shift) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12)
      r.rot.rotateTo(ang)
      return
    }
    if (this.scaling) {
      this.scaleTo(p, mods)
      return
    }
    if (this.moving) {
      const m = this.moving
      if (!m.started && (p.x !== m.x0 || p.y !== m.y0)) m.started = true
      if (m.started) {
        let dx = p.x - m.x0
        let dy = p.y - m.y0
        const sn = this.snapMove(dx, dy)
        dx += sn.dx
        dy += sn.dy
        this.snapLines = sn.lines
        m.mv.moveBy(dx, dy)
      }
      return
    }
    if (this.anchorDrag) {
      const a = this.anchorDrag
      if (!a.started && (p.x !== a.x0 || p.y !== a.y0)) a.started = true
      if (a.started) a.ad.moveBy(p.x - a.x0, p.y - a.y0)
      return
    }
    if (this.pen?.dragging) {
      const a = this.pen.anchors[this.pen.anchors.length - 1]!
      const out = { x: p.x + 0.5, y: p.y + 0.5 }
      if (Math.hypot(out.x - a.p.x, out.y - a.p.y) >= 1) {
        a.out = out
        // Alt rompe la simetría: el tirador de entrada queda donde estaba, como en Illustrator.
        a.in = mods.alt ? a.in : { x: 2 * a.p.x - out.x, y: 2 * a.p.y - out.y }
        a.type = mods.alt ? 'smooth' : 'symmetric'
      }
      this.setPreview(ws, this.penShape())
      return
    }
    if (this.drag) {
      this.drag.x1 = p.x
      this.drag.y1 = p.y
      this.drag.mods = mods
      this.setPreview(ws, this.build(tool, this.drag))
    }
  }

  /** Escala la selección: el tirador sigue al cursor (con Mayús proporcional, Alt desde el centro). */
  private scaleTo(p: Pointer, mods: Mods): void {
    const sc = this.scaling!
    const { box, handle } = sc
    const [hx, hy] = handle
    const fixed: Vec2 = mods.alt
      ? { x: box.x + box.w / 2, y: box.y + box.h / 2 }
      : { x: box.x + (1 - hx) * box.w, y: box.y + (1 - hy) * box.h }
    const start: Vec2 = { x: box.x + hx * box.w, y: box.y + hy * box.h }
    const cx = Math.round(p.fx)
    const cy = Math.round(p.fy)
    const factor = (cur: number, st: number, fx: number) =>
      Math.abs(st - fx) < 1e-9 ? 1 : (cur - fx) / (st - fx)
    let sx = hx === 0.5 ? 1 : factor(cx, start.x, fixed.x)
    let sy = hy === 0.5 ? 1 : factor(cy, start.y, fixed.y)
    if (mods.shift) {
      if (hx === 0.5) sx = sy
      else if (hy === 0.5) sy = sx
      else {
        const k = Math.abs(sx) > Math.abs(sy) ? sx : sy
        sx = sy = k
      }
    }
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0) return
    sc.sc.scaleBy(fixed, sx, sy)
  }

  up(tool: string): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.gradDrag) {
      commitLiveEdit(ws.session, 'grad-tool')
      this.gradDrag = null
      return
    }
    if (this.radiusDrag) {
      this.radiusDrag.end()
      this.radiusDrag = null
      return
    }
    if (this.rotating) {
      this.rotating.rot.end()
      this.rotating = null
      return
    }
    if (this.scaling) {
      this.scaling.sc.end()
      this.scaling = null
      return
    }
    if (this.moving) {
      if (this.moving.started) this.moving.mv.end()
      else if (this.keyCandidate) {
        const ui = useUiStore()
        ui.keyShape = ui.keyShape === this.keyCandidate ? '' : this.keyCandidate
      }
      this.keyCandidate = null
      this.moving = null
      this.snapLines = []
      this.moveBounds = null
      return
    }
    if (this.anchorDrag) {
      if (this.anchorDrag.started) this.anchorDrag.ad.end()
      this.anchorDrag = null
      return
    }
    if (this.pen) {
      this.pen.dragging = false
      return
    }
    if (this.drag) {
      const shape = this.build(tool, this.drag)
      this.drag = null
      this.setPreview(ws, null)
      if (shape) addShape(ws.session, shape)
    }
  }

  // ---------- Pluma ----------

  /** Termina el trazado de la Pluma (Intro = abierto, clic en la primera ancla = cerrado). */
  finishPen(closed: boolean): void {
    const ws = this.getWs()
    const p = this.pen
    this.pen = null
    if (ws) this.setPreview(ws, null)
    if (!ws || !p || p.anchors.length < 2) return
    addShape(ws.session, makePath([{ closed, anchors: p.anchors }], currentAppearance(closed)))
  }

  cancelPen(): void {
    this.pen = null
    const w = this.getWs()
    if (w) this.setPreview(w, null)
  }

  cancel(): void {
    this.drag = null
    this.cancelPen()
    if (this.moving?.started) this.moving.mv.end()
    this.moving = null
    this.scaling?.sc.end()
    this.scaling = null
    this.rotating?.rot.end()
    this.rotating = null
    this.radiusDrag?.end()
    this.radiusDrag = null
    if (this.gradDrag) {
      const ws = this.getWs()
      if (ws) commitLiveEdit(ws.session, 'grad-tool')
      this.gradDrag = null
    }
    if (this.anchorDrag?.started) this.anchorDrag.ad.end()
    this.anchorDrag = null
  }

  hover(x: number, y: number, tool: string): void {
    const ws = this.getWs()
    this.hoverId =
      ws && ['sel', 'dsel', 'pen', 'addAnchor'].includes(tool) ? hitShape(ws.session, x, y) : null
  }

  /** Doble clic con V sobre un grupo: modo aislamiento. */
  doubleClick(x: number, y: number): void {
    const ws = this.getWs()
    if (!ws) return
    const s = ws.session
    if (s.isolatedGroup) return
    const id = hitShape(s, x, y)
    if (id && getShape(s, id)?.kind === 'group') isolateGroup(s, id)
  }

  convertSelectionToPath(): void {
    const ws = this.getWs()
    if (ws) convertToPath(ws.session, ws.session.selectedShapes)
  }

  // ---------- overlay ----------

  overlay(tool: string): {
    shapes: ShapeOverlay[]
    selBox: Box | null
    radiusWidget: Vec2 | null
    gradientBar: OverlayGradientBar | null
    snapLines: SnapLine[]
  } {
    const ws = this.getWs()
    if (!ws)
      return { shapes: [], selBox: null, radiusWidget: null, gradientBar: null, snapLines: [] }
    const s = ws.session
    const out: ShapeOverlay[] = []
    const direct =
      tool === 'dsel' || tool === 'addAnchor' || tool === 'delAnchor' || tool === 'convAnchor'
    // Recorre también los hijos de los grupos; las formas anidadas se dibujan en coordenadas de imagen.
    const visit = (layerColor: string, list: Shape[]): void => {
      for (const item of list) {
        if (item.kind === 'group') visit(layerColor, item.children)
        const selected = s.selectedShapes.includes(item.id)
        if (!selected && item.id !== this.hoverId) continue
        const sh = resolveShape(s, item.id) ?? item
        const entry: ShapeOverlay = {
          lines: shapeLines(sh),
          color: layerColor,
          thick: selected && s.selectedShapes.length > 1 && item.id === useUiStore().keyShape,
          box: null,
          anchors: [],
          selectedAnchors: [],
          handles: []
        }
        if (selected && sh.kind !== 'group' && (direct || sh.kind === 'path')) {
          const path = displayPath(sh)
          path.subpaths.forEach((sp, si) =>
            sp.anchors.forEach((a, i) => {
              const pt = apply(path.transform, a.p)
              const isSel = this.isAnchorSelected(sh.id, si, i)
              ;(isSel ? entry.selectedAnchors : entry.anchors).push(pt)
              // tiradores de las anclas seleccionadas y de sus vecinas
              if (direct && (isSel || this.neighbourSelected(sh.id, si, i, sp.anchors.length)))
                for (const part of ['in', 'out'] as const) {
                  const hp = a[part]
                  if (hp) entry.handles.push({ a: pt, b: apply(path.transform, hp) })
                }
            })
          )
        }
        out.push(entry)
      }
    }
    for (const layer of s.image.layers) if (layer.visible) visit(layer.color, layer.shapes)
    if (this.pen) {
      const shape = this.penShape()
      out.push({
        lines: shape ? shapeLines(shape) : [],
        color: '#3d8bff',
        box: null,
        anchors: this.pen.anchors.map((a) => a.p),
        selectedAnchors: [],
        handles: []
      })
    }
    const selBox = tool === 'sel' && s.selectedShapes.length ? shapesBox(s, s.selectedShapes) : null
    const rw = tool === 'sel' || tool === 'dsel' ? this.radiusWidget() : null
    return {
      shapes: out,
      selBox,
      radiusWidget: rw?.pos ?? null,
      gradientBar: this.gradientBar(tool),
      snapLines: this.snapLines
    }
  }

  // ---------- herramienta Degradado (G) ----------

  /** Forma, atributo y degradado sobre los que actúa la herramienta (forma única seleccionada). */
  private gradientTarget(): { sh: Shape; attr: Attr; grad: GradientPaint | null; T: Mat2D } | null {
    const ws = this.getWs()
    if (!ws || ws.session.selectedShapes.length !== 1) return null
    const sh = resolveShape(ws.session, ws.session.selectedShapes[0]!)
    if (!sh || sh.kind === 'group') return null
    const ui = useUiStore()
    let attr = findGradientAttr(sh, ui.activeAttr)
    // sin degradado ni atributo elegido: el relleno de más arriba, o el primer contorno
    if (!attr) {
      // los rellenos tienen prioridad sobre los contornos (como en Illustrator)
      const top = (list: Attr[]): Attr | null => {
        for (const id of [...sh.appearance.stack].reverse()) {
          const x = list.find((y) => y.id === id && y.enabled)
          if (x) return x
        }
        return null
      }
      attr = top(sh.appearance.fills) ?? top(sh.appearance.strokes)
    }
    if (!attr) return null
    return { sh, attr, grad: attr.paint.type === 'solid' ? null : attr.paint, T: sh.transform }
  }

  private gradientBar(tool: string): OverlayGradientBar | null {
    if (tool !== 'gradient') return null
    const t = this.gradientTarget()
    if (!t?.grad) return null
    const { grad, T } = t
    const from = apply(T, grad.from)
    const to = apply(T, grad.to)
    const ui = useUiStore()
    return {
      from,
      to,
      stops: sortedStops(grad.stops).map((s, i) => ({
        pos: { x: from.x + (to.x - from.x) * s.offset, y: from.y + (to.y - from.y) * s.offset },
        color: `rgba(${s.color.r},${s.color.g},${s.color.b},${s.color.a / 255})`,
        selected: i === ui.activeStop
      }))
    }
  }

  private gradStart: Vec2 = { x: 0, y: 0 }

  private downGradient(p: Pointer): void {
    const ws = this.getWs()
    const tg = this.gradientTarget()
    if (ws && !tg) {
      // sin forma seleccionada: un clic sobre una forma la selecciona
      const id = hitShape(ws.session, p.x, p.y)
      if (id) selectShapes(ws.session, [id])
      return
    }
    if (!ws || !tg) return
    const vp = ws.viewport
    const ui = useUiStore()
    ui.activeAttr = tg.attr.id
    const base = { shapeId: tg.sh.id, attrId: tg.attr.id, T: tg.T }
    const nearPt = (q: Vec2): boolean => {
      const a = vp.toScreen(q.x, q.y)
      return Math.hypot(a.x - p.sx, a.y - p.sy) < HIT + 2
    }
    if (tg.grad) {
      const from = apply(tg.T, tg.grad.from)
      const to = apply(tg.T, tg.grad.to)
      const stops = sortedStops(tg.grad.stops)
      // las paradas intermedias quedan encima de la línea; los extremos tienen prioridad
      if (nearPt(from)) {
        this.gradDrag = { kind: 'from', stopIndex: 0, ...base }
        return
      }
      if (nearPt(to)) {
        this.gradDrag = { kind: 'to', stopIndex: 0, ...base }
        return
      }
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i]!
        const pos = {
          x: from.x + (to.x - from.x) * s.offset,
          y: from.y + (to.y - from.y) * s.offset
        }
        if (nearPt(pos)) {
          ui.activeStop = i
          this.gradDrag = { kind: 'stop', stopIndex: i, ...base }
          return
        }
      }
    }
    // arrastrar en el vacío define un degradado nuevo: de aquí hasta donde se suelte
    this.gradDrag = { kind: 'new', stopIndex: 0, ...base }
    this.gradStart = { x: Math.round(p.fx), y: Math.round(p.fy) }
  }

  private moveGradient(p: Pointer): void {
    const ws = this.getWs()
    const d = this.gradDrag
    if (!ws || !d) return
    const ui = useUiStore()
    const inv = invert(d.T)
    if (!inv) return
    const img = { x: Math.round(p.fx), y: Math.round(p.fy) }
    const local = (q: Vec2): Vec2 => apply(inv, q)
    liveUpdateShape(ws.session, d.shapeId, 'grad-tool', t('gradient.edit'), (shape) => {
      const at = [...shape.appearance.fills, ...shape.appearance.strokes].find(
        (x) => x.id === d.attrId
      )
      if (!at) return
      if (d.kind === 'new') {
        if (img.x === this.gradStart.x && img.y === this.gradStart.y) return
        if (at.paint.type === 'solid') {
          const c = at.paint.color
          const light = c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 128
          const to = light ? { r: 0, g: 0, b: 0, a: 255 } : { r: 255, g: 255, b: 255, a: 255 }
          at.paint = defaultGradient(shape, 'linear', c, to)
        }
        at.paint.from = local(this.gradStart)
        at.paint.to = local(img)
        return
      }
      const g = at.paint
      if (g.type === 'solid') return
      if (d.kind === 'from') g.from = local(img)
      else if (d.kind === 'to') g.to = local(img)
      else {
        const a = apply(d.T, g.from)
        const b = apply(d.T, g.to)
        const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1
        const k = Math.min(
          1,
          Math.max(0, ((p.fx - a.x) * (b.x - a.x) + (p.fy - a.y) * (b.y - a.y)) / len2)
        )
        g.stops = sortedStops(g.stops)
        const stop = g.stops[d.stopIndex]
        if (!stop) return
        stop.offset = k
        g.stops = sortedStops(g.stops)
        d.stopIndex = g.stops.indexOf(stop)
        ui.activeStop = d.stopIndex
      }
    })
  }

  private neighbourSelected(id: ID, si: number, i: number, n: number): boolean {
    return (
      this.isAnchorSelected(id, si, (i + 1) % n) || this.isAnchorSelected(id, si, (i - 1 + n) % n)
    )
  }
}
