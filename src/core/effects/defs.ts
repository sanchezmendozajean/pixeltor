// Catálogo de efectos (specs/06). Cada efecto es una función pura de píxeles; ninguno modifica
// el ráster base. Parámetros de distancia en px enteros salvo que se indique.

import { hslToRgb, rgbToHsl } from '../palette/palette'
import type { Rect } from '../raster/bitmap'
import {
  type Plane,
  blurReach,
  boxBlur,
  channelPlane,
  clampByte,
  dilate,
  gaussianBlur,
  invertPlane,
  parseColor
} from './kernels'
import {
  type Region,
  cropRegion,
  expandRect,
  intersectRect,
  makeRegion,
  regionIndex
} from './region'
import type { EffectDef, ParamDef, ParamValue } from './types'

type P = Record<string, ParamValue>
const n = (p: P, k: string): number => p[k] as number

/** Fuente sobre fondo (alfa recta). Escribe en `out[o..o+3]`. */
function over(
  out: Uint8ClampedArray,
  o: number,
  [tr, tg, tb, ta]: [number, number, number, number],
  [br, bg, bb, ba]: [number, number, number, number]
): void {
  if (ta >= 255) {
    out[o] = tr
    out[o + 1] = tg
    out[o + 2] = tb
    out[o + 3] = 255
    return
  }
  const sa = ta / 255
  const da = (ba / 255) * (1 - sa)
  const oa = sa + da
  if (oa <= 0) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
    return
  }
  out[o] = clampByte((tr * sa + br * da) / oa)
  out[o + 1] = clampByte((tg * sa + bg * da) / oa)
  out[o + 2] = clampByte((tb * sa + bb * da) / oa)
  out[o + 3] = clampByte(oa * 255)
}

/** Dibuja el plano de alfa (0..255) teñido de `color` y `opacity` (0..100), bajo o sobre la entrada. */
function paintPlane(
  input: Region,
  out: Rect,
  plane: Plane,
  pw: number,
  poff: { x: number; y: number },
  color: string,
  opacity: number,
  under: boolean,
  mask?: (x: number, y: number) => number
): Region {
  const res = makeRegion(out)
  const c = parseColor(color)
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const pa = plane[(y + poff.y) * pw + x + poff.x]!
      let a = (pa * opacity) / 100
      if (mask) a *= mask(out.x + x, out.y + y)
      const ii = regionIndex(input, out.x + x, out.y + y)
      const o = (y * out.w + x) * 4
      const px: [number, number, number, number] =
        ii >= 0
          ? [input.data[ii]!, input.data[ii + 1]!, input.data[ii + 2]!, input.data[ii + 3]!]
          : [0, 0, 0, 0]
      const tint: [number, number, number, number] = [c.r, c.g, c.b, clampByte(a)]
      if (under) over(res.data, o, px, tint)
      else over(res.data, o, tint, px)
    }
  return res
}

const colorP = (key: string, def: string): ParamDef => ({ key, kind: 'color', def })
const intP = (key: string, min: number, max: number, def: number): ParamDef => ({
  key,
  kind: 'int',
  min,
  max,
  def
})
const floatP = (key: string, min: number, max: number, def: number, step = 0.5): ParamDef => ({
  key,
  kind: 'float',
  min,
  max,
  def,
  step
})

/** Plano de alfa de la entrada desplazado (dx, dy) sobre la región de salida ampliada `pad`. */
function shadowPlane(input: Region, out: Rect, pad: number, dx: number, dy: number) {
  const e = expandRect(out, pad)
  return { e, plane: channelPlane(input, { x: e.x - dx, y: e.y - dy, w: e.w, h: e.h }, 3) }
}

const shift = (p: P): number => Math.max(Math.abs(n(p, 'dx')), Math.abs(n(p, 'dy')))

