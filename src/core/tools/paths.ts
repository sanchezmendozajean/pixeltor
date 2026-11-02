// Edición de trazados y transformaciones de caja (specs/05): convertir en trazado, anclas y escalado.

import { apply, invert, multiply } from '../geometry/geometry'
import {
  type Anchor,
  type Mat2D,
  type PathShape,
  type RectShape,
  type Shape,
  type SubPath,
  type Vec2,
  cloneShape
} from '../model/shapes'
import type { ID } from '../model/types'
import { shapeLines } from '../render/shape'
import type { DocumentSession } from '../session'
import { findShape, layersOf } from './shapes'

const K = 0.5522847498 // constante de Bézier para cuartos de círculo

const corner = (x: number, y: number): Anchor => ({
  p: { x, y },
  in: null,
  out: null,
  type: 'corner'
})

/** Convierte una forma paramétrica en trazado (conserva la transformación y la apariencia). */
export function toPath(sh: Shape): PathShape {
  if (sh.kind === 'group') throw new Error('Un grupo no se puede convertir en trazado')
  if (sh.kind === 'path') return sh
  let subpaths: SubPath[] = []
  switch (sh.kind) {
    case 'rect': {
      const [tl, tr, br, bl] = sh.radius.map((r) => Math.min(r, sh.w / 2, sh.h / 2)) as [
        number,
        number,
        number,
        number
      ]
      const { w, h } = sh
      const lerp = (p: Vec2, q: Vec2): Vec2 => ({
        x: p.x + (q.x - p.x) * K,
        y: p.y + (q.y - p.y) * K
      })
      const a: Anchor[] = []
      // Recorrido horario; cada esquina redondeada = ancla de llegada + ancla de salida.
      const corners: [number, Vec2, Vec2, Vec2][] = [
        [tl, { x: 0, y: 0 }, { x: 0, y: tl }, { x: tl, y: 0 }],
        [tr, { x: w, y: 0 }, { x: w - tr, y: 0 }, { x: w, y: tr }],
        [br, { x: w, y: h }, { x: w, y: h - br }, { x: w - br, y: h }],
        [bl, { x: 0, y: h }, { x: bl, y: h }, { x: 0, y: h - bl }]
      ]
      for (const [r, c, pa, pb] of corners) {
        if (r <= 0) a.push(corner(c.x, c.y))
        else {
          a.push({ p: pa, in: null, out: lerp(pa, c), type: 'corner' })
          a.push({ p: pb, in: lerp(pb, c), out: null, type: 'corner' })
        }
      }
      subpaths = [{ closed: true, anchors: a }]
      break
    }
    case 'ellipse': {
      const { rx, ry } = sh
      subpaths = [
        {
          closed: true,
          anchors: [
            {
              p: { x: rx, y: 0 },
              in: { x: rx, y: -ry * K },
              out: { x: rx, y: ry * K },
              type: 'smooth'
            },
            {
              p: { x: 0, y: ry },
              in: { x: rx * K, y: ry },
              out: { x: -rx * K, y: ry },
              type: 'smooth'
            },
            {
              p: { x: -rx, y: 0 },
              in: { x: -rx, y: ry * K },
              out: { x: -rx, y: -ry * K },
              type: 'smooth'
            },
            {
              p: { x: 0, y: -ry },
              in: { x: -rx * K, y: -ry },
              out: { x: rx * K, y: -ry },
              type: 'smooth'
            }
          ]
        }
      ]
      break
    }
    case 'line':
      subpaths = [{ closed: false, anchors: [corner(sh.a.x, sh.a.y), corner(sh.b.x, sh.b.y)] }]
      break
    case 'polygon':
    case 'star': {
      const lines = shapeLinesLocal(sh)
      subpaths = [{ closed: true, anchors: lines.map((p) => corner(p.x, p.y)) }]
      break
    }
  }
  return {
    id: sh.id,
    name: sh.name,
    visible: sh.visible,
    locked: sh.locked,
    opacity: sh.opacity,
    blendMode: sh.blendMode,
    transform: sh.transform,
    appearance: sh.appearance,
    antialias: sh.antialias,
    kind: 'path',
    subpaths,
    fillRule: 'nonzero'
  }
}

