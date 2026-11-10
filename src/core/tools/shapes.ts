// Operaciones sobre formas vectoriales y estampado (specs/05, 07). Todo pasa por Transactions.

import { multiply } from '../geometry/geometry'
import type { Fill, GroupShape, Mat2D, Shape, Stroke } from '../model/shapes'
import { cloneShape, makeGroup, reIdShape, solidFill, solidStroke } from '../model/shapes'
import type { ID, Layer, RGBA } from '../model/types'
import { compositeOver } from '../raster/blend'
import { pixelBounds, renderShapeCached, renderShapeRegion, shapeAlphaAt } from '../render/shape'
import { renderShapeFx } from '../render/compose'
import type { DocumentSession } from '../session'

export interface ShapeLocation {
  layer: Layer
  /** Lista que contiene la forma: la de la capa o los hijos de un grupo. */
  list: Shape[]
  index: number
  shape: Shape
  parent: GroupShape | null
}

function searchList(
  layer: Layer,
  list: Shape[],
  parent: GroupShape | null,
  id: ID
): ShapeLocation | null {
  for (let index = 0; index < list.length; index++) {
    const shape = list[index]!
    if (shape.id === id) return { layer, list, index, shape, parent }
    if (shape.kind === 'group') {
      const r = searchList(layer, shape.children, shape, id)
      if (r) return r
    }
  }
  return null
}

/** Localiza una forma en cualquier capa y a cualquier profundidad de grupos. */
/**
 * Capas que contienen esas formas, para avisar de qué capas cambian; undefined (cambio desconocido)
 * si alguna no se encuentra.
 */
export function layersOf(s: DocumentSession, ids: ID[]): ID[] | undefined {
  const out = new Set<ID>()
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f) return undefined
    out.add(f.layer.id)
  }
  return [...out]
}

export function findShape(s: DocumentSession, id: ID): ShapeLocation | null {
  for (const layer of s.image.layers) {
    const r = searchList(layer, layer.shapes, null, id)
    if (r) return r
  }
  return null
}

/** Todas las listas de formas de una capa (la de la capa y las de cada grupo). */
function containers(layer: Layer): Shape[][] {
  const out: Shape[][] = []
  const walk = (list: Shape[]) => {
    out.push(list)
    for (const sh of list) if (sh.kind === 'group') walk(sh.children)
  }
  walk(layer.shapes)
  return out
}

/** Copia de la forma con su transformación compuesta con la de sus grupos (coordenadas de imagen). */
export function resolveShape(s: DocumentSession, id: ID): Shape | null {
  const f = findShape(s, id)
  if (!f) return null
  const copy = cloneShape(f.shape)
  const chain: Mat2D[] = []
  let p = f.parent
  while (p) {
    chain.push(p.transform)
    const pl = findShape(s, p.id)
    p = pl?.parent ?? null
  }
  for (const m of chain) copy.transform = multiply(m, copy.transform)
  return copy
}

export function getShape(s: DocumentSession, id: ID): Shape | null {
  return findShape(s, id)?.shape ?? null
}

/** Añade una forma encima de las demás de la capa activa y la selecciona. */
export function addShape(s: DocumentSession, shape: Shape): boolean {
  let layer = s.activeLayer
  // una capa de grupo no tiene contenido propio: la forma va a su miembro de más arriba
  if (layer.isGroup) {
    const members = s.image.layers.filter((l) => l.groupId === layer.id)
    layer = members[members.length - 1] ?? layer
    if (layer.isGroup) return false
  }
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
    for (const list of containers(layer)) {
      for (let i = list.length - 1; i >= 0; i--)
        if (set.has(list[i]!.id)) {
          list.splice(i, 1)
          any = true
        }
    }
  }
  s.selectedShapes = s.selectedShapes.filter((x) => !set.has(x))
  if (any) tx.commit({ model: true })
  return any
}

