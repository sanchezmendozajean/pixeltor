import type { Bitmap } from './bitmap'
import { PixelMask } from './mask'

export interface FloodOptions {
  /** 0..255, distancia máxima por canal. */
  tolerance: number
  contiguous: boolean
}

/** Máscara de los píxeles similares al de (sx,sy). Usada por el bote y la varita. */
export function selectSimilar(src: Bitmap, sx: number, sy: number, opt: FloodOptions): PixelMask {
  const { width: w, height: h, data } = src
  const mask = new PixelMask(w, h)
  if (!src.inBounds(sx, sy)) return mask
  const si = (sy * w + sx) * 4
  const r = data[si]!
  const g = data[si + 1]!
  const b = data[si + 2]!
  const a = data[si + 3]!
  const matches = (i: number): boolean =>
    // los píxeles totalmente transparentes son todos "iguales"
    a === 0
      ? data[i + 3] === 0
      : Math.max(
          Math.abs(data[i]! - r),
          Math.abs(data[i + 1]! - g),
          Math.abs(data[i + 2]! - b),
          Math.abs(data[i + 3]! - a)
        ) <= opt.tolerance

  if (!opt.contiguous) {
    for (let p = 0; p < w * h; p++) if (matches(p * 4)) mask.data[p] = 255
    return mask
  }
  const stack: number[] = [sy * w + sx]
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w
    const y = (p - x) / w
    if (mask.data[p] || !matches(p * 4)) continue
    let xl = x
    let xr = x
    while (xl > 0 && !mask.data[y * w + xl - 1] && matches((y * w + xl - 1) * 4)) xl--
    while (xr < w - 1 && !mask.data[y * w + xr + 1] && matches((y * w + xr + 1) * 4)) xr++
    for (let i = xl; i <= xr; i++) {
      mask.data[y * w + i] = 255
      if (y > 0 && !mask.data[(y - 1) * w + i]) stack.push((y - 1) * w + i)
      if (y < h - 1 && !mask.data[(y + 1) * w + i]) stack.push((y + 1) * w + i)
    }
  }
  return mask
}
