import { FORMAT_VERSION } from './version'
import { newId } from './ids'
import { cloneShape } from './shapes'
import type { ID, Layer, PixeltorDocument, PxImage } from './types'
import { MAX_SIZE } from './types'

export const APP_NAME = 'Pixeltor 0.2.0'

const LAYER_COLORS = ['#4c8dff', '#ff6b6b', '#4ecb8d', '#ffb454', '#b07cff', '#3dd6d0']

export function clampSize(n: number): number {
  return Math.min(MAX_SIZE, Math.max(1, Math.round(n)))
}

export function createLayer(width: number, height: number, name: string, index = 0): Layer {
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    lockAlpha: false,
    opacity: 1,
    blendMode: 'normal',
    color: LAYER_COLORS[index % LAYER_COLORS.length]!,
    raster: { id: newId(), width, height },
    shapes: [],
    effects: []
  }
}

export function createImage(width: number, height: number, name = 'Imagen 1'): PxImage {
  const w = clampSize(width)
  const h = clampSize(height)
  return {
    id: newId(),
    name,
    width: w,
    height: h,
    durationMs: 100,
    includeInAnimation: true,
    layers: [createLayer(w, h, 'Capa 1')]
  }
}

export function createDocument(
  width: number,
  height: number,
  name = 'Sin título'
): PixeltorDocument {
  const now = new Date().toISOString()
  return {
    id: newId(),
    formatVersion: FORMAT_VERSION,
    name,
    images: [createImage(width, height)],
    animation: { loop: 'loop' },
    settings: { pixelGridMinZoom: 8, background: 'transparent' },
    metadata: { createdAt: now, modifiedAt: now, app: APP_NAME }
  }
}

export function findLayer(img: PxImage, id: ID): Layer | undefined {
  return img.layers.find((l) => l.id === id)
}

/** Copia de los metadatos de una capa (el ráster se comparte por id). */
export function cloneLayerMeta(l: Layer): Layer {
  return {
    ...l,
    raster: { ...l.raster },
    shapes: l.shapes.map(cloneShape),
    effects: [...l.effects]
  }
}
