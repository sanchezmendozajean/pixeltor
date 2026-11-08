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
  AnchorPull,
  SegmentDrag,
  type SegmentHit,
  bakedPath,
  cutAtAnchors,
  joinAnchors,
  findSegment,
  replaceSubpath,
  reverseAnchors,
  hitSegment,
  ShapeMove,
  RectRadiusDrag,
  radiusHandleT,
  ShapeRotate,
  isolateGroup,
  resolveShape,
  computeSnap,
  shapeBounds,
  shapeTouchesRect,
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
  convertAnchors,
  anchorSides,
  setSingleHandle,
  convertToPath,
  deleteAnchor,
  deleteAnchors,
  getShape,
  hitShape,
  makeAppearance,
  makeEllipse,
  makeLine,
  makePath,
  makePolygon,
  makeRect,
  makeStar,
  multiply,
  selectShapes,
  shapeLines,
  shapesBox,
  toEditablePath
} from '@core/index'
import type { Workspace } from '@/session/workspace'
import { useColorsStore } from '@/stores/colors'
import { useDocumentsStore } from '@/stores/documents'
import { hexToRgba } from '@/stores/colorUtil'
import { useToolsStore } from '@/stores/tools'
import { t } from '@/i18n'
import type { CursorKind } from './cursors'
import { useUiStore } from '@/stores/ui'
import { findGradientAttr, type Attr } from './gradientTarget'
import type { OverlayState, ShapeOverlay } from '@/viewport/overlay'
import { edgeForPixel, handlePoint } from './boxHandles'

type RotateCorner = 'tl' | 'tr' | 'bl' | 'br'

const ANCHOR_TOOLS = new Set(['pen', 'addAnchor', 'delAnchor', 'convAnchor'])

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
  ctrl?: boolean
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

/** Los modos «degradado» de la barra de herramientas: la forma nueva lleva un degradado lineal. */
function withPaintModes(shape: Shape): Shape {
  const c = useColorsStore()
  if (!c.fillGradient && !c.strokeGradient) return shape
  const fill = rgba(hexToRgba(c.fill))
  const stroke = rgba(hexToRgba(c.stroke))
  const ap = shape.appearance
  const fills = ap.fills.map((f) =>
    c.fillGradient ? { ...f, paint: defaultGradient(shape, 'linear', fill, stroke) } : f
  )
  const strokes = ap.strokes.map((st) =>
    c.strokeGradient ? { ...st, paint: defaultGradient(shape, 'linear', stroke, fill) } : st
  )
  return { ...shape, appearance: { ...ap, fills, strokes } }
}

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

/**
 * Contorno que se dibuja de una forma seleccionada o bajo el cursor. Rectángulos y elipses se
 * dibujan por el centro de los píxeles de su borde (0,5 px hacia dentro), igual que los tiradores
 * de la caja, y no por la arista entre dos píxeles.
 */
function outlineLines(sh: Shape): ReturnType<typeof shapeLines> {
  // Se construye la forma encogida medio píxel (y no se desplaza su polígono, que en esquinas
  // redondeadas pequeñas deja picos hacia fuera). Con menos de 1,5 px se deja tal cual.
  if (sh.kind === 'rect' && sh.w >= 1.5 && sh.h >= 1.5)
    return shapeLines({
      ...sh,
      w: sh.w - 1,
      h: sh.h - 1,
      radius: sh.radius.map((r) => Math.max(0, r - 0.5)) as typeof sh.radius,
      transform: multiply(sh.transform, [1, 0, 0, 1, 0.5, 0.5])
    })
  if (sh.kind === 'ellipse' && sh.rx >= 0.75 && sh.ry >= 0.75)
    return shapeLines({ ...sh, rx: sh.rx - 0.5, ry: sh.ry - 0.5 })
  return shapeLines(sh)
}