const dropShadow: EffectDef = {
  type: 'drop-shadow',
  category: 'shadow',
  params: [
    intP('dx', -64, 64, 2),
    intP('dy', -64, 64, 2),
    colorP('color', '#000000'),
    intP('opacity', 0, 100, 70),
    intP('blur', 0, 64, 0),
    intP('spread', 0, 16, 0),
    { key: 'knockout', kind: 'bool', def: false }
  ],
  influence: (p) => shift(p) + n(p, 'spread') + blurReach(n(p, 'blur')),
  apply(input, out, p) {
    const pad = n(p, 'spread') + blurReach(n(p, 'blur'))
    const { e, plane } = shadowPlane(input, out, pad, n(p, 'dx'), n(p, 'dy'))
    const sp = gaussianBlur(dilate(plane, e.w, e.h, n(p, 'spread')), e.w, e.h, n(p, 'blur'))
    return paintPlane(
      input,
      out,
      sp,
      e.w,
      { x: out.x - e.x, y: out.y - e.y },
      p['color'] as string,
      n(p, 'opacity'),
      true,
      p['knockout']
        ? (x, y) => {
            const i = regionIndex(input, x, y)
            return i < 0 ? 1 : 1 - input.data[i + 3]! / 255
          }
        : undefined
    )
  }
}

const innerShadow: EffectDef = {
  type: 'inner-shadow',
  category: 'shadow',
  params: [
    intP('dx', -64, 64, 2),
    intP('dy', -64, 64, 2),
    colorP('color', '#000000'),
    intP('opacity', 0, 100, 70),
    intP('blur', 0, 64, 0),
    intP('choke', 0, 16, 0)
  ],
  influence: (p) => shift(p) + n(p, 'choke') + blurReach(n(p, 'blur')),
  apply(input, out, p) {
    const pad = n(p, 'choke') + blurReach(n(p, 'blur'))
    const { e, plane } = shadowPlane(input, out, pad, n(p, 'dx'), n(p, 'dy'))
    const sp = gaussianBlur(
      dilate(invertPlane(plane), e.w, e.h, n(p, 'choke')),
      e.w,
      e.h,
      n(p, 'blur')
    )
    return paintPlane(
      input,
      out,
      sp,
      e.w,
      { x: out.x - e.x, y: out.y - e.y },
      p['color'] as string,
      n(p, 'opacity'),
      false,
      (x, y) => {
        const i = regionIndex(input, x, y)
        return i < 0 ? 0 : input.data[i + 3]! / 255
      }
    )
  }
}

const outerGlow: EffectDef = {
  type: 'outer-glow',
  category: 'shadow',
  params: [
    colorP('color', '#ffe066'),
    intP('opacity', 0, 100, 80),
    intP('radius', 0, 64, 3),
    intP('spread', 0, 16, 0),
    intP('steps', 0, 16, 0)
  ],
  influence: (p) => n(p, 'spread') + blurReach(n(p, 'radius')),
  apply(input, out, p) {
    const pad = n(p, 'spread') + blurReach(n(p, 'radius'))
    const { e, plane } = shadowPlane(input, out, pad, 0, 0)
    const g = gaussianBlur(dilate(plane, e.w, e.h, n(p, 'spread')), e.w, e.h, n(p, 'radius'))
    const steps = n(p, 'steps')
    if (steps > 0)
      for (let i = 0; i < g.length; i++)
        g[i] = (Math.ceil((g[i]! / 255) * steps - 1e-9) / steps) * 255
    return paintPlane(
      input,
      out,
      g,
      e.w,
      { x: out.x - e.x, y: out.y - e.y },
      p['color'] as string,
      n(p, 'opacity'),
      true
    )
  }
}

const pixelOutline: EffectDef = {
  type: 'pixel-outline',
  category: 'outline',
  params: [
    intP('thickness', 1, 8, 1),
    { key: 'position', kind: 'enum', options: ['outer', 'inner'], def: 'outer' },
    { key: 'connectivity', kind: 'enum', options: ['4', '8'], def: '4' },
    colorP('color', '#000000')
  ],
  influence: (p) => n(p, 'thickness'),
  apply(input, out, p) {
    const t = n(p, 'thickness')
    const eight = p['connectivity'] === '8'
    const e = expandRect(out, t)
    const a = channelPlane(input, e, 3)
    const solid = a.map((v) => (v > 0 ? 255 : 0))
    const ring = new Float32Array(a.length)
    if (p['position'] === 'outer') {
      const d = dilate(solid, e.w, e.h, t, eight)
      for (let i = 0; i < ring.length; i++) ring[i] = d[i]! > 0 && solid[i] === 0 ? 255 : 0
    } else {
      const er = invertPlane(dilate(invertPlane(solid), e.w, e.h, t, eight))
      for (let i = 0; i < ring.length; i++) ring[i] = solid[i]! > 0 && er[i] === 0 ? 255 : 0
    }
    return paintPlane(
      input,
      out,
      ring,
      e.w,
      { x: out.x - e.x, y: out.y - e.y },
      p['color'] as string,
      100,
      p['position'] === 'outer'
    )
  }
}

