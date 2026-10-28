// Alinear y distribuir formas (specs/05). Trabaja con los límites de PÍXELES visibles
// (opción por defecto); todo movimiento es entero y forma un único paso de historial.

import type { ID } from '../model/types'
import { pixelBounds, renderShapeRegion } from '../render/shape'
import type { DocumentSession } from '../session'
import { findShape, resolveShape, translateMat } from './shapes'

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export type AlignHow = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom'
export type AlignTo = 'selection' | 'key' | 'canvas'
export type DistributeMode = 'start' | 'center' | 'end'
export type Axis = 'h' | 'v'

/** Límites de píxeles pintados de una forma (coordenadas de imagen). */
export function shapeBounds(s: DocumentSession, id: ID): Bounds | null {
  const sh = resolveShape(s, id)
  if (!sh) return null
  return pixelBounds(renderShapeRegion(sh, s.image.width, s.image.height))
}

interface Item {
  id: ID
  b: Bounds
}

function items(s: DocumentSession, ids: ID[]): Item[] {
  const out: Item[] = []
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.layer.locked || f.shape.locked) continue
    const b = shapeBounds(s, id)
    if (b) out.push({ id, b })
  }
  return out
}

function union(list: Bounds[]): Bounds {
  const x0 = Math.min(...list.map((b) => b.x))
  const y0 = Math.min(...list.map((b) => b.y))
  const x1 = Math.max(...list.map((b) => b.x + b.w))
  const y1 = Math.max(...list.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Aplica desplazamientos enteros distintos a cada forma en un solo paso. */
function applyMoves(
  s: DocumentSession,
  moves: Map<ID, { dx: number; dy: number }>,
  label: string
): boolean {
  const live = [...moves].filter(([, m]) => m.dx !== 0 || m.dy !== 0)
  if (!live.length) return false
  const tx = s.begin(label)
  for (const [id, m] of live) {
    const f = findShape(s, id)
    if (f) f.shape.transform = translateMat(f.shape.transform, m.dx, m.dy)
  }
  tx.commit({ model: true })
  return true
}

const LABELS: Record<AlignHow, string> = {
  left: 'Alinear a la izquierda',
  centerH: 'Centrar horizontalmente',
  right: 'Alinear a la derecha',
  top: 'Alinear arriba',
  centerV: 'Centrar verticalmente',
  bottom: 'Alinear abajo'
}

/**
 * Alinea las formas respecto a la selección, a un objeto clave (que no se mueve) o al lienzo.
 * Devuelve false si no hubo nada que mover.
 */
export function alignShapes(
  s: DocumentSession,
  ids: ID[],
  how: AlignHow,
  to: AlignTo,
  keyId?: ID
): boolean {
  const list = items(s, ids)
  if (!list.length) return false
  let target: Bounds
  if (to === 'canvas') target = { x: 0, y: 0, w: s.image.width, h: s.image.height }
  else if (to === 'key') {
    const key = keyId ? shapeBounds(s, keyId) : null
    if (!key) return false
    target = key
  } else {
    if (list.length < 2) return false
    target = union(list.map((i) => i.b))
  }
  const moves = new Map<ID, { dx: number; dy: number }>()
  for (const { id, b } of list) {
    if (to === 'key' && id === keyId) continue
    let dx = 0
    let dy = 0
    switch (how) {
      case 'left':
        dx = target.x - b.x
        break
      case 'right':
        dx = target.x + target.w - (b.x + b.w)
        break
      case 'centerH':
        dx = Math.round(target.x + target.w / 2 - (b.x + b.w / 2))
        break
      case 'top':
        dy = target.y - b.y
        break
      case 'bottom':
        dy = target.y + target.h - (b.y + b.h)
        break
      case 'centerV':
        dy = Math.round(target.y + target.h / 2 - (b.y + b.h / 2))
        break
    }
    moves.set(id, { dx, dy })
  }
  return applyMoves(s, moves, LABELS[how])
}

/**
 * Distribuye objetos para que sus bordes (o centros) queden a igual distancia entre los dos
 * extremos, que no se mueven. Hacen falta al menos 3 formas.
 */
export function distributeShapes(
  s: DocumentSession,
  ids: ID[],
  axis: Axis,
  mode: DistributeMode
): boolean {
  const list = items(s, ids)
  if (list.length < 3) return false
  const pos = (b: Bounds): number =>
    axis === 'h'
      ? mode === 'start'
        ? b.x
        : mode === 'center'
          ? b.x + b.w / 2
          : b.x + b.w
      : mode === 'start'
        ? b.y
        : mode === 'center'
          ? b.y + b.h / 2
          : b.y + b.h
  const sorted = [...list].sort((a, b) => pos(a.b) - pos(b.b))
  const first = pos(sorted[0]!.b)
  const last = pos(sorted[sorted.length - 1]!.b)
  const step = (last - first) / (sorted.length - 1)
  const moves = new Map<ID, { dx: number; dy: number }>()
  sorted.forEach((it, i) => {
    const d = Math.round(first + step * i - pos(it.b))
    moves.set(it.id, axis === 'h' ? { dx: d, dy: 0 } : { dx: 0, dy: d })
  })
  const what =
    mode === 'start' ? 'bordes iniciales' : mode === 'center' ? 'centros' : 'bordes finales'
  return applyMoves(
    s,
    moves,
    `Distribuir ${axis === 'h' ? 'horizontalmente' : 'verticalmente'} (${what})`
  )
}

/** Distribuye con un espacio fijo en píxeles entre formas contiguas, partiendo de la primera. */
export function distributeSpacing(s: DocumentSession, ids: ID[], axis: Axis, gap: number): boolean {
  const list = items(s, ids)
  if (list.length < 2) return false
  const start = (b: Bounds): number => (axis === 'h' ? b.x : b.y)
  const size = (b: Bounds): number => (axis === 'h' ? b.w : b.h)
  const sorted = [...list].sort((a, b) => start(a.b) - start(b.b))
  const moves = new Map<ID, { dx: number; dy: number }>()
  let cursor = start(sorted[0]!.b) + size(sorted[0]!.b)
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]!
    const d = Math.round(cursor + gap - start(it.b))
    moves.set(it.id, axis === 'h' ? { dx: d, dy: 0 } : { dx: 0, dy: d })
    cursor += gap + size(it.b)
  }
  return applyMoves(s, moves, `Distribuir espaciado de ${gap} px`)
}
