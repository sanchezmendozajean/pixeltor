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
  private changed = false

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
    drag.changed = true
    ;(s.image.guides ??= []).push({ id: drag.id, axis, pos: Math.round(pos) })
    s.emit({ imageId: s.activeImageId, dirty: null, structure: true, layerIds: [] })
    return drag
  }

  moveTo(pos: number): void {
    const g = this.s.image.guides?.find((x) => x.id === this.id)
    if (!g) return
    if (g.pos !== Math.round(pos)) this.changed = true
    g.pos = Math.round(pos)
    this.s.emit({ imageId: this.s.activeImageId, dirty: null, structure: true, layerIds: [] })
  }

  /** Confirma; si `remove`, la guía se elimina (se arrastró de vuelta a la regla). */
  end(remove = false): boolean {
    if (remove) this.s.image.guides = (this.s.image.guides ?? []).filter((g) => g.id !== this.id)
    // un clic sin mover no deja un paso de historial vacío
    return this.tx.commit({ model: remove || this.changed })
  }
}

// ---------- Posición de una guía por expresión ----------

/**
 * Evalúa una posición de guía: números, `%` (porcentaje del tamaño de la imagen en ese eje), `px`
 * opcional, + - * / y paréntesis. «100% - 10» = el borde menos 10 px. El resultado se redondea a
 * entero. Devuelve null si la expresión no es válida.
 */
export function evalGuideExpr(text: string, size: number): number | null {
  const src = text.trim().toLowerCase().replace(/,/g, '.')
  if (!src) return null
  let i = 0
  const ws = (): void => {
    while (src[i] === ' ') i++
  }
  const number = (): number | null => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    let v = Number.parseFloat(m[0])
    ws()
    if (src[i] === '%') {
      i++
      v = (v * size) / 100
    } else if (src.startsWith('px', i)) i += 2
    return v
  }
  const primary = (): number | null => {
    ws()
    if (src[i] === '(') {
      i++
      const v = sum()
      ws()
      if (v === null || src[i] !== ')') return null
      i++
      return v
    }
    if (src[i] === '-' || src[i] === '+') {
      const neg = src[i] === '-'
      i++
      const v = primary()
      return v === null ? null : neg ? -v : v
    }
    return number()
  }
  const product = (): number | null => {
    let v = primary()
    for (;;) {
      ws()
      const op = src[i]
      if (v === null || (op !== '*' && op !== '/')) return v
      i++
      const r = primary()
      if (r === null) return null
      v = op === '*' ? v * r : v / r
    }
  }
  function sum(): number | null {
    let v = product()
    for (;;) {
      ws()
      const op = src[i]
      if (v === null || (op !== '+' && op !== '-')) return v
      i++
      const r = product()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
  }
  const v = sum()
  ws()
  if (v === null || i !== src.length || !Number.isFinite(v)) return null
  return Math.round(v)
}

/** Coloca la guía en `pos` (entero) como un único paso de historial. */
export function setGuidePos(s: DocumentSession, id: ID, pos: number): boolean {
  const g = s.image.guides?.find((x) => x.id === id)
  const p = Math.round(pos)
  if (!g || g.pos === p) return false
  const tx = s.begin('Mover guía')
  g.pos = p
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true, layerIds: [] })
  return tx.commit({ model: true })
}