/** Trazado visible de una forma: el suyo, o el equivalente si es paramétrica (solo para mostrar). */
function displayPath(sh: Shape): PathShape {
  if (sh.kind === 'group') return { ...sh, kind: 'path', subpaths: [], fillRule: 'nonzero' }
  return sh.kind === 'path' ? sh : toEditablePath(sh)
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
  /** Ctrl mantenido con Selección: se muestran anclas como en Selección directa. */
  private ctrlDirect = false
  /** Esquina cuya zona de rotación se usó por última vez (para el cursor). */
  private rotCorner: RotateCorner = 'tl'
  private moveBounds: { x: number; y: number; w: number; h: number } | null = null
  /** Líneas de ajuste visibles mientras se arrastra. */
  snapLines: SnapLine[] = []
  private radiusDrag: RectRadiusDrag | null = null
  private rotating: { rot: ShapeRotate; start: number } | null = null
  private anchorDrag: {
    ad: AnchorDrag
    x0: number
    y0: number
    started: boolean
    /** Posición de lienzo del ancla arrastrada (null si se arrastra un tirador). */
    pt0: Vec2 | null
    shapeId: ID
  } | null = null
  private pen: { anchors: Anchor[]; dragging: boolean; base: number } | null = null
  /** Punto bajo el cursor: la pluma dibuja un segmento provisional hasta él (como Illustrator). */
  private penHover: Vec2 | null = null
  /** La pluma continúa un trazado abierto existente (se sustituye al terminar). */
  private penCont: { shapeId: ID; subpath: number } | null = null
  /** Arrastre de un segmento para curvarlo (Selección directa). */
  private segDrag: {
    /** Se crea al empezar a arrastrar (un clic sin mover no deja pasos de historial). */
    sd: SegmentDrag | null
    sid: ID
    seg: SegmentHit
    fx0: number
    fy0: number
    sx: number
    sy: number
  } | null = null
  /** Anclas seleccionadas con la Selección directa. */
  private anchorList: AnchorSel[] = []
  /** Arrastre para sacar tiradores de un ancla (se crea al mover; sin mover, un clic convierte). */
  private pull: { ref: AnchorSel; sx: number; sy: number; pu: AnchorPull | null } | null = null

  private get anchorSel(): AnchorSel[] {
    // las anclas de formas que ya no están seleccionadas se descartan (no deben recibir Supr, etc.)
    const sel = this.getWs()?.session.selectedShapes ?? []
    if (this.anchorList.some((a) => !sel.includes(a.shapeId)))
      this.anchorSel = this.anchorList.filter((a) => sel.includes(a.shapeId))
    return this.anchorList
  }
  private set anchorSel(v: AnchorSel[]) {
    this.anchorList = v
    const ui = useUiStore()
    ui.anchorCount = v.length
    const ws = this.getWs()
    ui.anchorSides = ws ? anchorSides(ws.session, v) : { in: false, out: false }
  }
  /** Marco de selección de anclas (Selección directa en vacío). */
  /** Marco de selección de formas (herramienta V sobre el fondo), en px de imagen con decimales. */
  private shapeMarquee: { x0: number; y0: number; x1: number; y1: number; add: boolean } | null =
    null
  private anchorMarquee: { x0: number; y0: number; x1: number; y1: number; add: boolean } | null =
    null
  hoverId: string | null = null

  constructor(private readonly getWs: () => Workspace | null) {}

  /** Muestra la vista previa y publica su tamaño en píxeles para la barra de estado. */
  private setPreview(ws: Workspace, shape: Shape | null): void {
    if (shape) shape = withPaintModes(shape)
    ws.setPreview(shape)
    const b = shape
      ? pixelBounds(renderShapeRegion(shape, ws.session.image.width, ws.session.image.height))
      : null
    useDocumentsStore().drawingSize = b ? { w: b.w, h: b.h } : null
  }

  /** Hay anclas seleccionadas con la Selección directa. */
  get hasAnchorSelection(): boolean {
    return this.anchorSel.length > 0
  }

  /** Rectángulo (px de imagen) del marco de anclas en curso, para dibujarlo. */
  get anchorMarqueeRect(): { x: number; y: number; w: number; h: number } | null {
    const sm = this.shapeMarquee
    if (sm)
      return {
        x: Math.min(sm.x0, sm.x1),
        y: Math.min(sm.y0, sm.y1),
        w: Math.abs(sm.x1 - sm.x0),
        h: Math.abs(sm.y1 - sm.y0)
      }
    const m = this.anchorMarquee
    if (!m) return null
    const x = Math.min(m.x0, m.x1)
    const y = Math.min(m.y0, m.y1)
    return { x, y, w: Math.abs(m.x1 - m.x0) + 1, h: Math.abs(m.y1 - m.y0) + 1 }
  }

  /** Elimina las anclas seleccionadas (Supr con la Selección directa). */
  deleteSelectedAnchors(): boolean {
    const ws = this.getWs()
    if (!ws || !this.anchorSel.length) return false
    const ok = deleteAnchors(ws.session, this.anchorSel)
    this.anchorSel = []
    return ok
  }

  /** Convierte las anclas seleccionadas en suaves o en esquinas. */
  convertSelectedAnchors(smooth: boolean): boolean {
    const ws = this.getWs()
    return !!ws && convertAnchors(ws.session, this.anchorSel, smooth)
  }

  /** Deja un solo tirador (entrada o salida) en las anclas seleccionadas. */
  singleHandleSelected(side: 'in' | 'out'): boolean {
    const ws = this.getWs()
    return !!ws && setSingleHandle(ws.session, this.anchorSel, side)
  }

  /** Corta los trazados en las anclas seleccionadas (tijeras). */
  cutSelectedAnchors(): boolean {
    const ws = this.getWs()
    if (!ws || !this.anchorSel.length) return false
    const ok = cutAtAnchors(ws.session, this.anchorSel)
    this.anchorSel = []
    return ok
  }

  /** Une dos extremos seleccionados (Ctrl+J). */
  joinSelectedAnchors(): boolean {
    const ws = this.getWs()
    if (!ws) return false
    const ok = joinAnchors(ws.session, this.anchorSel)
    if (ok) this.anchorSel = []
    return ok
  }

  /**
   * Si el ancla es un extremo de un trazado abierto, la pluma lo continúa desde ahí
   * (el sentido se invierte si es el primero). Devuelve false si no es un extremo.
   */
  private continuePath(ref: AnchorSel): boolean {
    const ws = this.getWs()
    if (!ws) return false
    const sh = getShape(ws.session, ref.shapeId)
    if (!sh || sh.kind === 'group') return false
    const baked = bakedPath(sh)
    const sp = baked.subpaths[ref.subpath]
    if (!sp || sp.closed || sp.anchors.length < 1) return false
    const last = sp.anchors.length - 1
    if (ref.index !== 0 && ref.index !== last) return false
    const list = ref.index === last ? sp.anchors : reverseAnchors(sp.anchors)
    this.pen = { anchors: list.map((a) => ({ ...a })), dragging: false, base: list.length }
    this.penCont = { shapeId: ref.shapeId, subpath: ref.subpath }
    return true
  }

  /** Mueve las anclas seleccionadas (flechas del teclado). */
  nudgeAnchors(dx: number, dy: number): boolean {
    const ws = this.getWs()
    if (!ws || !this.anchorSel.length) return false
    const byShape = new Map<string, AnchorSel[]>()
    for (const a of this.anchorSel) byShape.set(a.shapeId, [...(byShape.get(a.shapeId) ?? []), a])
    for (const [id, list] of byShape) {
      const d = new AnchorDrag(
        ws.session,
        id,
        list.map((a) => ({ subpath: a.subpath, index: a.index, part: 'p' as const }))
      )
      d.moveBy(dx, dy)
      d.end()
    }
    return true
  }

  /** Posición de lienzo de cada ancla de las formas indicadas. */
  private anchorsOf(ids: ID[]): { ref: AnchorSel; pt: Vec2 }[] {
    const ws = this.getWs()
    if (!ws) return []
    const out: { ref: AnchorSel; pt: Vec2 }[] = []
    for (const id of ids) {
      const sh = getShape(ws.session, id)
      if (!sh || sh.kind === 'group') continue
      const path = displayPath(sh)
      path.subpaths.forEach((sp, si) =>
        sp.anchors.forEach((a, i) =>
          out.push({ ref: { shapeId: id, subpath: si, index: i }, pt: apply(path.transform, a.p) })
        )
      )
    }
    return out
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
    if (!this.pen) return null
    const anchors = [...this.pen.anchors]
    if (this.penHover && !this.pen.dragging && anchors.length)
      anchors.push({ p: this.penHover, in: null, out: null, type: 'corner' })
    if (anchors.length < 2) return null
    return makePath([{ closed: false, anchors }], currentAppearance(false))
  }

  /**
   * Deshacer con la pluma en curso: quita la última ancla puesta (y, si no queda ninguna nueva,
   * abandona el trazado). Devuelve false si no hay trazado en curso.
   */
  undoPen(): boolean {
    const p = this.pen
    if (!p) return false
    if (p.anchors.length > p.base && p.anchors.length > 1) {
      p.anchors.pop()
      const last = p.anchors[p.anchors.length - 1]!
      // el tirador de salida pertenecía al segmento que se quita
      if (p.anchors.length > p.base) {
        last.out = null
        if (!last.in) last.type = 'corner'
      }
      const ws = this.getWs()
      if (ws) this.setPreview(ws, this.penShape())
    } else this.cancelPen()
    return true
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
    // Ctrl con Selección, la pluma y compañeras = Selección directa temporal (como en Illustrator)
    if (tool === 'sel' && !mods.ctrl) return this.downSelect(p, mods)
    if (
      tool === 'dsel' ||
      (mods.ctrl && (tool === 'sel' || ANCHOR_TOOLS.has(tool)) && !this.penActive)
    )
      return this.downDirect(p, mods)
    if (tool === 'addAnchor') {
      const id = hitShape(s, p.x, p.y, 2) ?? s.selectedShapes.find((i) => getShape(s, i))
      if (id && addAnchorAt(s, id, p.fx, p.fy, 6 / vp.zoom + 1)) selectShapes(s, [id])
      return
    }
    if (tool === 'delAnchor' || tool === 'convAnchor') {
      const hit = this.hitAnchor(p, near)
      if (!hit || hit.part !== 'p') return
      if (tool === 'delAnchor') deleteAnchor(s, hit)
      // Convertir ancla: clic alterna esquina/suave; arrastrar saca los tiradores
      else this.pull = { ref: hit, sx: p.sx, sy: p.sy, pu: null }
      return
    }

    const layer = s.activeLayer
    if (layer.locked || !layer.visible) return
    if (tool === 'pen') {
      // Sobre un trazado seleccionado la pluma edita: clic en un segmento añade un ancla, clic en
      // un ancla la elimina (con Alt la convierte). Fuera de ellos empieza un trazado nuevo.
      if (!this.penActive && s.selectedShapes.length) {
        const hit = this.hitAnchor(p, near)
        if (hit && hit.part === 'p') {
          if (mods.alt) this.pull = { ref: hit, sx: p.sx, sy: p.sy, pu: null }
          else if (this.continuePath(hit)) this.setPreview(ws, this.penShape())
          else deleteAnchors(s, [hit])
          return
        }
        for (const id of s.selectedShapes)
          if (addAnchorAt(s, id, p.fx, p.fy, 6 / vp.zoom + 1)) return
      }
      const pt = { x: p.x + 0.5, y: p.y + 0.5 }
      this.pen ??= { anchors: [], dragging: false, base: 0 }
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
    const q0 = this.snapPt(p.x, p.y, [])
    this.drag = { x0: q0.x, y0: q0.y, x1: q0.x, y1: q0.y, mods }
    this.setPreview(ws, this.build(tool, this.drag))
  }

  /** ¿El puntero está sobre un tirador de la caja de selección (o su zona de rotación)? Manda sobre guías y ejes. */
  overSelectionControl(sx: number, sy: number): boolean {
    const ws = this.getWs()
    if (!ws) return false
    const pt = ws.viewport.toImage(sx, sy)
    const p: Pointer = { x: Math.floor(pt.x), y: Math.floor(pt.y), fx: pt.x, fy: pt.y, sx, sy }
    return !!this.hitBoxHandle(p) || !!this.rotateCorner(p)
  }

  /** Tiradores de la caja de selección bajo el cursor. */
  private hitBoxHandle(p: Pointer): { handle: [number, number]; box: Box } | null {
    const ws = this.getWs()
    if (!ws || !ws.session.selectedShapes.length) return null
    const box = shapesBox(ws.session, ws.session.selectedShapes)
    if (!box) return null
    const vp = ws.viewport
    for (const [hx, hy] of HANDLES) {
      const pt = handlePoint(box, hx, hy)
      const a = vp.toScreen(pt.x, pt.y)
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
    // parte a ~20 px de pantalla de la esquina con radio 0 y llega al borde del arco con el radio
    // máximo; libre (sin ajustar a píxeles) para que no se salga de formas pequeñas
    const d = radiusHandleT(sh.radius[0], Math.min(sh.w, sh.h) / 2, this.radiusOffset())
    return { id: sh.id, pos: apply(sh.transform, { x: d, y: d }) }
  }

  /**
   * Separación (en píxeles de imagen) entre la esquina y el tirador con radio 0: fija en la
   * imagen (1,25 px: fuera del píxel del borde, por donde va el contorno) para que el tirador esté
   * en el mismo sitio relativo a la forma a cualquier zoom; sólo con zoom bajo crece hasta que
   * queden 16 px de pantalla y no se pise con el tirador de la caja.
   */
  private radiusOffset(): number {
    const ws = this.getWs()
    return ws ? Math.max(1.25, 16 / ws.viewport.zoom) : 1.25
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
    return this.rotateCorner(p)?.box ?? null
  }

  /** Esquina de la caja de selección cuya zona de rotación está bajo el cursor. */
  private rotateCorner(p: Pointer): { box: Box; corner: RotateCorner } | null {
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
      const pt = handlePoint(box, hx, hy)
      const a = ws.viewport.toScreen(pt.x, pt.y)
      const d = Math.hypot(a.x - p.sx, a.y - p.sy)
      const outside = (hx === 0 ? p.sx < a.x : p.sx > a.x) || (hy === 0 ? p.sy < a.y : p.sy > a.y)
      if (d >= HIT && d <= 26 && outside) {
        const corner = (['tl', 'tr', 'bl', 'br'] as const)[hy * 2 + hx]!
        return { box, corner }
      }
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

  /** Ajusta un punto (esquina que se dibuja, tirador de escala, ancla) a lienzo, guías y objetos. */
  private snapPt(x: number, y: number, exclude: ID[]): { x: number; y: number } {
    const ws = this.getWs()
    const ui = useUiStore()
    if (!ws || (!ui.snap.canvas && !ui.snap.smart && !ui.snap.guides)) {
      this.snapLines = []
      return { x, y }
    }
    const r = computeSnap(
      ws.session,
      { x, y, w: 0, h: 0 },
      exclude,
      { canvas: ui.snap.canvas, objects: ui.snap.smart, guides: ui.snap.guides && ui.showGuides },
      4 / ws.viewport.zoom
    )
    this.snapLines = r.lines
    return { x: x + r.dx, y: y + r.dy }
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
    } else {
      // fondo: marco de selección (Mayús suma al conjunto actual)
      if (!mods.shift && s.selectedShapes.length) selectShapes(s, [])
      this.shapeMarquee = { x0: p.fx, y0: p.fy, x1: p.fx, y1: p.fy, add: mods.shift }
    }
  }

  /** Selecciona las formas visibles cuyos píxeles tocan el marco (con Mayús, suma a la selección). */
  private selectInMarquee(m: {
    x0: number
    y0: number
    x1: number
    y1: number
    add: boolean
  }): void {
    const ws = this.getWs()
    if (!ws) return
    const s = ws.session
    const x0 = Math.min(m.x0, m.x1)
    const x1 = Math.max(m.x0, m.x1)
    const y0 = Math.min(m.y0, m.y1)
    const y1 = Math.max(m.y0, m.y1)
    // un clic sin arrastrar sólo deselecciona (ya hecho al pulsar)
    if (x1 - x0 < 0.01 && y1 - y0 < 0.01) return
    const hit: ID[] = []
    for (const layer of s.image.layers) {
      if (!layer.visible || layer.locked) continue
      for (const sh of layer.shapes) {
        if (!sh.visible || sh.locked) continue
        const b = shapeBounds(s, sh.id)
        // primero la caja (barato) y luego los píxeles realmente pintados
        if (
          b &&
          b.x < x1 &&
          b.x + b.w > x0 &&
          b.y < y1 &&
          b.y + b.h > y0 &&
          shapeTouchesRect(s, sh.id, { x0, y0, x1, y1 })
        )
          hit.push(sh.id)
      }
    }
    if (!hit.length) return
    selectShapes(s, m.add ? [...new Set([...s.selectedShapes, ...hit])] : hit)
    // si ninguna está en la capa activa, pasa a serlo la de la última
    const onActive = s.activeLayer.shapes.some((x) => hit.includes(x.id))
    const owner = s.image.layers.find((l) => l.shapes.some((x) => x.id === hit[hit.length - 1]))
    if (!onActive && owner) s.setActiveLayer(owner.id)
  }

  /** Posición de lienzo de un ancla. */
  private anchorWorld(r: { shapeId: ID; subpath: number; index: number }): Vec2 | null {
    const sh = getShape(this.getWs()!.session, r.shapeId)
    if (!sh) return null
    const path = displayPath(sh)
    const a = path.subpaths[r.subpath]?.anchors[r.index]
    return a ? apply(path.transform, a.p) : null
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
            // mismos tiradores que se dibujan: los de las anclas seleccionadas y los de sus vecinas
            const visible =
              this.isAnchorSelected(id, si, i) || this.neighbourSelected(id, si, i, anchors.length)
            if (hp && visible && near(apply(path.transform, hp)))
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
    if (hit && hit.part === 'p' && mods.alt) {
      // Alt+clic: esquina ↔ suave; Alt+arrastrar: saca los tiradores
      if (!s.selectedShapes.includes(hit.shapeId)) selectShapes(s, [hit.shapeId])
      this.anchorSel = [{ shapeId: hit.shapeId, subpath: hit.subpath, index: hit.index }]
      this.pull = { ref: hit, sx: p.sx, sy: p.sy, pu: null }
      return
    }
    if (hit) {
      if (!s.selectedShapes.includes(hit.shapeId)) selectShapes(s, [hit.shapeId])
      if (hit.part === 'p') {
        if (mods.shift && this.isAnchorSelected(hit.shapeId, hit.subpath, hit.index))
          this.anchorSel = this.anchorSel.filter(
            (a) =>
              !(a.shapeId === hit.shapeId && a.subpath === hit.subpath && a.index === hit.index)
          )
        else if (mods.shift) this.anchorSel = [...this.anchorSel, { ...hit }]
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
        // Alt sobre un tirador: se mueve solo, sin arrastrar al opuesto
        ad: new AnchorDrag(s, hit.shapeId, targets, hit.part !== 'p' && !!mods.alt),
        x0: p.x,
        y0: p.y,
        started: false,
        pt0: hit.part === 'p' ? this.anchorWorld(hit) : null,
        shapeId: hit.shapeId
      }
      return
    }
    // clic sobre un segmento de una forma seleccionada: arrastrarlo lo curva
    if (!mods.shift) {
      for (const sid of s.selectedShapes) {
        const seg = findSegment(s, sid, p.fx, p.fy, 6 / vp.zoom + 1)
        if (seg) {
          this.segDrag = {
            sd: null,
            sid,
            seg,
            fx0: p.fx,
            fy0: p.fy,
            sx: p.sx,
            sy: p.sy
          }
          return
        }
      }
    }
    const id = hitShape(s, p.x, p.y)
    if (!mods.shift) this.anchorSel = []
    if (id) selectShapes(s, [id])
    else this.anchorMarquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: mods.shift }
  }

  move(tool: string, p: Pointer, mods: Mods): void {
    const ws = this.getWs()
    if (!ws) return
    if (this.gradDrag) {
      this.moveGradient(p)
      return
    }
    if (this.radiusDrag) {
      this.radiusDrag.moveTo(p.fx, p.fy, mods.alt, this.radiusOffset())
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
        m.mv.setCopy(!!mods.alt)
        if (mods.shift) {
          // Mayús: restringe a X, Y o diagonal de 45° (sin ajuste magnético)
          const ax = Math.abs(dx)
          const ay = Math.abs(dy)
          if (ax > ay * 2.414) dy = 0
          else if (ay > ax * 2.414) dx = 0
          else {
            const d = Math.round((ax + ay) / 2)
            dx = Math.sign(dx) * d
            dy = Math.sign(dy) * d
          }
          this.snapLines = []
        } else {
          const sn = this.snapMove(dx, dy)
          dx += sn.dx
          dy += sn.dy
          this.snapLines = sn.lines
        }
        m.mv.moveBy(dx, dy)
      }
      return
    }
    if (this.segDrag) {
      const g = this.segDrag
      if (!g.sd && Math.hypot(p.sx - g.sx, p.sy - g.sy) > 3)
        g.sd = new SegmentDrag(ws.session, g.sid, g.seg)
      g.sd?.moveBy(p.fx - g.fx0, p.fy - g.fy0)
      return
    }
    if (this.pull) {
      const pl = this.pull
      if (!pl.pu && Math.hypot(p.sx - pl.sx, p.sy - pl.sy) > 3)
        pl.pu = new AnchorPull(ws.session, pl.ref)
      pl.pu?.pullTo(p.fx, p.fy)
      return
    }
    if (this.shapeMarquee) {
      this.shapeMarquee.x1 = p.fx
      this.shapeMarquee.y1 = p.fy
      return
    }
    if (this.anchorMarquee) {
      this.anchorMarquee.x1 = p.x
      this.anchorMarquee.y1 = p.y
      return
    }
    if (this.anchorDrag) {
      const a = this.anchorDrag
      if (!a.started && (p.x !== a.x0 || p.y !== a.y0)) a.started = true
      if (a.started) {
        let dx = p.x - a.x0
        let dy = p.y - a.y0
        if (mods.shift) {
          // Mayús: restringe el desplazamiento a X, Y o diagonal de 45° (sin ajuste magnético)
          const ax = Math.abs(dx)
          const ay = Math.abs(dy)
          if (ax > ay * 2.414) dy = 0
          else if (ay > ax * 2.414) dx = 0
          else {
            const d = Math.round((ax + ay) / 2)
            dx = Math.sign(dx) * d
            dy = Math.sign(dy) * d
          }
          this.snapLines = []
        } else if (a.pt0) {
          // el ancla acaba en el centro de un píxel (lo garantiza AnchorDrag); el ajuste a guías y objetos parte de ahí
          const q = this.snapPt(Math.floor(a.pt0.x + dx) + 0.5, Math.floor(a.pt0.y + dy) + 0.5, [
            a.shapeId
          ])
          dx = q.x - a.pt0.x
          dy = q.y - a.pt0.y
        }
        a.ad.moveBy(dx, dy)
      }
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
      const q = this.snapPt(p.x, p.y, [])
      this.drag.x1 = q.x
      this.drag.y1 = q.y
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
    // el tirador queda sobre el píxel del cursor: la arista de la caja se lleva a ese píxel
    const q = this.snapPt(
      edgeForPixel(p.fx, hx),
      edgeForPixel(p.fy, hy),
      this.getWs()!.session.selectedShapes
    )
    const cx = q.x
    const cy = q.y
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
      this.snapLines = []
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
    if (this.segDrag) {
      const g = this.segDrag
      this.segDrag = null
      if (g.sd) g.sd.end()
      else {
        const id = hitShape(ws.session, g.fx0, g.fy0)
        if (id) selectShapes(ws.session, [id])
      }
      return
    }
    if (this.pull) {
      const pl = this.pull
      this.pull = null
      if (pl.pu) pl.pu.end()
      else {
        const a = displayPath(getShape(ws.session, pl.ref.shapeId)!).subpaths[pl.ref.subpath]!
          .anchors[pl.ref.index]!
        convertAnchors(ws.session, [pl.ref], !(a.in || a.out))
      }
      return
    }
    if (this.shapeMarquee) {
      const m = this.shapeMarquee
      this.shapeMarquee = null
      this.selectInMarquee(m)
      return
    }
    if (this.anchorMarquee) {
      const m = this.anchorMarquee
      this.anchorMarquee = null
      this.shapeMarquee = null
      const x0 = Math.min(m.x0, m.x1)
      const x1 = Math.max(m.x0, m.x1) + 1
      const y0 = Math.min(m.y0, m.y1)
      const y1 = Math.max(m.y0, m.y1) + 1
      const s = ws.session
      const scope = s.selectedShapes.length
        ? s.selectedShapes
        : s.activeLayer.shapes.filter((x) => x.visible && !x.locked).map((x) => x.id)
      const inside = this.anchorsOf(scope).filter(
        ({ pt }) => pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1
      )
      const picked = inside.map((i) => i.ref)
      this.anchorSel = m.add ? [...this.anchorSel, ...picked] : picked
      // el marco sobre formas no seleccionadas las selecciona
      const owners = [...new Set(picked.map((r) => r.shapeId))]
      if (owners.length && !owners.every((id) => s.selectedShapes.includes(id)))
        selectShapes(s, owners)
      else if (!owners.length && !m.add && s.selectedShapes.length) selectShapes(s, [])
      return
    }
    if (this.anchorDrag) {
      if (this.anchorDrag.started) this.anchorDrag.ad.end()
      this.anchorDrag = null
      this.snapLines = []
      return
    }
    if (this.pen) {
      this.pen.dragging = false
      return
    }
    if (this.drag) {
      const shape = this.build(tool, this.drag)
      this.drag = null
      this.snapLines = []
      this.setPreview(ws, null)
      if (shape) addShape(ws.session, withPaintModes(shape))
    }
  }

  // ---------- Pluma ----------

  /** Termina el trazado de la Pluma (Intro = abierto, clic en la primera ancla = cerrado). */
  finishPen(closed: boolean): void {
    const ws = this.getWs()
    const p = this.pen
    this.pen = null
    this.penHover = null
    if (ws) this.setPreview(ws, null)
    const cont = this.penCont
    this.penCont = null
    if (!ws || !p || p.anchors.length < 2) return
    if (cont) {
      replaceSubpath(ws.session, cont.shapeId, cont.subpath, p.anchors, closed)
      return
    }
    addShape(
      ws.session,
      withPaintModes(makePath([{ closed, anchors: p.anchors }], currentAppearance(closed)))
    )
  }

  cancelPen(): void {
    this.pen = null
    this.penHover = null
    this.penCont = null
    const w = this.getWs()
    if (w) this.setPreview(w, null)
  }

  cancel(): void {
    this.segDrag?.sd?.end()
    this.segDrag = null
    this.pull?.pu?.end()
    this.pull = null
    this.drag = null
    this.anchorMarquee = null
    this.snapLines = []
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

  /** Tipo de cursor para las herramientas de trazados según lo que hay bajo el puntero. */
  cursorHint(tool: string, p: Pointer, mods: Mods): CursorKind | null {
    const ws = this.getWs()
    if (!ws) return null
    const s = ws.session
    const vp = ws.viewport
    const near = (q: Vec2) => {
      const a = vp.toScreen(q.x, q.y)
      return Math.hypot(a.x - p.sx, a.y - p.sy) < HIT
    }
    const direct =
      tool === 'dsel' ||
      (!!mods.ctrl && (tool === 'sel' || ANCHOR_TOOLS.has(tool)) && !this.penActive)
    this.ctrlDirect = tool === 'sel' && direct
    // Selección: cursor de rotación en las zonas de rotación de la caja (y mientras se rota)
    if (tool === 'sel' && !direct) {
      if (this.rotating) return `rotate-${this.rotCorner}`
      if (!this.hitBoxHandle(p)) {
        const rz = this.rotateCorner(p)
        if (rz) {
          this.rotCorner = rz.corner
          return `rotate-${rz.corner}`
        }
      }
    }
    if (direct) {
      const hit = this.hitAnchor(p, near)
      if (!hit) return 'direct'
      if (mods.alt && hit.part === 'p') return 'pen-convert'
      return hit.part === 'p' ? 'direct-anchor' : 'direct-handle'
    }
    if (tool === 'addAnchor') return 'pen-plus'
    if (tool === 'delAnchor') return 'pen-minus'
    if (tool === 'convAnchor') return 'pen-convert'
    if (tool === 'pen') {
      if (this.penActive || !s.selectedShapes.length) return 'pen'
      const hit = this.hitAnchor(p, near)
      if (hit && hit.part === 'p') return mods.alt ? 'pen-convert' : 'pen-minus'
      if (s.selectedShapes.some((id) => hitSegment(s, id, p.fx, p.fy, 6 / vp.zoom + 1)))
        return 'pen-plus'
      return 'pen'
    }
    return null
  }

  hover(x: number, y: number, tool: string): void {
    const ws = this.getWs()
    if (ws && tool === 'pen' && this.pen?.anchors.length && !this.pen.dragging) {
      this.penHover = { x: x + 0.5, y: y + 0.5 }
      this.setPreview(ws, this.penShape())
    }
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
    const tempDirect = tool === 'sel' && this.ctrlDirect
    const direct =
      tempDirect ||
      tool === 'dsel' ||
      tool === 'addAnchor' ||
      tool === 'delAnchor' ||
      tool === 'convAnchor'
    // Recorre también los hijos de los grupos; las formas anidadas se dibujan en coordenadas de imagen.
    const visit = (layerColor: string, list: Shape[]): void => {
      for (const item of list) {
        if (item.kind === 'group') visit(layerColor, item.children)
        const selected = s.selectedShapes.includes(item.id)
        if (!selected && item.id !== this.hoverId) continue
        const sh = resolveShape(s, item.id) ?? item
        const entry: ShapeOverlay = {
          lines: outlineLines(sh),
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
              // (también con la Pluma, que edita anclas con Alt y al pulsarlas)
              if (
                (direct || tool === 'pen') &&
                (isSel || this.neighbourSelected(sh.id, si, i, sp.anchors.length))
              )
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
    const selBox =
      tool === 'sel' && !tempDirect && s.selectedShapes.length
        ? shapesBox(s, s.selectedShapes)
        : null
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
