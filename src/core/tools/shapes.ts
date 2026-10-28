// Operaciones sobre formas vectoriales y estampado (specs/05, 07). Todo pasa por Transactions.

import type { Mat2D, Shape } from '../model/shapes'
import { cloneShape } from '../model/shapes'
import { newId } from '../model/ids'
import type { ID, Layer } from '../model/types'
import { compositeOver } from '../raster/blend'
import { renderShape } from '../render/shape'
import type { DocumentSession } from '../session'

function findShape(
  s: DocumentSession,
  id: ID
): { layer: Layer; index: number; shape: Shape } | null {
  for (const layer of s.image.layers) {
    const index = layer.shapes.findIndex((x) => x.id === id)
    if (index >= 0) return { layer, index, shape: layer.shapes[index]! }
  }
  return null
}

export function getShape(s: DocumentSession, id: ID): Shape | null {
  return findShape(s, id)?.shape ?? null
}

/** Añade una forma encima de las demás de la capa activa y la selecciona. */
export function addShape(s: DocumentSession, shape: Shape): boolean {
  const layer = s.activeLayer
  if (layer.locked || !layer.visible) return false
  const tx = s.begin(`Crear ${shape.name}`)
  layer.shapes.push(shape)
  s.selectedShapes = [shape.id]
  tx.commit({ model: true })
  return true
}

/** Edita una forma. Cambios seguidos con la misma `mergeKey` forman un único paso. */
export function updateShape(
  s: DocumentSession,
  id: ID,
  fn: (shape: Shape) => void,
  label: string,
  mergeKey?: string
): boolean {
  const f = findShape(s, id)
  if (!f) return false
  const tx = s.begin(label, mergeKey)
  fn(f.shape)
  tx.commit({ model: true })
  return true
}

export function translateMat(m: Mat2D, dx: number, dy: number): Mat2D {
  return [m[0], m[1], m[2], m[3], m[4] + dx, m[5] + dy]
}

export function moveShapes(
  s: DocumentSession,
  ids: ID[],
  dx: number,
  dy: number,
  mergeKey?: string
): void {
  if (!ids.length || (dx === 0 && dy === 0)) return
  const tx = s.begin(ids.length === 1 ? 'Mover forma' : `Mover ${ids.length} formas`, mergeKey)
  for (const id of ids) {
    const f = findShape(s, id)
    if (f && !f.layer.locked) f.shape.transform = translateMat(f.shape.transform, dx, dy)
  }
  tx.commit({ model: true })
}

export function removeShapes(s: DocumentSession, ids: ID[]): boolean {
  const set = new Set(ids)
  let any = false
  const tx = s.begin(set.size === 1 ? 'Eliminar forma' : `Eliminar ${set.size} formas`)
  for (const layer of s.image.layers) {
    if (layer.locked) continue
    const before = layer.shapes.length
    layer.shapes = layer.shapes.filter((x) => !set.has(x.id))
    any ||= layer.shapes.length !== before
  }
  s.selectedShapes = s.selectedShapes.filter((x) => !set.has(x))
  if (any) tx.commit({ model: true })
  return any
}

export function selectShapes(s: DocumentSession, ids: ID[]): void {
  s.selectedShapes = ids
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true })
}

export type Arrange = 'front' | 'forward' | 'backward' | 'back'

export function arrangeShapes(s: DocumentSession, ids: ID[], how: Arrange): void {
  const tx = s.begin('Organizar')
  for (const layer of s.image.layers) {
    const sel = new Set(ids)
    const list = layer.shapes
    if (!list.some((x) => sel.has(x.id))) continue
    if (how === 'front')
      layer.shapes = [...list.filter((x) => !sel.has(x.id)), ...list.filter((x) => sel.has(x.id))]
    else if (how === 'back')
      layer.shapes = [...list.filter((x) => sel.has(x.id)), ...list.filter((x) => !sel.has(x.id))]
    else if (how === 'forward') {
      for (let i = list.length - 2; i >= 0; i--)
        if (sel.has(list[i]!.id) && !sel.has(list[i + 1]!.id))
          [list[i], list[i + 1]] = [list[i + 1]!, list[i]!]
    } else {
      for (let i = 1; i < list.length; i++)
        if (sel.has(list[i]!.id) && !sel.has(list[i - 1]!.id))
          [list[i], list[i - 1]] = [list[i - 1]!, list[i]!]
    }
  }
  tx.commit({ model: true })
}

