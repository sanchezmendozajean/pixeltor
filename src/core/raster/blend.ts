import type { BlendMode } from '../model/types'
import type { Bitmap, Rect } from './bitmap'

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
  const D = dst.data
  const S = src.data
  const w = dst.width
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * w + x) * 4
      const sa = (S[i + 3]! / 255) * opacity
      if (sa <= 0) continue
      const ba = D[i + 3]! / 255
      const ra = sa + ba * (1 - sa)
      if (mode === 'normal' && ba === 0) {
        D[i] = S[i]!
        D[i + 1] = S[i + 1]!
        D[i + 2] = S[i + 2]!
        D[i + 3] = Math.round(sa * 255)
        continue
      }
      for (let c = 0; c < 3; c++) {
        const cs = S[i + c]! / 255
        const cb = D[i + c]! / 255
        const mixed = ba === 0 ? cs : (1 - ba) * cs + ba * blendChannel(mode, cb, cs)
        const out = ((1 - sa) * ba * cb + sa * mixed) / ra
        D[i + c] = Math.round(out * 255)
      }
      D[i + 3] = Math.round(ra * 255)
    }
  }
}