export function selectShapes(s: DocumentSession, ids: ID[]): void {
  s.selectedShapes = ids
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true, layerIds: [] })
}

export type Arrange = 'front' | 'forward' | 'backward' | 'back'

export function arrangeShapes(s: DocumentSession, ids: ID[], how: Arrange): void {
  const tx = s.begin('Organizar')
  const sel = new Set(ids)
  for (const layer of s.image.layers) {
    for (const list of containers(layer)) {
      if (!list.some((x) => sel.has(x.id))) continue
      let next: Shape[]
      if (how === 'front')
        next = [...list.filter((x) => !sel.has(x.id)), ...list.filter((x) => sel.has(x.id))]
      else if (how === 'back')
        next = [...list.filter((x) => sel.has(x.id)), ...list.filter((x) => !sel.has(x.id))]
      else {
        next = [...list]
        if (how === 'forward') {
          for (let i = next.length - 2; i >= 0; i--)
            if (sel.has(next[i]!.id) && !sel.has(next[i + 1]!.id))
              [next[i], next[i + 1]] = [next[i + 1]!, next[i]!]
        } else {
          for (let i = 1; i < next.length; i++)
            if (sel.has(next[i]!.id) && !sel.has(next[i - 1]!.id))
              [next[i], next[i - 1]] = [next[i - 1]!, next[i]!]
        }
      }
      list.splice(0, list.length, ...next)
    }
  }
  tx.commit({ model: true })
}

/**
 * Reordena formas junto a `targetId` (panel Capas): `above` las deja justo encima de él en la
 * pila, `below` justo debajo. Admite formas de la misma lista (capa o grupo) y, si el destino no
 * está dentro de un grupo, de otras capas (las de grupos pierden el grupo).
 */
export function reorderShapes(
  s: DocumentSession,
  ids: ID[],
  targetId: ID,
  position: 'above' | 'below'
): boolean {
  const target = findShape(s, targetId)
  if (!target || target.layer.locked) return false
  const movers: { shape: Shape; list: Shape[]; index: number }[] = []
  for (const id of ids) {
    if (id === targetId) continue
    const f = findShape(s, id)
    if (!f || f.layer.locked) continue
    if (f.list === target.list) movers.push({ shape: f.shape, list: f.list, index: f.index })
    else if (f.layer !== target.layer && !target.parent)
      movers.push({
        shape: f.parent ? resolveShape(s, id)! : f.shape,
        list: f.list,
        index: f.index
      })
  }
  if (!movers.length) return false
  const tx = s.begin(movers.length === 1 ? 'Reordenar forma' : 'Reordenar formas')
  const order = [...movers].sort((a, b) => a.index - b.index)
  const keep = order.map((m) => m.shape)
  const byList = new Map<Shape[], number[]>()
  for (const m of movers) byList.set(m.list, [...(byList.get(m.list) ?? []), m.index])
  for (const [list, idx] of byList) for (const i of idx.sort((a, b) => b - a)) list.splice(i, 1)
  const at = target.list.indexOf(target.shape)
  target.list.splice(position === 'above' ? at + 1 : at, 0, ...keep)
  tx.commit({ model: true })
  return true
}

/** Mueve formas a otra capa (quedan encima de las que ya tenga). Las de grupos pierden el grupo. */
export function moveShapesToLayer(s: DocumentSession, ids: ID[], layerId: ID): boolean {
  const target = s.image.layers.find((l) => l.id === layerId)
  if (!target || target.locked) return false
  const tx = s.begin('Mover a capa')
  const moved: Shape[] = []
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.layer === target || f.layer.locked) continue
    moved.push(f.parent ? resolveShape(s, id)! : f.shape)
    f.list.splice(f.index, 1)
  }
  target.shapes.push(...moved)
  tx.commit({ model: true })
  return moved.length > 0
}

const reId = reIdShape