function shapeLinesLocal(sh: Shape): Vec2[] {
  const copy = cloneShape(sh)
  copy.transform = [1, 0, 0, 1, 0, 0]
  return shapeLines(copy)[0]!.pts
}

export function convertToPath(s: DocumentSession, ids: ID[]): boolean {
  const tx = s.begin('Convertir en trazado')
  let any = false
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'path' || f.shape.kind === 'group' || f.layer.locked) continue
    f.list[f.index] = toPath(f.shape)
    any = true
  }
  if (any) tx.commit({ model: true })
  return any
}

// ---------- Anclas ----------

export interface AnchorRef {
  shapeId: ID
  subpath: number
  index: number
}
export type AnchorPart = 'p' | 'in' | 'out'

function localDelta(m: Mat2D, dx: number, dy: number): Vec2 {
  const inv = invert([m[0], m[1], m[2], m[3], 0, 0])
  return inv ? apply(inv, { x: dx, y: dy }) : { x: dx, y: dy }
}

/** Centro del píxel que contiene el valor (coordenadas de imagen). */
export const pixelCenter = (v: number): number => Math.floor(v + 1e-9) + 0.5

/**
 * Lleva el ancla al centro del píxel más cercano (en coordenadas de imagen), con sus tiradores,
 * para que el vector quede siempre «encima» de un píxel y no entre dos.
 */
export function centerAnchor(m: Mat2D, a: Anchor): void {
  const img = apply(m, a.p)
  const d = localDelta(m, pixelCenter(img.x) - img.x, pixelCenter(img.y) - img.y)
  if (Math.abs(d.x) < 1e-9 && Math.abs(d.y) < 1e-9) return
  a.p = { x: a.p.x + d.x, y: a.p.y + d.y }
  if (a.in) a.in = { x: a.in.x + d.x, y: a.in.y + d.y }
  if (a.out) a.out = { x: a.out.x + d.x, y: a.out.y + d.y }
}

/** Arrastre de anclas o tiradores: un único paso de historial. Convierte formas paramétricas. */
export class AnchorDrag {
  private readonly tx
  private readonly shape: PathShape
  private readonly start: {
    sub: number
    i: number
    part: AnchorPart
    pt: Vec2
    in?: Vec2 | null
    out?: Vec2 | null
  }[] = []

  constructor(
    private readonly s: DocumentSession,
    shapeId: ID,
    targets: { subpath: number; index: number; part: AnchorPart }[],
    /** Alt: el tirador se mueve solo, sin arrastrar al opuesto (rompe la simetría). */
    private readonly independent = false
  ) {
    const f = findShape(s, shapeId)
    if (!f || f.shape.kind === 'group') throw new Error('forma no editable')
    this.tx = s.begin(targets.length > 1 ? `Mover ${targets.length} anclas` : 'Mover ancla')
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    this.shape = f.list[f.index] as PathShape
    for (const t of targets) {
      const a = this.shape.subpaths[t.subpath]?.anchors[t.index]
      if (!a) continue
      const pt = t.part === 'p' ? a.p : (a[t.part] ?? a.p)
      this.start.push({
        sub: t.subpath,
        i: t.index,
        part: t.part,
        pt: { ...pt },
        in: a.in ? { ...a.in } : null,
        out: a.out ? { ...a.out } : null
      })
    }
  }

