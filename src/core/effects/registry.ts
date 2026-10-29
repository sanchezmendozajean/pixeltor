// Registro de efectos (specs/06): esquemas, valores por defecto, cadena de aplicación y salida.

import { newId } from '../model/ids'
import type { Effect, EffectOutput } from '../model/types'
import type { Rect } from '../raster/bitmap'
import { ditherThreshold } from '../render/paint'
import { EFFECT_DEFS } from './defs'
import { type Region, cropRegion, expandRect } from './region'
import type { EffectContext, EffectDef, ParamValue } from './types'

export const EFFECTS: ReadonlyMap<string, EffectDef> = new Map(EFFECT_DEFS.map((d) => [d.type, d]))

export function effectDef(type: string): EffectDef | undefined {
  return EFFECTS.get(type)
}

/** Completa y recorta los parámetros según el esquema del efecto. */
export function resolveParams(
  def: EffectDef,
  raw: Record<string, ParamValue>
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const d of def.params) {
    const v = raw[d.key]
    switch (d.kind) {
      case 'int':
      case 'float': {
        const num = typeof v === 'number' && Number.isFinite(v) ? v : d.def
        const c = Math.min(d.max, Math.max(d.min, num))
        out[d.key] = d.kind === 'int' ? Math.round(c) : c
        break
      }
      case 'color':
        out[d.key] = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d.def
        break
      case 'bool':
        out[d.key] = typeof v === 'boolean' ? v : d.def
        break
      case 'enum':
        out[d.key] = typeof v === 'string' && d.options.includes(v) ? v : d.def
        break
    }
  }
  return out
}

export function defaultParams(def: EffectDef): Record<string, ParamValue> {
  return resolveParams(def, {})
}

export function newEffect(type: string): Effect | null {
  const def = EFFECTS.get(type)
  if (!def) return null
  return { id: newId(), type, enabled: true, params: defaultParams(def) }
}

const active = (effects: readonly Effect[]): { fx: Effect; def: EffectDef }[] =>
  effects.flatMap((fx) => {
    const def = fx.enabled ? EFFECTS.get(fx.type) : undefined
    return def ? [{ fx, def }] : []
  })

/** Hay algún efecto activo en la lista. */
export function hasActiveEffects(effects: readonly Effect[] | undefined): boolean {
  return !!effects && active(effects).length > 0
}

/** Píxeles que la cadena de efectos lee más allá de la región de salida. */
export function effectsInfluence(effects: readonly Effect[], ctx: EffectContext): number {
  return active(effects).reduce(
    (sum, { fx, def }) => sum + def.influence(resolveParams(def, fx.params), ctx),
    0
  )
}

/** Sección «Salida»: umbral/tramado del alfa y cuantización a la paleta. Modifica `r`. */
export function applyOutput(r: Region, out: EffectOutput | undefined, ctx: EffectContext): void {
  if (!out) return
  const d = r.data
  const w = r.rect.w
  if (out.alpha !== 'keep') {
    const t = out.threshold ?? 128
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3]!
      if (a === 0) continue
      if (out.alpha === 'threshold') d[i + 3] = a >= t ? 255 : 0
      else {
        const k = i / 4
        const x = r.rect.x + (k % w)
        const y = r.rect.y + Math.floor(k / w)
        d[i + 3] = a / 255 > ditherThreshold('bayer4', x, y) ? 255 : 0
      }
    }
  }
  const pal = out.quantizeToPalette
    ? ctx.palettes?.find((p) => p.id === out.quantizeToPalette)
    : undefined
  if (pal && pal.swatches.length) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      let best = pal.swatches[0]!.color
      let bd = Infinity
      for (const s of pal.swatches) {
        const dr = s.color.r - d[i]!
        const dg = s.color.g - d[i + 1]!
        const db = s.color.b - d[i + 2]!
        const dist = dr * dr + dg * dg + db * db
        if (dist < bd) {
          bd = dist
          best = s.color
        }
      }
      d[i] = best.r
      d[i + 1] = best.g
      d[i + 2] = best.b
    }
  }
}

/**
 * Aplica la cadena de efectos (de arriba abajo) a `input` y devuelve la región `out`.
 * Cada etapa calcula solo lo que las siguientes necesitan.
 */
export function applyEffects(
  effects: readonly Effect[],
  input: Region,
  out: Rect,
  ctx: EffectContext
): Region {
  const list = active(effects).map(({ fx, def }) => ({
    fx,
    def,
    params: resolveParams(def, fx.params)
  }))
  const infl = list.map((e) => e.def.influence(e.params, ctx))
  let cur = input
  for (let k = 0; k < list.length; k++) {
    let after = 0
    for (let j = k + 1; j < list.length; j++) after += infl[j]!
    const e = list[k]!
    cur = e.def.apply(cur, after ? expandRect(out, after) : out, e.params, ctx)
    applyOutput(cur, e.fx.output, ctx)
  }
  const r = cur.rect
  return r.x === out.x && r.y === out.y && r.w === out.w && r.h === out.h
    ? cur
    : cropRegion(cur, out)
}
