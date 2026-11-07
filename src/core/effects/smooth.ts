// Efecto «Suavizar bordes»: quita los dientes de sierra de las diagonales sin tocar los bordes
// rectos ni el interior. Se amplía la imagen con Scale2x (EPX) una o dos veces —que sólo
// redondea los escalones— y se reduce promediando: los escalones quedan con cobertura parcial.
// Determinista (aritmética entera salvo el redondeo final) y por bandas para acotar la memoria.

import type { Rect } from '../raster/bitmap'
import { clampByte } from './kernels'
import { type Region, cropRegion, expandRect, makeRegion, regionIndex } from './region'
import type { EffectDef, ParamValue } from './types'

type P = Record<string, ParamValue>

/** Filas por banda: menos cuanto mayor es la ampliación, para acotar la memoria. */
const bandRows = (passes: number): number => Math.max(8, 64 >> (2 * Math.max(0, passes - 2)))

/** Ampliación ×2 de un búfer RGBA de w×h; fuera del búfer todo es transparente. */
function scale2x(src: Uint32Array, w: number, h: number, key: (v: number) => number): Uint32Array {
  const out = new Uint32Array(w * h * 4)
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]!
  const ow = w * 2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = src[y * w + x]!
      const b = at(x, y - 1)
      const d = at(x - 1, y)
      const f = at(x + 1, y)
      const hh = at(x, y + 1)
      let e0 = e
      let e1 = e
      let e2 = e
      let e3 = e
      if (key(b) !== key(hh) && key(d) !== key(f)) {
        if (key(d) === key(b)) e0 = d
        if (key(b) === key(f)) e1 = f
        if (key(d) === key(hh)) e2 = d
        if (key(hh) === key(f)) e3 = f
      }
      const o = y * 2 * ow + x * 2
      out[o] = e0
      out[o + 1] = e1
      out[o + ow] = e2
      out[o + ow + 1] = e3
    }
  return out
}

// Los píxeles se empaquetan como 0xAABBGGRR en un Uint32 (se comparan de una vez).
const pack = (r: number, g: number, b: number, a: number): number =>
  ((a << 24) | (b << 16) | (g << 8) | r) >>> 0

/** Ampliación Scale2x repetida y reducción por promedio sobre la región `out`. */
function scaleSmooth(
  input: Region,
  out: Rect,
  passes: number,
  k: number,
  key: (v: number) => number
): Region {
  const f = 2 ** passes
  const res = makeRegion(out)
  for (let by = 0; by < out.h; by += bandRows(passes)) {
    const bh = Math.min(bandRows(passes), out.h - by)
    const band: Rect = { x: out.x, y: out.y + by, w: out.w, h: bh }
    const win = cropRegion(input, expandRect(band, passes))
    const ww = win.rect.w
    const wh = win.rect.h
    let buf: Uint32Array = new Uint32Array(ww * wh)
    for (let i = 0; i < buf.length; i++) {
      const o = i * 4
      buf[i] = pack(win.data[o]!, win.data[o + 1]!, win.data[o + 2]!, win.data[o + 3]!)
    }
    let bw = ww
    let bhh = wh
    for (let s = 0; s < passes; s++) {
      buf = scale2x(buf, bw, bhh, key)
      bw *= 2
      bhh *= 2
    }
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < out.w; x++) {
        let sa = 0
        let sr = 0
        let sg = 0
        let sb = 0
        const x0 = (x + passes) * f
        const y0 = (y + passes) * f
        for (let j = 0; j < f; j++)
          for (let i = 0; i < f; i++) {
            const v = buf[(y0 + j) * bw + x0 + i]!
            const a = v >>> 24
            sa += a
            sr += (v & 255) * a
            sg += ((v >>> 8) & 255) * a
            sb += ((v >>> 16) & 255) * a
          }
        const wi = ((y + passes) * ww + x + passes) * 4
        const oa = win.data[wi + 3]!
        const sm = sa / (f * f)
        const o = ((by + y) * out.w + x) * 4
        const a = oa + (sm - oa) * k
        if (a <= 0) continue
        // color: el suavizado ponderado por alfa; sin cobertura nueva, el original
        const mix = (orig: number, sum: number): number =>
          sa === 0 ? orig : oa === 0 ? sum / sa : orig + (sum / sa - orig) * k
        res.data[o] = clampByte(mix(win.data[wi]!, sr))
        res.data[o + 1] = clampByte(mix(win.data[wi + 1]!, sg))
        res.data[o + 2] = clampByte(mix(win.data[wi + 2]!, sb))
        res.data[o + 3] = clampByte(a)
      }
  }
  return res
}

