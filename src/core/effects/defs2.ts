// Catálogo de efectos (2.ª parte): resplandor interior, iluminación direccional, bisel,
// desenfoque de movimiento, ondulación, torsión, mapa de degradado y reemplazar colores.

import type { Rect } from '../raster/bitmap'
import { blurReach, channelPlane, clampByte, gaussianBlur, parseColor } from './kernels'
import { type Region, cropRegion, expandRect, makeRegion, regionIndex } from './region'
import type { EffectDef, ParamDef, ParamValue } from './types'
import { EFFECT_DEFS } from './defs'

type P = Record<string, ParamValue>
type Px = [number, number, number, number]
const n = (p: P, k: string): number => p[k] as number

const colorP = (key: string, def: string): ParamDef => ({ key, kind: 'color', def })
const intP = (key: string, min: number, max: number, def: number): ParamDef => ({
  key,
  kind: 'int',
  min,
  max,
  def
})

const find = (type: string): EffectDef => EFFECT_DEFS.find((d) => d.type === type)!

/** Resplandor interior = sombra interior sin desplazamiento. */
const innerGlow: EffectDef = {
  type: 'inner-glow',
  category: 'shadow',
  params: [colorP('color', '#ffffff'), intP('opacity', 0, 100, 70), intP('radius', 0, 64, 3)],
  influence: (p, ctx) => find('inner-shadow').influence(asShadow(p), ctx),
  apply: (input, out, p, ctx) => find('inner-shadow').apply(input, out, asShadow(p), ctx)
}
const asShadow = (p: P): P => ({
  dx: 0,
  dy: 0,
  color: p['color']!,
  opacity: p['opacity']!,
  blur: p['radius']!,
  choke: 0
})

/**
 * Sombreado automático: el alfa desenfocado es un mapa de alturas; las caras que miran a la luz
 * se aclaran y las opuestas se oscurecen. `steps` > 0 cuantiza para un resultado de pixel art.
 */
function lighting(
  input: Region,
  out: Rect,
  width: number,
  angle: number,
  strength: number,
  light: string,
  shade: string,
  steps: number
): Region {
  const e = expandRect(out, width + 2)
  const h = gaussianBlur(channelPlane(input, e, 3), e.w, e.h, width)
  const lx = Math.cos((angle * Math.PI) / 180)
  const ly = Math.sin((angle * Math.PI) / 180)
  const L = parseColor(light)
  const S = parseColor(shade)
  const res = cropRegion(input, out)
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const o = (y * out.w + x) * 4
      if (res.data[o + 3] === 0) continue
      const ex = x + out.x - e.x
      const ey = y + out.y - e.y
      const gx = (h[ey * e.w + ex + 1]! - h[ey * e.w + ex - 1]!) / 2
      const gy = (h[(ey + 1) * e.w + ex]! - h[(ey - 1) * e.w + ex]!) / 2
      // la cara mira a la luz cuando la altura baja hacia ella
      let d = (-(gx * lx + gy * ly) / 255) * strength
      d = Math.max(-1, Math.min(1, d))
      if (steps > 0) d = Math.sign(d) * (Math.ceil(Math.abs(d) * steps - 1e-9) / steps)
      const c = d >= 0 ? L : S
      const k = Math.abs(d)
      res.data[o] = clampByte(res.data[o]! + (c.r - res.data[o]!) * k)
      res.data[o + 1] = clampByte(res.data[o + 1]! + (c.g - res.data[o + 1]!) * k)
      res.data[o + 2] = clampByte(res.data[o + 2]! + (c.b - res.data[o + 2]!) * k)
    }
  return res
}

const directionalLight: EffectDef = {
  type: 'directional-light',
  category: 'shadow',
  params: [
    intP('angle', 0, 359, 225),
    intP('width', 1, 8, 2),
    intP('intensity', 0, 100, 60),
    colorP('light', '#ffffff'),
    colorP('shade', '#000000'),
    intP('steps', 0, 8, 3)
  ],
  influence: (p) => n(p, 'width') + blurReach(n(p, 'width')) + 2,
  apply: (input, out, p) =>
    lighting(
      input,
      out,
      n(p, 'width'),
      n(p, 'angle'),
      n(p, 'intensity') / 12,
      p['light'] as string,
      p['shade'] as string,
      n(p, 'steps')
    )
}

const bevel: EffectDef = {
  type: 'bevel',
  category: 'shadow',
  params: [
    intP('size', 1, 8, 2),
    intP('depth', 0, 100, 70),
    intP('angle', 0, 359, 225),
    colorP('light', '#ffffff'),
    colorP('shade', '#000000')
  ],
  influence: (p) => n(p, 'size') + blurReach(n(p, 'size')) + 2,
  apply: (input, out, p) =>
    lighting(
      input,
      out,
      n(p, 'size'),
      n(p, 'angle'),
      n(p, 'depth') / 8,
      p['light'] as string,
      p['shade'] as string,
      2
    )
}