export function duplicateShapes(s: DocumentSession, ids: ID[], dx = 0, dy = 0): ID[] {
  const tx = s.begin('Duplicar forma')
  const created: ID[] = []
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f) continue
    const c = cloneShape(f.shape)
    reId(c)
    c.name = `${f.shape.name} copia`
    c.transform = translateMat(c.transform, dx, dy)
    f.list.splice(f.index + 1, 0, c)
    created.push(c.id)
  }
  s.selectedShapes = created
  tx.commit({ model: true })
  return created
}

// ---------- Color de las formas seleccionadas ----------

/** Rellenos/contornos que reciben el color: el primero activo de cada forma (los grupos, en sus hijos). */
function paintTargets(shape: Shape, target: 'fill' | 'stroke'): (Fill | Stroke)[] {
  if (shape.kind === 'group') return shape.children.flatMap((c) => paintTargets(c, target))
  const list: (Fill | Stroke)[] =
    target === 'fill' ? shape.appearance.fills : shape.appearance.strokes
  const first = list.find((a) => a.enabled)
  return first ? [first] : []
}

/** Color liso del primer relleno o contorno de la primera forma que lo tenga; null si ninguna. */
export function shapesColor(s: DocumentSession, ids: ID[], target: 'fill' | 'stroke'): RGBA | null {
  for (const id of ids) {
    const sh = getShape(s, id)
    const p = sh ? paintTargets(sh, target)[0] : undefined
    if (p?.paint.type === 'solid') return { ...p.paint.color }
  }
  return null
}

/**
 * Pinta con `c` el relleno o el contorno de las formas (como el panel Color con formas
 * seleccionadas). Conserva la transparencia de un color liso previo; un degradado pasa a color liso.
 * Los cambios seguidos del mismo destino forman un único paso (arrastres del selector).
 */
export function setShapesColor(
  s: DocumentSession,
  ids: ID[],
  target: 'fill' | 'stroke',
  c: RGBA
): boolean {
  const paints = ids.flatMap((id) => {
    const f = findShape(s, id)
    return f && !f.layer.locked ? paintTargets(f.shape, target) : []
  })
  if (!paints.length) return false
  const tx = s.begin(
    target === 'fill' ? 'Color de relleno' : 'Color de contorno',
    `color:${target}`
  )
  for (const p of paints)
    p.paint = {
      type: 'solid',
      color: { r: c.r, g: c.g, b: c.b, a: p.paint.type === 'solid' ? p.paint.color.a : c.a }
    }
  return tx.commit({ model: true })
}

/** ¿La forma (o alguno de sus hijos) pinta relleno/contorno? Null si no hay forma editable. */
export function shapePaintsTarget(
  s: DocumentSession,
  id: ID,
  target: 'fill' | 'stroke'
): boolean | null {
  const sh = getShape(s, id)
  return sh ? paintTargets(sh, target).length > 0 : null
}

/**
 * Activa o desactiva el relleno/contorno de las formas (el indicador «ninguno» de la barra de
 * herramientas). Desactivar conserva los datos (se puede reactivar en Apariencia); activar
 * reactiva el primero que haya o crea uno liso con `color`.
 */
export function setShapesPaint(
  s: DocumentSession,
  ids: ID[],
  target: 'fill' | 'stroke',
  on: boolean,
  color: RGBA
): boolean {
  const apply = (sh: Shape): boolean => {
    if (sh.kind === 'group') return sh.children.map(apply).some(Boolean)
    const list: (Fill | Stroke)[] = target === 'fill' ? sh.appearance.fills : sh.appearance.strokes
    if (!on) {
      const active = list.filter((a) => a.enabled)
      for (const a of active) a.enabled = false
      return active.length > 0
    }
    if (list.some((a) => a.enabled)) return false
    if (list.length) {
      list[0]!.enabled = true
      return true
    }
    const ap = sh.appearance
    if (target === 'fill') {
      const f = solidFill(color)
      ap.fills = [f]
      ap.stack = [f.id, ...ap.stack]
    } else {
      const st = solidStroke(color, 1)
      if (sh.kind !== 'line' && sh.kind !== 'path') st.align = 'inside'
      ap.strokes = [st]
      ap.stack = [...ap.stack, st.id]
    }
    return true
  }
  const tx = s.begin(
    target === 'fill' ? 'Relleno' : 'Contorno',
    `paint:${target}:${on ? 'on' : 'off'}`
  )
  let changed = false
  for (const id of ids) {
    const f = findShape(s, id)
    if (f && !f.layer.locked && apply(f.shape)) changed = true
  }
  return tx.commit({ model: changed })
}

