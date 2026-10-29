// Modelo de documento (specs/02). Solo el subconjunto de F1: sin formas ni efectos todavía.

export type ID = string
export type RGBA = { r: number; g: number; b: number; a: number }

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'add'
  | 'subtract'
  | 'difference'

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'add',
  'subtract',
  'difference'
]

import type { Shape } from './shapes'
import type { Palette } from '../palette/palette'

/** Sección «Salida» común de los efectos (specs/06). */
export interface EffectOutput {
  alpha: 'keep' | 'threshold' | 'dither'
  threshold?: number
  /** Cuantiza los colores a esta paleta del documento. */
  quantizeToPalette?: ID
}

/** Efecto no destructivo de una forma o de una capa. */
export interface Effect {
  id: ID
  type: string
  enabled: boolean
  params: Record<string, number | string | boolean>
  output?: EffectOutput
}

export interface RasterRef {
  id: ID
  width: number
  height: number
}

export interface Layer {
  id: ID
  name: string
  visible: boolean
  locked: boolean
  lockAlpha: boolean
  opacity: number
  blendMode: BlendMode
  color: string
  raster: RasterRef
  /** [0] = forma inferior. */
  shapes: Shape[]
  effects: Effect[]
}

/** Guía de la imagen: línea horizontal (`h`, posición y) o vertical (`v`, posición x), en px. */
export interface Guide {
  id: ID
  axis: 'h' | 'v'
  pos: number
}

export interface PxImage {
  id: ID
  name: string
  width: number
  height: number
  durationMs: number
  includeInAnimation: boolean
  layers: Layer[]
  guides?: Guide[]
}

export interface DocumentSettings {
  pixelGridMinZoom: number
  background: 'transparent' | RGBA
}

export interface PixeltorDocument {
  id: ID
  formatVersion: string
  name: string
  images: PxImage[]
  /** Paletas del documento; la primera es la activa del panel Muestras. */
  palettes?: Palette[]
  animation: { loop: 'loop' | 'pingpong' | 'once' }
  settings: DocumentSettings
  metadata: { createdAt: string; modifiedAt: string; app: string }
}

export const MAX_SIZE = 2048
export const MAX_LAYERS = 256
