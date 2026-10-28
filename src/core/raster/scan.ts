// Relleno por líneas de escaneo con muestreo en el CENTRO del píxel (specs/03).

import type { Vec2 } from '../model/shapes'

export type FillRule = 'nonzero' | 'evenodd'

/** Máscara de cobertura binaria (0 / 255) del tamaño de la imagen. */
export type Coverage = Uint8Array

export const emptyCoverage = (w: number, h: number): Coverage => new Uint8Array(w * h)

export function fillPolygons(polys: Vec2[][], rule: FillRule, w: number, h: number): Coverage {
  const cov = emptyCoverage(w, h)
  const rows: { x: number; dir: number }[][] = Array.from({ length: h }, () => [])
  for (const poly of polys) {
    const n = poly.length
    if (n < 3) continue
    for (let i = 0; i < n; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      if (a.y === b.y) continue
      const dir = b.y > a.y ? 1 : -1
      const [top, bot] = a.y < b.y ? [a, b] : [b, a]
      // filas cuyo centro yc = y + 0.5 cae en [top.y, bot.y)
      const y0 = Math.max(0, Math.ceil(top.y - 0.5))
      const y1 = Math.min(h - 1, Math.ceil(bot.y - 0.5) - 1)
      const slope = (bot.x - top.x) / (bot.y - top.y)
      for (let y = y0; y <= y1; y++) rows[y]!.push({ x: top.x + (y + 0.5 - top.y) * slope, dir })
    }
  }
  for (let y = 0; y < h; y++) {
    const r = rows[y]!
    if (r.length < 2) continue
    r.sort((p, q) => p.x - q.x)
    let wind = 0
    for (let i = 0; i < r.length - 1; i++) {
      wind += r[i]!.dir
      const inside = rule === 'nonzero' ? wind !== 0 : (i & 1) === 0
      if (!inside) continue
      const xs = Math.max(0, Math.ceil(r[i]!.x - 0.5))
      const xe = Math.min(w - 1, Math.ceil(r[i + 1]!.x - 0.5) - 1)
      for (let x = xs; x <= xe; x++) cov[y * w + x] = 255
    }
  }
  return cov
}

export function coverageOr(a: Coverage, b: Coverage): Coverage {
  const o = new Uint8Array(a.length)
  for (let i = 0; i < o.length; i++) o[i] = a[i]! | b[i]!
  return o
}
export function coverageAnd(a: Coverage, b: Coverage): Coverage {
  const o = new Uint8Array(a.length)
  for (let i = 0; i < o.length; i++) o[i] = a[i]! & b[i]!
  return o
}
/** a − b */
export function coverageSub(a: Coverage, b: Coverage): Coverage {
  const o = new Uint8Array(a.length)
  for (let i = 0; i < o.length; i++) o[i] = b[i]! ? 0 : a[i]!
  return o
}