  /** Desplazamiento acumulado en coordenadas de imagen. */
  moveBy(dx: number, dy: number): void {
    const d = localDelta(this.shape.transform, dx, dy)
    for (const st of this.start) {
      const a = this.shape.subpaths[st.sub]!.anchors[st.i]!
      let np = { x: st.pt.x + d.x, y: st.pt.y + d.y }
      if (st.part === 'p') {
        // las anclas se colocan siempre en el centro de un píxel; los tiradores las acompañan
        const m = this.shape.transform
        const from = apply(m, st.pt)
        const to = { x: pixelCenter(from.x + dx), y: pixelCenter(from.y + dy) }
        const dl = localDelta(m, to.x - from.x, to.y - from.y)
        np = { x: st.pt.x + dl.x, y: st.pt.y + dl.y }
        a.p = np
        // los tiradores acompañan al ancla
        if (st.in) a.in = { x: st.in.x + dl.x, y: st.in.y + dl.y }
        if (st.out) a.out = { x: st.out.x + dl.x, y: st.out.y + dl.y }
      } else {
        a[st.part] = np
        if (this.independent) a.type = 'corner'
        // suave/simétrico: el tirador opuesto refleja la dirección
        const other = st.part === 'in' ? 'out' : 'in'
        if (!this.independent && a.type !== 'corner' && a[other]) {
          const vx = a.p.x - np.x
          const vy = a.p.y - np.y
          const len =
            a.type === 'symmetric'
              ? Math.hypot(vx, vy)
              : Math.hypot((st[other]?.x ?? a.p.x) - a.p.x, (st[other]?.y ?? a.p.y) - a.p.y)
          const n = Math.hypot(vx, vy) || 1
          a[other] = { x: a.p.x + (vx / n) * len, y: a.p.y + (vy / n) * len }
        }
      }
    }
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [this.shape.id])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

/**
 * Saca los tiradores de un ancla arrastrando (herramienta Convertir ancla, o Alt sobre un ancla):
 * el ancla pasa a simétrica con el tirador de salida bajo el cursor y el de entrada reflejado.
 */
export class AnchorPull {
  private readonly tx
  private readonly shape: PathShape
  private readonly anchor: Anchor

  constructor(
    private readonly s: DocumentSession,
    ref: AnchorRef
  ) {
    const f = findShape(s, ref.shapeId)
    if (!f || f.shape.kind === 'group') throw new Error('forma no editable')
    this.tx = s.begin('Sacar tiradores')
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    this.shape = f.list[f.index] as PathShape
    const a = this.shape.subpaths[ref.subpath]?.anchors[ref.index]
    if (!a) throw new Error('ancla inexistente')
    this.anchor = a
  }

  /** (x, y) en coordenadas de imagen. */
  pullTo(x: number, y: number): void {
    const inv = invert(this.shape.transform)
    const p = inv ? apply(inv, { x, y }) : { x, y }
    const a = this.anchor
    a.out = p
    a.in = { x: 2 * a.p.x - p.x, y: 2 * a.p.y - p.y }
    a.type = 'symmetric'
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [this.shape.id])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

export interface SegmentHit {
  subpath: number
  /** Índice del ancla de inicio del segmento. */
  index: number
  /** Parámetro 0..1 del punto más cercano dentro del segmento. */
  t: number
}

/** Segmento del trazado más cercano a (x, y) si está a menos de reach px; sin modificar nada. */
export function findSegment(
  s: DocumentSession,
  shapeId: ID,
  x: number,
  y: number,
  reach: number
): SegmentHit | null {
  const f = findShape(s, shapeId)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return null
  const sh = f.shape.kind === 'path' ? f.shape : toPath(f.shape)
  let best: (SegmentHit & { d: number }) | null = null
  sh.subpaths.forEach((sp, spi) => {
    const n = sp.anchors.length
    const segs = sp.closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const a = sp.anchors[i]!
      const b = sp.anchors[(i + 1) % n]!
      for (let k = 1; k < 32; k++) {
        const p = apply(sh.transform, cubicAt(a, b, k / 32))
        const d = Math.hypot(p.x - x, p.y - y)
        if (d <= reach && (!best || d < best.d)) best = { subpath: spi, index: i, t: k / 32, d }
      }
    }
  })
  return best
}

export function hitSegment(
  s: DocumentSession,
  shapeId: ID,
  x: number,
  y: number,
  reach: number
): boolean {
  return !!findSegment(s, shapeId, x, y, reach)
}

/**
 * Curva un segmento arrastrándolo (Selección directa sobre un segmento): los extremos no se
 * mueven y los tiradores de ambos lados se desplazan para que el punto agarrado siga al cursor.
 */
export class SegmentDrag {
  private readonly tx
  private readonly shape: PathShape
  private readonly a: Anchor
  private readonly b: Anchor
  private readonly a0: Anchor
  private readonly b0: Anchor
  private readonly t: number

  constructor(
    private readonly s: DocumentSession,
    shapeId: ID,
    hit: SegmentHit
  ) {
    const f = findShape(s, shapeId)
    if (!f || f.shape.kind === 'group') throw new Error('forma no editable')
    this.tx = s.begin('Curvar segmento')
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    this.shape = f.list[f.index] as PathShape
    const sp = this.shape.subpaths[hit.subpath]!
    this.a = sp.anchors[hit.index]!
    this.b = sp.anchors[(hit.index + 1) % sp.anchors.length]!
    this.a0 = { ...this.a }
    this.b0 = { ...this.b }
    // lejos de los extremos el desplazamiento de los tiradores no se dispara
    this.t = Math.min(0.85, Math.max(0.15, hit.t))
  }

