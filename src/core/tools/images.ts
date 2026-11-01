// Varias imágenes por documento (specs/08): crear, duplicar, eliminar, reordenar y editar la
// duración. Cada operación es un comando deshacible que guarda el estado de la lista de imágenes.

import { cloneLayerMeta } from '../model/document'
import { newId } from '../model/ids'
import type { Shape } from '../model/shapes'
import type { ID, Layer, PxImage } from '../model/types'
import { Bitmap } from '../raster/bitmap'
import type { HistoryCommand } from '../history/history'
import type { DocumentSession } from '../session'

export const MIN_DURATION_MS = 10
export const MAX_DURATION_MS = 60_000
const MAX_IMAGES = 1024

interface ImageState {
  images: PxImage[]
  activeImageId: ID
  activeLayerId: ID
}

function cloneImage(img: PxImage): PxImage {
  return {
    ...img,
    layers: img.layers.map(cloneLayerMeta),
    guides: img.guides?.map((g) => ({ ...g }))
  }
}

function capture(s: DocumentSession): ImageState {
  return {
    images: s.doc.images.map(cloneImage),
    activeImageId: s.activeImageId,
    activeLayerId: s.activeLayerId
  }
}

function restore(s: DocumentSession, st: ImageState): void {
  s.doc.images = st.images.map(cloneImage)
  s.activeImageId = st.activeImageId
  s.activeLayerId = st.activeLayerId
  // la selección de píxeles y de formas pertenece a la imagen anterior
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true })
}

class ImagesCommand implements HistoryCommand<DocumentSession> {
  memorySize: number
  time = Date.now()
  constructor(
    public label: string,
    private before: ImageState,
    private after: ImageState
  ) {
    this.memorySize = 4096
  }
  redo(s: DocumentSession): void {
    restore(s, this.after)
  }
  undo(s: DocumentSession): void {
    restore(s, this.before)
  }
}

/** Ejecuta `fn` y registra el cambio como un paso de historial. */
function change(s: DocumentSession, label: string, fn: () => boolean): boolean {
  const before = capture(s)
  if (!fn()) return false
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.history.record(new ImagesCommand(label, before, capture(s)))
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true })
  return true
}

function freshShapes(list: Shape[]): Shape[] {
  return list.map((sh) => {
    const c = JSON.parse(JSON.stringify(sh)) as Shape
    c.id = newId()
    if (c.kind === 'group') c.children = freshShapes(c.children)
    return c
  })
}

/** Copia de la imagen con ids nuevos; `content` = copiar los píxeles y las formas. */
function fresh(s: DocumentSession, src: PxImage, content: boolean, name: string): PxImage {
  const layers: Layer[] = src.layers.map((l) => {
    const copy = cloneLayerMeta(l)
    copy.id = newId()
    copy.raster = { id: newId(), width: src.width, height: src.height }
    const base = s.bitmapOf(l.id)
    s.rasters.set(copy.raster.id, content ? base.clone() : new Bitmap(src.width, src.height))
    copy.shapes = content ? freshShapes(l.shapes) : []
    if (!content) copy.effects = []
    return copy
  })
  return { ...cloneImage(src), id: newId(), name, layers, guides: content ? src.guides : [] }
}

const indexOf = (s: DocumentSession, id: ID): number => s.doc.images.findIndex((i) => i.id === id)

function nextName(s: DocumentSession): string {
  let n = s.doc.images.length + 1
  while (s.doc.images.some((i) => i.name === `Imagen ${n}`)) n++
  return `Imagen ${n}`
}

/** Activa otra imagen (no es un paso de historial): se conserva la capa del mismo nombre. */
export function setActiveImage(s: DocumentSession, id: ID): boolean {
  const img = s.doc.images.find((i) => i.id === id)
  if (!img || id === s.activeImageId) return false
  const name = s.activeLayer.name
  const layer = img.layers.find((l) => l.name === name) ?? img.layers[img.layers.length - 1]!
  s.activeImageId = id
  s.activeLayerId = layer.id
  s.selection = { mask: null, floating: null }
  s.selectedShapes = []
  s.isolatedGroup = null
  s.emit({ imageId: id, dirty: null, structure: true })
  return true
}

