// Operaciones sobre trazados (specs/05): trazados compuestos, simplificar, desplazar el trazado y
// convertir el contorno en forma. Trabajan en coordenadas de lienzo (hornean la transformación) y
// producen trazados de esquinas rectas.

import { IDENTITY, apply, flattenCubic } from '../geometry/geometry'
import {
  type Anchor,
  type Fill,
  type PathShape,
  type Shape,
  type SubPath,
  type Vec2,
  cloneShape
} from '../model/shapes'
import { newId } from '../model/ids'
import type { ID } from '../model/types'
import type { DocumentSession } from '../session'
import { findShape } from './shapes'
import { toPath } from './paths'

const TOL = 0.1

const corner = (p: Vec2): Anchor => ({ p, in: null, out: null, type: 'corner' })

/** Copia del trazado con la transformación horneada en las anclas. */
export function bakedPath(sh: Shape): PathShape {
  const p = cloneShape(toPath(sh))
  const m = p.transform
  p.subpaths = p.subpaths.map((sp) => ({
    closed: sp.closed,
    anchors: sp.anchors.map((a) => ({
      ...a,
      p: apply(m, a.p),
      in: a.in ? apply(m, a.in) : null,
      out: a.out ? apply(m, a.out) : null
    }))
  }))
  p.transform = [...IDENTITY]
  return p
}

export interface Poly {
  closed: boolean
  pts: Vec2[]
}

/** Aplana un subtrazado a una polilínea. */
export function flattenSubpath(sp: SubPath): Poly {
  const a = sp.anchors
  const pts: Vec2[] = a.length ? [{ ...a[0]!.p }] : []
  const n = sp.closed ? a.length : a.length - 1
  for (let i = 0; i < n; i++) {
    const p = a[i]!
    const q = a[(i + 1) % a.length]!
    if (p.out || q.in) flattenCubic(p.p, p.out ?? p.p, q.in ?? q.p, q.p, TOL, pts)
    else pts.push({ ...q.p })
  }
  if (sp.closed && pts.length > 1) {
    const f = pts[0]!
    const l = pts[pts.length - 1]!
    if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-9) pts.pop()
  }
  return { closed: sp.closed, pts }
}

function replace(
  s: DocumentSession,
  label: string,
  ids: ID[],
  fn: (sh: Shape) => Shape | null
): boolean {
  const tx = s.begin(label)
  let any = false
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    const next = fn(f.shape)
    if (!next) continue
    f.list[f.index] = next
    any = true
  }
  if (any) tx.commit({ model: true })
  return any
}

// ---------- Trazados compuestos ----------

/** Une las formas en un trazado compuesto (relleno par-impar: los huecos quedan vacíos). */
export function makeCompound(s: DocumentSession, ids: ID[]): ID | null {
  const found = ids
    .map((id) => findShape(s, id))
    .filter((f): f is NonNullable<typeof f> => !!f && f.shape.kind !== 'group' && !f.layer.locked)
  if (found.length < 2) return null
  const tx = s.begin('Crear trazado compuesto')
  const top = found[found.length - 1]!
  const out = bakedPath(top.shape)
  out.subpaths = found.flatMap((f) => bakedPath(f.shape).subpaths)
  out.fillRule = 'evenodd'
  out.name = 'Trazado compuesto'
  top.list[top.index] = out
  for (const f of found.slice(0, -1)) {
    const cur = findShape(s, f.shape.id)
    if (cur) cur.list.splice(cur.index, 1)
  }
  s.selectedShapes = [out.id]
  tx.commit({ model: true })
  return out.id
}

/** Separa un trazado compuesto en un trazado por subtrazado. */
export function releaseCompound(s: DocumentSession, ids: ID[]): boolean {
  const tx = s.begin('Liberar trazado compuesto')
  const created: ID[] = []
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind !== 'path' || f.shape.subpaths.length < 2 || f.layer.locked) continue
    const parts = f.shape.subpaths.map((sp, i) => {
      const p = cloneShape(f.shape as PathShape)
      p.id = i === 0 ? p.id : newId()
      p.subpaths = [sp]
      p.fillRule = 'nonzero'
      return p
    })
    for (const p of parts) created.push(p.id)
    f.list.splice(f.index, 1, ...parts)
  }
  if (!created.length) return false
  s.selectedShapes = created
  tx.commit({ model: true })
  return true
}

// ---------- Simplificar ----------

function rdp(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    const a = pts[i]!
    const b = pts[j]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    let far = -1
    let dmax = tol
    for (let k = i + 1; k < j; k++) {
      const p = pts[k]!
      const d =
        len < 1e-9
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len
      if (d > dmax) {
        dmax = d
        far = k
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([i, far], [far, j])
    }
  }
  return pts.filter((_, i) => keep[i])
}