  /** Desplazamiento acumulado del cursor en coordenadas de imagen. */
  moveBy(dx: number, dy: number): void {
    const m = this.shape.transform
    const inv = invert([m[0], m[1], m[2], m[3], 0, 0])
    const d = inv ? apply(inv, { x: dx, y: dy }) : { x: dx, y: dy }
    const k = 1 / (3 * this.t * (1 - this.t))
    const sh = { x: d.x * k, y: d.y * k }
    const p1 = this.a0.out ?? this.a0.p
    const p2 = this.b0.in ?? this.b0.p
    this.a.out = { x: p1.x + sh.x, y: p1.y + sh.y }
    this.b.in = { x: p2.x + sh.x, y: p2.y + sh.y }
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [this.shape.id])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

function splitCubic(a: Anchor, b: Anchor, t: number): { mid: Anchor; a: Anchor; b: Anchor } {
  const lerp = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const p0 = a.p
  const p1 = a.out ?? a.p
  const p2 = b.in ?? b.p
  const p3 = b.p
  const p01 = lerp(p0, p1)
  const p12 = lerp(p1, p2)
  const p23 = lerp(p2, p3)
  const p012 = lerp(p01, p12)
  const p123 = lerp(p12, p23)
  const m = lerp(p012, p123)
  const straight = !a.out && !b.in
  return {
    a: { ...a, out: straight ? null : p01 },
    mid: {
      p: m,
      in: straight ? null : p012,
      out: straight ? null : p123,
      type: straight ? 'corner' : 'smooth'
    },
    b: { ...b, in: straight ? null : p23 }
  }
}

function cubicAt(a: Anchor, b: Anchor, t: number): Vec2 {
  const u = 1 - t
  const p1 = a.out ?? a.p
  const p2 = b.in ?? b.p
  return {
    x: u * u * u * a.p.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.p.x,
    y: u * u * u * a.p.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.p.y
  }
}

/** Añade un ancla sobre el segmento más cercano a (x, y) (px de imagen); `reach` en px. */
export function addAnchorAt(
  s: DocumentSession,
  shapeId: ID,
  x: number,
  y: number,
  reach = 4
): boolean {
  const f = findShape(s, shapeId)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return false
  const sh = f.shape.kind === 'path' ? f.shape : toPath(f.shape)
  let best: { sp: number; i: number; t: number; d: number } | null = null
  sh.subpaths.forEach((sp, spi) => {
    const n = sp.anchors.length
    const segs = sp.closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const a = sp.anchors[i]!
      const b = sp.anchors[(i + 1) % n]!
      for (let k = 1; k < 32; k++) {
        const t = k / 32
        const p = apply(sh.transform, cubicAt(a, b, t))
        const d = Math.hypot(p.x - x, p.y - y)
        if (!best || d < best.d) best = { sp: spi, i, t, d }
      }
    }
  })
  if (!best || (best as { d: number }).d > reach) return false
  const b = best as { sp: number; i: number; t: number }
  const tx = s.begin('Añadir ancla')
  if (f.shape.kind !== 'path') f.list[f.index] = sh
  const sp = sh.subpaths[b.sp]!
  const a0 = sp.anchors[b.i]!
  const a1 = sp.anchors[(b.i + 1) % sp.anchors.length]!
  const r = splitCubic(a0, a1, b.t)
  sp.anchors[b.i] = r.a
  if ((b.i + 1) % sp.anchors.length === 0) sp.anchors[0] = r.b
  else sp.anchors[b.i + 1] = r.b
  centerAnchor(sh.transform, r.mid)
  sp.anchors.splice(b.i + 1, 0, r.mid)
  tx.commit({ model: true })
  return true
}

/** Elimina un ancla; si el trazado se queda con menos de 2, se elimina la forma. */
export function deleteAnchor(s: DocumentSession, ref: AnchorRef): boolean {
  const f = findShape(s, ref.shapeId)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return false
  const tx = s.begin('Eliminar ancla')
  if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
  const sh = f.list[f.index] as PathShape
  const sp = sh.subpaths[ref.subpath]
  if (!sp) return false
  sp.anchors.splice(ref.index, 1)
  if (sp.anchors.length < 2) sh.subpaths.splice(ref.subpath, 1)
  if (!sh.subpaths.length) {
    f.list.splice(f.index, 1)
    s.selectedShapes = s.selectedShapes.filter((i) => i !== sh.id)
  }
  tx.commit({ model: true })
  return true
}

/** Convierte un ancla en esquina (sin tiradores) o en suave (tiradores según los vecinos). */
export function convertAnchor(s: DocumentSession, ref: AnchorRef, smooth: boolean): boolean {
  const f = findShape(s, ref.shapeId)
  if (!f || f.shape.kind === 'group' || f.layer.locked) return false
  const tx = s.begin(smooth ? 'Ancla suave' : 'Ancla de esquina')
  if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
  const sh = f.list[f.index] as PathShape
  const sp = sh.subpaths[ref.subpath]
  const a = sp?.anchors[ref.index]
  if (!sp || !a) return false
  if (!smooth) {
    a.in = null
    a.out = null
    a.type = 'corner'
  } else {
    const n = sp.anchors.length
    const prev = sp.anchors[(ref.index - 1 + n) % n]!
    const next = sp.anchors[(ref.index + 1) % n]!
    const dx = next.p.x - prev.p.x
    const dy = next.p.y - prev.p.y
    const len = Math.hypot(dx, dy) || 1
    const k =
      (Math.hypot(a.p.x - prev.p.x, a.p.y - prev.p.y) +
        Math.hypot(next.p.x - a.p.x, next.p.y - a.p.y)) /
      6
    a.in = { x: a.p.x - (dx / len) * k, y: a.p.y - (dy / len) * k }
    a.out = { x: a.p.x + (dx / len) * k, y: a.p.y + (dy / len) * k }
    a.type = 'symmetric'
  }
  tx.commit({ model: true })
  return true
}

// ---------- Escalado con la caja ----------

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Caja delimitadora (en px de imagen) de las formas dadas. */
export function shapesBox(s: DocumentSession, ids: ID[]): Box | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f) continue
    for (const l of shapeLines(f.shape))
      for (const p of l.pts) {
        x0 = Math.min(x0, p.x)
        y0 = Math.min(y0, p.y)
        x1 = Math.max(x1, p.x)
        y1 = Math.max(y1, p.y)
      }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Aplica la escala (sx, sy) respecto a (ox, oy) a una forma, horneándola en los parámetros si puede. */
