import type { ID, PxImage } from '../model/types'
import { Bitmap, type Rect, clipRect } from '../raster/bitmap'
import { compositeAt, compositeOver } from '../raster/blend'
import type { Shape } from '../model/shapes'
import { renderShapeCached, renderShapeRegion } from './shape'
import { applyEffects, effectsInfluence, hasActiveEffects } from '../effects/registry'
import { type Region, regionFromBitmap } from '../effects/region'
import type { FloatingPixels } from '../raster/mask'

/**
 * Píxeles que un cambio puede alterar más allá de la región tocada por culpa de los efectos:
 * úsese para ampliar las regiones sucias.
 */
export function effectsReach(img: PxImage): number {
  const ctx = { width: img.width, height: img.height }
  let reach = 0
  for (const layer of img.layers) {
    let shapes = 0
    const visit = (list: Shape[]): void => {
      for (const sh of list) {
        if (sh.kind === 'group') visit(sh.children)
        if (hasActiveEffects(sh.effects))
          shapes = Math.max(shapes, effectsInfluence(sh.effects!, ctx))
      }
    }
    visit(layer.shapes)
    reach = Math.max(reach, shapes + effectsInfluence(layer.effects, ctx))
  }
  return reach
}

function regionBitmap(r: Region): Bitmap {
  return new Bitmap(r.rect.w, r.rect.h, r.data)
}

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
  let layerFx: Bitmap | null = null
  const ctx = { width: img.width, height: img.height }
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
        const sb = renderShapeCached(sh, img.width, img.height)
        if (!sb) continue
        if (hasActiveEffects(sh.effects)) {
          const fx = applyEffects(sh.effects!, regionFromBitmap(sb.bitmap, sb.x, sb.y), r, ctx)
          compositeAt(shapeScratch, regionBitmap(fx), r.x, r.y, sh.blendMode, sh.opacity, r)
        } else compositeAt(shapeScratch, sb.bitmap, sb.x, sb.y, sh.blendMode, sh.opacity, r)
      }
      const pb = pv ? renderShapeRegion(pv, img.width, img.height) : null
      if (pv && pb) compositeAt(shapeScratch, pb.bitmap, pb.x, pb.y, pv.blendMode, pv.opacity, r)
      src = shapeScratch
    }
    const f = extras.floating
    if (f && f.layerId === layer.id) {
      scratch ??= new Bitmap(img.width, img.height)
      scratch.data.set(src.data)
      stampOnto(scratch, f.pixels)
      src = scratch
    }
    if (hasActiveEffects(layer.effects)) {
      // Efectos de capa: se calculan sobre la composición ráster + formas, solo en la región.
      const fx = applyEffects(layer.effects, regionFromBitmap(src), r, ctx)
      layerFx ??= new Bitmap(img.width, img.height)
      for (let y = 0; y < r.h; y++)
        layerFx.data.set(
          fx.data.subarray(y * r.w * 4, (y + 1) * r.w * 4),
          ((r.y + y) * img.width + r.x) * 4
        )
      src = layerFx
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
