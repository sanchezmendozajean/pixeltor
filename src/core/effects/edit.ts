// Edición de efectos de formas y capas: todo deshacible. Los ajustes de parámetros admiten
// edición «viva» (se ven al instante y registran un solo paso al soltar).

import { newId } from '../model/ids'
import type { Effect, EffectOutput, ID } from '../model/types'
import { findLayer } from '../model/document'
import type { DocumentSession, Transaction } from '../session'
import { findShape } from '../tools/shapes'
import { compositeOver } from '../raster/blend'
import { renderShapeFx } from '../render/compose'
import { regionFromBitmap } from './region'
import { applyEffects, effectDef, hasActiveEffects, newEffect, resolveParams } from './registry'
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

/** Añade varios efectos (un preset) en un solo paso de historial. */
export function applyEffectPreset(
  s: DocumentSession,
  t: EffectTarget,
  preset: Omit<Effect, 'id'>[]
): boolean {
  return edit(s, t, 'Aplicar preset de efectos', (l) => {
    let any = false
    for (const p of preset) {
      const def = effectDef(p.type)
      if (!def) continue
      const fx: Effect = {
        id: newId(),
        type: p.type,
        enabled: p.enabled,
        params: resolveParams(def, p.params)
      }
      if (p.output) fx.output = { ...p.output }
      l.push(fx)
      any = true
    }
    return any
  })
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

/**
 * Rasterizar efectos de capa (Ctrl+Alt+E): estampa todas las formas visibles de la capa en su
 * ráster, aplica los efectos de la capa y vacía la lista. El render de la imagen no cambia.
 * Con upTo (Aplicar efecto) sólo se aplican los efectos hasta ése, inclusive; los siguientes
 * siguen activos sobre el resultado.
 */
export function rasterizeLayerEffects(s: DocumentSession, layerId: ID, upTo?: ID): boolean {
  const layer = findLayer(s.image, layerId)
  if (!layer || layer.locked || (!layer.shapes.length && !hasActiveEffects(layer.effects)))
    return false
  const { width: w, height: h } = s.image
  const raster = s.bitmapOf(layer.id)
  const cut = upTo ? layer.effects.findIndex((e) => e.id === upTo) : layer.effects.length - 1
  if (upTo && cut < 0) return false
  const applied = layer.effects.slice(0, cut + 1)
  const tx = s.begin(upTo ? 'Aplicar efecto' : 'Rasterizar efectos de capa')
  tx.touch(layer.id, { x: 0, y: 0, w, h })
  for (const sh of layer.shapes) {
    if (!sh.visible) continue
    const bmp = renderShapeFx(sh, w, h)
    if (bmp) compositeOver(raster, bmp, sh.blendMode, sh.opacity)
  }
  layer.shapes = []
  if (hasActiveEffects(applied)) {
    const fx = applyEffects(
      applied,
      regionFromBitmap(raster.clone()),
      { x: 0, y: 0, w, h },
      { width: w, height: h, palettes: s.doc.palettes }
    )
    raster.data.set(fx.data)
  }
  layer.effects = layer.effects.slice(cut + 1)
  s.selectedShapes = []
  tx.commit({ model: true })
  return true
}
