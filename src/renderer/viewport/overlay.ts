// Overlay 2D de un visor: hormigas en marcha, marco en construcción y cursor de pincel.
// Es UI (no imagen), así que se dibuja en espacio de pantalla con Canvas2D.

import type { PixelMask, Rect } from '@core/index'
import type { Viewport } from './Viewport'

const edgeCache = new WeakMap<PixelMask, Path2D>()

/** Contorno de la máscara en coordenadas de imagen (segmentos alineados a la rejilla). */
function maskPath(mask: PixelMask): Path2D {
  const hit = edgeCache.get(mask)
  if (hit) return hit
  const p = new Path2D()
  const { width: w, height: h } = mask
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask.data[y * w + x] !== 0
  for (let y = 0; y <= h; y++) {
    let start = -1
    let kind = 0 // 1 = borde superior de un píxel, 2 = borde inferior
    for (let x = 0; x <= w; x++) {
      const above = at(x, y - 1)
      const below = at(x, y)
      const k = x < w ? (below && !above ? 1 : above && !below ? 2 : 0) : 0
      if (k !== kind) {
        if (kind) {
          p.moveTo(start, y)
          p.lineTo(x, y)
        }
        start = x
        kind = k
      }
    }
  }
  for (let x = 0; x <= w; x++) {
    let start = -1
    let kind = 0
    for (let y = 0; y <= h; y++) {
      const left = at(x - 1, y)
      const right = at(x, y)
      const k = y < h ? (right && !left ? 1 : left && !right ? 2 : 0) : 0
      if (k !== kind) {
        if (kind) {
          p.moveTo(x, start)
          p.lineTo(x, y)
        }
        start = y
        kind = k
      }
    }
  }
  edgeCache.set(mask, p)
  return p
}

export interface ShapeOverlay {
  lines: { pts: { x: number; y: number }[]; closed: boolean }[]
  /** Color de la capa (specs/05). */
  color: string
  /** Caja delimitadora con tiradores (forma seleccionada). */
  box: Rect | null
  /** Objeto clave del panel Alinear: se dibuja con trazo grueso. */
  thick?: boolean
  anchors: { x: number; y: number }[]
  selectedAnchors: { x: number; y: number }[]
  handles: { a: { x: number; y: number }; b: { x: number; y: number } }[]
}