/** Mueve formas a otra capa (quedan encima de las que ya tenga). */
export function moveShapesToLayer(s: DocumentSession, ids: ID[], layerId: ID): boolean {
  const target = s.image.layers.find((l) => l.id === layerId)
  if (!target || target.locked) return false
  const tx = s.begin('Mover a capa')
  const moved: Shape[] = []
  for (const layer of s.image.layers) {
    if (layer === target) continue
    const keep: Shape[] = []
    for (const sh of layer.shapes) (ids.includes(sh.id) ? moved : keep).push(sh)
    layer.shapes = keep
  }
  target.shapes.push(...moved)
  tx.commit({ model: true })
  return moved.length > 0
}

export function duplicateShapes(s: DocumentSession, ids: ID[], dx = 0, dy = 0): ID[] {
  const tx = s.begin('Duplicar forma')
  const created: ID[] = []
  for (const layer of s.image.layers) {
    const copies: Shape[] = []
    for (const sh of layer.shapes) {
      if (!ids.includes(sh.id)) continue
      const c = cloneShape(sh)
      c.id = newId()
      c.name = `${sh.name} copia`
      c.transform = translateMat(c.transform, dx, dy)
      copies.push(c)
      created.push(c.id)
    }
    layer.shapes.push(...copies)
  }
  s.selectedShapes = created
  tx.commit({ model: true })
  return created
}

export interface StampResult {
  /** Formas estampadas (las pedidas más las inferiores arrastradas por la regla de orden). */
  stamped: ID[]
  /** Se tuvo que incluir formas inferiores superpuestas para conservar el aspecto. */
  includedBelow: boolean
}

/**
 * Estampa formas en el ráster de su capa conservando el render de la imagen (invariante de
 * specs/07). Regla de orden: si hay formas NO estampadas por debajo que se superponen con una
 * estampada, también se estampan las inferiores (todas las que quedan por debajo de la más alta),
 * porque el ráster base está debajo de todas las formas.
 */
export function stampShapes(s: DocumentSession, ids: ID[]): StampResult | null {
  const { width: w, height: h } = s.image
  const result: StampResult = { stamped: [], includedBelow: false }
  const tx = s.begin(ids.length === 1 ? 'Estampar forma' : 'Estampar formas')
  let touched = false
  for (const layer of s.image.layers) {
    const want = new Set(ids)
    const list = layer.shapes
    if (!list.some((x) => want.has(x.id)) || layer.locked) continue
    let top = -1
    list.forEach((x, i) => {
      if (want.has(x.id)) top = i
    })
    // Formas no pedidas por debajo de la más alta pedida
    const bitmaps = list.map((x) => (x.visible ? renderShape(x, w, h) : null))
    let conflict = false
    for (let i = 0; i <= top && !conflict; i++) {
      if (want.has(list[i]!.id)) continue
      for (let j = i + 1; j <= top && !conflict; j++) {
        if (want.has(list[j]!.id) && overlaps(bitmaps[i], bitmaps[j])) conflict = true
      }
    }
    const chosen = list.filter((x, i) => (conflict ? i <= top : want.has(x.id)))
    const raster = s.bitmapOf(layer.id)
    tx.touch(layer.id, { x: 0, y: 0, w, h })
    for (const sh of chosen) {
      const bmp = bitmaps[list.indexOf(sh)]
      if (bmp) compositeOver(raster, bmp, sh.blendMode, sh.opacity)
      result.stamped.push(sh.id)
    }
    result.includedBelow ||= conflict
    const gone = new Set(chosen.map((x) => x.id))
    layer.shapes = list.filter((x) => !gone.has(x.id))
    touched = true
  }
  if (!touched) return null
  s.selectedShapes = s.selectedShapes.filter((x) => !result.stamped.includes(x))
  tx.commit({ model: true })
  return result
}

export function stampAllShapes(s: DocumentSession): StampResult | null {
  return stampShapes(
    s,
    s.activeLayer.shapes.map((x) => x.id)
  )
}

function overlaps(
  a: { data: Uint8ClampedArray } | null | undefined,
  b: { data: Uint8ClampedArray } | null | undefined
): boolean {
  if (!a || !b) return false
  for (let i = 3; i < a.data.length; i += 4) if (a.data[i] && b.data[i]) return true
  return false
}
