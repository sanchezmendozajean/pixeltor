import type { BlendMode } from '../model/types'
import { Bitmap, type Rect } from './bitmap'

// Fórmulas de W3C Compositing and Blending Level 1, en coma flotante (Float64: determinista
// en cualquier plataforma porque solo usa + − × ÷ y Math.round).

function blendChannel(mode: BlendMode, cb: number, cs: number): number {
  switch (mode) {
    case 'multiply':
      return cb * cs
    case 'screen':
      return cb + cs - cb * cs
    case 'overlay':
      return cb <= 0.5 ? 2 * cb * cs : 1 - 2 * (1 - cb) * (1 - cs)
    case 'darken':
      return Math.min(cb, cs)
    case 'lighten':
      return Math.max(cb, cs)
    case 'add':
      return Math.min(1, cb + cs)
    case 'subtract':
      return Math.max(0, cb - cs)
    case 'difference':
      return Math.abs(cb - cs)
    default:
      return cs
  }
}

/** Compone el píxel de `S` en `si` sobre el de `D` en `di` (índices de byte). */
function blendPixel(
  D: Uint8ClampedArray,
  di: number,
  S: Uint8ClampedArray,
  si: number,
  mode: BlendMode,
  opacity: number
): void {
  const sa = (S[si + 3]! / 255) * opacity
  if (sa <= 0) return
  const ba = D[di + 3]! / 255
  const ra = sa + ba * (1 - sa)
  if (mode === 'normal' && ba === 0) {
    D[di] = S[si]!
    D[di + 1] = S[si + 1]!
    D[di + 2] = S[si + 2]!
    D[di + 3] = Math.round(sa * 255)
    return
  }
  for (let c = 0; c < 3; c++) {
    const cs = S[si + c]! / 255
    const cb = D[di + c]! / 255
    const mixed = ba === 0 ? cs : (1 - ba) * cs + ba * blendChannel(mode, cb, cs)
    const out = ((1 - sa) * ba * cb + sa * mixed) / ra
    D[di + c] = Math.round(out * 255)
  }
  D[di + 3] = Math.round(ra * 255)
}

/**
 * Compone `src` sobre `dst` (modifica `dst`) en `rect` (coordenadas de ambos, mismo tamaño).
 * `opacity` 0..1 multiplica el alfa de origen.
 */
export function compositeOver(
  dst: Bitmap,
  src: Bitmap,
  mode: BlendMode,
  opacity: number,
  rect?: Rect
): void {
  const r = rect ?? { x: 0, y: 0, w: dst.width, h: dst.height }
  const w = dst.width
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * w + x) * 4
      const a = src.data[i + 3]!
      if (a === 0) continue
      if (a === 255 && opacity === 1 && mode === 'normal') {
        // opaco: sustituye al destino sin aritmética de coma flotante
        dst.data[i] = src.data[i]!
        dst.data[i + 1] = src.data[i + 1]!
        dst.data[i + 2] = src.data[i + 2]!
        dst.data[i + 3] = 255
        continue
      }
      blendPixel(dst.data, i, src.data, i, mode, opacity)
    }
}

/** Como `compositeOver`, con `src` más pequeño colocado en (ox, oy) de `dst`. */
export function compositeAt(
  dst: Bitmap,
  src: Bitmap,
  ox: number,
  oy: number,
  mode: BlendMode,
  opacity: number,
  rect?: Rect
): void {
  const r = rect ?? { x: 0, y: 0, w: dst.width, h: dst.height }
  const x0 = Math.max(r.x, ox)
  const y0 = Math.max(r.y, oy)
  const x1 = Math.min(r.x + r.w, ox + src.width)
  const y1 = Math.min(r.y + r.h, oy + src.height)
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      blendPixel(
        dst.data,
        (y * dst.width + x) * 4,
        src.data,
        ((y - oy) * src.width + (x - ox)) * 4,
        mode,
        opacity
      )
}
