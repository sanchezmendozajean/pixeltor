// Comandos del espejo de capa (specs/13): elegir tipo, activar/desactivar, quitar y mover los ejes.

import { findLayer } from '../model/document'
import type { ID, LayerMirror, MirrorType } from '../model/types'
import { defaultMirror } from '../render/mirror'
import type { DocumentSession } from '../session'

/** Puede llevar espejo cualquier capa que no sea un grupo. */
export function canMirror(s: DocumentSession, layerId: ID): boolean {
  const l = findLayer(s.image, layerId)
  return !!l && !l.isGroup
}

/** Activa el espejo `type` en la capa (conserva la posición de los ejes si ya tenía uno). */
export function setLayerMirrorType(s: DocumentSession, layerId: ID, type: MirrorType): boolean {
  const layer = findLayer(s.image, layerId)
  if (!layer || layer.isGroup) return false
  const tx = s.begin('Espejo de capa')
  layer.mirror = layer.mirror
    ? { ...layer.mirror, type, enabled: true }
    : defaultMirror(type, s.image.width, s.image.height)
  return tx.commit({ model: true })
}

/** Activa o desactiva el espejo sin perder su configuración. */
export function setLayerMirrorEnabled(s: DocumentSession, layerId: ID, enabled: boolean): boolean {
  const layer = findLayer(s.image, layerId)
  if (!layer?.mirror || layer.mirror.enabled === enabled) return false
  const tx = s.begin(enabled ? 'Activar espejo' : 'Desactivar espejo')
  layer.mirror = { ...layer.mirror, enabled }
  return tx.commit({ model: true })
}

/** Quita el espejo de la capa. */
export function removeLayerMirror(s: DocumentSession, layerId: ID): boolean {
  const layer = findLayer(s.image, layerId)
  if (!layer?.mirror) return false
  const tx = s.begin('Quitar espejo')
  delete layer.mirror
  return tx.commit({ model: true })
}

/**
 * Qué se mueve al arrastrar: un eje vertical (x), uno horizontal (y), ambos a la vez (xy, junto a
 * su cruce) o el pivote de las diagonales (pivot).
 */
export type MirrorDragPart = 'x' | 'y' | 'xy' | 'pivot'

/** Arrastre de los ejes: se ve en vivo y el paso de historial se crea al soltar. */
export class MirrorDrag {
  private readonly tx

  constructor(
    private readonly s: DocumentSession,
    private readonly layerId: ID,
    private readonly part: MirrorDragPart
  ) {
    this.tx = s.begin('Mover eje de espejo')
  }

  /** Coloca el eje bajo el punto (coordenadas de imagen, con decimales). */
  moveTo(px: number, py: number): void {
    const layer = findLayer(this.s.image, this.layerId)
    const m = layer?.mirror
    if (!layer || !m) return
    const { width: w, height: h } = this.s.image
    const next: LayerMirror = { ...m }
    // los ejes vertical/horizontal van en el borde entre píxeles; las diagonales, en un píxel
    if (this.part === 'x' || this.part === 'xy')
      next.x = Math.min(w - 1, Math.max(1, Math.round(px)))
    if (this.part === 'y' || this.part === 'xy')
      next.y = Math.min(h - 1, Math.max(1, Math.round(py)))
    if (this.part === 'pivot') {
      next.x = Math.min(w - 1, Math.max(0, Math.floor(px)))
      next.y = Math.min(h - 1, Math.max(0, Math.floor(py)))
    }
    layer.mirror = next
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: [this.layerId]
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}
