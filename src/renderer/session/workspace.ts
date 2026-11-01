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
import { AsyncFxProvider } from '@core/index'
import { Viewport } from '@/viewport/Viewport'
import type { ExportOptions } from '@/app/exportOps'
import { fxExecutor } from '@/workers/pool'
import { useUiStore } from '@/stores/ui'

export class Workspace {
  readonly viewport: Viewport
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
  /** Imagen que se está reproduciendo (null = se ve la activa). */
  playImageId: string | null = null
  private frameBmp: Bitmap | null = null
  /** Contador de cambios del documento (para cachés de papel cebolla). */
  version = 0
  private onionCache = new Map<string, { version: number; canvas: HTMLCanvasElement }>()
  /** Efectos calculados en workers; mientras tanto se ve el último resultado válido. */
  private readonly fx = new AsyncFxProvider(
    fxExecutor(),
    () => this.recompose(null),
    (busy) => {
      useUiStore().fxBusy = busy
    }
  )

  constructor(
    readonly id: string,
    readonly session: DocumentSession
  ) {
    const img = session.image
    this.viewport = new Viewport(img.width, img.height)
    this.composite = new Bitmap(img.width, img.height)
    this.recompose(null)
    this.unsub = session.onChange((e) => {
      this.version++
      if (this.playImageId) return // durante la reproducción el visor sólo muestra fotogramas
      const i = session.image
      if (i.width !== this.composite.width || i.height !== this.composite.height) {
        this.composite = new Bitmap(i.width, i.height)
        this.viewport.imageW = i.width
        this.viewport.imageH = i.height
        e.dirty = null
      }
      // Cambios estructurales (propiedades, orden, selección flotante): recomponer entera.
      this.recompose(e.structure ? null : e.dirty)
    })
  }

  get name(): string {
    return this.session.doc.name
  }

  /** Muestra otra imagen del documento sin activarla (reproducción); null = volver a la activa. */
  setPlayImage(id: string | null): void {
    this.playImageId = id
    const s = this.session
    let w = s.image.width
    let h = s.image.height
    if (id) {
      // el lienzo de reproducción es el de mayor tamaño; las imágenes menores se centran
      for (const i of s.doc.images) {
        if (!i.includeInAnimation) continue
        w = Math.max(w, i.width)
        h = Math.max(h, i.height)
      }
    }
    if (w !== this.composite.width || h !== this.composite.height) {
      this.composite = new Bitmap(w, h)
      this.viewport.imageW = w
      this.viewport.imageH = h
    }
    this.recompose(null)
  }

  private composePlayFrame(): void {
    const s = this.session
    const img = s.doc.images.find((i) => i.id === this.playImageId) ?? s.image
    if (!this.frameBmp || this.frameBmp.width !== img.width || this.frameBmp.height !== img.height)
      this.frameBmp = new Bitmap(img.width, img.height)
    composeImage(img, s.rasters, this.frameBmp, undefined, {
      fx: this.fx,
      palettes: s.doc.palettes
    })
    const out = this.composite
    out.data.fill(0)
    const ox = Math.floor((out.width - img.width) / 2)
    const oy = Math.floor((out.height - img.height) / 2)
    for (let y = 0; y < img.height; y++)
      out.data.set(
        this.frameBmp.data.subarray(y * img.width * 4, (y + 1) * img.width * 4),
        ((y + oy) * out.width + ox) * 4
      )
    for (const fn of this.redrawListeners) fn(null)
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
    if (this.playImageId) {
      this.composePlayFrame()
      return
    }
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
  }
}
