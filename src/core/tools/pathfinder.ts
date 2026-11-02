// Buscatrazos (specs/05): unir, restar la forma frontal, intersecar y excluir. Las formas se
// aplanan a polígonos (las curvas pasan a segmentos rectos, como en el resto de operaciones de
// trazados) y se combinan con `polygon-clipping`, que resuelve bordes coincidentes y huecos.

import polygonClipping, { type MultiPolygon, type Ring } from 'polygon-clipping'
import { type PathShape, type Shape, cloneShape } from '../model/shapes'
import { IDENTITY } from '../geometry/geometry'
import { newId } from '../model/ids'
import type { ID } from '../model/types'
import type { DocumentSession } from '../session'
import { bakedPath, flattenSubpath } from './pathops'
import { findShape } from './shapes'

export type PathfinderOp = 'unite' | 'minusFront' | 'intersect' | 'exclude'

const LABEL: Record<PathfinderOp, string> = {
  unite: 'Unir formas',
  minusFront: 'Restar forma frontal',
  intersect: 'Intersecar formas',
  exclude: 'Excluir formas'
}

const area = (r: Ring): number => {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!
    const q = r[(i + 1) % r.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/** Región (multipolígono) que cubre una forma, respetando su regla de relleno. */
export function shapeRegion(sh: Shape): MultiPolygon {
  const rings: Ring[] = []
  for (const sp of bakedPath(sh).subpaths) {
    const pts = flattenSubpath(sp).pts
    if (pts.length < 3) continue // un subtrazado abierto o degenerado no encierra área
    rings.push(pts.map((p): [number, number] => [p.x, p.y]))
  }
  if (!rings.length) return []
  const polys = rings.map((r): MultiPolygon => [[r]])
  const [head, ...rest] = polys as [MultiPolygon, ...MultiPolygon[]]
  if ((sh as PathShape).fillRule === 'evenodd') return polygonClipping.xor(head, ...rest)
  // relleno no cero: los anillos de sentido contrario al mayor son huecos
  const big = rings.reduce((m, r) => (Math.abs(area(r)) > Math.abs(area(m)) ? r : m))
  const sign = Math.sign(area(big))
  const solid = polys.filter((_, i) => Math.sign(area(rings[i]!)) === sign)
  const holes = polys.filter((_, i) => Math.sign(area(rings[i]!)) !== sign)
  const u = polygonClipping.union(solid[0]!, ...solid.slice(1))
  return holes.length ? polygonClipping.difference(u, ...holes) : u
}

/** Combina las regiones: la primera es la de atrás y la última la de delante. */
export function combine(op: PathfinderOp, regions: MultiPolygon[]): MultiPolygon {
  const [first, ...rest] = regions as [MultiPolygon, ...MultiPolygon[]]
  switch (op) {
    case 'unite':
      return polygonClipping.union(first, ...rest)
    case 'intersect':
      return polygonClipping.intersection(first, ...rest)
    case 'exclude':
      return polygonClipping.xor(first, ...rest)
    case 'minusFront': {
      // lo de atrás menos lo de delante
      const front = rest[rest.length - 1]!
      const backs = [first, ...rest.slice(0, -1)]
      return polygonClipping.difference(polygonClipping.union(backs[0]!, ...backs.slice(1)), front)
    }
  }
}

/** Anillos del resultado como subtrazados cerrados de esquinas rectas. */
function toSubpaths(mp: MultiPolygon): PathShape['subpaths'] {
  const out: PathShape['subpaths'] = []
  for (const poly of mp)
    for (const ring of poly) {
      // polygon-clipping repite el primer punto al final
      const pts = ring.slice(0, ring.length > 1 ? -1 : undefined)
      if (pts.length < 3) continue
      out.push({
        closed: true,
        anchors: pts.map(([x, y]) => ({
          p: { x, y },
          in: null,
          out: null,
          type: 'corner' as const
        }))
      })
    }
  return out
}

/**
 * Aplica una operación a las formas indicadas (al menos dos). El resultado sustituye a la forma
 * frontal y conserva su apariencia; «restar» conserva la de la forma de más atrás.
 */
export function pathfinder(s: DocumentSession, ids: ID[], op: PathfinderOp): ID | null {
  const found = ids
    .map((id) => findShape(s, id))
    .filter((f): f is NonNullable<typeof f> => !!f && f.shape.kind !== 'group' && !f.layer.locked)
  if (found.length < 2) return null
  // orden de apilado: capa (abajo → arriba) y posición dentro de su lista
  const layerIdx = (f: (typeof found)[number]): number => s.image.layers.indexOf(f.layer)
  found.sort((a, b) => layerIdx(a) - layerIdx(b) || a.index - b.index)

  const result = combine(
    op,
    found.map((f) => shapeRegion(f.shape))
  )
  const subpaths = toSubpaths(result)
  const keep = op === 'minusFront' ? found[0]! : found[found.length - 1]!

  const tx = s.begin(LABEL[op])
  const base = cloneShape(keep.shape)
  const doomed = found.filter((f) => f !== keep).map((f) => f.shape.id)
  if (subpaths.length) {
    const out: PathShape = {
      ...(bakedPath(base) as PathShape),
      id: newId(),
      kind: 'path',
      subpaths,
      fillRule: 'evenodd',
      transform: [...IDENTITY],
      name: op === 'unite' ? 'Unión' : keep.shape.name
    }
    const cur = findShape(s, keep.shape.id)!
    cur.list[cur.index] = out
    s.selectedShapes = [out.id]
    for (const id of doomed) {
      const f = findShape(s, id)
      if (f) f.list.splice(f.index, 1)
    }
    tx.commit({ model: true })
    return out.id
  }
  // resultado vacío (p. ej. intersección sin solape): las formas desaparecen
  for (const id of [keep.shape.id, ...doomed]) {
    const f = findShape(s, id)
    if (f) f.list.splice(f.index, 1)
  }
  s.selectedShapes = []
  tx.commit({ model: true })
  return null
}