/** Caja mínima que contiene los píxeles con alfa > 0 de la región, o null si está vacía. */
function alphaBounds(input: Region): Rect | null {
  const { x, y, w, h } = input.rect
  let x0 = w
  let x1 = -1
  let y0 = h
  let y1 = -1
  for (let j = 0; j < h; j++) {
    const row = j * w * 4 + 3
    for (let i = 0; i < w; i++)
      if (input.data[row + i * 4]) {
        if (i < x0) x0 = i
        if (i > x1) x1 = i
        if (j < y0) y0 = j
        y1 = j
      }
  }
  return x1 < 0 ? null : { x: x + x0, y: y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Desenfoque aproximado a media resolución: reduce 2×2 (media), desenfoca con la mitad de radio y amplía. */
function blurHalf(
  p: Plane,
  w: number,
  h: number,
  blur: (p: Plane, w: number, h: number, k: number) => Plane
): Plane {
  const hw = (w + 1) >> 1
  const hh = (h + 1) >> 1
  const small = new Float32Array(hw * hh) as Plane
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < hw; x++) {
      const x1 = Math.min(w - 1, 2 * x + 1)
      const y1 = Math.min(h - 1, 2 * y + 1)
      small[y * hw + x] =
        (p[2 * y * w + 2 * x]! + p[2 * y * w + x1]! + p[y1 * w + 2 * x]! + p[y1 * w + x1]!) / 4
    }
  const b = blur(small, hw, hh, 0.5)
  const out = new Float32Array(w * h) as Plane
  for (let y = 0; y < h; y++) {
    const row = (y >> 1) * hw
    for (let x = 0; x < w; x++) out[y * w + x] = b[row + (x >> 1)]!
  }
  return out
}

/**
 * Desenfoca RGBA premultiplicado con `blur`; `mode`: both | alpha | color. Sólo se calcula la zona
 * que el contenido puede alcanzar (caja del alfa + radio): fuera de ella el resultado es 0.
 */
function blurRegion(
  input: Region,
  out: Rect,
  pad: number,
  mode: string,
  /** `k` es la escala de resolución (1 = completa, 0,5 = borrador): el radio se multiplica por k. */
  blur: (p: Plane, w: number, h: number, k: number) => Plane,
  draft = false
): Region {
  const res = makeRegion(out)
  const content = alphaBounds(input)
  if (!content) return res
  const e = intersectRect(expandRect(out, pad), expandRect(content, pad))
  if (e.w <= 0 || e.h <= 0) return res
  const a = channelPlane(input, e, 3)
  const pr = [0, 1, 2].map((c) => {
    const ch = channelPlane(input, e, c)
    for (let i = 0; i < ch.length; i++) ch[i] = (ch[i]! * a[i]!) / 255
    return ch
  })
  // Borrador (sólo al arrastrar): se desenfoca a media resolución y se amplía; ~4× menos trabajo
  const half = draft && e.w >= 64 && e.h >= 64
  const run = (p: Plane): Plane => (half ? blurHalf(p, e.w, e.h, blur) : blur(p, e.w, e.h, 1))
  const blurredA = run(a)
  const bp = mode === 'alpha' ? pr : pr.map(run)
  // en el modo «ambos» fuera de la zona calculada todo es 0: se recorre sólo esa zona
  const full = mode !== 'both'
  const xa = full ? 0 : Math.max(0, e.x - out.x)
  const xb = full ? out.w : Math.min(out.w, e.x + e.w - out.x)
  const ya = full ? 0 : Math.max(0, e.y - out.y)
  const yb = full ? out.h : Math.min(out.h, e.y + e.h - out.y)
  if (mode === 'both') {
    // camino rápido (el habitual): todo el recorrido cae dentro de la zona calculada
    const [b0, b1, b2] = bp as [Plane, Plane, Plane]
    const d = res.data
    for (let y = ya; y < yb; y++) {
      let pi = (y + out.y - e.y) * e.w + (xa + out.x - e.x)
      let o = (y * out.w + xa) * 4
      for (let x = xa; x < xb; x++, pi++, o += 4) {
        const wa = blurredA[pi]!
        if (wa > 0) {
          d[o] = clampByte((b0[pi]! / wa) * 255)
          d[o + 1] = clampByte((b1[pi]! / wa) * 255)
          d[o + 2] = clampByte((b2[pi]! / wa) * 255)
        }
        d[o + 3] = clampByte(wa)
      }
    }
    return res
  }
  for (let y = ya; y < yb; y++)
    for (let x = xa; x < xb; x++) {
      const px = x + out.x - e.x
      const py = y + out.y - e.y
      const inside = px >= 0 && py >= 0 && px < e.w && py < e.h
      const pi = py * e.w + px
      const o = (y * out.w + x) * 4
      if (mode === 'alpha') {
        const ii = regionIndex(input, out.x + x, out.y + y)
        if (ii >= 0) {
          res.data[o] = input.data[ii]!
          res.data[o + 1] = input.data[ii + 1]!
          res.data[o + 2] = input.data[ii + 2]!
        }
        res.data[o + 3] = inside ? clampByte(blurredA[pi]!) : 0
        continue
      }
      const wa = inside ? blurredA[pi]! : 0
      if (wa > 0) {
        res.data[o] = clampByte((bp[0]![pi]! / wa) * 255)
        res.data[o + 1] = clampByte((bp[1]![pi]! / wa) * 255)
        res.data[o + 2] = clampByte((bp[2]![pi]! / wa) * 255)
      }
      if (mode === 'color') {
        const ii = regionIndex(input, out.x + x, out.y + y)
        res.data[o + 3] = ii >= 0 ? input.data[ii + 3]! : 0
      } else res.data[o + 3] = clampByte(wa)
    }
  return res
}

const channelsParam: ParamDef = {
  key: 'channels',
  kind: 'enum',
  options: ['both', 'alpha', 'color'],
  def: 'both'
}

const gaussianBlurFx: EffectDef = {
  type: 'gaussian-blur',
  category: 'blur',
  params: [floatP('radius', 0, 64, 2), channelsParam],
  influence: (p) => blurReach(n(p, 'radius')),
  apply: (input, out, p, ctx) =>
    blurRegion(
      input,
      out,
      blurReach(n(p, 'radius')),
      p['channels'] as string,
      (pl, w, h, k) => gaussianBlur(pl, w, h, n(p, 'radius') * k),
      ctx.draft
    )
}

const boxBlurFx: EffectDef = {
  type: 'box-blur',
  category: 'blur',
  params: [intP('rx', 0, 64, 2), intP('ry', 0, 64, 2), intP('iterations', 1, 4, 1), channelsParam],
  influence: (p) => (Math.max(n(p, 'rx'), n(p, 'ry')) + 1) * n(p, 'iterations'),
  apply: (input, out, p, ctx) =>
    blurRegion(
      input,
      out,
      (Math.max(n(p, 'rx'), n(p, 'ry')) + 1) * n(p, 'iterations'),
      p['channels'] as string,
      (pl, w, h, k) =>
        boxBlur(
          pl,
          w,
          h,
          Math.round(n(p, 'rx') * k),
          Math.round(n(p, 'ry') * k),
          n(p, 'iterations')
        ),
      ctx.draft
    )
}

/** Efecto que copia píxeles de la posición de origen calculada por `src(x, y)`. */
function remap(input: Region, out: Rect, src: (x: number, y: number) => [number, number]): Region {
  const res = makeRegion(out)
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const [sx, sy] = src(out.x + x, out.y + y)
      const i = regionIndex(input, sx, sy)
      if (i < 0) continue
      const o = (y * out.w + x) * 4
      res.data[o] = input.data[i]!
      res.data[o + 1] = input.data[i + 1]!
      res.data[o + 2] = input.data[i + 2]!
      res.data[o + 3] = input.data[i + 3]!
    }
  return res
}