// ---------- Portapapeles de formas ----------

/**
 * Copias independientes de las formas (con la transformación de sus grupos ya aplicada) para el
 * portapapeles. Si se elige un grupo y alguno de sus hijos, sólo se copia el grupo.
 */
export function copyShapes(s: DocumentSession, ids: ID[]): Shape[] {
  const set = new Set(ids)
  const out: Shape[] = []
  for (const id of ids) {
    let p = findShape(s, id)?.parent ?? null
    let covered = false
    while (p) {
      if (set.has(p.id)) covered = true
      p = findShape(s, p.id)?.parent ?? null
    }
    const sh = covered ? null : resolveShape(s, id)
    if (sh) out.push(sh)
  }
  return out
}

/** Pega copias de formas en la capa activa (en su sitio, o desplazadas) y las selecciona. */
export function pasteShapes(s: DocumentSession, shapes: Shape[], dx = 0, dy = 0): ID[] {
  let layer = s.activeLayer
  if (layer.isGroup) {
    const members = s.image.layers.filter((l) => l.groupId === layer.id)
    layer = members[members.length - 1] ?? layer
    if (layer.isGroup) return []
  }
  if (layer.locked || !layer.visible || !shapes.length) return []
  const tx = s.begin(shapes.length === 1 ? 'Pegar forma' : `Pegar ${shapes.length} formas`)
  const created: ID[] = []
  for (const sh of shapes) {
    const c = cloneShape(sh)
    reId(c)
    c.transform = translateMat(c.transform, dx, dy)
    layer.shapes.push(c)
    created.push(c.id)
  }
  s.selectedShapes = created
  tx.commit({ model: true })
  return created
}

// ---------- Grupos ----------

/** Agrupa formas de una misma lista (las de la capa de la primera). El grupo ocupa el lugar de la más alta. */
export function groupShapes(s: DocumentSession, ids: ID[]): ID | null {
  const first = ids.map((i) => findShape(s, i)).find(Boolean)
  if (!first || first.layer.locked) return null
  const members = ids
    .map((i) => findShape(s, i))
    .filter((f): f is ShapeLocation => !!f && f.list === first.list)
  if (members.length < 2) return null
  const tx = s.begin('Agrupar')
  const ordered = [...members].sort((p, q) => p.index - q.index)
  const group = makeGroup(ordered.map((m) => m.shape))
  const at = ordered[ordered.length - 1]!.index - (ordered.length - 1)
  for (const m of [...ordered].reverse()) first.list.splice(m.index, 1)
  first.list.splice(at, 0, group)
  s.selectedShapes = [group.id]
  tx.commit({ model: true })
  return group.id
}

/** Disuelve grupos: los hijos pasan a la lista del grupo con la transformación compuesta. */
export function ungroupShapes(s: DocumentSession, ids: ID[]): ID[] {
  const tx = s.begin('Desagrupar')
  const out: ID[] = []
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind !== 'group' || f.layer.locked) continue
    const g = f.shape
    const kids = g.children.map((c) => {
      const copy = cloneShape(c)
      copy.transform = multiply(g.transform, copy.transform)
      // la opacidad del grupo se reparte entre los hijos (aproximación: ya no se componen juntos)
      copy.opacity *= g.opacity
      return copy
    })
    f.list.splice(f.index, 1, ...kids)
    out.push(...kids.map((k) => k.id))
  }
  if (out.length) s.selectedShapes = out
  if (out.length) tx.commit({ model: true })
  return out
}

