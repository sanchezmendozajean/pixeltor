import type { Bitmap, Rect } from './bitmap'
import type { PixelMask } from './mask'

/** Bresenham: puntos enteros entre (x0,y0) y (x1,y1), ambos incluidos. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    pts.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return pts
}

/**
 * Pixel-perfect (como Aseprite): elimina el píxel central de cada esquina en "L"
 * de una polilínea de 1 px. Devuelve una lista nueva.
 */
export function pixelPerfect(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts.slice()
  const out: [number, number][] = [pts[0]!]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = out[out.length - 1]!
    const c = pts[i]!
    const n = pts[i + 1]!
    const diagonal = Math.abs(p[0] - n[0]) === 1 && Math.abs(p[1] - n[1]) === 1
    const isL = (c[0] === p[0] && c[1] === n[1]) || (c[1] === p[1] && c[0] === n[0])
    if (!(diagonal && isL)) out.push(c)
  }
  out.push(pts[pts.length - 1]!)
  return out
}

/** Desplazamientos de la punta del pincel respecto al píxel central. */
export function brushOffsets(size: number, shape: 'square' | 'round'): [number, number][] {
  const s = Math.max(1, Math.round(size))
  const off: [number, number][] = []
  const lo = -Math.floor((s - 1) / 2)
  const c = (s - 1) / 2
  const r = s / 2
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      if (shape === 'round' && s > 2) {
        const dx = i - c
        const dy = j - c
        if (dx * dx + dy * dy > r * r - 0.25) continue
      }
      off.push([lo + i, lo + j])
    }
  }
  return off
}

export interface PaintTarget {
  bitmap: Bitmap
  /** Si no es null, solo se pinta dentro de la selección. */
  mask: PixelMask | null
  lockAlpha: boolean
}

/** Pone un píxel respetando máscara y bloqueo de transparencia. Devuelve true si cambió. */
export function putPixel(
  t: PaintTarget,
  x: number,
  y: number,
  color: number,
  erase = false
): boolean {
  const b = t.bitmap
  if (!b.inBounds(x, y)) return false
  if (t.mask && !t.mask.has(x, y)) return false
  const cur = b.get(x, y)
  if (erase) {
    if (t.lockAlpha || (cur & 255) === 0) return false
    b.set(x, y, 0)
    return true
  }
  if (t.lockAlpha && (cur & 255) === 0) return false
  const next = t.lockAlpha ? ((color & 0xffffff00) | (cur & 255)) >>> 0 : color
  if (cur === next) return false
  b.set(x, y, next)
  return true
}

export class DirtyTracker {
  rect: Rect | null = null
  add(x: number, y: number): void {
    const r = this.rect
    if (!r) {
      this.rect = { x, y, w: 1, h: 1 }
      return
    }
    const x1 = Math.max(r.x + r.w, x + 1)
    const y1 = Math.max(r.y + r.h, y + 1)
    r.x = Math.min(r.x, x)
    r.y = Math.min(r.y, y)
    r.w = x1 - r.x
    r.h = y1 - r.y
  }
}

export function stampBrush(
  t: PaintTarget,
  cx: number,
  cy: number,
  offsets: [number, number][],
  color: number,
  erase: boolean,
  dirty: DirtyTracker
): void {
  for (const [ox, oy] of offsets) {
    if (putPixel(t, cx + ox, cy + oy, color, erase)) dirty.add(cx + ox, cy + oy)
  }
}
