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
  /** Reservado para F2/F4; en F1 siempre vacío. */
  shapes: unknown[]
  effects: unknown[]
}

export interface PxImage {
  id: ID
  name: string
  width: number
  height: number
  durationMs: number
  includeInAnimation: boolean
  layers: Layer[]
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
  animation: { loop: 'loop' | 'pingpong' | 'once' }
  settings: DocumentSettings
  metadata: { createdAt: string; modifiedAt: string; app: string }
}

export const MAX_SIZE = 2048
export const MAX_LAYERS = 256
