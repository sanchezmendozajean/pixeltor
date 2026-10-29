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
