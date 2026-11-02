// Grupos de capas y máscaras de recorte (specs/02). Modelo plano: la capa de grupo va justo
// encima de sus miembros contiguos (`groupId`), un solo nivel de anidamiento.

import { createLayer, findLayer } from '../model/document'
import { Bitmap } from '../raster/bitmap'
import type { ID, Layer } from '../model/types'
import { MAX_LAYERS } from '../model/types'
import type { DocumentSession } from '../session'

/** Miembros de un grupo, de abajo arriba. */
export function groupMembers(layers: Layer[], groupId: ID): Layer[] {
  return layers.filter((l) => l.groupId === groupId)
}

/** Agrupa la capa activa: crea una capa de grupo encima de ella y la hace su miembro. */
export function createGroup(s: DocumentSession, layerId: ID = s.activeLayerId): Layer | null {
  const img = s.image
  const layer = findLayer(img, layerId)
  if (!layer || layer.isGroup || layer.groupId || img.layers.length >= MAX_LAYERS) return null
  const tx = s.begin('Agrupar capa')
  const g = createLayer(
    img.width,
    img.height,
    `Grupo ${img.layers.filter((l) => l.isGroup).length + 1}`
  )
  g.isGroup = true
  s.rasters.set(g.raster.id, new Bitmap(img.width, img.height))
  img.layers.splice(img.layers.indexOf(layer) + 1, 0, g)
  layer.groupId = g.id
  s.activeLayerId = g.id
  tx.commit({ model: true })
  return g
}

/** Mete una capa en un grupo, como su miembro de más arriba. */
export function addToGroup(s: DocumentSession, layerId: ID, groupId: ID): boolean {
  const img = s.image
  const layer = findLayer(img, layerId)
  const head = findLayer(img, groupId)
  if (!layer || !head?.isGroup || layer.isGroup || layer.groupId === groupId) return false
  const tx = s.begin('Añadir capa al grupo')
  img.layers = img.layers.filter((l) => l !== layer)
  img.layers.splice(img.layers.indexOf(head), 0, layer)
  layer.groupId = groupId
  tx.commit({ model: true })
  return true
}

/** Saca una capa de su grupo y la deja justo encima de él. */
export function removeFromGroup(s: DocumentSession, layerId: ID): boolean {
  const img = s.image
  const layer = findLayer(img, layerId)
  const head = layer?.groupId ? findLayer(img, layer.groupId) : undefined
  if (!layer || !head) return false
  const tx = s.begin('Sacar capa del grupo')
  img.layers = img.layers.filter((l) => l !== layer)
  img.layers.splice(img.layers.indexOf(head) + 1, 0, layer)
  delete layer.groupId
  tx.commit({ model: true })
  return true
}

/** Disuelve un grupo: sus miembros quedan sueltos en su sitio. */
export function ungroup(s: DocumentSession, groupId: ID): boolean {
  const img = s.image
  const head = findLayer(img, groupId)
  if (!head?.isGroup) return false
  const members = groupMembers(img.layers, groupId)
  const tx = s.begin('Desagrupar capas')
  for (const m of members) delete m.groupId
  img.layers = img.layers.filter((l) => l !== head)
  if (s.activeLayerId === groupId)
    s.activeLayerId = (members[members.length - 1] ?? img.layers[0]!).id
  tx.commit({ model: true })
  return true
}

/** Crea o libera la máscara de recorte de una capa (necesita una capa base debajo, en su misma pila). */
export function toggleClip(s: DocumentSession, layerId: ID = s.activeLayerId): boolean {
  const img = s.image
  const layer = findLayer(img, layerId)
  if (!layer) return false
  if (!layer.clip) {
    const i = img.layers.indexOf(layer)
    const below = img.layers[i - 1]
    // la base debe ser de la misma pila: mismo grupo (o ambas sueltas)
    if (!below || below.groupId !== layer.groupId) return false
  }
  s.setLayerProps(layerId, { clip: !layer.clip })
  return true
}