const mod = (a: number, m: number): number => ((a % m) + m) % m

const offsetFx: EffectDef = {
  type: 'offset',
  category: 'distort',
  params: [
    intP('dx', -512, 512, 4),
    intP('dy', -512, 512, 0),
    { key: 'wrap', kind: 'bool', def: false }
  ],
  influence: (p, ctx) => (p['wrap'] ? Math.min(512, Math.max(ctx.width, ctx.height)) : shift(p)),
  apply: (input, out, p, ctx) =>
    remap(input, out, (x, y) =>
      p['wrap']
        ? [mod(x - n(p, 'dx'), ctx.width), mod(y - n(p, 'dy'), ctx.height)]
        : [x - n(p, 'dx'), y - n(p, 'dy')]
    )
}

const waveFx: EffectDef = {
  type: 'wave',
  category: 'distort',
  params: [
    { key: 'axis', kind: 'enum', options: ['h', 'v'], def: 'h' },
    intP('amplitude', 0, 64, 2),
    intP('wavelength', 2, 256, 16),
    intP('phase', 0, 360, 0)
  ],
  influence: (p) => n(p, 'amplitude'),
  apply(input, out, p) {
    const k = (2 * Math.PI) / n(p, 'wavelength')
    const ph = (n(p, 'phase') * Math.PI) / 180
    const amp = n(p, 'amplitude')
    return remap(input, out, (x, y) =>
      p['axis'] === 'h'
        ? [x - Math.round(amp * Math.sin(k * y + ph)), y]
        : [x, y - Math.round(amp * Math.sin(k * x + ph))]
    )
  }
}

