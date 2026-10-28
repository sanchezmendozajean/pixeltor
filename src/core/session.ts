// DocumentSession: estado vivo de un documento abierto (specs/01).
// Reúne modelo, buffers de píxeles (fuera del modelo), selección e historial.
// Todo cambio pasa por una Transaction → comando deshacible (CLAUDE.md, regla 2).

import { deflateSync, inflateSync } from 'fflate'
import { History, type HistoryCommand } from './history/history'
import { cloneLayerMeta, createDocument, createLayer, findLayer } from './model/document'
import { newId } from './model/ids'
import type { ID, Layer, PixeltorDocument, PxImage } from './model/types'
import { MAX_LAYERS } from './model/types'
import { Bitmap, type Rect, clipRect, unionRect } from './raster/bitmap'
import type { FloatingPixels, PixelMask } from './raster/mask'

export const TILE = 64

export interface SelectionState {
  mask: PixelMask | null
  floating: FloatingPixels | null
}

export interface Snapshot {
  imageId: ID
  layers: Layer[]
  activeLayerId: ID
  selection: SelectionState
  shapes: ID[]
}

export interface ChangeEvent {
  imageId: ID
  /** Región de píxeles modificada (null = ninguna). */
  dirty: Rect | null
  /** Cambió la estructura de capas, sus propiedades o la selección. */
  structure: boolean
}

interface TileRecord {
  layerId: ID
  tx: number
  ty: number
  before: Uint8Array
  after: Uint8Array
}

const packTile = (d: Uint8ClampedArray): Uint8Array =>
  deflateSync(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), { level: 1 })
const unpackTile = (d: Uint8Array): Uint8ClampedArray => new Uint8ClampedArray(inflateSync(d))

function tileRect(tx: number, ty: number, w: number, h: number): Rect {
  return clipRect({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE }, w, h)
}

class EditCommand implements HistoryCommand<DocumentSession> {
  time = Date.now()
  memorySize: number

  constructor(
    public label: string,
    private tiles: TileRecord[],
    private before: Snapshot,
    private after: Snapshot,
    public mergeKey?: string
  ) {
    this.memorySize = tiles.reduce((n, t) => n + t.before.length + t.after.length, 0) + 512
  }

  redo(s: DocumentSession): void {
    this.apply(s, 'after')
  }
  undo(s: DocumentSession): void {
    this.apply(s, 'before')
  }

  mergeWith(next: HistoryCommand<DocumentSession>): boolean {
    if (!(next instanceof EditCommand) || this.tiles.length || next.tiles.length) return false
    this.after = next.after
    return true
  }

  private apply(s: DocumentSession, which: 'before' | 'after'): void {
    let dirty: Rect | null = null
    for (const t of this.tiles) {
      const bmp = s.rasters.get(s.layerRasterId(t.layerId))
      if (!bmp) continue
      const rect = tileRect(t.tx, t.ty, bmp.width, bmp.height)
      bmp.writeRect(rect, unpackTile(which === 'before' ? t.before : t.after))
      dirty = unionRect(dirty, rect)
    }
    s.restore(which === 'before' ? this.before : this.after, dirty)
  }
}

/** Edición en curso: acumula teselas "antes" y al confirmar genera un único comando. */
export class Transaction {
  private readonly before: Snapshot
  private readonly saved = new Map<
    string,
    { layerId: ID; tx: number; ty: number; data: Uint8ClampedArray }
  >()
  private dirty: Rect | null = null

  constructor(
    private readonly s: DocumentSession,
    private readonly label: string,
    private readonly mergeKey?: string
  ) {
    this.before = s.snapshot()
  }

