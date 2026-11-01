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