/** Reduce las anclas con Ramer–Douglas–Peucker (las curvas pasan a segmentos rectos). */
export function simplifyPaths(s: DocumentSession, ids: ID[], tolerance = 1): boolean {
  return replace(s, 'Simplificar trazado', ids, (sh) => {
    const p = bakedPath(sh)
    p.subpaths = p.subpaths.map((sp) => {
      const poly = flattenSubpath(sp)
      // cerrado: partir por el punto más lejano del primero para no recortar la esquina inicial
      let pts = poly.pts
      if (poly.closed && pts.length > 3) {
        let far = 0
        let dm = -1
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i]!.x - pts[0]!.x, pts[i]!.y - pts[0]!.y)
          if (d > dm) {
            dm = d
            far = i
          }
        }
        const a = rdp(pts.slice(0, far + 1), tolerance)
        const b = rdp([...pts.slice(far), pts[0]!], tolerance)
        pts = [...a, ...b.slice(1, -1)]
      } else pts = rdp(pts, tolerance)
      return { closed: sp.closed, anchors: pts.map(corner) }
    })
    return p
  })
}

// ---------- Desplazar el trazado y contorno de trazo ----------

function signedArea(pts: Vec2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/** Quita puntos consecutivos repetidos. */
function dedupe(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of pts) {
    const l = out[out.length - 1]
    if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 1e-6) out.push(p)
  }
  if (out.length > 1) {
    const f = out[0]!
    const l = out[out.length - 1]!
    if (Math.hypot(f.x - l.x, f.y - l.y) <= 1e-6) out.pop()
  }
  return out
}

const MITER_LIMIT = 4

/**
 * Desplaza un polígono cerrado `d` px hacia fuera (d > 0) o hacia dentro (d < 0) con esquinas en
 * inglete (bisel si el inglete supera el límite).
 */
export function offsetPolygon(input: Vec2[], d: number): Vec2[] {
  const pts = dedupe(input)
  const n = pts.length
  if (n < 3 || d === 0) return pts
  const sgn = signedArea(pts) > 0 ? 1 : -1
  const normals: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % n]!
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
    const dx = (q.x - p.x) / len
    const dy = (q.y - p.y) / len
    normals.push({ x: sgn * dy, y: -sgn * dx })
  }
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const n1 = normals[(i + n - 1) % n]!
    const n2 = normals[i]!
    const p = pts[i]!
    const dot = n1.x * n2.x + n1.y * n2.y
    const k = 1 + dot
    if (k < (1 / (MITER_LIMIT * MITER_LIMIT)) * 2) {
      out.push({ x: p.x + n1.x * d, y: p.y + n1.y * d }, { x: p.x + n2.x * d, y: p.y + n2.y * d })
    } else {
      out.push({ x: p.x + ((n1.x + n2.x) / k) * d, y: p.y + ((n1.y + n2.y) / k) * d })
    }
  }
  return out
}

/** Desplaza los trazados cerrados `d` px (positivo = hacia fuera). Los abiertos se ignoran. */
export function offsetPaths(s: DocumentSession, ids: ID[], d: number): boolean {
  return replace(s, d >= 0 ? 'Expandir trazado' : 'Contraer trazado', ids, (sh) => {
    const p = bakedPath(sh)
    if (!p.subpaths.some((sp) => sp.closed)) return null
    p.subpaths = p.subpaths.map((sp) =>
      sp.closed
        ? { closed: true, anchors: offsetPolygon(flattenSubpath(sp).pts, d).map(corner) }
        : sp
    )
    return p
  })
}

/** Contorno de una polilínea abierta con remates rectos (anillo de ida y vuelta). */
function openOutline(pts: Vec2[], half: number): Vec2[] {
  const p = dedupe(pts)
  if (p.length < 2) return []
  const left: Vec2[] = []
  const right: Vec2[] = []
  const n = p.length
  const nor = (i: number): Vec2 => {
    const a = p[i]!
    const b = p[i + 1]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: (b.y - a.y) / len, y: -(b.x - a.x) / len }
  }
  for (let i = 0; i < n; i++) {
    const n1 = i > 0 ? nor(i - 1) : nor(0)
    const n2 = i < n - 1 ? nor(i) : nor(n - 2)
    const k = 1 + n1.x * n2.x + n1.y * n2.y
    const mx = k < 0.125 ? n2.x : (n1.x + n2.x) / k
    const my = k < 0.125 ? n2.y : (n1.y + n2.y) / k
    left.push({ x: p[i]!.x + mx * half, y: p[i]!.y + my * half })
    right.push({ x: p[i]!.x - mx * half, y: p[i]!.y - my * half })
  }
  return [...left, ...right.reverse()]
}