/** Difumina el alfa y el color (ponderado) con un núcleo 3×3 [1 2 1] y mezcla según `t`. */
function softenEdges(src: Region, out: Rect, t: number): Region {
  const res = makeRegion(out)
  const W = [1, 2, 1]
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      let sa = 0
      let sr = 0
      let sg = 0
      let sb = 0
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          const q = regionIndex(src, out.x + x + i - 1, out.y + y + j - 1)
          if (q < 0) continue
          const w = W[i]! * W[j]!
          const a = src.data[q + 3]! * w
          sa += a
          sr += src.data[q]! * a
          sg += src.data[q + 1]! * a
          sb += src.data[q + 2]! * a
        }
      const q0 = regionIndex(src, out.x + x, out.y + y)
      const oa = src.data[q0 + 3]!
      const a = oa + (sa / 16 - oa) * t
      if (a <= 0) continue
      const o = (y * out.w + x) * 4
      const mix = (orig: number, sum: number): number =>
        sa === 0 ? orig : oa === 0 ? sum / sa : orig + (sum / sa - orig) * t
      res.data[o] = clampByte(mix(src.data[q0]!, sr))
      res.data[o + 1] = clampByte(mix(src.data[q0 + 1]!, sg))
      res.data[o + 2] = clampByte(mix(src.data[q0 + 2]!, sb))
      res.data[o + 3] = clampByte(a)
    }
  return res
}

export const smoothEdges: EffectDef = {
  type: 'smooth-edges',
  category: 'outline',
  params: [
    { key: 'intensity', kind: 'int', min: 0, max: 100, def: 100 },
    { key: 'passes', kind: 'int', min: 1, max: 4, def: 2 },
    { key: 'softness', kind: 'int', min: 0, max: 100, def: 0 },
    { key: 'keepOriginal', kind: 'bool', def: false },
    { key: 'scope', kind: 'enum', options: ['silhouette', 'everything'], def: 'silhouette' }
  ],
  influence: (p) => (p['passes'] as number) + ((p['softness'] as number) > 0 ? 1 : 0),
  apply(input: Region, out: Rect, p: P): Region {
    const passes = p['passes'] as number
    const k = (p['intensity'] as number) / 100
    const soft = (p['softness'] as number) / 100
    const key = p['scope'] !== 'everything' ? (v: number) => v >>> 24 : (v: number) => v
    const res =
      soft <= 0
        ? scaleSmooth(input, out, passes, k, key)
        : softenEdges(scaleSmooth(input, expandRect(out, 1), passes, k, key), out, soft)
    return p['keepOriginal'] ? paintOriginal(res, input) : res
  }
}

/** El trazo original se ve íntegro encima del resultado suavizado (el halo queda debajo). */
function paintOriginal(res: Region, input: Region): Region {
  const { rect, data } = res
  for (let y = 0; y < rect.h; y++)
    for (let x = 0; x < rect.w; x++) {
      const q = regionIndex(input, rect.x + x, rect.y + y)
      if (q < 0) continue
      const sa = input.data[q + 3]!
      if (sa === 0) continue
      const o = (y * rect.w + x) * 4
      if (sa === 255) {
        data[o] = input.data[q]!
        data[o + 1] = input.data[q + 1]!
        data[o + 2] = input.data[q + 2]!
        data[o + 3] = 255
        continue
      }
      const fa = sa / 255
      const ba = (data[o + 3]! / 255) * (1 - fa)
      const oa = fa + ba
      for (let c = 0; c < 3; c++)
        data[o + c] = clampByte((input.data[q + c]! * fa + data[o + c]! * ba) / oa)
      data[o + 3] = clampByte(oa * 255)
    }
  return res
}
