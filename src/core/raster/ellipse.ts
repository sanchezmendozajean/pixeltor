// Elipse por punto medio (Zingl). Da círculos de pixel art limpios y simétricos (specs/03 §4).

import { type Coverage, emptyCoverage } from './scan'

/**
 * Píxeles del contorno de la elipse inscrita en el rectángulo [x0..x1] × [y0..y1] (inclusivo).
 * Llama a `plot` por cada píxel (puede repetir).
 */
export function ellipseOutline(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: (x: number, y: number) => void
): void {
  let a = Math.abs(x1 - x0)
  const b = Math.abs(y1 - y0)
  let b1 = b & 1
  let dx = 4 * (1 - a) * b * b
  let dy = 4 * (b1 + 1) * a * a
  let err = dx + dy + b1 * a * a
  if (x0 > x1) {
    x0 = x1
    x1 += a
  }
  if (y0 > y1) y0 = y1
  y0 += (b + 1) >> 1
  y1 = y0 - b1
  a *= 8 * a
  b1 = 8 * b * b
  do {
    plot(x1, y0)
    plot(x0, y0)
    plot(x0, y1)
    plot(x1, y1)
    const e2 = 2 * err
    if (e2 <= dy) {
      y0++
      y1--
      dy += a
      err += dy
    }
    if (e2 >= dx || 2 * err > dy) {
      x0++
      x1--
      dx += b1
      err += dx
    }
  } while (x0 <= x1)
  while (y0 - y1 < b) {
    plot(x0 - 1, y0)
    plot(x1 + 1, y0++)
    plot(x0 - 1, y1)
    plot(x1 + 1, y1--)
  }
}

/** Relleno y contorno (1 px) de la elipse inscrita en el rectángulo de píxeles dado. */
export function ellipseMasks(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number
): { fill: Coverage; outline: Coverage } {
  const fill = emptyCoverage(w, h)
  const outline = emptyCoverage(w, h)
  const minX = new Map<number, number>()
  const maxX = new Map<number, number>()
  ellipseOutline(x0, y0, x1, y1, (x, y) => {
    if (x >= 0 && y >= 0 && x < w && y < h) outline[y * w + x] = 255
    minX.set(y, Math.min(minX.get(y) ?? x, x))
    maxX.set(y, Math.max(maxX.get(y) ?? x, x))
  })
  for (const [y, lo] of minX) {
    if (y < 0 || y >= h) continue
    const hi = maxX.get(y)!
    for (let x = Math.max(0, lo); x <= Math.min(w - 1, hi); x++) fill[y * w + x] = 255
  }
  return { fill, outline }
}
