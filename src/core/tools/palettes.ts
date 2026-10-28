// Operaciones de paletas sobre el documento (todas deshacibles). La primera paleta del documento
// es la activa del panel Muestras. Las muestras globales enlazan rellenos y contornos sólidos
// (`SolidPaint.swatchId`): editar la muestra recolorea todas las formas enlazadas.

import type { Shape } from '../model/shapes'
import type { ID, RGBA } from '../model/types'
import { LIBRARY, libraryColors } from '../palette/library'
import {
  type Palette,
  type Swatch,
  makePalette,
  makeSwatch,
  MAX_SWATCHES,
  type SortKey,
  sortSwatches
} from '../palette/palette'
import type { DocumentSession } from '../session'

/** Paleta inicial de un documento nuevo (PICO-8). */
export function defaultPalette(): Palette {
  const pico = LIBRARY[0]!
  return makePalette(pico.name, libraryColors(pico))
}

/** Lista de paletas del documento (se crea la inicial si no hay). */
export function documentPalettes(s: DocumentSession): Palette[] {
  if (!s.doc.palettes || !s.doc.palettes.length) s.doc.palettes = [defaultPalette()]
  return s.doc.palettes
}

export function activePalette(s: DocumentSession): Palette {
  return documentPalettes(s)[0]!
}

function edit<T>(s: DocumentSession, label: string, fn: () => T, mergeKey?: string): T {
  documentPalettes(s)
  const tx = s.begin(label, mergeKey)
  const r = fn()
  tx.commit({ model: true })
  return r
}

export function addSwatch(s: DocumentSession, color: RGBA, name?: string): Swatch | null {
  const p = activePalette(s)
  if (p.swatches.length >= MAX_SWATCHES) return null
  const same = p.swatches.find(
    (x) =>
      x.color.r === color.r && x.color.g === color.g && x.color.b === color.b && x.color.a === color.a
  )
  if (same) return same
  return edit(s, 'Añadir muestra', () => {
    const sw = makeSwatch(color, name)
    p.swatches.push(sw)
    return sw
  })
}

export function removeSwatch(s: DocumentSession, id: ID): boolean {
  const p = activePalette(s)
  if (!p.swatches.some((x) => x.id === id)) return false
  edit(s, 'Eliminar muestra', () => {
    p.swatches = p.swatches.filter((x) => x.id !== id)
    // las formas enlazadas conservan su color pero dejan de ser globales
    forEachSolid(s, (paint) => {
      if (paint.swatchId === id) delete paint.swatchId
    })
  })
  return true
}

export function moveSwatch(s: DocumentSession, id: ID, to: number): boolean {
  const p = activePalette(s)
  const from = p.swatches.findIndex((x) => x.id === id)
  if (from < 0) return false
  const dest = Math.min(p.swatches.length - 1, Math.max(0, to))
  if (dest === from) return false
  edit(s, 'Reordenar muestras', () => {
    const [sw] = p.swatches.splice(from, 1)
    p.swatches.splice(dest, 0, sw!)
  })
  return true
}

export function renameSwatch(s: DocumentSession, id: ID, name: string): void {
  const sw = activePalette(s).swatches.find((x) => x.id === id)
  if (!sw) return
  edit(s, 'Renombrar muestra', () => {
    if (name.trim()) sw.name = name.trim()
    else delete sw.name
  })
}

export function sortPalette(s: DocumentSession, by: SortKey): void {
  const p = activePalette(s)
  edit(s, 'Ordenar paleta', () => {
    p.swatches = sortSwatches(p.swatches, by)
  })
}

/** Añade al final una lista de colores (rampa, extracción), sin repetir los existentes. */
export function appendColors(s: DocumentSession, colors: RGBA[], label: string): number {
  const p = activePalette(s)
  const have = new Set(p.swatches.map((x) => key(x.color)))
  const fresh = colors.filter((c) => {
    const k = key(c)
    if (have.has(k)) return false
    have.add(k)
    return true
  })
  const room = MAX_SWATCHES - p.swatches.length
  const add = fresh.slice(0, Math.max(0, room))
  if (!add.length) return 0
  edit(s, label, () => {
    for (const c of add) p.swatches.push(makeSwatch(c))
  })
  return add.length
}

/** Sustituye la paleta activa por otra (importada o de la biblioteca); queda como primera. */
export function installPalette(s: DocumentSession, palette: Palette): void {
  edit(s, 'Cambiar paleta', () => {
    s.doc.palettes = [palette, ...documentPalettes(s)]
  })
}

/** Cambia a otra de las paletas del documento (la pasa al principio). */
export function activatePalette(s: DocumentSession, id: ID): boolean {
  const list = documentPalettes(s)
  const i = list.findIndex((p) => p.id === id)
  if (i <= 0) return false
  edit(s, 'Cambiar paleta', () => {
    const [p] = list.splice(i, 1)
    list.unshift(p!)
  })
  return true
}

export function deletePalette(s: DocumentSession, id: ID): boolean {
  const list = documentPalettes(s)
  if (list.length <= 1 || !list.some((p) => p.id === id)) return false
  edit(s, 'Eliminar paleta', () => {
    s.doc.palettes = list.filter((p) => p.id !== id)
  })
  return true
}

const key = (c: RGBA): number => ((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0

// ---------- Muestras globales ----------

function visit(list: Shape[], fn: (paint: { swatchId?: ID; color: RGBA }) => void): void {
  for (const sh of list) {
    if (sh.kind === 'group') visit(sh.children, fn)
    for (const f of sh.appearance.fills) if (f.paint.type === 'solid') fn(f.paint)
    for (const st of sh.appearance.strokes) if (st.paint.type === 'solid') fn(st.paint)
  }
}

function forEachSolid(s: DocumentSession, fn: (p: { swatchId?: ID; color: RGBA }) => void): void {
  for (const img of s.doc.images) for (const layer of img.layers) visit(layer.shapes, fn)
}

/** Número de pinturas sólidas enlazadas a la muestra. */
export function swatchUsage(s: DocumentSession, id: ID): number {
  let n = 0
  forEachSolid(s, (p) => {
    if (p.swatchId === id) n++
  })
  return n
}

/** Enlaza o desenlaza (swatchId = null) las pinturas sólidas indicadas de una forma. */
export function linkPaint(paint: { swatchId?: ID }, swatchId: ID | null): void {
  if (swatchId) paint.swatchId = swatchId
  else delete paint.swatchId
}

/**
 * Cambia el color de una muestra; las formas enlazadas (de todas las imágenes) se recolorean en
 * el mismo paso de historial. Los cambios seguidos de la misma muestra se fusionan.
 */
export function setSwatchColor(s: DocumentSession, id: ID, color: RGBA): boolean {
  const sw = activePalette(s).swatches.find((x) => x.id === id)
  if (!sw) return false
  // guardar también las capas de las demás imágenes para poder deshacer sus formas
  s.snapshotExtra = s.doc.images.filter((i) => i.id !== s.activeImageId).map((i) => i.id)
  try {
    edit(
      s,
      'Editar muestra',
      () => {
        sw.color = { ...color }
        forEachSolid(s, (p) => {
          if (p.swatchId === id) p.color = { ...color }
        })
      },
      `swatch:${id}`
    )
  } finally {
    s.snapshotExtra = []
  }
  return true
}
