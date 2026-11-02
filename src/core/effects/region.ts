// Región de píxeles RGBA con origen en coordenadas de imagen. Fuera de la región todo es transparente.

import { Bitmap, type Rect } from '../raster/bitmap'

export interface Region {
  rect: Rect
  data: Uint8ClampedArray
}

export const makeRegion = (rect: Rect): Region => ({
  rect: { ...rect },
  data: new Uint8ClampedArray(Math.max(0, rect.w * rect.h * 4))
})

export function regionFromBitmap(b: Bitmap, x = 0, y = 0): Region {
  return { rect: { x, y, w: b.width, h: b.height }, data: b.data }
}

export function expandRect(r: Rect, n: number): Rect {
  return { x: r.x - n, y: r.y - n, w: r.w + 2 * n, h: r.h + 2 * n }
}

/** Intersección de dos rectángulos (w o h ≤ 0 si no se tocan). */
export function intersectRect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return {
    x,
    y,
    w: Math.min(a.x + a.w, b.x + b.w) - x,
    h: Math.min(a.y + a.h, b.y + b.h) - y
  }
}

/** Índice del píxel (x, y) de imagen dentro de la región, o -1 si queda fuera. */
export function regionIndex(r: Region, x: number, y: number): number {
  const lx = x - r.rect.x
  const ly = y - r.rect.y
  if (lx < 0 || ly < 0 || lx >= r.rect.w || ly >= r.rect.h) return -1
  return (ly * r.rect.w + lx) * 4
}

export function regionAlpha(r: Region, x: number, y: number): number {
  const i = regionIndex(r, x, y)
  return i < 0 ? 0 : r.data[i + 3]!
}

/** Recorta la región a `rect` (lo que quede fuera es transparente). */
export function cropRegion(src: Region, rect: Rect): Region {
  const out = makeRegion(rect)
  const x0 = Math.max(rect.x, src.rect.x)
  const x1 = Math.min(rect.x + rect.w, src.rect.x + src.rect.w)
  if (x1 <= x0) return out
  for (
    let y = Math.max(rect.y, src.rect.y);
    y < Math.min(rect.y + rect.h, src.rect.y + src.rect.h);
    y++
  ) {
    const s = ((y - src.rect.y) * src.rect.w + (x0 - src.rect.x)) * 4
    out.data.set(
      src.data.subarray(s, s + (x1 - x0) * 4),
      ((y - rect.y) * rect.w + (x0 - rect.x)) * 4
    )
  }
  return out
}