type Px = [number, number, number, number]

const mosaicFx: EffectDef = {
  type: 'mosaic',
  category: 'distort',
  params: [
    intP('cw', 1, 64, 4),
    intP('ch', 1, 64, 4),
    { key: 'sampling', kind: 'enum', options: ['center', 'average', 'mode'], def: 'center' }
  ],
  influence: (p) => Math.max(n(p, 'cw'), n(p, 'ch')),
  apply(input, out, p) {
    const cw = n(p, 'cw')
    const ch = n(p, 'ch')
    const mode = p['sampling'] as string
    const cache = new Map<string, Px>()
    const at = (x: number, y: number): Px | null => {
      const i = regionIndex(input, x, y)
      return i < 0
        ? null
        : [input.data[i]!, input.data[i + 1]!, input.data[i + 2]!, input.data[i + 3]!]
    }
    const cell = (cx: number, cy: number): Px => {
      const key = `${cx},${cy}`
      const hit = cache.get(key)
      if (hit) return hit
      let res: Px = [0, 0, 0, 0]
      if (mode === 'center') {
        res = at(cx + (cw >> 1), cy + (ch >> 1)) ?? res
      } else if (mode === 'average') {
        let r = 0
        let g = 0
        let b = 0
        let a = 0
        for (let y = cy; y < cy + ch; y++)
          for (let x = cx; x < cx + cw; x++) {
            const px = at(x, y)
            if (!px) continue
            r += px[0] * px[3]
            g += px[1] * px[3]
            b += px[2] * px[3]
            a += px[3]
          }
        if (a > 0)
          res = [clampByte(r / a), clampByte(g / a), clampByte(b / a), clampByte(a / (cw * ch))]
      } else {
        const counts = new Map<number, number>()
        let best = -1
        let bestN = 0
        for (let y = cy; y < cy + ch; y++)
          for (let x = cx; x < cx + cw; x++) {
            const px = at(x, y)
            if (!px || px[3] === 0) continue
            const k = ((px[0] << 24) | (px[1] << 16) | (px[2] << 8) | px[3]) >>> 0
            const c = (counts.get(k) ?? 0) + 1
            counts.set(k, c)
            if (c > bestN) {
              bestN = c
              best = k
            }
          }
        if (best >= 0)
          res = [(best >>> 24) & 255, (best >>> 16) & 255, (best >>> 8) & 255, best & 255]
      }
      cache.set(key, res)
      return res
    }
    const res = makeRegion(out)
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        const c = cell(Math.floor((out.x + x) / cw) * cw, Math.floor((out.y + y) / ch) * ch)
        res.data.set(c, (y * out.w + x) * 4)
      }
    return res
  }
}

