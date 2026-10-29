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
import { fxExecutor } from '@/workers/pool'
import { useUiStore } from '@/stores/ui'

export class Workspace {
  readonly viewport: Viewport
  composite: Bitmap
  /** Ruta en disco; null mientras el documento no se haya guardado. */
  filePath: string | null = null
  /** Última ruta/escala de exportación, para «Exportar de nuevo». */
  lastExport: { path: string; scale: number } | null = null
  /** Forma en construcción que se ve pixelada en vivo. */
  private preview: Shape | null = null
  private redrawListeners = new Set<(r: Rect | null) => void>()
  private viewListeners = new Set<() => void>()
  private unsub: () => void
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