/**
 * Convierte el primer contorno activo en una forma rellena con su pintura (Objeto › Contorno de
 * trazo). Respeta el grosor y la alineación; el resultado es un trazado compuesto (par-impar).
 */
export function outlineStroke(s: DocumentSession, ids: ID[]): boolean {
  return replace(s, 'Contorno de trazo', ids, (sh) => {
    const st = sh.appearance.strokes.find((x) => x.enabled)
    if (!st) return null
    const p = bakedPath(sh)
    const w = st.width
    const subs: SubPath[] = []
    for (const sp of p.subpaths) {
      const poly = flattenSubpath(sp)
      if (poly.pts.length < 2) continue
      if (sp.closed && poly.pts.length >= 3) {
        const [o, i] =
          st.align === 'inside'
            ? [st.offset ?? 0, w + (st.offset ?? 0)].map((v) => -v)
            : st.align === 'outside'
              ? [st.offset ?? 0, w + (st.offset ?? 0)]
              : [w / 2, -w / 2]
        subs.push({ closed: true, anchors: offsetPolygon(poly.pts, o!).map(corner) })
        subs.push({ closed: true, anchors: offsetPolygon(poly.pts, i!).map(corner) })
      } else {
        const ring = openOutline(poly.pts, w / 2)
        if (ring.length) subs.push({ closed: true, anchors: ring.map(corner) })
      }
    }
    if (!subs.length) return null
    const fill: Fill = {
      id: newId(),
      enabled: true,
      paint: JSON.parse(JSON.stringify(st.paint)) as Fill['paint'],
      opacity: st.opacity,
      blendMode: st.blendMode
    }
    return {
      ...p,
      name: 'Contorno',
      subpaths: subs,
      fillRule: 'evenodd',
      appearance: { stack: [fill.id], fills: [fill], strokes: [] }
    }
  })
}

// ---------- Cortar, unir y continuar trazados ----------

export interface AnchorTarget {
  shapeId: ID
  subpath: number
  index: number
}

const flip = (a: Anchor): Anchor => ({ ...a, in: a.out, out: a.in })

/** Invierte el sentido de un subtrazado. */
export function reverseAnchors(list: Anchor[]): Anchor[] {
  return [...list].reverse().map(flip)
}

const cloneAnchor = (a: Anchor): Anchor => ({
  ...a,
  p: { ...a.p },
  in: a.in ? { ...a.in } : null,
  out: a.out ? { ...a.out } : null
})

/**
 * Corta el trazado en las anclas indicadas (tijeras): cada pieza resultante es un trazado abierto.
 * Las anclas de los extremos de un trazado abierto no cortan nada.
 */
export function cutAtAnchors(s: DocumentSession, refs: AnchorTarget[]): boolean {
  const byShape = new Map<ID, AnchorTarget[]>()
  for (const r of refs) byShape.set(r.shapeId, [...(byShape.get(r.shapeId) ?? []), r])
  const tx = s.begin('Cortar en anclas')
  let any = false
  const created: ID[] = []
  for (const [id, list] of byShape) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    const path = f.shape.kind === 'path' ? f.shape : toPath(f.shape)
    const pieces: Anchor[][] = []
    const keep: SubPath[] = []
    path.subpaths.forEach((sp, spi) => {
      const cuts = [...new Set(list.filter((r) => r.subpath === spi).map((r) => r.index))].sort(
        (x, y) => x - y
      )
      const n = sp.anchors.length
      const useful = sp.closed ? cuts : cuts.filter((c) => c > 0 && c < n - 1)
      if (!useful.length) {
        keep.push(sp)
        return
      }
      // anclas de "from" a "to" (inclusive); en trazados cerrados puede dar la vuelta
      const sub = (from: number, to: number): Anchor[] => {
        // en un trazado cerrado con un solo corte (from === to) se da la vuelta completa
        const count = from === to ? n + 1 : ((to - from + n) % n) + 1
        const out: Anchor[] = []
        for (let k = 0; k < count; k++) out.push(cloneAnchor(sp.anchors[(from + k) % n]!))
        return out
      }
      if (sp.closed) {
        for (let k = 0; k < useful.length; k++) {
          const piece = sub(useful[k]!, useful[(k + 1) % useful.length]!)
          piece[0]!.in = null
          piece[piece.length - 1]!.out = null
          pieces.push(piece)
        }
      } else {
        const bounds = [0, ...useful, n - 1]
        for (let k = 0; k < bounds.length - 1; k++) {
          const piece = sub(bounds[k]!, bounds[k + 1]!)
          if (k > 0) piece[0]!.in = null
          if (k < bounds.length - 2) piece[piece.length - 1]!.out = null
          pieces.push(piece)
        }
      }
      any = true
    })
    if (!pieces.length) continue
    const made = pieces.filter((p) => p.length >= 2)
    if (keep.length) {
      // hay otros subtrazados sin cortar: todo sigue en la misma forma
      path.subpaths = [...keep, ...made.map((anchors) => ({ closed: false, anchors }))]
      f.list[f.index] = path
      continue
    }
    const shapes = made.map((anchors, i) => {
      const copy = cloneShape(path)
      copy.subpaths = [{ closed: false, anchors }]
      if (i > 0) copy.id = newId()
      return copy
    })
    f.list.splice(f.index, 1, ...shapes)
    created.push(...shapes.map((x) => x.id))
  }
  if (!any) return false
  if (created.length) s.selectedShapes = created
  tx.commit({ model: true })
  return true
}