const motionBlur: EffectDef = {
  type: 'motion-blur',
  category: 'blur',
  params: [intP('angle', 0, 359, 0), intP('distance', 1, 64, 8)],
  influence: (p) => n(p, 'distance'),
  apply(input, out, p) {
    const d = n(p, 'distance')
    const a = (n(p, 'angle') * Math.PI) / 180
    const offs: [number, number][] = []
    for (let k = 0; k < d; k++) {
      const t = k - (d - 1) / 2
      offs.push([Math.round(t * Math.cos(a)), Math.round(t * Math.sin(a))])
    }
    const res = makeRegion(out)
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        let r = 0
        let g = 0
        let b = 0
        let al = 0
        for (const [ox, oy] of offs) {
          const i = regionIndex(input, out.x + x + ox, out.y + y + oy)
          if (i < 0) continue
          const sa = input.data[i + 3]!
          r += input.data[i]! * sa
          g += input.data[i + 1]! * sa
          b += input.data[i + 2]! * sa
          al += sa
        }
        const o = (y * out.w + x) * 4
        if (al > 0) {
          res.data[o] = clampByte(r / al)
          res.data[o + 1] = clampByte(g / al)
          res.data[o + 2] = clampByte(b / al)
          res.data[o + 3] = clampByte(al / offs.length)
        }
      }
    return res
  }
}

function remap(input: Region, out: Rect, src: (x: number, y: number) => [number, number]): Region {
  const res = makeRegion(out)
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const [sx, sy] = src(out.x + x, out.y + y)
      const i = regionIndex(input, sx, sy)
      if (i < 0) continue
      res.data.set(input.data.subarray(i, i + 4), (y * out.w + x) * 4)
    }
  return res
}

const ripple: EffectDef = {
  type: 'ripple',
  category: 'distort',
  params: [
    intP('cx', -2048, 4096, 16),
    intP('cy', -2048, 4096, 16),
    intP('amplitude', 0, 32, 2),
    intP('wavelength', 2, 128, 12)
  ],
  influence: (p) => n(p, 'amplitude'),
  apply(input, out, p) {
    const k = (2 * Math.PI) / n(p, 'wavelength')
    return remap(input, out, (x, y) => {
      const dx = x - n(p, 'cx')
      const dy = y - n(p, 'cy')
      const r = Math.hypot(dx, dy)
      if (r < 1e-9) return [x, y]
      const s = Math.round(n(p, 'amplitude') * Math.sin(k * r))
      return [Math.round(x - (dx / r) * s), Math.round(y - (dy / r) * s)]
    })
  }
}

const twirl: EffectDef = {
  type: 'twirl',
  category: 'distort',
  params: [
    intP('cx', -2048, 4096, 16),
    intP('cy', -2048, 4096, 16),
    intP('angle', -360, 360, 90),
    intP('radius', 1, 512, 16)
  ],
  influence: (p) => 2 * n(p, 'radius') + 1,
  apply(input, out, p) {
    const R = n(p, 'radius')
    return remap(input, out, (x, y) => {
      const dx = x - n(p, 'cx')
      const dy = y - n(p, 'cy')
      const r = Math.hypot(dx, dy)
      if (r >= R) return [x, y]
      const t = ((n(p, 'angle') * Math.PI) / 180) * (1 - r / R) ** 2
      const c = Math.cos(t)
      const s = Math.sin(t)
      return [Math.round(n(p, 'cx') + dx * c - dy * s), Math.round(n(p, 'cy') + dx * s + dy * c)]
    })
  }
}

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
      }
      return res
    }
  }
}

const gradientMap = pointwise(
  'gradient-map',
  [
    colorP('dark', '#1d2b53'),
    colorP('mid', '#ab5236'),
    colorP('light', '#fff1e8'),
    intP('steps', 0, 16, 0)
  ],
  (px, p) => {
    let t = (0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]) / 255
    const steps = n(p, 'steps')
    if (steps > 1) t = Math.round(t * (steps - 1)) / (steps - 1)
    const a = parseColor(p['dark'] as string)
    const m = parseColor(p['mid'] as string)
    const b = parseColor(p['light'] as string)
    const [c0, c1, u] = t < 0.5 ? [a, m, t * 2] : [m, b, (t - 0.5) * 2]
    px[0] = clampByte(c0.r + (c1.r - c0.r) * u)
    px[1] = clampByte(c0.g + (c1.g - c0.g) * u)
    px[2] = clampByte(c0.b + (c1.b - c0.b) * u)
  }
)

const colorReplace = pointwise(
  'color-replace',
  [colorP('from', '#ff0000'), colorP('to', '#0000ff'), intP('tolerance', 0, 255, 0)],
  (px, p) => {
    const f = parseColor(p['from'] as string)
    const dist = Math.max(Math.abs(px[0] - f.r), Math.abs(px[1] - f.g), Math.abs(px[2] - f.b))
    if (dist <= n(p, 'tolerance')) {
      const t = parseColor(p['to'] as string)
      px[0] = t.r
      px[1] = t.g
      px[2] = t.b
    }
  }
)

EFFECT_DEFS.push(
  innerGlow,
  directionalLight,
  bevel,
  motionBlur,
  ripple,
  twirl,
  gradientMap,
  colorReplace
)
