// Workspace = documento abierto en una pestaña: sesión del core + visor + composición viva.
// Es un objeto "crudo" (no reactivo): los buffers de píxeles nunca pasan por Pinia (regla 3).

import {
  Bitmap,
  type DocumentSession,
  type Shape,
  type Rect,
  composeImage,
  effectsReach
} from '@core/index'
import {
  AsyncFxProvider,
  invalidatePrefix,
  newPrefixCache,
  type LayoutNode,
  type SavedViewers,
  cloneLayout,
  type LayoutPreset,
  MAX_VIEWERS,
  PRESET_COUNT,
  equalize,
  type SplitDir,
  leaf,
  leaves,
  presetLayout,
  removeLeaf,
  splitLeaf
} from '@core/index'
import type { Viewport } from '@/viewport/Viewport'
import { ViewerState } from './viewer'
import type { ExportOptions } from '@/app/exportOps'
import { fxExecutor } from '@/workers/pool'
import { useUiStore } from '@/stores/ui'

export class Workspace {
  /** Visores del documento (hasta 4) y su disposición. */
  readonly viewers: ViewerState[] = []
  layout: LayoutNode
  /** Visor activo = el último en el que se hizo clic. */
  activeViewerId: string
  /** Visor que está atendiendo la entrada ahora mismo; las herramientas leen `viewport`. */
  ctx: ViewerState
  private layoutListeners = new Set<() => void>()
  private viewerSeq = 0
  /** Contador de recomposiciones, para invalidar las composiciones propias de cada visor. */
  private stamp = 0
  composite: Bitmap
  /** Ruta en disco; null mientras el documento no se haya guardado. */
  filePath: string | null = null
  /** Última ruta/escala de exportación, para «Exportar de nuevo». */
  lastExport: { path: string; options: ExportOptions } | null = null
  /** Forma en construcción que se ve pixelada en vivo. */
  private preview: Shape | null = null
  private redrawListeners = new Set<(r: Rect | null) => void>()
  private viewListeners = new Set<() => void>()
  private unsub: () => void
  /** Composición de las capas bajo la activa (se reutiliza mientras se edita la activa). */
  private readonly prefix = newPrefixCache()
  private frameBmp: Bitmap | null = null
  /** Contador de cambios del documento (para cachés de papel cebolla). */
  version = 0
  private onionCache = new Map<string, { version: number; canvas: HTMLCanvasElement }>()
  /** Efectos calculados en workers; mientras tanto se ve el último resultado válido. */
  private readonly fx = new AsyncFxProvider(
    fxExecutor(),
    () => {
      this.stamp++
      this.recompose(null)
    },
    (busy) => {
      useUiStore().fxBusy = busy
    }
  )

  constructor(
    readonly id: string,
    readonly session: DocumentSession
  ) {
    const img = session.image
    const first = this.addViewer(img.width, img.height)
    this.layout = leaf(first.id)
    this.activeViewerId = first.id
    this.ctx = first
    this.restoreViewers(session.doc.viewers)
    this.composite = new Bitmap(img.width, img.height)
    this.recompose(null)
    this.unsub = session.onChange((e) => {
      this.version++
      invalidatePrefix(this.prefix, session.image, e.layerIds)
      const i = session.image
      if (i.width !== this.composite.width || i.height !== this.composite.height) {
        this.composite = new Bitmap(i.width, i.height)
        e.dirty = null
      }
      // Cambios estructurales (propiedades, orden, selección flotante): recomponer entera.
      this.recompose(e.structure ? null : e.dirty)
    })
  }

  get name(): string {
    return this.session.doc.name
  }

  // ---------- Visores (specs/09) ----------

  /** Ajustes de visores y disposición para guardarlos en el documento. */
  snapshotViewers(): SavedViewers | undefined {
    const single = this.viewers.length === 1
    const v = this.viewers[0]!
    // un único visor con los ajustes por defecto no se guarda
    if (single && !v.imageId && v.pixelGrid && v.showPaths && !v.onion && v.tiled === 'none')
      return undefined
    return {
      layout: cloneLayout(this.layout),
      active: this.activeViewerId,
      viewers: this.viewers.map((x) => ({
        id: x.id,
        ...(x.imageId ? { imageId: x.imageId } : {}),
        pixelGrid: x.pixelGrid,
        showPaths: x.showPaths,
        onion: x.onion,
        tiled: x.tiled,
        sync: x.sync
      }))
    }
  }

