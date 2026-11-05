// Tamaño de lienzo y recorte (specs/02): cambia las dimensiones de la imagen activa recortando o
// ampliando los rásters de todas sus capas y desplazando formas y guías según el ancla elegida.
// Es un único comando deshacible que conserva los rásters anteriores.

import { cloneLayerMeta } from '../model/document'
import type { Guide, ID, Layer } from '../model/types'
import { MAX_SIZE } from '../model/types'
import { Bitmap } from '../raster/bitmap'
import type { HistoryCommand } from '../history/history'
import type { DocumentSession } from '../session'
import { commitFloating } from './selection'

/** Ancla 3×3: columna y fila (0 = inicio, 1 = centro, 2 = fin). */
export interface CanvasAnchor {
  x: 0 | 1 | 2
  y: 0 | 1 | 2
}

interface ImageState {
  width: number
  height: number
  layers: Layer[]
  guides: Guide[]
  rasters: Map<ID, Bitmap>
}

function capture(s: DocumentSession): ImageState {
  const img = s.image
  const rasters = new Map<ID, Bitmap>()
  for (const l of img.layers) rasters.set(l.raster.id, s.rasters.get(l.raster.id)!)
  return {
    width: img.width,
    height: img.height,
    layers: img.layers.map(cloneLayerMeta),
    guides: (img.guides ?? []).map((g) => ({ ...g })),
    rasters
  }
}

function restore(s: DocumentSession, imageId: ID, st: ImageState): void {
  const img = s.doc.images.find((i) => i.id === imageId)!
  img.width = st.width
  img.height = st.height
  img.layers = st.layers.map(cloneLayerMeta)
  img.guides = st.guides.map((g) => ({ ...g }))
  for (const [id, bmp] of st.rasters) s.rasters.set(id, bmp)
  s.activeImageId = imageId
  if (!img.layers.some((l) => l.id === s.activeLayerId)) s.activeLayerId = img.layers[0]!.id
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.emit({ imageId, dirty: null, structure: true })
}

class ResizeCommand implements HistoryCommand<DocumentSession> {
  memorySize: number
  time = Date.now()
  constructor(
    public label: string,
    private imageId: ID,
    private before: ImageState,
    private after: ImageState
  ) {
    let n = 4096
    for (const st of [before, after]) for (const b of st.rasters.values()) n += b.data.length
    this.memorySize = n
  }
  redo(s: DocumentSession): void {
    restore(s, this.imageId, this.after)
  }
  undo(s: DocumentSession): void {
    restore(s, this.imageId, this.before)
  }
}

/** Copia `src` en un bitmap nuevo de `w`×`h` con su esquina superior izquierda en (dx, dy). */
function relocate(src: Bitmap, w: number, h: number, dx: number, dy: number): Bitmap {
  const out = new Bitmap(w, h)
  const x0 = Math.max(0, dx)
  const x1 = Math.min(w, dx + src.width)
  if (x1 <= x0) return out
  for (let y = Math.max(0, dy); y < Math.min(h, dy + src.height); y++) {
    const from = ((y - dy) * src.width + (x0 - dx)) * 4
    out.data.set(src.data.subarray(from, from + (x1 - x0) * 4), (y * w + x0) * 4)
  }
  return out
}

/**
 * Cambia el lienzo de la imagen activa a `width`×`height`. El contenido actual se coloca con su
 * esquina superior izquierda en (`dx`, `dy`) dentro del lienzo nuevo (negativo = recorta).
 */
export function resizeCanvasTo(
  s: DocumentSession,
  width: number,
  height: number,
  dx: number,
  dy: number,
  label = 'Tamaño de lienzo'
): boolean {
  const img = s.image
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) return false
  if (width === img.width && height === img.height && dx === 0 && dy === 0) return false
  commitFloating(s)

  const before = capture(s)
  img.width = width
  img.height = height
  for (const l of img.layers) {
    const next = relocate(s.rasters.get(l.raster.id)!, width, height, dx, dy)
    s.rasters.set(l.raster.id, next)
    l.raster = { ...l.raster, width, height }
    for (const sh of l.shapes) {
      sh.transform = [
        sh.transform[0],
        sh.transform[1],
        sh.transform[2],
        sh.transform[3],
        sh.transform[4] + dx,
        sh.transform[5] + dy
      ]
    }
  }
  if (img.guides) {
    img.guides = img.guides
      .map((g) => ({ ...g, pos: g.pos + (g.axis === 'v' ? dx : dy) }))
      .filter((g) => g.pos >= 0 && g.pos <= (g.axis === 'v' ? width : height))
  }
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.isolatedGroup = null
  s.history.record(new ResizeCommand(label, img.id, before, capture(s)))
  s.emit({ imageId: img.id, dirty: null, structure: true })
  return true
}

/** Tamaño de lienzo con ancla 3×3: el contenido se ancla a esa posición del lienzo nuevo. */
export function resizeCanvas(
  s: DocumentSession,
  width: number,
  height: number,
  anchor: CanvasAnchor = { x: 0, y: 0 }
): boolean {
  const dx = Math.floor(((width - s.image.width) * anchor.x) / 2)
  const dy = Math.floor(((height - s.image.height) * anchor.y) / 2)
  return resizeCanvasTo(s, width, height, dx, dy)
}

/** Recorta el lienzo al rectángulo que envuelve la selección de píxeles. */
export function cropToSelection(s: DocumentSession): boolean {
  const b = s.selection.mask?.bounds()
  if (!b) return false
  return resizeCanvasTo(s, b.w, b.h, -b.x, -b.y, 'Recortar a la selección')
}

/** Remuestrea por vecino más cercano (sin suavizado: es pixel art). */
function scaleBitmap(src: Bitmap, w: number, h: number): Bitmap {
  const out = new Bitmap(w, h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor(((y + 0.5) * src.height) / h))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(((x + 0.5) * src.width) / w))
      const i = (sy * src.width + sx) * 4
      out.data.set(src.data.subarray(i, i + 4), (y * w + x) * 4)
    }
  }
  return out
}

/**
 * Tamaño de imagen: escala la imagen activa a `width`×`height` (vecino más cercano). Las formas se
 * escalan con ella; los efectos y los grosores de contorno conservan sus valores en píxeles.
 */
export function resizeImage(s: DocumentSession, width: number, height: number): boolean {
  const img = s.image
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) return false
  if (width === img.width && height === img.height) return false
  commitFloating(s)

  const before = capture(s)
  const sx = width / img.width
  const sy = height / img.height
  img.width = width
  img.height = height
  for (const l of img.layers) {
    s.rasters.set(l.raster.id, scaleBitmap(s.rasters.get(l.raster.id)!, width, height))
    l.raster = { ...l.raster, width, height }
    for (const sh of l.shapes) {
      const [a, b, c, d, e, f] = sh.transform
      sh.transform = [a * sx, b * sy, c * sx, d * sy, e * sx, f * sy]
    }
  }
  if (img.guides)
    img.guides = img.guides.map((g) => ({
      ...g,
      pos: Math.round(g.pos * (g.axis === 'v' ? sx : sy))
    }))
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.isolatedGroup = null
  s.history.record(new ResizeCommand('Tamaño de imagen', img.id, before, capture(s)))
  s.emit({ imageId: img.id, dirty: null, structure: true })
  return true
}