/** Entra o sale del modo aislamiento de un grupo (no es un paso de historial). */
export function isolateGroup(s: DocumentSession, id: ID | null): void {
  if (id) {
    const f = findShape(s, id)
    if (!f || f.shape.kind !== 'group') return
  }
  const leaving = s.isolatedGroup
  s.isolatedGroup = id
  // al salir queda seleccionado el grupo; al entrar, ningún hijo
  s.selectedShapes = !id && leaving ? [leaving] : []
  s.emit({ imageId: s.activeImageId, dirty: null, structure: true, layerIds: [] })
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
    const bitmaps = list.map((x) => (x.visible ? renderShapeFx(x, w, h) : null))
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

/** Forma más alta bajo el píxel (x, y); con `reach` px de tolerancia para contornos finos. */
export function hitShape(s: DocumentSession, x: number, y: number, reach = 1): ID | null {
  const { width: w, height: h } = s.image
  const test = (sh: Shape): boolean => {
    if (!sh.visible || sh.locked) return false
    const bmp = renderShapeCached(sh, w, h)
    if (!bmp) return false
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const px = x + dx
        const py = y + dy
        if (px < 0 || py < 0 || px >= w || py >= h) continue
        // el centro cuenta siempre; los vecinos solo para formas de contorno fino
        if ((dx === 0 && dy === 0) || thinOnly(sh)) if (shapeAlphaAt(bmp, px, py)) return true
      }
    return false
  }
  // En aislamiento solo se pueden elegir los hijos del grupo aislado.
  const iso = s.isolatedGroup ? findShape(s, s.isolatedGroup) : null
  if (iso && iso.shape.kind === 'group') {
    const kids = iso.shape.children
    for (let i = kids.length - 1; i >= 0; i--) {
      const r = resolveShape(s, kids[i]!.id)
      if (r && test(r)) return kids[i]!.id
    }
    return null
  }
  for (let li = s.image.layers.length - 1; li >= 0; li--) {
    const layer = s.image.layers[li]!
    if (!layer.visible || layer.locked) continue
    for (let si = layer.shapes.length - 1; si >= 0; si--) {
      const sh = layer.shapes[si]!
      if (test(sh)) return sh.id
    }
  }
  return null
}

function thinOnly(sh: Shape): boolean {
  return sh.appearance.fills.every((f) => !f.enabled) || sh.kind === 'line'
}

/** Mover formas de forma interactiva: todo el arrastre es un único paso de historial. */
export class ShapeMove {
  private readonly tx
  private readonly start: Map<ID, Mat2D>

  constructor(
    private readonly s: DocumentSession,
    private readonly ids: ID[]
  ) {
    this.tx = s.begin(ids.length === 1 ? 'Mover forma' : `Mover ${ids.length} formas`)
    this.start = new Map()
    for (const id of ids) {
      const f = findShape(s, id)
      if (f && !f.layer.locked) this.start.set(id, [...f.shape.transform] as Mat2D)
    }
  }

  /** Copias creadas al arrastrar con Alt (vacío = se mueven los originales). */
  private clones: { id: ID; from: ID }[] = []

  /** Alt: activa o desactiva la duplicación. Con copia, los originales se quedan y se mueven los clones. */
  setCopy(on: boolean): void {
    if (on === this.clones.length > 0) return
    if (on) {
      for (const id of this.start.keys()) {
        const f = findShape(this.s, id)
        if (!f) continue
        const c = cloneShape(f.shape)
        reId(c)
        c.name = `${f.shape.name} copia`
        f.list.splice(f.index + 1, 0, c)
        this.clones.push({ id: c.id, from: id })
      }
      this.s.selectedShapes = this.clones.map((c) => c.id)
    } else {
      for (const c of this.clones) {
        const f = findShape(this.s, c.id)
        if (f) f.list.splice(f.index, 1)
      }
      this.clones = []
      this.s.selectedShapes = [...this.start.keys()]
    }
  }