  /** Reconstruye los visores de un documento abierto (el primero ya existe; se reutiliza). */
  private restoreViewers(saved: SavedViewers | undefined): void {
    if (!saved) return
    const ids = leaves(saved.layout)
    this.viewers.length = 0
    this.viewerSeq = 0
    const map = new Map<string, string>()
    for (const sid of ids) {
      const v = this.addViewer(this.session.image.width, this.session.image.height)
      map.set(sid, v.id)
      const s = saved.viewers.find((x) => x.id === sid)
      if (!s) continue
      v.imageId =
        s.imageId && this.session.doc.images.some((i) => i.id === s.imageId) ? s.imageId : null
      v.pixelGrid = s.pixelGrid ?? true
      v.showPaths = s.showPaths ?? true
      v.onion = s.onion ?? false
      v.tiled = s.tiled ?? 'none'
      v.sync = s.sync ?? false
    }
    const remap = (n: LayoutNode): LayoutNode =>
      n.kind === 'leaf' ? leaf(map.get(n.viewer)!) : { ...n, a: remap(n.a), b: remap(n.b) }
    this.layout = remap(saved.layout)
    this.activeViewerId = map.get(saved.active ?? ids[0]!) ?? this.viewers[0]!.id
    this.ctx = this.activeViewer
  }

  /** Zoom/desplazamiento del visor que atiende la entrada (lo usan las herramientas). */
  get viewport(): Viewport {
    return this.ctx.viewport
  }

  get activeViewer(): ViewerState {
    return this.viewers.find((v) => v.id === this.activeViewerId) ?? this.viewers[0]!
  }

  viewer(id: string): ViewerState | undefined {
    return this.viewers.find((v) => v.id === id)
  }

  private addViewer(w: number, h: number): ViewerState {
    const v = new ViewerState(`v${++this.viewerSeq}`, w, h)
    this.viewers.push(v)
    return v
  }

  setActiveViewer(id: string): void {
    const v = this.viewer(id)
    if (!v) return
    this.ctx = v
    if (this.activeViewerId === id) return
    this.activeViewerId = id
    this.emitLayout()
  }

  onLayout(fn: () => void): () => void {
    this.layoutListeners.add(fn)
    return () => this.layoutListeners.delete(fn)
  }

  private emitLayout(): void {
    for (const fn of this.layoutListeners) fn()
    this.refreshView()
  }

  /** Divide un visor; el nuevo hereda sus ajustes y se vuelve el activo. */
  splitViewer(id: string, dir: SplitDir): boolean {
    const src = this.viewer(id)
    if (!src || this.viewers.length >= MAX_VIEWERS) return false
    const v = this.addViewer(this.composite.width, this.composite.height)
    const next = splitLeaf(this.layout, id, dir, v.id)
    if (!next) {
      this.viewers.pop()
      return false
    }
    v.inherit(src)
    v.sync = src.sync
    this.layout = next
    this.activeViewerId = v.id
    this.ctx = v
    this.emitLayout()
    return true
  }

  closeViewer(id: string): boolean {
    const next = removeLeaf(this.layout, id)
    if (!next) return false
    if (this.viewer(id)?.playImageId) this.setViewerPlay(this.viewer(id)!, null)
    this.viewers.splice(
      this.viewers.findIndex((v) => v.id === id),
      1
    )
    this.layout = next
    if (this.activeViewerId === id) this.activeViewerId = leaves(next)[0]!
    this.ctx = this.activeViewer
    this.emitLayout()
    return true
  }