  /** Avisa de que se va a modificar `rect` del ráster de la capa (guarda las teselas originales). */
  touch(layerId: ID, rect: Rect): void {
    const bmp = this.s.bitmapOf(layerId)
    const r = clipRect(rect, bmp.width, bmp.height)
    if (r.w <= 0 || r.h <= 0) return
    this.dirty = unionRect(this.dirty, r)
    for (let ty = Math.floor(r.y / TILE); ty <= Math.floor((r.y + r.h - 1) / TILE); ty++) {
      for (let tx = Math.floor(r.x / TILE); tx <= Math.floor((r.x + r.w - 1) / TILE); tx++) {
        const key = `${layerId}:${tx}:${ty}`
        if (this.saved.has(key)) continue
        const { data } = bmp.readRect(tileRect(tx, ty, bmp.width, bmp.height))
        this.saved.set(key, { layerId, tx, ty, data })
      }
    }
  }

  /**
   * Confirma la transacción. Con `model: true` se registra aunque no haya cambiado ningún píxel
   * (cambios de capas o selección). Devuelve false si no hubo nada que registrar.
   */
  commit(opts: { model?: boolean } = {}): boolean {
    const tiles: TileRecord[] = []
    for (const t of this.saved.values()) {
      const bmp = this.s.bitmapOf(t.layerId)
      const now = bmp.readRect(tileRect(t.tx, t.ty, bmp.width, bmp.height)).data
      if (now.every((v, i) => v === t.data[i])) continue
      tiles.push({
        layerId: t.layerId,
        tx: t.tx,
        ty: t.ty,
        before: packTile(t.data),
        after: packTile(now)
      })
    }
    if (!tiles.length && !opts.model) return false
    const cmd = new EditCommand(this.label, tiles, this.before, this.s.snapshot(), this.mergeKey)
    this.s.history.record(cmd)
    this.s.emit({ imageId: this.s.activeImageId, dirty: this.dirty, structure: !!opts.model })
    return true
  }
}

export class DocumentSession {
  readonly rasters = new Map<ID, Bitmap>()
  readonly history: History<DocumentSession>
  activeImageId: ID
  activeLayerId: ID
  selection: SelectionState = { mask: null, floating: null }
  /** Formas seleccionadas (herramienta Selección). */
  selectedShapes: ID[] = []
  private listeners = new Set<(e: ChangeEvent) => void>()

  constructor(
    public doc: PixeltorDocument,
    rasters?: Map<ID, Bitmap>
  ) {
    this.history = new History<DocumentSession>(this)
    for (const img of doc.images) {
      for (const l of img.layers) {
        this.rasters.set(
          l.raster.id,
          rasters?.get(l.raster.id) ?? new Bitmap(img.width, img.height)
        )
      }
    }
    this.activeImageId = doc.images[0]!.id
    this.activeLayerId = doc.images[0]!.layers[doc.images[0]!.layers.length - 1]!.id
  }

  static create(width: number, height: number, name?: string): DocumentSession {
    return new DocumentSession(createDocument(width, height, name))
  }

  get image(): PxImage {
    return this.doc.images.find((i) => i.id === this.activeImageId)!
  }
  get activeLayer(): Layer {
    return findLayer(this.image, this.activeLayerId) ?? this.image.layers[0]!
  }

  layerRasterId(layerId: ID): ID {
    for (const img of this.doc.images) {
      const l = findLayer(img, layerId)
      if (l) return l.raster.id
    }
    throw new Error(`Capa desconocida: ${layerId}`)
  }
  bitmapOf(layerId: ID): Bitmap {
    return this.rasters.get(this.layerRasterId(layerId))!
  }

