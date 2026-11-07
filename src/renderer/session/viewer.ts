// Estado de un visor (specs/09): su Viewport y los ajustes que son propios de cada visor.
// Es un objeto «crudo» (no reactivo), igual que el Workspace que lo contiene.

import type { Bitmap } from '@core/index'
import { Viewport } from '@/viewport/Viewport'
import { useUiStore } from '@/stores/ui'

export type TileMode = 'none' | 'both' | 'h' | 'v'

export class ViewerState {
  readonly viewport: Viewport
  /** Imagen fijada; null = sigue la activa. */
  imageId: string | null = null
  pixelGrid = true
  showPaths = true
  onion = false
  tiled: TileMode = 'none'
  /** Si está activo, comparte zoom y centro con los demás visores sincronizados. */
  sync = false
  /** Imagen en reproducción dentro de este visor (null = no reproduce). */
  playImageId: string | null = null
  /** Composición propia cuando muestra una imagen distinta de la activa o reproduce. */
  own: Bitmap | null = null
  ownStamp = ''
  /** Se ajustó al tamaño la primera vez que se mostró. */
  fitted = false
  /** Zoom y centro guardados en el archivo; se aplican al conocer el tamaño del visor. */
  restoreView: { zoom: number; cx: number; cy: number } | null = null
  /** Zoom y centro recordados de cada imagen que ha mostrado este visor. */
  views = new Map<string, { zoom: number; cx: number; cy: number }>()
  /** Última imagen mostrada (para guardar su vista y recuperar la de la siguiente al cambiar). */
  shownImageId: string | null = null

  /** Zoom y punto de la imagen en el centro del visor (null si aún no se ha mostrado). */
  captureView(): { zoom: number; cx: number; cy: number } | null {
    if (!this.fitted) return null
    const vp = this.viewport
    return {
      zoom: vp.zoom,
      cx: (vp.width / 2 - vp.panX) / vp.zoom,
      cy: (vp.height / 2 - vp.panY) / vp.zoom
    }
  }

  /** Aplica la vista guardada (si la hay) o encaja la imagen. */
  applyInitialView(): void {
    const r = this.restoreView
    this.restoreView = null
    const vp = this.viewport
    if (!r) return vp.fit()
    vp.zoom = r.zoom
    vp.panX = vp.width / 2 - r.cx * r.zoom
    vp.panY = vp.height / 2 - r.cy * r.zoom
    vp.panBy(0, 0)
  }

  constructor(
    readonly id: string,
    imageW: number,
    imageH: number
  ) {
    this.viewport = new Viewport(imageW, imageH)
  }

  /** Copia los ajustes de otro visor (al dividir, el nuevo se parece al original). */
  inherit(from: ViewerState): void {
    this.pixelGrid = from.pixelGrid
    this.showPaths = from.showPaths
    this.onion = from.onion
    this.tiled = from.tiled
    this.imageId = from.imageId
    const v = this.viewport
    const f = from.viewport
    v.zoom = f.zoom
    v.panX = f.panX
    v.panY = f.panY
    v.width = f.width
    v.height = f.height
    this.fitted = from.fitted
    this.views = new Map(from.views)
    this.shownImageId = from.shownImageId
    this.restoreView = from.restoreView
  }
}

/** Refleja en la interfaz (menús, botones) los ajustes del visor activo. */
export function mirrorViewerFlags(ws: { activeViewer: ViewerState }): void {
  const ui = useUiStore()
  const v = ws.activeViewer
  ui.pixelGrid = v.pixelGrid
  ui.showPaths = v.showPaths
  ui.onion.enabled = v.onion
}
