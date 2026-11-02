import type { ID, Layer, PxImage } from '../model/types'
import { Bitmap, type Rect, clipRect } from '../raster/bitmap'
import { compositeAt, compositeOver } from '../raster/blend'
import type { Shape } from '../model/shapes'
import { renderShape, renderShapeCached, renderShapeRegion } from './shape'
import { applyEffects, effectsInfluence, hasActiveEffects } from '../effects/registry'
import { type FxProvider, syncFx } from '../effects/async'
import { type Region, regionFromBitmap } from '../effects/region'
import type { Palette } from '../palette/palette'
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

/** Forma con sus efectos, a tamaño de imagen (para estampar); null si queda vacía. */
export function renderShapeFx(sh: Shape, w: number, h: number): Bitmap | null {
  if (!hasActiveEffects(sh.effects)) return renderShape(sh, w, h)
  const sb = renderShapeCached(sh, w, h)
  if (!sb) return null
  const fx = applyEffects(
    sh.effects!,
    regionFromBitmap(sb.bitmap, sb.x, sb.y),
    { x: 0, y: 0, w, h },
    { width: w, height: h }
  )
  return new Bitmap(w, h, fx.data)
}

function regionBitmap(r: Region): Bitmap {
  return new Bitmap(r.rect.w, r.rect.h, r.data)
}

export interface ComposeExtras {
  /** Píxeles flotantes que se ven encima de la capa indicada. */
  floating?: { layerId: ID; pixels: FloatingPixels } | null
  /** Forma en construcción (vista previa pixelada en vivo) sobre la capa indicada. */
  preview?: { layerId: ID; shape: Shape } | null
  /** Cómo se aplican los efectos (por defecto en línea; el visor usa workers). */
  fx?: FxProvider
  /** Paletas del documento (salida «ajustar a paleta» de los efectos). */
  palettes?: Palette[]
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
  const ctx = { width: img.width, height: img.height, palettes: extras.palettes }
  const provider = extras.fx ?? syncFx

  /** Contenido de una capa normal (ráster + formas + efectos); el bitmap es temporal y compartido. */
  const layerSource = (layer: Layer): Bitmap | null => {
    let src = rasters.get(layer.raster.id)
    if (!src) return null
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
          const fx = provider.apply(
            `shape:${sh.id}`,
            sh.effects!,
            regionFromBitmap(sb.bitmap, sb.x, sb.y),
            r,
            ctx
          )
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
      const fx = provider.apply(`layer:${layer.id}`, layer.effects, regionFromBitmap(src), r, ctx)
      layerFx ??= new Bitmap(img.width, img.height)
      for (let y = 0; y < r.h; y++)
        layerFx.data.set(
          fx.data.subarray(y * r.w * 4, (y + 1) * r.w * 4),
          ((r.y + y) * img.width + r.x) * 4
        )
      src = layerFx
    }
    return src
  }

  const live = (l: Layer): boolean => l.visible && l.opacity > 0

  /** Compone un elemento (capa o grupo) y pasa su contenido a `use`; los grupos usan un búfer propio. */
  const withSource = (item: Layer, use: (src: Bitmap) => void): void => {
    if (!item.isGroup) {
      const src = layerSource(item)
      if (src) use(src)
      return
    }
    const g = acquire(img.width, img.height, r)
    drawStack(
      img.layers.filter((m) => m.groupId === item.id),
      g
    )
    use(g)
    release(g)
  }

  /** Dibuja una lista de capas de abajo arriba, agrupando cada capa con sus máscaras de recorte. */
  const drawStack = (list: Layer[], dst: Bitmap): void => {
    for (let i = 0; i < list.length;) {
      const base = list[i]!
      let j = i + 1
      while (j < list.length && list[j]!.clip) j++
      const clips = list.slice(i + 1, j).filter(live)
      i = j
      if (!live(base)) continue
      if (!clips.length) {
        withSource(base, (src) => compositeOver(dst, src, base.blendMode, base.opacity, r))
        continue
      }
      // la base y sus recortes se componen aparte; el resultado se limita al alfa de la base
      const b = acquire(img.width, img.height, r)
      withSource(base, (src) => compositeOver(b, src, 'normal', 1, r))
      for (const c of clips)
        withSource(c, (src) => {
          const tmp = acquire(img.width, img.height, r)
          copyRegion(tmp, b, r)
          compositeOver(tmp, src, c.blendMode, c.opacity, r)
          for (let y = r.y; y < r.y + r.h; y++)
            for (let x = r.x; x < r.x + r.w; x++) {
              const p = (y * img.width + x) * 4
              if (b.data[p + 3]) {
                b.data[p] = tmp.data[p]!
                b.data[p + 1] = tmp.data[p + 1]!
                b.data[p + 2] = tmp.data[p + 2]!
              }
            }
          release(tmp)
        })
      compositeOver(dst, b, base.blendMode, base.opacity, r)
      release(b)
    }
  }

  drawStack(
    img.layers.filter((l) => !l.groupId),
    out
  )
}

// Búferes temporales reutilizados entre composiciones (evita reservar megabytes por trazo).
const POOL = new Map<string, Bitmap[]>()

function acquire(w: number, h: number, r: Rect): Bitmap {
  const bmp = POOL.get(`${w}x${h}`)?.pop() ?? new Bitmap(w, h)
  for (let y = r.y; y < r.y + r.h; y++) bmp.data.fill(0, (y * w + r.x) * 4, (y * w + r.x + r.w) * 4)
  return bmp
}

function release(b: Bitmap): void {
  const k = `${b.width}x${b.height}`
  const list = POOL.get(k) ?? []
  if (list.length < 6) list.push(b)
  POOL.set(k, list)
}

function copyRegion(dst: Bitmap, src: Bitmap, r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    const o = (y * src.width + r.x) * 4
    dst.data.set(src.data.subarray(o, o + r.w * 4), o)
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
