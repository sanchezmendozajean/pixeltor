// Herramientas vectoriales: formas paramétricas, Pluma, Selección (V), Selección directa (A)
// y herramientas de anclas. Crear/editar una forma = un comando; durante el arrastre solo hay
// vista previa o edición transitoria dentro de una Transaction.

import {
  type Anchor,
  type AnchorPart,
  type Appearance,
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
import type { ShapeOverlay } from '@/viewport/overlay'

export const SHAPE_TOOLS = new Set([
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

export class ShapeTools {
  private drag: { x0: number; y0: number; x1: number; y1: number; mods: Mods } | null = null
  private moving: { mv: ShapeMove; x0: number; y0: number; started: boolean } | null = null
  private scaling: {
    sc: ShapeScale
    handle: [number, number]
    box: Box
    mods: Mods
  } | null = null
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
      if (mods.shift) selectShapes(s, cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id])
      else if (!cur.includes(id)) selectShapes(s, [id])
      const layer = s.image.layers.find((l) => l.shapes.some((sh) => sh.id === id))
      if (layer && layer.id !== s.activeLayerId) s.setActiveLayer(layer.id)
      this.moving = { mv: new ShapeMove(s, s.selectedShapes), x0: p.x, y0: p.y, started: false }
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
      if (m.started) m.mv.moveBy(p.x - m.x0, p.y - m.y0)
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
      this.moving = null
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
  } {
    const ws = this.getWs()
    if (!ws) return { shapes: [], selBox: null, radiusWidget: null }
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
    return { shapes: out, selBox, radiusWidget: rw?.pos ?? null }
  }

  private neighbourSelected(id: ID, si: number, i: number, n: number): boolean {
    return (
      this.isAnchorSelected(id, si, (i + 1) % n) || this.isAnchorSelected(id, si, (i - 1 + n) % n)
    )
  }
}
