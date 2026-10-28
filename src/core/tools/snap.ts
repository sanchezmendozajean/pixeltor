// Guías y ajuste (snapping) al mover formas (specs/05): lienzo, guías y bordes/centros de otras
// formas (guías inteligentes). Los desplazamientos resultantes son enteros.

import { newId } from '../model/ids'
import type { Shape } from '../model/shapes'
import type { Guide, ID } from '../model/types'
import type { DocumentSession } from '../session'
import { type Bounds, shapeBounds } from './align'

export interface SnapOptions {
  canvas: boolean
  objects: boolean
  guides: boolean
}

export interface SnapLine {
  /** `v` = línea vertical en x = pos; `h` = línea horizontal en y = pos. */
  axis: 'v' | 'h'
  pos: number
  /** Tramo dibujado sobre el otro eje. */
  from: number
  to: number
  kind: 'canvas' | 'object' | 'guide'
}

export interface SnapResult {
  dx: number
  dy: number
  lines: SnapLine[]
}

interface Target {
  pos: number
  kind: SnapLine['kind']
  /** Tramo del objeto objetivo en el otro eje (para dibujar la línea). */
  span?: [number, number]
}

const PRIORITY: Record<SnapLine['kind'], number> = { guide: 0, canvas: 1, object: 2 }

function collectTargets(
  s: DocumentSession,
  exclude: Set<ID>,
  opt: SnapOptions
): { xs: Target[]; ys: Target[] } {
  const xs: Target[] = []
  const ys: Target[] = []
  const { width: w, height: h } = s.image
  if (opt.canvas) {
    for (const x of [0, w / 2, w]) xs.push({ pos: x, kind: 'canvas', span: [0, h] })
    for (const y of [0, h / 2, h]) ys.push({ pos: y, kind: 'canvas', span: [0, w] })
  }
  if (opt.guides)
    for (const g of s.image.guides ?? [])
      (g.axis === 'v' ? xs : ys).push({ pos: g.pos, kind: 'guide' })
  if (opt.objects) {
    const visit = (list: Shape[]): void => {
      for (const sh of list) {
        if (sh.kind === 'group') visit(sh.children)
        if (exclude.has(sh.id) || !sh.visible) continue
        // los grupos cuentan como una unidad; sus hijos también por si se está aislando
        const b = shapeBounds(s, sh.id)
        if (!b) continue
        for (const x of [b.x, b.x + b.w / 2, b.x + b.w])
          xs.push({ pos: x, kind: 'object', span: [b.y, b.y + b.h] })
        for (const y of [b.y, b.y + b.h / 2, b.y + b.h])
          ys.push({ pos: y, kind: 'object', span: [b.x, b.x + b.w] })
      }
    }
    for (const layer of s.image.layers) if (layer.visible) visit(layer.shapes)
  }
  return { xs, ys }
}

function best(refs: number[], targets: Target[], radius: number): number {
  let bestD = Infinity
  let bestPrio = Infinity
  let delta = 0
  for (const r of refs)
    for (const t of targets) {
      const d = t.pos - r
      if (Math.abs(d) > radius) continue
      const prio = PRIORITY[t.kind]
      // gana el más cercano; a igual distancia, guías y lienzo antes que objetos
      if (Math.abs(d) < bestD - 1e-9 || (Math.abs(d) <= bestD + 1e-9 && prio < bestPrio)) {
        bestD = Math.abs(d)
        bestPrio = prio
        delta = d
      }
    }
  return bestD === Infinity ? 0 : Math.round(delta)
}

/**
 * Ajusta el desplazamiento de `moving` (límites ya desplazados) a los objetivos cercanos.
 * `radius` en px de imagen (p. ej. 4 / zoom). Devuelve el ajuste a SUMAR y las líneas a mostrar.
 */
export function computeSnap(
  s: DocumentSession,
  moving: Bounds,
  exclude: ID[],
  opt: SnapOptions,
  radius: number
): SnapResult {
  const { xs, ys } = collectTargets(s, new Set(exclude), opt)
  const rx = [moving.x, moving.x + moving.w / 2, moving.x + moving.w]
  const ry = [moving.y, moving.y + moving.h / 2, moving.y + moving.h]
  const dx = best(rx, xs, radius)
  const dy = best(ry, ys, radius)
  const lines: SnapLine[] = []
  const b = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h }
  for (const r of [b.x, b.x + b.w / 2, b.x + b.w])
    for (const t of xs)
      if (Math.abs(t.pos - r) <= 0.5)
        lines.push({
          axis: 'v',
          pos: t.pos,
          from: Math.min(b.y, t.span?.[0] ?? b.y),
          to: Math.max(b.y + b.h, t.span?.[1] ?? b.y + b.h),
          kind: t.kind
        })
  for (const r of [b.y, b.y + b.h / 2, b.y + b.h])
    for (const t of ys)
      if (Math.abs(t.pos - r) <= 0.5)
        lines.push({
          axis: 'h',
          pos: t.pos,
          from: Math.min(b.x, t.span?.[0] ?? b.x),
          to: Math.max(b.x + b.w, t.span?.[1] ?? b.x + b.w),
          kind: t.kind
        })
  return { dx, dy, lines }
}

// ---------- Guías ----------

export function addGuide(s: DocumentSession, axis: 'h' | 'v', pos: number): ID {
  const tx = s.begin('Crear guía')
  const g: Guide = { id: newId(), axis, pos: Math.round(pos) }
  ;(s.image.guides ??= []).push(g)
  tx.commit({ model: true })
  return g.id
}

export function removeGuide(s: DocumentSession, id: ID): boolean {
  const list = s.image.guides ?? []
  if (!list.some((g) => g.id === id)) return false
  const tx = s.begin('Eliminar guía')
  s.image.guides = list.filter((g) => g.id !== id)
  tx.commit({ model: true })
  return true
}

/** Arrastre de una guía: se ve en vivo y el paso de historial se crea al soltar. */
export class GuideDrag {
  private readonly tx

  constructor(
    private readonly s: DocumentSession,
    readonly id: ID,
    label = 'Mover guía'
  ) {
    this.tx = s.begin(label)
  }

  /** Crea una guía nueva y la deja en arrastre: el paso «Crear guía» se registra al soltar. */
  static create(s: DocumentSession, axis: 'h' | 'v', pos: number): GuideDrag {
    const drag = new GuideDrag(s, newId(), 'Crear guía')
    ;(s.image.guides ??= []).push({ id: drag.id, axis, pos: Math.round(pos) })
    s.emit({ imageId: s.activeImageId, dirty: null, structure: true })
    return drag
  }

  moveTo(pos: number): void {
    const g = this.s.image.guides?.find((x) => x.id === this.id)
    if (!g) return
    g.pos = Math.round(pos)
    this.s.emit({ imageId: this.s.activeImageId, dirty: null, structure: true })
  }

  /** Confirma; si `remove`, la guía se elimina (se arrastró de vuelta a la regla). */
  end(remove = false): boolean {
    if (remove) this.s.image.guides = (this.s.image.guides ?? []).filter((g) => g.id !== this.id)
    return this.tx.commit({ model: true })
  }
}