export interface OverlayState {
  shapes?: ShapeOverlay[]
  /** Guías del lienzo (px de imagen). */
  guides?: { axis: 'h' | 'v'; pos: number }[]
  /** Líneas de ajuste temporales (guías inteligentes) en coordenadas de imagen. */
  snapLines?: { axis: 'v' | 'h'; pos: number; from: number; to: number; kind: string }[]
  /** Anotador del degradado de la herramienta G (coordenadas de imagen). */
  gradientBar?: {
    from: { x: number; y: number }
    to: { x: number; y: number }
    stops: { pos: { x: number; y: number }; color: string; selected: boolean }[]
  } | null
  /** Caja de la selección con tiradores de escala (herramienta V). */
  selBox?: Rect | null
  /** Widget de radio de esquina (círculo interior), en coordenadas de imagen. */
  radiusWidget?: { x: number; y: number } | null
  mask: PixelMask | null
  marquee: Rect | null
  /** Píxel bajo el cursor y los desplazamientos de la punta (para el cursor exacto en zoom alto). */
  cursor: { x: number; y: number; offsets: [number, number][]; blocked: boolean } | null
  dashOffset: number
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  st: OverlayState,
  dpr: number
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, vp.width, vp.height)

  const withImageSpace = (fn: () => void) => {
    ctx.save()
    ctx.translate(vp.panX, vp.panY)
    ctx.scale(vp.zoom, vp.zoom)
    fn()
    ctx.restore()
  }

  for (const g of st.guides ?? []) {
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.strokeStyle = '#2fd3e0'
    ctx.beginPath()
    if (g.axis === 'v') {
      const x = Math.round(vp.toScreen(g.pos, 0).x) + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, vp.height)
    } else {
      const y = Math.round(vp.toScreen(0, g.pos).y) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(vp.width, y)
    }
    ctx.stroke()
  }

  for (const l of st.snapLines ?? []) {
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.strokeStyle = l.kind === 'guide' ? '#2fd3e0' : '#ff2bd6'
    ctx.beginPath()
    if (l.axis === 'v') {
      const a = vp.toScreen(l.pos, l.from)
      const b = vp.toScreen(l.pos, l.to)
      ctx.moveTo(Math.round(a.x) + 0.5, a.y - 6)
      ctx.lineTo(Math.round(b.x) + 0.5, b.y + 6)
    } else {
      const a = vp.toScreen(l.from, l.pos)
      const b = vp.toScreen(l.to, l.pos)
      ctx.moveTo(a.x - 6, Math.round(a.y) + 0.5)
      ctx.lineTo(b.x + 6, Math.round(b.y) + 0.5)
    }
    ctx.stroke()
  }

  for (const sh of st.shapes ?? []) {
    withImageSpace(() => {
      ctx.lineWidth = (sh.thick ? 3 : 1) / vp.zoom
      ctx.setLineDash([])
      ctx.strokeStyle = sh.color
      for (const l of sh.lines) {
        if (!l.pts.length) continue
        ctx.beginPath()
        ctx.moveTo(l.pts[0]!.x, l.pts[0]!.y)
        for (const p of l.pts.slice(1)) ctx.lineTo(p.x, p.y)
        if (l.closed) ctx.closePath()
        ctx.stroke()
      }
    })
    ctx.strokeStyle = sh.color
    ctx.fillStyle = '#fff'
    ctx.lineWidth = 1
    if (sh.box) {
      const a = vp.toScreen(sh.box.x, sh.box.y)
      const w = sh.box.w * vp.zoom
      const h = sh.box.h * vp.zoom
      ctx.strokeRect(a.x + 0.5, a.y + 0.5, w, h)
      for (const [hx, hy] of [
        [0, 0],
        [0.5, 0],
        [1, 0],
        [0, 0.5],
        [1, 0.5],
        [0, 1],
        [0.5, 1],
        [1, 1]
      ] as const) {
        ctx.fillRect(a.x + hx * w - 2, a.y + hy * h - 2, 5, 5)
        ctx.strokeRect(a.x + hx * w - 2.5, a.y + hy * h - 2.5, 5, 5)
      }
    }
    for (const hd of sh.handles) {
      const a = vp.toScreen(hd.a.x, hd.a.y)
      const b = vp.toScreen(hd.b.x, hd.b.y)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    for (const p of sh.anchors) {
      const q = vp.toScreen(p.x, p.y)
      ctx.fillStyle = '#fff'
      ctx.fillRect(q.x - 2.5, q.y - 2.5, 5, 5)
      ctx.strokeRect(q.x - 2.5, q.y - 2.5, 5, 5)
    }
    for (const p of sh.selectedAnchors) {
      const q = vp.toScreen(p.x, p.y)
      ctx.fillStyle = sh.color
      ctx.fillRect(q.x - 3, q.y - 3, 7, 7)
    }
  }

  if (st.gradientBar) {
    const g = st.gradientBar
    const a = vp.toScreen(g.from.x, g.from.y)
    const b = vp.toScreen(g.to.x, g.to.y)
    ctx.setLineDash([])
    // trazo doble (oscuro + claro) para que se vea sobre cualquier color
    for (const [w, c] of [
      [3, '#000'],
      [1, '#fff']
    ] as const) {
      ctx.lineWidth = w
      ctx.strokeStyle = c
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    for (const p of [a, b]) {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    for (const s of g.stops) {
      const q = vp.toScreen(s.pos.x, s.pos.y)
      ctx.fillStyle = s.color
      ctx.strokeStyle = s.selected ? '#3d8bff' : '#fff'
      ctx.lineWidth = s.selected ? 3 : 2
      ctx.beginPath()
      ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  if (st.radiusWidget) {
    const q = vp.toScreen(st.radiusWidget.x, st.radiusWidget.y)
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#3d8bff'
    ctx.beginPath()
    ctx.arc(q.x, q.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  if (st.selBox) {
    const b = st.selBox
    const a = vp.toScreen(b.x, b.y)
    const w = b.w * vp.zoom
    const h = b.h * vp.zoom
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.strokeStyle = '#3d8bff'
    ctx.fillStyle = '#fff'
    ctx.strokeRect(a.x + 0.5, a.y + 0.5, w, h)
    for (const [hx, hy] of [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [0, 0.5],
      [1, 0.5],
      [0, 1],
      [0.5, 1],
      [1, 1]
    ] as const) {
      ctx.fillRect(a.x + hx * w - 2.5, a.y + hy * h - 2.5, 6, 6)
      ctx.strokeRect(a.x + hx * w - 2.5, a.y + hy * h - 2.5, 6, 6)
    }
  }

  if (st.mask) {
    const path = maskPath(st.mask)
    withImageSpace(() => {
      ctx.lineWidth = 1 / vp.zoom
      ctx.setLineDash([4 / vp.zoom, 4 / vp.zoom])
      ctx.strokeStyle = '#000'
      ctx.lineDashOffset = st.dashOffset / vp.zoom
      ctx.stroke(path)
      ctx.strokeStyle = '#fff'
      ctx.lineDashOffset = (st.dashOffset + 4) / vp.zoom
      ctx.stroke(path)
    })
  }

  if (st.marquee) {
    const m = st.marquee
    withImageSpace(() => {
      ctx.lineWidth = 1 / vp.zoom
      ctx.setLineDash([4 / vp.zoom, 4 / vp.zoom])
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(m.x, m.y, m.w, m.h)
      ctx.strokeStyle = '#000'
      ctx.lineDashOffset = 4 / vp.zoom
      ctx.strokeRect(m.x, m.y, m.w, m.h)
    })
  }

  const c = st.cursor
  if (c && vp.zoom >= 4) {
    withImageSpace(() => {
      ctx.lineWidth = 1 / vp.zoom
      ctx.setLineDash([])
      ctx.strokeStyle = c.blocked ? '#ff5555' : '#fff'
      ctx.globalCompositeOperation = 'difference'
      for (const [ox, oy] of c.offsets) ctx.strokeRect(c.x + ox, c.y + oy, 1, 1)
    })
  }
}