/**
 * Une dos extremos de trazados abiertos (Ctrl+J). Los dos extremos de un mismo trazado lo
 * cierran; en trazados distintos (de la misma forma o de formas diferentes) se funden en uno.
 * Si los extremos coinciden se fusionan en una sola ancla; si no, se unen con un segmento recto.
 */
export function joinAnchors(s: DocumentSession, refs: AnchorTarget[]): boolean {
  if (refs.length !== 2) return false
  const [r1, r2] = refs as [AnchorTarget, AnchorTarget]
  const f1 = findShape(s, r1.shapeId)
  const f2 = findShape(s, r2.shapeId)
  if (!f1 || !f2 || f1.shape.kind === 'group' || f2.shape.kind === 'group') return false
  if (f1.layer.locked || f2.layer.locked) return false
  const p1 = bakedPath(f1.shape)
  const p2 = f1.shape.id === f2.shape.id ? p1 : bakedPath(f2.shape)
  const sp1 = p1.subpaths[r1.subpath]
  const sp2 = p2.subpaths[r2.subpath]
  if (!sp1 || !sp2 || sp1.closed || sp2.closed) return false
  const end = (sp: SubPath, i: number): boolean => i === 0 || i === sp.anchors.length - 1
  if (!end(sp1, r1.index) || !end(sp2, r2.index)) return false
  const same = sp1 === sp2
  if (same && r1.index === r2.index) return false
  const near = (a: Anchor, b: Anchor): boolean => Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < 0.5

  const tx = s.begin('Unir anclas')
  let result: SubPath
  if (same) {
    const list = sp1.anchors.map(cloneAnchor)
    const first = list[0]!
    const last = list[list.length - 1]!
    if (near(first, last) && list.length > 2) {
      first.in = last.in
      list.pop()
    }
    result = { closed: true, anchors: list }
  } else {
    // A termina en el ancla a unir y B empieza por la suya
    const a = r1.index === sp1.anchors.length - 1 ? sp1.anchors : reverseAnchors(sp1.anchors)
    const b = r2.index === 0 ? sp2.anchors : reverseAnchors(sp2.anchors)
    const la = cloneAnchor(a[a.length - 1]!)
    const fb = cloneAnchor(b[0]!)
    const merged: Anchor[] = a.slice(0, -1).map(cloneAnchor)
    if (near(la, fb)) merged.push({ ...la, out: fb.out })
    else merged.push(la, fb)
    merged.push(...b.slice(1).map(cloneAnchor))
    result = { closed: false, anchors: merged }
  }
  p1.subpaths[r1.subpath] = result
  f1.list[f1.index] = p1
  if (!same) {
    if (f1.shape.id === f2.shape.id) p1.subpaths = p1.subpaths.filter((x) => x !== sp2)
    else {
      const cur2 = findShape(s, f2.shape.id)
      if (cur2) {
        if (p2.subpaths.length > 1) {
          p2.subpaths = p2.subpaths.filter((x) => x !== sp2)
          cur2.list[cur2.index] = p2
        } else cur2.list.splice(cur2.index, 1)
      }
    }
  }
  s.selectedShapes = [p1.id]
  tx.commit({ model: true })
  return true
}

/**
 * Sustituye un subtrazado por otro (la Pluma al continuar un trazado abierto). El resultado queda
 * con la transformación horneada.
 */
export function replaceSubpath(
  s: DocumentSession,
  shapeId: ID,
  subpath: number,
  anchors: Anchor[],
  closed: boolean
): boolean {
  const f = findShape(s, shapeId)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return false
  const p = bakedPath(f.shape)
  if (!p.subpaths[subpath]) return false
  const tx = s.begin('Continuar trazado')
  p.subpaths[subpath] = { closed, anchors }
  f.list[f.index] = p
  tx.commit({ model: true })
  return true
}
