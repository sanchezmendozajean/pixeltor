// Esquema de efectos (specs/06): cada tipo declara parámetros con rango y valor por defecto.

import type { Palette } from '../palette/palette'
import type { Region } from './region'

export type ParamValue = number | string | boolean

export type ParamDef =
  | { key: string; kind: 'int' | 'float'; min: number; max: number; def: number; step?: number }
  | { key: string; kind: 'color'; def: string }
  | { key: string; kind: 'bool'; def: boolean }
  | { key: string; kind: 'enum'; options: string[]; def: string }

export type EffectCategory = 'shadow' | 'outline' | 'blur' | 'distort' | 'color'

export interface EffectContext {
  /** Tamaño de la imagen (para efectos que envuelven o se anclan al origen). */
  width: number
  height: number
  palettes?: Palette[]
  /**
   * Borrador: mientras se arrastra un parámetro, los desenfoques se calculan a media resolución
   * (aproximado). Al soltar se recalcula el resultado exacto.
   */
  draft?: boolean
}

export interface EffectDef {
  type: string
  category: EffectCategory
  params: ParamDef[]
  /** Píxeles que el efecto lee más allá de la región de salida. */
  influence(p: Record<string, ParamValue>, ctx: EffectContext): number
  /** Calcula `out` (región de salida) leyendo `input`. */
  apply(
    input: Region,
    out: import('../raster/bitmap').Rect,
    p: Record<string, ParamValue>,
    ctx: EffectContext
  ): Region
  /** Valores de la sección «Salida» por defecto. */
  defaultOutput?: { alpha: 'keep' | 'threshold' | 'dither'; threshold?: number }
}
