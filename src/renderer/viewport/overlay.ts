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

export interface OverlayState {
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