/** Efecto por píxel (sin vecindad); los píxeles transparentes no se tocan. */
function pointwise(type: string, params: ParamDef[], fn: (px: Px, p: P) => void): EffectDef {
  return {
    type,
    category: 'color',
    params,
    influence: () => 0,
    apply(input, out, p) {
      const res = cropRegion(input, out)
      const px: Px = [0, 0, 0, 0]
      for (let i = 0; i < res.data.length; i += 4) {
        if (res.data[i + 3] === 0) continue
        px[0] = res.data[i]!
        px[1] = res.data[i + 1]!
        px[2] = res.data[i + 2]!
        px[3] = res.data[i + 3]!
        fn(px, p)
        res.data[i] = px[0]
        res.data[i + 1] = px[1]
        res.data[i + 2] = px[2]
        res.data[i + 3] = px[3]
      }
      return res
    }
  }
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

const hslFx = pointwise(
  'hsl',
  [
    intP('h', -180, 180, 0),
    intP('s', -100, 100, 0),
    intP('l', -100, 100, 0),
    { key: 'colorize', kind: 'bool', def: false }
  ],
  (px, p) => {
    const c = rgbToHsl({ r: px[0], g: px[1], b: px[2], a: 255 })
    const colorize = !!p['colorize']
    const h = colorize ? ((n(p, 'h') % 360) + 360) % 360 : c.h + n(p, 'h')
    const s = colorize ? clamp01(0.5 + n(p, 's') / 200) : clamp01(c.s * (1 + n(p, 's') / 100))
    const dl = n(p, 'l')
    const l = clamp01(dl >= 0 ? c.l + ((1 - c.l) * dl) / 100 : c.l * (1 + dl / 100))
    const o = hslToRgb(h, s, l)
    px[0] = o.r
    px[1] = o.g
    px[2] = o.b
  }
)

const brightnessContrast = pointwise(
  'brightness-contrast',
  [intP('brightness', -100, 100, 0), intP('contrast', -100, 100, 0)],
  (px, p) => {
    const c = n(p, 'contrast') * 2.55
    const f = (259 * (c + 255)) / (255 * (259 - c))
    const b = n(p, 'brightness') * 2.55
    for (let k = 0; k < 3; k++) px[k] = clampByte(f * (px[k]! - 128) + 128 + b)
  }
)

const invertFx = pointwise('invert', [], (px) => {
  px[0] = 255 - px[0]
  px[1] = 255 - px[1]
  px[2] = 255 - px[2]
})

const posterizeFx = pointwise('posterize', [intP('levels', 2, 16, 4)], (px, p) => {
  const lv = n(p, 'levels') - 1
  for (let k = 0; k < 3; k++) px[k] = clampByte((Math.round((px[k]! / 255) * lv) / lv) * 255)
})

const colorOverlay = pointwise(
  'color-overlay',
  [colorP('color', '#ff0000'), intP('opacity', 0, 100, 50)],
  (px, p) => {
    const c = parseColor(p['color'] as string)
    const o = n(p, 'opacity') / 100
    px[0] = clampByte(px[0]! + (c.r - px[0]!) * o)
    px[1] = clampByte(px[1]! + (c.g - px[1]!) * o)
    px[2] = clampByte(px[2]! + (c.b - px[2]!) * o)
  }
)

const longShadow: EffectDef = {
  type: 'long-shadow',
  category: 'shadow',
  params: [
    intP('angle', 0, 359, 45),
    intP('length', 1, 256, 16),
    colorP('color', '#000000'),
    intP('opacity', 0, 100, 60),
    { key: 'fade', kind: 'bool', def: false }
  ],
  influence: (p) => n(p, 'length'),
  apply(input, out, p) {
    const len = n(p, 'length')
    const ang = (n(p, 'angle') * Math.PI) / 180
    const ux = Math.cos(ang)
    const uy = Math.sin(ang)
    const steps: [number, number, number][] = []
    const seen = new Set<string>()
    for (let k = 1; k <= len; k++) {
      const sx = Math.round(k * ux)
      const sy = Math.round(k * uy)
      const key = `${sx},${sy}`
      if (seen.has(key)) continue
      seen.add(key)
      steps.push([sx, sy, p['fade'] ? 1 - (k - 1) / len : 1])
    }
    const plane = new Float32Array(out.w * out.h)
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        let m = 0
        for (const [sx, sy, w] of steps) {
          const i = regionIndex(input, out.x + x - sx, out.y + y - sy)
          if (i >= 0) m = Math.max(m, input.data[i + 3]! * w)
        }
        plane[y * out.w + x] = m
      }
    return paintPlane(
      input,
      out,
      plane,
      out.w,
      { x: 0, y: 0 },
      p['color'] as string,
      n(p, 'opacity'),
      true
    )
  }
}

export const EFFECT_DEFS: EffectDef[] = [
  dropShadow,
  innerShadow,
  longShadow,
  outerGlow,
  pixelOutline,
  gaussianBlurFx,
  boxBlurFx,
  waveFx,
  offsetFx,
  mosaicFx,
  hslFx,
  brightnessContrast,
  posterizeFx,
  invertFx,
  colorOverlay
]