/** Imagen nueva tras la activa: vacía (mismas capas) o copia de la actual. */
export function addImage(s: DocumentSession, mode: 'duplicate' | 'empty' = 'duplicate'): ID | null {
  if (s.doc.images.length >= MAX_IMAGES) return null
  let id: ID | null = null
  const ok = change(s, mode === 'duplicate' ? 'Duplicar imagen' : 'Nueva imagen', () => {
    const src = s.image
    const img = fresh(s, src, mode === 'duplicate', nextName(s))
    s.doc.images.splice(indexOf(s, src.id) + 1, 0, img)
    const name = s.activeLayer.name
    s.activeImageId = img.id
    s.activeLayerId = (img.layers.find((l) => l.name === name) ?? img.layers[0]!).id
    id = img.id
    return true
  })
  return ok ? id : null
}

/** Duplica las imágenes indicadas (cada copia queda justo después de su original). */
export function duplicateImages(s: DocumentSession, ids: ID[]): ID[] {
  const made: ID[] = []
  change(s, ids.length > 1 ? 'Duplicar imágenes' : 'Duplicar imagen', () => {
    for (const id of ids) {
      const i = indexOf(s, id)
      if (i < 0 || s.doc.images.length >= MAX_IMAGES) continue
      const img = fresh(s, s.doc.images[i]!, true, `${s.doc.images[i]!.name} copia`)
      s.doc.images.splice(i + 1, 0, img)
      made.push(img.id)
    }
    if (made.length) {
      s.activeImageId = made[0]!
      s.activeLayerId = s.doc.images.find((x) => x.id === made[0])!.layers[0]!.id
    }
    return made.length > 0
  })
  return made
}

/** Elimina imágenes; siempre queda al menos una. */
export function deleteImages(s: DocumentSession, ids: ID[]): boolean {
  const gone = new Set(ids.filter((id) => indexOf(s, id) >= 0))
  if (!gone.size || gone.size >= s.doc.images.length) return false
  return change(s, gone.size > 1 ? 'Eliminar imágenes' : 'Eliminar imagen', () => {
    const at = Math.min(...[...gone].map((id) => indexOf(s, id)))
    s.doc.images = s.doc.images.filter((i) => !gone.has(i.id))
    if (gone.has(s.activeImageId)) {
      const next = s.doc.images[Math.min(at, s.doc.images.length - 1)]!
      s.activeImageId = next.id
      s.activeLayerId = next.layers[next.layers.length - 1]!.id
    }
    return true
  })
}

/** Mueve una imagen a la posición `to` (0 = primera). */
export function moveImage(s: DocumentSession, id: ID, to: number): boolean {
  const from = indexOf(s, id)
  const dest = Math.min(s.doc.images.length - 1, Math.max(0, to))
  if (from < 0 || from === dest) return false
  return change(s, 'Reordenar imágenes', () => {
    const [img] = s.doc.images.splice(from, 1)
    s.doc.images.splice(dest, 0, img!)
    return true
  })
}

/** Invierte el orden de las imágenes indicadas entre las posiciones que ocupan. */
export function reverseImages(s: DocumentSession, ids: ID[]): boolean {
  const idx = ids
    .map((id) => indexOf(s, id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  if (idx.length < 2) return false
  return change(s, 'Invertir orden', () => {
    const picked = idx.map((i) => s.doc.images[i]!).reverse()
    idx.forEach((i, k) => (s.doc.images[i] = picked[k]!))
    return true
  })
}

export function setImageDuration(s: DocumentSession, ids: ID[], ms: number): boolean {
  const v = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms)))
  const targets = s.doc.images.filter((i) => ids.includes(i.id) && i.durationMs !== v)
  if (!targets.length) return false
  return change(s, 'Duración de imagen', () => {
    for (const i of targets) i.durationMs = v
    return true
  })
}

export function setImageIncluded(s: DocumentSession, ids: ID[], included: boolean): boolean {
  const targets = s.doc.images.filter(
    (i) => ids.includes(i.id) && i.includeInAnimation !== included
  )
  if (!targets.length) return false
  return change(s, included ? 'Incluir en la animación' : 'Excluir de la animación', () => {
    for (const i of targets) i.includeInAnimation = included
    return true
  })
}

export function renameImage(s: DocumentSession, id: ID, name: string): boolean {
  const img = s.doc.images.find((i) => i.id === id)
  const n = name.trim()
  if (!img || !n || img.name === n) return false
  return change(s, 'Renombrar imagen', () => {
    img.name = n
    return true
  })
}

/** Duración total de la animación (solo imágenes incluidas), en ms. */
export function totalDuration(s: DocumentSession): number {
  return s.doc.images.filter((i) => i.includeInAnimation).reduce((n, i) => n + i.durationMs, 0)
}
