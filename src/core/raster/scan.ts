// Relleno por líneas de escaneo con muestreo en el CENTRO del píxel (specs/03).

import type { Vec2 } from '../model/shapes'

export type FillRule = 'nonzero' | 'evenodd'

/** Máscara de cobertura binaria (0 / 255) del tamaño de la imagen. */
export type Coverage = Uint8Array

export const emptyCoverage = (w: number, h: number): Coverage => new Uint8Array(w * h)

const TIE = 1e-6

/**
 * Relleno con el borde incluido: un píxel cuyo centro cae justo sobre el contorno también se
 * pinta (en todos los lados). Es la unión del relleno normal y el del polígono movido TIE en x, en
 * y y en ambos, que recoge los centros que quedan exactamente en el borde derecho/inferior.
 */
export function fillPolygonsClosed(
  polys: Vec2[][],
  rule: FillRule,
  w: number,
  h: number
): Coverage {
  const a = fillPolygons(polys, rule, w, h)
  for (const [dx, dy] of [
    [TIE, 0],
    [0, TIE],
    [TIE, TIE]
  ] as const) {
    const b = fillPolygons(
      polys.map((p) => p.map((q) => ({ x: q.x + dx, y: q.y + dy }))),
      rule,
      w,
      h
    )
    for (let i = 0; i < a.length; i++) a[i] = a[i]! | b[i]!
  }
  // Un vértice en el centro de un píxel que es un extremo vertical (punta arriba o abajo) deja un
  // tramo de ancho cero en su fila y no pintaba nada: el píxel de la propia ancla se marca aquí.
  const near = (v: number): boolean => Math.abs(v - Math.floor(v) - 0.5) < TIE
  for (const poly of polys)
    if (poly.length >= 3)
      for (const q of poly)
        if (near(q.x) && near(q.y)) {
          const x = Math.floor(q.x)
          const y = Math.floor(q.y)
          if (x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = 255
        }
  return a
}

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

/** Un paso de erosión (4-vecinos). Fuera del lienzo cuenta como relleno: el borde del lienzo no deja contorno. */
export function erode(c: Coverage, w: number, h: number, steps: number): Coverage {
  let cur = c
  for (let s = 0; s < steps; s++) {
    const o = new Uint8Array(cur.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!cur[i]) continue
        const l = x === 0 || cur[i - 1]
        const r = x === w - 1 || cur[i + 1]
        const u = y === 0 || cur[i - w]
        const d = y === h - 1 || cur[i + w]
        if (l && r && u && d) o[i] = 255
      }
    cur = o
  }
  return cur
}

/** Dilatación (4-vecinos) `steps` veces. */
export function dilate(c: Coverage, w: number, h: number, steps: number): Coverage {
  let cur = c
  for (let s = 0; s < steps; s++) {
    const o = new Uint8Array(cur.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (
          cur[i] ||
          (x > 0 && cur[i - 1]) ||
          (x < w - 1 && cur[i + 1]) ||
          (y > 0 && cur[i - w]) ||
          (y < h - 1 && cur[i + w])
        )
          o[i] = 255
      }
    cur = o
  }
  return cur
}

const FAR = 1e20

/** Transformada 1D de distancia al cuadrado (Felzenszwalb–Huttenlocher), exacta y determinista. */
function edt1d(
  f: Float64Array,
  n: number,
  out: Float64Array,
  v: Int32Array,
  z: Float64Array
): void {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s: number
    for (;;) {
      const p = v[k]!
      s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p)
      if (s <= z[k]!) k--
      else break
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++
    const d = q - v[k]!
    out[q] = d * d + f[v[k]!]!
  }
}

/** Distancia euclídea al cuadrado de cada píxel al más cercano con `src[i] != 0` (FAR si no hay). */
function distanceSq(src: Uint8Array, w: number, h: number, wantSet: boolean): Float64Array {
  const m = Math.max(w, h)
  const f = new Float64Array(m)
  const o = new Float64Array(m)
  const v = new Int32Array(m)
  const z = new Float64Array(m + 1)
  const d = new Float64Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = !!src[i] === wantSet ? 0 : FAR
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = d[y * w + x]!
    edt1d(f, h, o, v, z)
    for (let y = 0; y < h; y++) d[y * w + x] = o[y]!
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = d[y * w + x]!
    edt1d(f, w, o, v, z)
    for (let x = 0; x < w; x++) d[y * w + x] = o[x]!
  }
  return d
}

/** Dilatación con un disco de radio `r` (distancia euclídea): el contorno exterior no se achaflana. */
export function dilateDisc(c: Coverage, w: number, h: number, r: number): Coverage {
  if (r <= 0) return c
  const d = distanceSq(c, w, h, true)
  const o = new Uint8Array(c.length)
  const r2 = r * r
  for (let i = 0; i < o.length; i++) if (d[i]! <= r2) o[i] = 255
  return o
}

/** Erosión con un disco de radio `r`. Fuera del lienzo cuenta como relleno (como `erode`). */
export function erodeDisc(c: Coverage, w: number, h: number, r: number): Coverage {
  if (r <= 0) return c
  const d = distanceSq(c, w, h, false)
  const o = new Uint8Array(c.length)
  const r2 = r * r
  for (let i = 0; i < o.length; i++) if (c[i] && d[i]! > r2) o[i] = 255
  return o
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
