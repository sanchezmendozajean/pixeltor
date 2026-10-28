// Edición de trazados y transformaciones de caja (specs/05): convertir en trazado, anclas y escalado.

import { apply, invert, multiply } from '../geometry/geometry'
import {
  type Anchor,
  type Mat2D,
  type PathShape,
  type Shape,
  type SubPath,
  type Vec2,
  cloneShape
} from '../model/shapes'
import type { ID } from '../model/types'
import { shapeLines } from '../render/shape'
import type { DocumentSession } from '../session'
import { findShape } from './shapes'

const K = 0.5522847498 // constante de Bézier para cuartos de círculo

const corner = (x: number, y: number): Anchor => ({
  p: { x, y },
  in: null,
  out: null,
  type: 'corner'
})

/** Convierte una forma paramétrica en trazado (conserva la transformación y la apariencia). */
export function toPath(sh: Shape): PathShape {
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
    if (!f || f.shape.kind === 'path' || f.layer.locked) continue
    f.layer.shapes[f.index] = toPath(f.shape)
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
    targets: { subpath: number; index: number; part: AnchorPart }[]
  ) {
    const f = findShape(s, shapeId)
    if (!f) throw new Error('forma desconocida')
    this.tx = s.begin(targets.length > 1 ? `Mover ${targets.length} anclas` : 'Mover ancla')
    if (f.shape.kind !== 'path') f.layer.shapes[f.index] = toPath(f.shape)
    this.shape = f.layer.shapes[f.index] as PathShape
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
      const np = { x: st.pt.x + d.x, y: st.pt.y + d.y }
      if (st.part === 'p') {
        a.p = np
        // los tiradores acompañan al ancla
        if (st.in) a.in = { x: st.in.x + d.x, y: st.in.y + d.y }
        if (st.out) a.out = { x: st.out.x + d.x, y: st.out.y + d.y }
      } else {
        a[st.part] = np
        // suave/simétrico: el tirador opuesto refleja la dirección
        const other = st.part === 'in' ? 'out' : 'in'
        if (a.type !== 'corner' && a[other]) {
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
    this.s.emit({ imageId: this.s.activeImageId, dirty: null, structure: true })
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
  if (!f || f.layer.locked) return false
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
  if (f.shape.kind !== 'path') f.layer.shapes[f.index] = sh
  const sp = sh.subpaths[b.sp]!
  const a0 = sp.anchors[b.i]!
  const a1 = sp.anchors[(b.i + 1) % sp.anchors.length]!
  const r = splitCubic(a0, a1, b.t)
  sp.anchors[b.i] = r.a
  if ((b.i + 1) % sp.anchors.length === 0) sp.anchors[0] = r.b
  else sp.anchors[b.i + 1] = r.b
  sp.anchors.splice(b.i + 1, 0, r.mid)
  tx.commit({ model: true })
  return true
}

/** Elimina un ancla; si el trazado se queda con menos de 2, se elimina la forma. */
export function deleteAnchor(s: DocumentSession, ref: AnchorRef): boolean {
  const f = findShape(s, ref.shapeId)
  if (!f || f.layer.locked) return false
  const tx = s.begin('Eliminar ancla')
  if (f.shape.kind !== 'path') f.layer.shapes[f.index] = toPath(f.shape)
  const sh = f.layer.shapes[f.index] as PathShape
  const sp = sh.subpaths[ref.subpath]
  if (!sp) return false
  sp.anchors.splice(ref.index, 1)
  if (sp.anchors.length < 2) sh.subpaths.splice(ref.subpath, 1)
  if (!sh.subpaths.length) {
    f.layer.shapes.splice(f.index, 1)
    s.selectedShapes = s.selectedShapes.filter((i) => i !== sh.id)
  }
  tx.commit({ model: true })
  return true
}

/** Convierte un ancla en esquina (sin tiradores) o en suave (tiradores según los vecinos). */
export function convertAnchor(s: DocumentSession, ref: AnchorRef, smooth: boolean): boolean {
  const f = findShape(s, ref.shapeId)
  if (!f || f.layer.locked) return false
  const tx = s.begin(smooth ? 'Ancla suave' : 'Ancla de esquina')
  if (f.shape.kind !== 'path') f.layer.shapes[f.index] = toPath(f.shape)
  const sh = f.layer.shapes[f.index] as PathShape
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
      f.layer.shapes[f.index] = copy
    }
    this.s.emit({ imageId: this.s.activeImageId, dirty: null, structure: true })
  }

  get original(): Box {
    return this.box
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}