  /** Aplica un preset conservando los visores existentes (en orden) y creando o quitando los demás. */
  applyPreset(preset: LayoutPreset): void {
    const n = PRESET_COUNT[preset]
    const order = leaves(this.layout)
    while (order.length > n) {
      const id = order.pop()!
      if (this.viewer(id)?.playImageId) this.setViewerPlay(this.viewer(id)!, null)
      this.viewers.splice(
        this.viewers.findIndex((v) => v.id === id),
        1
      )
    }
    while (order.length < n) {
      const v = this.addViewer(this.composite.width, this.composite.height)
      v.inherit(this.activeViewer)
      order.push(v.id)
    }
    this.layout = presetLayout(preset, order)
    if (!this.viewer(this.activeViewerId)) this.activeViewerId = order[0]!
    this.ctx = this.activeViewer
    this.emitLayout()
  }

  /** Este visor atiende la entrada ahora mismo (las herramientas leen su Viewport). */
  enterViewer(v: ViewerState): void {
    this.ctx = v
  }

  equalizeLayout(): void {
    this.layout = equalize(this.layout)
    this.emitLayout()
  }

  /** Cambia un divisor (arrastre) o los iguala; la disposición ya es la del árbol vivo. */
  touchLayout(): void {
    this.emitLayout()
  }

  /** Zoom y centro compartidos entre los visores sincronizados (relativo al centro de cada uno). */
  syncFrom(src: ViewerState): void {
    if (!src.sync) return
    const sv = src.viewport
    const c = sv.toImageRaw(sv.width / 2, sv.height / 2)
    for (const v of this.viewers) {
      if (v === src || !v.sync) continue
      const vp = v.viewport
      vp.zoom = sv.zoom
      vp.panX = vp.width / 2 - c.x * vp.zoom
      vp.panY = vp.height / 2 - c.y * vp.zoom
      vp.panBy(0, 0)
    }
  }

  /** Qué imagen enseña el visor (la fijada o la activa). */
  imageIdOf(v: ViewerState): string {
    const s = this.session
    if (v.playImageId) return v.playImageId
    if (v.imageId && s.doc.images.some((i) => i.id === v.imageId)) return v.imageId
    return s.activeImageId
  }

  /** Reproduce una imagen dentro de un visor (null = volver a lo normal). */
  setViewerPlay(v: ViewerState, id: string | null): void {
    v.playImageId = id
    for (const fn of this.redrawListeners) fn(null)
  }

  /**
   * Bitmap que debe mostrar el visor. Si enseña la imagen activa es la composición compartida
   * (con actualización parcial); si enseña otra (fijada o en reproducción) se compone aparte.
   */
  displayFor(v: ViewerState): { bmp: Bitmap; own: boolean } {
    const s = this.session
    const id = this.imageIdOf(v)
    if (!v.playImageId && id === s.activeImageId) {
      v.viewport.imageW = this.composite.width
      v.viewport.imageH = this.composite.height
      return { bmp: this.composite, own: false }
    }
    const img = s.doc.images.find((i) => i.id === id) ?? s.image
    let w = img.width
    let h = img.height
    if (v.playImageId) {
      // el lienzo de reproducción es el de mayor tamaño; las imágenes menores se centran
      w = Math.max(w, s.image.width)
      h = Math.max(h, s.image.height)
      for (const i of s.doc.images) {
        if (!i.includeInAnimation) continue
        w = Math.max(w, i.width)
        h = Math.max(h, i.height)
      }
    }
    if (!v.own || v.own.width !== w || v.own.height !== h) {
      v.own = new Bitmap(w, h)
      v.ownStamp = ''
    }
    const key = `${this.version}|${this.stamp}|${id}`
    if (v.ownStamp !== key) {
      v.ownStamp = key
      if (
        !this.frameBmp ||
        this.frameBmp.width !== img.width ||
        this.frameBmp.height !== img.height
      )
        this.frameBmp = new Bitmap(img.width, img.height)
      composeImage(img, s.rasters, this.frameBmp, undefined, {
        fx: this.fx,
        palettes: s.doc.palettes
      })
      const out = v.own
      out.data.fill(0)
      const ox = Math.floor((out.width - img.width) / 2)
      const oy = Math.floor((out.height - img.height) / 2)
      for (let y = 0; y < img.height; y++)
        out.data.set(
          this.frameBmp.data.subarray(y * img.width * 4, (y + 1) * img.width * 4),
          ((y + oy) * out.width + ox) * 4
        )
    }
    v.viewport.imageW = v.own.width
    v.viewport.imageH = v.own.height
    return { bmp: v.own, own: true }
  }