function scaleShape(sh: Shape, sx: number, sy: number, ox: number, oy: number): void {
  const m: Mat2D = [sx, 0, 0, sy, ox - sx * ox, oy - sy * oy]
  const t = sh.transform
  const translateOnly = t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1
  if (translateOnly) {
    const c = apply(m, { x: t[4], y: t[5] })
    if (sh.kind === 'rect') {
      sh.w *= Math.abs(sx)
      sh.h *= Math.abs(sy)
      sh.radius = sh.radius.map((r) => r * Math.min(Math.abs(sx), Math.abs(sy))) as typeof sh.radius
      // la esquina superior izquierda es el origen local: con escala negativa cambia de lado
      sh.transform = [1, 0, 0, 1, sx < 0 ? c.x - sh.w : c.x, sy < 0 ? c.y - sh.h : c.y]
      return
    }
    if (sh.kind === 'ellipse') {
      sh.rx *= Math.abs(sx)
      sh.ry *= Math.abs(sy)
      sh.transform = [1, 0, 0, 1, c.x, c.y]
      return
    }
    if (sh.kind === 'line') {
      sh.a = apply(m, apply(t, sh.a))
      sh.b = apply(m, apply(t, sh.b))
      sh.transform = [1, 0, 0, 1, 0, 0]
      return
    }
    if (sh.kind === 'path') {
      for (const sp of sh.subpaths)
        for (const a of sp.anchors) {
          a.p = apply(m, apply(t, a.p))
          if (a.in) a.in = apply(m, apply(t, a.in))
          if (a.out) a.out = apply(m, apply(t, a.out))
        }
      sh.transform = [1, 0, 0, 1, 0, 0]
      return
    }
  }
  sh.transform = multiply(m, t)
}