  moveBy(dx: number, dy: number): void {
    const copying = this.clones.length > 0
    for (const [id, m] of this.start) {
      const f = findShape(this.s, id)
      if (f) f.shape.transform = copying ? m : translateMat(m, dx, dy)
    }
    for (const c of this.clones) {
      const f = findShape(this.s, c.id)
      const m = this.start.get(c.from)
      if (f && m) f.shape.transform = translateMat(m, dx, dy)
    }
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [...this.start.keys(), ...this.clones.map((c) => c.id)])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

/**
 * ¿Algún píxel pintado de la forma cae dentro del rectángulo (coordenadas de imagen)? Es más fino
 * que la caja delimitadora: un marco en el hueco de un trazado no lo toca.
 */
export function shapeTouchesRect(
  s: DocumentSession,
  id: ID,
  r: { x0: number; y0: number; x1: number; y1: number }
): boolean {
  const sh = resolveShape(s, id)
  if (!sh) return false
  const sb = renderShapeCached(sh, s.image.width, s.image.height)
  if (!sb) return false
  const { width, height, data } = sb.bitmap
  // píxeles [px, px+1) que cruza el rectángulo (un marco de ancho 0 sigue tocando el píxel que cubre)
  const px0 = Math.max(0, Math.floor(r.x0) - sb.x)
  const py0 = Math.max(0, Math.floor(r.y0) - sb.y)
  const px1 = Math.min(width - 1, Math.ceil(r.x1) - 1 - sb.x)
  const py1 = Math.min(height - 1, Math.ceil(r.y1) - 1 - sb.y)
  for (let y = py0; y <= py1; y++)
    for (let x = px0; x <= px1; x++) if (data[(y * width + x) * 4 + 3]) return true
  return false
}

/** Tamaño en píxeles (ancho × alto) de lo que pintan las formas dadas, o null si no pintan nada. */
export function shapesPixelSize(s: DocumentSession, ids: ID[]): { w: number; h: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of ids) {
    const sh = resolveShape(s, id)
    if (!sh) continue
    const b = pixelBounds(renderShapeRegion(sh, s.image.width, s.image.height))
    if (!b) continue
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return x0 === Infinity ? null : { w: x1 - x0, h: y1 - y0 }
}

// ---------- Edición viva (arrastres de paneles) ----------

/**
 * Edición de una forma que se aplica en vivo pero se registra en el historial UNA sola vez, al
 * terminar (soltar el ratón, cerrar el selector de color…).
 */
class LiveEdit {
  private readonly tx

  constructor(
    private readonly s: DocumentSession,
    private readonly id: ID,
    label: string
  ) {
    this.tx = s.begin(label)
  }

  update(fn: (shape: Shape) => void): void {
    const f = findShape(this.s, this.id)
    if (!f) return
    fn(f.shape)
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [this.id])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

const liveEdits = new WeakMap<DocumentSession, Map<string, LiveEdit>>()

/** Aplica `fn` a la forma sin crear paso de historial; el paso se crea en `commitLiveEdit(key)`. */
export function liveUpdateShape(
  s: DocumentSession,
  id: ID,
  key: string,
  label: string,
  fn: (shape: Shape) => void
): void {
  let m = liveEdits.get(s)
  if (!m) liveEdits.set(s, (m = new Map()))
  let live = m.get(key)
  if (!live) m.set(key, (live = new LiveEdit(s, id, label)))
  live.update(fn)
}

/** Cierra la edición viva: un único paso de historial con todo lo aplicado desde el principio. */
export function commitLiveEdit(s: DocumentSession, key: string): void {
  const m = liveEdits.get(s)
  const live = m?.get(key)
  if (!live) return
  m!.delete(key)
  live.end()
}