  /**
   * Papel cebolla: imágenes vecinas de la activa como lienzos teñidos (rojo = anteriores,
   * azul = siguientes), con opacidad decreciente por distancia. Sólo se dibujan en el visor.
   */
  onionFrames(
    before: number,
    after: number,
    opacity: number,
    tint: boolean
  ): { canvas: HTMLCanvasElement; alpha: number }[] {
    const s = this.session
    const imgs = s.doc.images
    const a = imgs.findIndex((i) => i.id === s.activeImageId)
    const out: { canvas: HTMLCanvasElement; alpha: number }[] = []
    const add = (i: number, dist: number, count: number, color: [number, number, number]): void => {
      const img = imgs[i]
      if (!img) return
      const key = `${img.id}|${tint}|${color.join(',')}`
      let hit = this.onionCache.get(key)
      if (!hit || hit.version !== this.version) {
        const bmp = new Bitmap(img.width, img.height)
        composeImage(img, s.rasters, bmp, undefined, { palettes: s.doc.palettes })
        if (tint)
          for (let p = 0; p < bmp.data.length; p += 4) {
            if (!bmp.data[p + 3]) continue
            for (let c = 0; c < 3; c++)
              bmp.data[p + c] = Math.round(bmp.data[p + c]! * 0.4 + color[c]! * 0.6)
          }
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas
          .getContext('2d')!
          .putImageData(new ImageData(new Uint8ClampedArray(bmp.data), img.width, img.height), 0, 0)
        hit = { version: this.version, canvas }
        this.onionCache.set(key, hit)
      }
      out.push({ canvas: hit.canvas, alpha: opacity * (1 - (dist - 1) / (count + 1)) })
    }
    for (let k = 1; k <= before; k++) add(a - k, k, before, [255, 60, 60])
    for (let k = 1; k <= after; k++) add(a + k, k, after, [60, 120, 255])
    return out
  }

  private recompose(rect: Rect | null): void {
    const s = this.session
    const f = s.selection.floating
    // los efectos propagan un cambio más allá de la región tocada
    const reach = rect ? effectsReach(s.image) : 0
    if (rect && reach > 0) {
      const x0 = Math.max(0, rect.x - reach)
      const y0 = Math.max(0, rect.y - reach)
      const x1 = Math.min(s.image.width, rect.x + rect.w + reach)
      const y1 = Math.min(s.image.height, rect.y + rect.h + reach)
      rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }
    composeImage(s.image, s.rasters, this.composite, rect ?? undefined, {
      floating: f ? { layerId: s.activeLayerId, pixels: f } : null,
      fx: this.fx,
      palettes: s.doc.palettes,
      prefix: this.prefix,
      hotLayerId: s.activeLayerId,
      preview: this.preview ? { layerId: s.activeLayerId, shape: this.preview } : null
    })
    for (const fn of this.redrawListeners) fn(rect)
  }

  onRedraw(fn: (r: Rect | null) => void): () => void {
    this.redrawListeners.add(fn)
    return () => this.redrawListeners.delete(fn)
  }

  /** Recompone una región mientras se pinta (antes de que el comando se confirme). */
  liveDirty(rect: Rect | null): void {
    if (rect) this.recompose(rect)
  }

  setPreview(shape: Shape | null): void {
    if (!shape && !this.preview) return
    this.preview = shape
    this.recompose(null)
  }

  /** Cambió el zoom, el desplazamiento o la selección, pero no los píxeles. */
  refreshView(): void {
    for (const fn of this.viewListeners) fn()
  }

  onView(fn: () => void): () => void {
    this.viewListeners.add(fn)
    return () => this.viewListeners.delete(fn)
  }

  dispose(): void {
    this.unsub()
    this.fx.clear()
    this.redrawListeners.clear()
    this.viewListeners.clear()
    this.layoutListeners.clear()
  }
}