/** Escalado interactivo de la selección: la caja original pasa a `target`. */
export class ShapeScale {
  private readonly tx
  private readonly originals = new Map<ID, Shape>()
  private readonly box: Box

  constructor(
    private readonly s: DocumentSession,
    private readonly ids: ID[],
    box: Box
  ) {
    this.tx = s.begin('Escalar')
    this.box = box
    for (const id of ids) {
      const f = findShape(s, id)
      if (f) this.originals.set(id, cloneShape(f.shape))
    }
  }

  /** `anchor` es el punto fijo (esquina/borde opuesto o centro) y `scale` los factores. */
  scaleBy(anchor: Vec2, sx: number, sy: number): void {
    for (const [id, orig] of this.originals) {
      const f = findShape(this.s, id)
      if (!f) continue
      const copy = cloneShape(orig)
      scaleShape(copy, sx, sy, anchor.x, anchor.y)
      f.list[f.index] = copy
    }
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [...this.originals.keys()])
    })
  }

  get original(): Box {
    return this.box
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

/** Rotación interactiva de la selección alrededor del centro de su caja. */
export class ShapeRotate {
  private readonly tx
  private readonly originals = new Map<ID, Shape>()
  readonly center: Vec2

  constructor(
    private readonly s: DocumentSession,
    ids: ID[],
    box: Box
  ) {
    this.tx = s.begin('Rotar')
    this.center = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    for (const id of ids) {
      const f = findShape(s, id)
      if (f) this.originals.set(id, cloneShape(f.shape))
    }
  }

  /** Ángulo (rad) respecto al estado inicial. */
  rotateTo(angle: number): void {
    const c = Math.cos(angle)
    const sn = Math.sin(angle)
    const { x, y } = this.center
    // rotación alrededor del centro: R · (p − c) + c
    const m: Mat2D = [c, sn, -sn, c, x - c * x + sn * y, y - sn * x - c * y]
    for (const [id, orig] of this.originals) {
      const f = findShape(this.s, id)
      if (!f) continue
      const copy = cloneShape(orig)
      copy.transform = multiply(m, copy.transform)
      f.list[f.index] = copy
    }
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [...this.originals.keys()])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

/** Radio de esquina del rectángulo arrastrando el widget (Alt: solo la esquina superior izquierda). */
export class RectRadiusDrag {
  private readonly tx
  private readonly rect: RectShape
  private readonly start: [number, number, number, number]

  constructor(
    private readonly s: DocumentSession,
    id: ID
  ) {
    const f = findShape(s, id)
    if (!f || f.shape.kind !== 'rect') throw new Error('no es un rectángulo')
    this.rect = f.shape
    this.start = [...f.shape.radius] as typeof this.start
    this.tx = s.begin('Radio de esquina')
  }

  /** (fx, fy) en coordenadas de imagen; el radio es la proyección sobre la diagonal de la esquina. */
  moveTo(fx: number, fy: number, single = false): void {
    const inv = invert(this.rect.transform)
    if (!inv) return
    const l = apply(inv, { x: fx, y: fy })
    const max = Math.min(this.rect.w, this.rect.h) / 2
    const r = Math.max(0, Math.min(max, Math.round((l.x + l.y) / 2)))
    this.rect.radius = single
      ? ([r, this.start[1], this.start[2], this.start[3]] as typeof this.start)
      : [r, r, r, r]
    this.s.emit({
      imageId: this.s.activeImageId,
      dirty: null,
      structure: true,
      layerIds: layersOf(this.s, [this.rect.id])
    })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}

// ---------- Operaciones sobre varias anclas ----------

/** Elimina varias anclas en un solo paso (un trazado con menos de 2 anclas desaparece). */
export function deleteAnchors(s: DocumentSession, refs: AnchorRef[]): boolean {
  if (!refs.length) return false
  const byShape = new Map<ID, AnchorRef[]>()
  for (const r of refs) byShape.set(r.shapeId, [...(byShape.get(r.shapeId) ?? []), r])
  const tx = s.begin(refs.length > 1 ? `Eliminar ${refs.length} anclas` : 'Eliminar ancla')
  let any = false
  for (const [id, list] of byShape) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    const sh = f.list[f.index] as PathShape
    // de mayor a menor índice para no desplazar los siguientes
    for (const r of [...list].sort((a, b) => b.subpath - a.subpath || b.index - a.index)) {
      const sp = sh.subpaths[r.subpath]
      if (!sp || !sp.anchors[r.index]) continue
      sp.anchors.splice(r.index, 1)
      any = true
    }
    sh.subpaths = sh.subpaths.filter((sp) => sp.anchors.length >= 2)
    if (!sh.subpaths.length) {
      const cur = findShape(s, id)
      if (cur) cur.list.splice(cur.index, 1)
      s.selectedShapes = s.selectedShapes.filter((i) => i !== id)
    }
  }
  if (!any) return false
  tx.commit({ model: true })
  return true
}

/** Convierte varias anclas en esquina o en suaves en un solo paso. */
export function convertAnchors(s: DocumentSession, refs: AnchorRef[], smooth: boolean): boolean {
  if (!refs.length) return false
  const tx = s.begin(smooth ? 'Anclas suaves' : 'Anclas de esquina')
  let any = false
  for (const r of refs) {
    const f = findShape(s, r.shapeId)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    const sh = f.list[f.index] as PathShape
    const sp = sh.subpaths[r.subpath]
    const a = sp?.anchors[r.index]
    if (!sp || !a) continue
    any = true
    if (!smooth) {
      a.in = null
      a.out = null
      a.type = 'corner'
      continue
    }
    const n = sp.anchors.length
    const prev = sp.anchors[(r.index - 1 + n) % n]!
    const next = sp.anchors[(r.index + 1) % n]!
    const dx = next.p.x - prev.p.x
    const dy = next.p.y - prev.p.y
    const len = Math.hypot(dx, dy) || 1
    const k =
      (Math.hypot(a.p.x - prev.p.x, a.p.y - prev.p.y) +
        Math.hypot(next.p.x - a.p.x, next.p.y - a.p.y)) /
      6
    a.in = { x: a.p.x - (dx / len) * k, y: a.p.y - (dy / len) * k }
    a.out = { x: a.p.x + (dx / len) * k, y: a.p.y + (dy / len) * k }
    a.type = 'symmetric'
  }
  if (!any) return false
  tx.commit({ model: true })
  return true
}

/** Objeto › Trazado › Añadir puntos de ancla: una ancla nueva en el centro de cada segmento. */
export function addMidAnchors(s: DocumentSession, ids: ID[]): boolean {
  const tx = s.begin('Añadir puntos de ancla')
  let any = false
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    const sh = f.list[f.index] as PathShape
    for (const sp of sh.subpaths) {
      const n = sp.anchors.length
      const segs = sp.closed ? n : n - 1
      const w = sp.anchors.map((x) => ({ ...x }))
      const mids: Anchor[] = []
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % n
        const r = splitCubic(w[i]!, w[j]!, 0.5)
        w[i] = r.a
        w[j] = r.b
        centerAnchor(sh.transform, r.mid)
        mids.push(r.mid)
        any = true
      }
      sp.anchors = w.flatMap((x, i) => (i < mids.length ? [x, mids[i]!] : [x]))
    }
  }
  if (!any) return false
  tx.commit({ model: true })
  return true
}

/**
 * Lleva todas las anclas de las formas al centro de su píxel (convierte las paramétricas en
 * trazados). Sirve para arreglar formas antiguas o convertidas, cuyas anclas caen entre píxeles.
 */
export function centerAnchors(s: DocumentSession, ids: ID[]): boolean {
  const tx = s.begin('Centrar anclas en los píxeles')
  let any = false
  for (const id of ids) {
    const f = findShape(s, id)
    if (!f || f.shape.kind === 'group' || f.layer.locked) continue
    const before = f.shape.kind === 'path' ? JSON.stringify(f.shape.subpaths) : null
    if (f.shape.kind !== 'path') f.list[f.index] = toPath(f.shape)
    const sh = f.list[f.index] as PathShape
    for (const sp of sh.subpaths) for (const a of sp.anchors) centerAnchor(sh.transform, a)
    if (before === null || before !== JSON.stringify(sh.subpaths)) any = true
  }
  if (!any) return false
  tx.commit({ model: true })
  return true
}
