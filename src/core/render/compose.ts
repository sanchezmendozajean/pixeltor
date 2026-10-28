import type { ID, PxImage } from '../model/types'
import { Bitmap, type Rect, clipRect } from '../raster/bitmap'
import { compositeOver } from '../raster/blend'
import type { Shape } from '../model/shapes'
import { renderShape, renderShapeCached } from './shape'
import type { FloatingPixels } from '../raster/mask'

export interface ComposeExtras {
  /** Píxeles flotantes que se ven encima de la capa indicada. */
  floating?: { layerId: ID; pixels: FloatingPixels } | null
  /** Forma en construcción (vista previa pixelada en vivo) sobre la capa indicada. */
  preview?: { layerId: ID; shape: Shape } | null
}

/**
 * Compone la imagen en `out` (mismo tamaño que la imagen) limitándose a `rect`.
 * Determinista: depende solo de las capas y sus rásters (specs/03).
 */
export function composeImage(
  img: PxImage,
  rasters: ReadonlyMap<ID, Bitmap>,
  out: Bitmap,
  rect?: Rect,
  extras: ComposeExtras = {}
): void {
  const r = clipRect(rect ?? { x: 0, y: 0, w: img.width, h: img.height }, img.width, img.height)
  if (r.w <= 0 || r.h <= 0) return
  for (let y = r.y; y < r.y + r.h; y++) {
    out.data.fill(0, (y * out.width + r.x) * 4, (y * out.width + r.x + r.w) * 4)
  }
  let scratch: Bitmap | null = null
  let shapeScratch: Bitmap | null = null
  for (const layer of img.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    let src = rasters.get(layer.raster.id)
    if (!src) continue
    const pv = extras.preview && extras.preview.layerId === layer.id ? extras.preview.shape : null
    if (layer.shapes.length || pv) {
      // Estampado virtual: el ráster base + las formas visibles, de abajo arriba.
      shapeScratch ??= new Bitmap(img.width, img.height)
      shapeScratch.data.set(src.data)
      for (const sh of layer.shapes) {
        if (!sh.visible) continue
        compositeOver(
          shapeScratch,
          renderShapeCached(sh, img.width, img.height),
          sh.blendMode,
          sh.opacity,
          r
        )
      }
      if (pv)
        compositeOver(
          shapeScratch,
          renderShape(pv, img.width, img.height),
          pv.blendMode,
          pv.opacity,
          r
        )
      src = shapeScratch
    }
    const f = extras.floating
    if (f && f.layerId === layer.id) {
      scratch ??= new Bitmap(img.width, img.height)
      scratch.data.set(src.data)
      stampOnto(scratch, f.pixels)
      src = scratch
    }
    compositeOver(out, src, layer.blendMode, layer.opacity, r)
  }
}

/** Dibuja un bitmap (con alfa) sobre otro en (x, y) usando "normal"; recorta a los límites. */
export function stampOnto(dst: Bitmap, f: FloatingPixels): void {
  const tmp = new Bitmap(dst.width, dst.height)
  const r = clipRect(
    { x: f.x, y: f.y, w: f.bitmap.width, h: f.bitmap.height },
    dst.width,
    dst.height
  )
  for (let y = r.y; y < r.y + r.h; y++) {
    const s = ((y - f.y) * f.bitmap.width + (r.x - f.x)) * 4
    tmp.data.set(f.bitmap.data.subarray(s, s + r.w * 4), (y * dst.width + r.x) * 4)
  }
  compositeOver(dst, tmp, 'normal', 1, r)
}