  onChange(fn: (e: ChangeEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  emit(e: ChangeEvent): void {
    this.doc.metadata.modifiedAt = new Date().toISOString()
    for (const fn of this.listeners) fn(e)
  }

  snapshot(): Snapshot {
    return {
      imageId: this.activeImageId,
      layers: this.image.layers.map(cloneLayerMeta),
      activeLayerId: this.activeLayerId,
      selection: { ...this.selection },
      shapes: [...this.selectedShapes]
    }
  }

  restore(snap: Snapshot, dirty: Rect | null): void {
    this.activeImageId = snap.imageId
    const img = this.image
    img.layers = snap.layers.map(cloneLayerMeta)
    this.activeLayerId = snap.activeLayerId
    this.selection = { ...snap.selection }
    this.selectedShapes = [...snap.shapes]
    this.emit({ imageId: img.id, dirty, structure: true })
  }

  begin(label: string, mergeKey?: string): Transaction {
    return new Transaction(this, label, mergeKey)
  }

  undo(): string | null {
    return this.history.undo()?.label ?? null
  }
  redo(): string | null {
    return this.history.redo()?.label ?? null
  }

  // ---------- Capas ----------

  setActiveLayer(id: ID): void {
    if (!findLayer(this.image, id)) return
    this.activeLayerId = id
    this.emit({ imageId: this.activeImageId, dirty: null, structure: true })
  }

  addLayer(name?: string): Layer | null {
    const img = this.image
    if (img.layers.length >= MAX_LAYERS) return null
    const tx = this.begin('Nueva capa')
    const layer = createLayer(
      img.width,
      img.height,
      name ?? `Capa ${img.layers.length + 1}`,
      img.layers.length
    )
    this.rasters.set(layer.raster.id, new Bitmap(img.width, img.height))
    const at = img.layers.findIndex((l) => l.id === this.activeLayerId) + 1
    img.layers.splice(at, 0, layer)
    this.activeLayerId = layer.id
    tx.commit({ model: true })
    return layer
  }

  deleteLayer(id: ID): boolean {
    const img = this.image
    const i = img.layers.findIndex((l) => l.id === id)
    if (i < 0 || img.layers.length <= 1) return false
    const tx = this.begin('Eliminar capa')
    img.layers.splice(i, 1)
    if (this.activeLayerId === id)
      this.activeLayerId = img.layers[Math.min(i, img.layers.length - 1)]!.id
    tx.commit({ model: true })
    return true
  }

  duplicateLayer(id: ID): Layer | null {
    const img = this.image
    const i = img.layers.findIndex((l) => l.id === id)
    const src = img.layers[i]
    if (!src || img.layers.length >= MAX_LAYERS) return null
    const tx = this.begin('Duplicar capa')
    const copy: Layer = {
      ...cloneLayerMeta(src),
      id: newId(),
      name: `${src.name} copia`,
      raster: { ...src.raster, id: newId() }
    }
    this.rasters.set(copy.raster.id, this.rasters.get(src.raster.id)!.clone())
    img.layers.splice(i + 1, 0, copy)
    this.activeLayerId = copy.id
    tx.commit({ model: true })
    return copy
  }

  /** Mueve la capa a la posición `to` (0 = inferior). */
  moveLayer(id: ID, to: number): boolean {
    const img = this.image
    const from = img.layers.findIndex((l) => l.id === id)
    const dest = Math.max(0, Math.min(img.layers.length - 1, to))
    if (from < 0 || from === dest) return false
    const tx = this.begin('Reordenar capa')
    const [l] = img.layers.splice(from, 1)
    img.layers.splice(dest, 0, l!)
    tx.commit({ model: true })
    return true
  }

  /** Cambia propiedades de una capa; los cambios seguidos de la misma propiedad se fusionan. */
  setLayerProps(
    id: ID,
    patch: Partial<
      Pick<Layer, 'name' | 'visible' | 'locked' | 'lockAlpha' | 'opacity' | 'blendMode'>
    >
  ): void {
    const layer = findLayer(this.image, id)
    if (!layer) return
    const keys = Object.keys(patch).sort().join(',')
    const label =
      patch.visible !== undefined
        ? 'Visibilidad de capa'
        : patch.name !== undefined
          ? 'Renombrar capa'
          : 'Propiedades de capa'
    const tx = this.begin(label, `layer:${id}:${keys}`)
    if (patch.opacity !== undefined)
      patch = { ...patch, opacity: Math.min(1, Math.max(0, patch.opacity)) }
    Object.assign(layer, patch)
    tx.commit({ model: true })
  }

  /** Rellena una capa de transparente (Supr sin selección). */
  clearLayer(id: ID): void {
    const bmp = this.bitmapOf(id)
    const tx = this.begin('Borrar capa')
    tx.touch(id, { x: 0, y: 0, w: bmp.width, h: bmp.height })
    bmp.data.fill(0)
    tx.commit()
  }
}
