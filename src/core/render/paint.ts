// Evaluación de pinturas (specs/12): degradados con modos de píxel deterministas.
// Los patrones de tramado se anclan a coordenadas de IMAGEN, no de la forma, para que dos
// formas adyacentes casen y el resultado sea idéntico en cualquier plataforma.

import { invert } from '../geometry/geometry'
import type { DitherMatrix, GradientPaint, GradientStop, Mat2D, Vec2 } from '../model/shapes'
import type { RGBA } from '../model/types'

const BAYER2 = [0, 2, 3, 1]
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function bayer(n: number): number[] {
  if (n === 2) return BAYER2
  if (n === 4) return BAYER4
  // 8×8 por recursión de la matriz de Bayer
  const prev = bayer(n / 2)
  const h = n / 2
  const out = new Array<number>(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      out[y * n + x] =
        4 * prev[(y % h) * h + (x % h)]! + [0, 2, 3, 1][(y >= h ? 2 : 0) + (x >= h ? 1 : 0)]!
  return out
}

const BAYER8 = bayer(8)

/** Umbral 0..1 (exclusivo de 1) de la matriz en el píxel de imagen (x, y). */
export function ditherThreshold(m: DitherMatrix, x: number, y: number): number {
  switch (m) {
    case 'bayer2':
      return (BAYER2[(y & 1) * 2 + (x & 1)]! + 0.5) / 4
    case 'bayer4':
      return (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16
    case 'bayer8':
      return (BAYER8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64
    case 'checker':
      return ((x + y) & 1) === 0 ? 0.25 : 0.75
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Color del degradado continuo en t (0..1). Las paradas se interpolan en RGBA sin premultiplicar. */
export function colorAt(stops: readonly GradientStop[], t: number): RGBA {
  if (!stops.length) return { r: 0, g: 0, b: 0, a: 0 }
  if (stops.length === 1 || t <= stops[0]!.offset) return stops[0]!.color
  const last = stops[stops.length - 1]!
  if (t >= last.offset) return last.color
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i]!
    if (t <= b.offset) {
      const a = stops[i - 1]!
      const span = b.offset - a.offset
      let k = span <= 1e-9 ? 1 : (t - a.offset) / span
      // Punto medio: se remodela el tramo para que `mid` caiga en el 50 % del color.
      const mid = a.mid ?? 0.5
      if (mid !== 0.5 && k > 0 && k < 1)
        k = Math.pow(k, Math.log(0.5) / Math.log(Math.min(0.99, Math.max(0.01, mid))))
      const mix = (p: number, q: number) => Math.round(p + (q - p) * k)
      return {
        r: mix(a.color.r, b.color.r),
        g: mix(a.color.g, b.color.g),
        b: mix(a.color.b, b.color.b),
        a: mix(a.color.a, b.color.a)
      }
    }
  }
  return last.color
}

export function sortedStops(stops: readonly GradientStop[]): GradientStop[] {
  return [...stops].sort((p, q) => p.offset - q.offset)
}

function nearest(colors: readonly RGBA[], c: RGBA): RGBA {
  let best = colors[0]!
  let bd = Infinity
  for (const p of colors) {
    const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2 + (p.a - c.a) ** 2
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

/** Parámetro t del degradado para un punto en coordenadas locales de la forma. */
export function gradientT(g: GradientPaint, p: Vec2): number {
  const dx = g.to.x - g.from.x
  const dy = g.to.y - g.from.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return 0
  const px = p.x - g.from.x
  const py = p.y - g.from.y
  switch (g.type) {
    case 'linear':
      return clamp01((px * dx + py * dy) / len2)
    case 'radial':
      return clamp01(Math.sqrt((px * px + py * py) / len2))
    case 'angular': {
      const a = Math.atan2(py, px) - Math.atan2(dy, dx)
      const turn = a / (Math.PI * 2)
      return turn - Math.floor(turn)
    }
  }
}

/**
 * Evaluador del degradado para píxeles de imagen. `transform` es local → imagen de la forma.
 * Devuelve una función (x, y) → RGBA para el centro del píxel (x + 0.5, y + 0.5).
 */
export function gradientSampler(
  g: GradientPaint,
  transform: Mat2D
): (x: number, y: number) => RGBA {
  const inv = invert(transform) ?? ([1, 0, 0, 1, 0, 0] as Mat2D)
  const stops = sortedStops(g.stops)
  const pm = g.pixelMode
  return (x, y) => {
    const ix = x + 0.5
    const iy = y + 0.5
    const p = { x: inv[0] * ix + inv[2] * iy + inv[4], y: inv[1] * ix + inv[3] * iy + inv[5] }
    const t = gradientT(g, p)
    switch (pm.mode) {
      case 'smooth':
        return colorAt(stops, t)
      case 'bands': {
        const n = Math.max(2, Math.round(pm.steps))
        const k = Math.min(n - 1, Math.floor(t * n))
        return colorAt(stops, k / (n - 1))
      }
      case 'dither': {
        const n = Math.max(2, Math.round(pm.steps))
        const scaled = t * (n - 1)
        const base = Math.floor(scaled)
        const frac = scaled - base
        const k = frac > ditherThreshold(pm.matrix, x, y) ? Math.min(n - 1, base + 1) : base
        return colorAt(stops, k / (n - 1))
      }
      case 'palette': {
        let c = colorAt(stops, t)
        if (!pm.colors.length) return c
        if (pm.dither) {
          // tramado ordenado: se desplaza el color antes de cuantizar
          const off = Math.round((ditherThreshold('bayer4', x, y) - 0.5) * 64)
          c = {
            r: Math.max(0, Math.min(255, c.r + off)),
            g: Math.max(0, Math.min(255, c.g + off)),
            b: Math.max(0, Math.min(255, c.b + off)),
            a: c.a
          }
        }
        return nearest(pm.colors, c)
      }
    }
  }
}
