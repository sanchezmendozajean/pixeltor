// Combinar capas: hacia abajo, visibles y aplanar. Se compone el conjunto con el mismo código que
// el visor (formas, efectos, opacidad y modos incluidos) y el resultado se estampa en una capa.
// Un solo paso deshacible; los rásters de las capas eliminadas quedan en la sesión para deshacer.

import { cloneLayerMeta } from '../model/document'
import type { ID, Layer } from '../model/types'
import { Bitmap } from '../raster/bitmap'
import { composeImage } from '../render/compose'
import type { DocumentSession } from '../session'

/** ¿Se puede combinar la capa activa con la de debajo? Ninguna puede ser grupo ni miembro de uno. */
export function canMergeDown(s: DocumentSession): boolean {
  const layers = s.image.layers
  const i = layers.findIndex((l) => l.id === s.activeLayerId)
  const top = layers[i]
  const base = layers[i - 1]
  if (!top || !base) return false
  return ![top, base].some((l) => l.isGroup || l.groupId || l.locked)
}

/** Compone `layers` (de abajo arriba) en un bitmap con el aspecto de la imagen. */
function compose(s: DocumentSession, layers: Layer[]): Bitmap {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage({ ...s.image, layers }, s.rasters, out, undefined, { palettes: s.doc.palettes })
  return out
}

function bake(
  s: DocumentSession,
  target: Layer,
  result: Bitmap,
  label: string,
  drop: Set<ID>
): void {
  const img = s.image
  const tx = s.begin(label)
  tx.touch(target.id, { x: 0, y: 0, w: img.width, h: img.height })
  s.bitmapOf(target.id).data.set(result.data)
  target.shapes = []
  target.effects = []
  delete target.clip
  delete target.groupId
  target.opacity = 1
  target.blendMode = 'normal'
  img.layers = img.layers.filter((l) => !drop.has(l.id))
  // los miembros que quedan de un grupo eliminado dejan de pertenecer a él
  const ids = new Set(img.layers.map((l) => l.id))
  for (const l of img.layers) if (l.groupId && !ids.has(l.groupId)) delete l.groupId
  s.activeLayerId = target.id
  s.selectedShapes = []
  tx.commit({ model: true })
}

/** Combina la capa activa con la de debajo (conserva el nombre, la opacidad y el modo de la base). */
export function mergeDown(s: DocumentSession): boolean {
  if (!canMergeDown(s)) return false
  const layers = s.image.layers
  const i = layers.findIndex((l) => l.id === s.activeLayerId)
  const top = layers[i]!
  const base = layers[i - 1]!
  // la base se compone sin su opacidad ni modo (los conserva la capa resultante)
  const tmpBase: Layer = { ...cloneLayerMeta(base), opacity: 1, blendMode: 'normal', clip: false }
  const result = compose(s, [tmpBase, cloneLayerMeta(top)])
  const { opacity, blendMode } = base
  bake(s, base, result, 'Combinar hacia abajo', new Set([top.id]))
  base.opacity = opacity
  base.blendMode = blendMode
  return true
}

/**
 * Aplana la imagen: todas las capas visibles (con grupos, recortes, formas y efectos) pasan a la
 * capa no-grupo inferior. Con `onlyVisible` las capas ocultas se conservan; si no, se descartan.
 */
export function flattenLayers(s: DocumentSession, onlyVisible: boolean): boolean {
  const img = s.image
  const groupVisible = new Map(img.layers.filter((l) => l.isGroup).map((l) => [l.id, l.visible]))
  const shown = (l: Layer): boolean =>
    l.visible && (!l.groupId || groupVisible.get(l.groupId) !== false)
  const set = onlyVisible ? img.layers.filter(shown) : img.layers.slice()
  const target = set.find((l) => !l.isGroup && !l.locked)
  if (!target || set.length < 2 || set.some((l) => l.locked)) return false
  const result = compose(s, set)
  const drop = new Set(set.filter((l) => l !== target).map((l) => l.id))
  bake(s, target, result, onlyVisible ? 'Combinar visibles' : 'Aplanar imagen', drop)
  return true
}
