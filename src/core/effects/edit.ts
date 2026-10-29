// Edición de efectos de formas y capas: todo deshacible. Los ajustes de parámetros admiten
// edición «viva» (se ven al instante y registran un solo paso al soltar).

import { newId } from '../model/ids'
import type { Effect, EffectOutput, ID } from '../model/types'
import { findLayer } from '../model/document'
import type { DocumentSession, Transaction } from '../session'
import { findShape } from '../tools/shapes'
import { effectDef, newEffect, resolveParams } from './registry'
import type { ParamValue } from './types'

export type EffectTarget = { kind: 'shape'; id: ID } | { kind: 'layer'; id: ID }

/** Lista de efectos del objetivo (la de una forma se crea si no existe). */
function listOf(s: DocumentSession, t: EffectTarget, create: boolean): Effect[] | null {
  if (t.kind === 'layer') {
    const l = findLayer(s.image, t.id)
    return l && !l.locked ? l.effects : null
  }
  const f = findShape(s, t.id)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return null
  if (create) f.shape.effects ??= []
  return f.shape.effects ?? null
}

export function getEffects(s: DocumentSession, t: EffectTarget): Effect[] {
  if (t.kind === 'layer') return findLayer(s.image, t.id)?.effects ?? []
  return findShape(s, t.id)?.shape.effects ?? []
}

function edit(
  s: DocumentSession,
  t: EffectTarget,
  label: string,
  fn: (list: Effect[]) => boolean,
  mergeKey?: string
): boolean {
  const list = listOf(s, t, true)
  if (!list) return false
  const tx = s.begin(label, mergeKey)
  if (!fn(list)) return false
  tx.commit({ model: true })
  return true
}

export function addEffect(s: DocumentSession, t: EffectTarget, type: string): Effect | null {
  const fx = newEffect(type)
  if (!fx) return null
  return edit(s, t, 'Añadir efecto', (l) => (l.push(fx), true)) ? fx : null
}

export function removeEffect(s: DocumentSession, t: EffectTarget, id: ID): boolean {
  return edit(s, t, 'Eliminar efecto', (l) => {
    const i = l.findIndex((e) => e.id === id)
    if (i < 0) return false
    l.splice(i, 1)
    return true
  })
}

export function moveEffect(s: DocumentSession, t: EffectTarget, id: ID, dir: -1 | 1): boolean {
  return edit(s, t, 'Reordenar efectos', (l) => {
    const i = l.findIndex((e) => e.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= l.length) return false
    ;[l[i], l[j]] = [l[j]!, l[i]!]
    return true
  })
}

export function duplicateEffect(s: DocumentSession, t: EffectTarget, id: ID): boolean {
  return edit(s, t, 'Duplicar efecto', (l) => {
    const i = l.findIndex((e) => e.id === id)
    if (i < 0) return false
    const copy = JSON.parse(JSON.stringify(l[i])) as Effect
    copy.id = newId()
    l.splice(i + 1, 0, copy)
    return true
  })
}

export interface EffectPatch {
  enabled?: boolean
  params?: Record<string, ParamValue>
  output?: EffectOutput | null
}

function patchEffect(e: Effect, patch: EffectPatch): void {
  if (patch.enabled !== undefined) e.enabled = patch.enabled
  if (patch.params) {
    const def = effectDef(e.type)
    const merged = { ...e.params, ...patch.params }
    e.params = def ? resolveParams(def, merged) : merged
  }
  if (patch.output === null) delete e.output
  else if (patch.output) e.output = { ...patch.output }
}

/** Cambia el estado de un efecto como un paso de historial (los ajustes seguidos se fusionan). */
export function updateEffect(
  s: DocumentSession,
  t: EffectTarget,
  id: ID,
  patch: EffectPatch
): boolean {
  return edit(
    s,
    t,
    'Editar efecto',
    (l) => {
      const e = l.find((x) => x.id === id)
      if (!e) return false
      patchEffect(e, patch)
      return true
    },
    `fx:${id}`
  )
}

// ---------- Edición viva ----------

const lives = new WeakMap<DocumentSession, Map<string, Transaction>>()

/** Aplica el cambio sin crear paso de historial; el paso se registra en `commitEffectEdit`. */
export function liveUpdateEffect(
  s: DocumentSession,
  t: EffectTarget,
  id: ID,
  key: string,
  patch: EffectPatch
): void {
  const list = listOf(s, t, true)
  const e = list?.find((x) => x.id === id)
  if (!e) return
  let m = lives.get(s)
  if (!m) lives.set(s, (m = new Map()))
  if (!m.has(key)) m.set(key, s.begin('Editar efecto'))
  patchEffect(e, patch)
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true })
}

export function commitEffectEdit(s: DocumentSession, key: string): void {
  const m = lives.get(s)
  const tx = m?.get(key)
  if (!tx) return
  m!.delete(key)
  tx.commit({ model: true })
}
