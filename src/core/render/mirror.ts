// Espejo de capa (specs/13): refleja los píxeles de la capa (ráster + formas ya rasterizadas) respecto
// a uno o dos ejes de referencia. No duplica formas ni toca el ráster: es un paso del render que va
// entre «ráster + formas» y los efectos de capa. Todo en enteros, así que es exacto y determinista.

import type { Layer, LayerMirror, MirrorType } from '../model/types'
import { Bitmap, type Rect } from '../raster/bitmap'

export const MIRROR_TYPES: readonly MirrorType[] = ['v', 'h', 'vh', 'd45', 'd135', 'd45-135']

export function isMirrorType(v: unknown): v is MirrorType {
  return typeof v === 'string' && (MIRROR_TYPES as readonly string[]).includes(v)
}

/** Espejo nuevo con los ejes en el centro de la imagen. */
export function defaultMirror(type: MirrorType, w: number, h: number): LayerMirror {
  return { type, enabled: true, x: Math.floor(w / 2), y: Math.floor(h / 2) }
}

/** Espejo en vigor de una capa (activado y no es un grupo), o null. */
export function activeMirror(l: Layer): LayerMirror | null {
  return l.mirror?.enabled && !l.isGroup ? l.mirror : null
}

export type MirrorMap = (x: number, y: number) => [number, number]

/**
 * Reflexiones (sin la identidad) del espejo. Vertical/horizontal: el eje está en el borde `x`/`y`
 * (entre dos píxeles). Diagonales: pasan por el centro del píxel (x, y); «45°» es la diagonal
 * ascendente («/») y «135°» la descendente («\»).
 */
export function mirrorMaps(m: LayerMirror): MirrorMap[] {
  const { x: a, y: b } = m
  const v: MirrorMap = (x, y) => [2 * a - 1 - x, y]
  const h: MirrorMap = (x, y) => [x, 2 * b - 1 - y]
  const d135: MirrorMap = (x, y) => [a + (y - b), b + (x - a)]
  const d45: MirrorMap = (x, y) => [a - (y - b), b - (x - a)]
  switch (m.type) {
    case 'v':
      return [v]
    case 'h':
      return [h]
    case 'vh':
      return [v, h, (x, y) => [2 * a - 1 - x, 2 * b - 1 - y]]
    case 'd45':
      return [d45]
    case 'd135':
      return [d135]
    case 'd45-135':
      return [d45, d135, (x, y) => [2 * a - x, 2 * b - y]]
  }
}

/** Mínimo rectángulo que contiene a `r` y a todos sus reflejos, recortado a la imagen. */
export function mirrorRect(m: LayerMirror, r: Rect, w: number, h: number): Rect {
  let x0 = r.x
  let y0 = r.y
  let x1 = r.x + r.w - 1
  let y1 = r.y + r.h - 1
  for (const map of mirrorMaps(m))
    for (const [cx, cy] of [
      [r.x, r.y],
      [r.x + r.w - 1, r.y + r.h - 1]
    ] as const) {
      const [px, py] = map(cx, cy)
      x0 = Math.min(x0, px)
      x1 = Math.max(x1, px)
      y0 = Math.min(y0, py)
      y1 = Math.max(y1, py)
    }
  x0 = Math.max(0, x0)
  y0 = Math.max(0, y0)
  x1 = Math.min(w - 1, x1)
  y1 = Math.min(h - 1, y1)
  return { x: x0, y: y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1) }
}

/**
 * Región que hay que recomponer para que un cambio en `r` se vea también en los reflejos de todas
 * las capas con espejo (punto fijo: una capa puede ampliar lo que otra necesita).
 */
export function mirrorClosure(layers: readonly Layer[], r: Rect, w: number, h: number): Rect {
  const mirrors = layers.map(activeMirror).filter((m): m is LayerMirror => !!m)
  if (!mirrors.length) return r
  let cur = r
  for (let i = 0; i < 8; i++) {
    let next = cur
    for (const m of mirrors) next = mirrorRect(m, next, w, h)
    if (next.x === cur.x && next.y === cur.y && next.w === cur.w && next.h === cur.h) break
    cur = next
  }
  return cur
}

/**
 * Escribe en `dst` la capa `src` más sus reflejos (el original queda por encima donde coinciden).
 * Fuera de `r` copia `src` tal cual; `dst` y `src` deben ser distintos y del mismo tamaño.
 */
export function applyMirror(src: Bitmap, dst: Bitmap, m: LayerMirror, r: Rect): void {
  dst.data.set(src.data)
  const maps = mirrorMaps(m)
  const w = src.width
  const h = src.height
  const S = src.data
  const D = dst.data
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * w + x) * 4
      if (D[i + 3] === 255) continue
      for (const map of maps) {
        const [qx, qy] = map(x, y)
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue
        const j = (qy * w + qx) * 4
        const ua = S[j + 3]!
        if (ua === 0) continue
        const ea = D[i + 3]!
        if (ea === 0) {
          D[i] = S[j]!
          D[i + 1] = S[j + 1]!
          D[i + 2] = S[j + 2]!
          D[i + 3] = ua
        } else {
          // el píxel actual (ea) sobre el reflejado (ua), alfa no premultiplicado
          const e = ea / 255
          const u = (ua / 255) * (1 - e)
          const a = e + u
          for (let c = 0; c < 3; c++) D[i + c] = Math.round((D[i + c]! * e + S[j + c]! * u) / a)
          D[i + 3] = Math.round(a * 255)
        }
        if (D[i + 3] === 255) break
      }
    }
}

/** Aplica el espejo a un ráster completo y devuelve el resultado (para estampar o combinar). */
export function mirrorBitmap(src: Bitmap, m: LayerMirror): Bitmap {
  const out = new Bitmap(src.width, src.height)
  applyMirror(src, out, m, { x: 0, y: 0, w: src.width, h: src.height })
  return out
}

export interface MirrorLine {
  id: 'v' | 'h' | 'd45' | 'd135'
  /** Extremos en coordenadas de imagen (recortados a los bordes del lienzo). */
  a: { x: number; y: number }
  b: { x: number; y: number }
}

/** Segmento de la recta p + t·d recortado al rectángulo [0,w]×[0,h]; null si no lo cruza. */
function clipLine(
  p: { x: number; y: number },
  d: { x: number; y: number },
  w: number,
  h: number
): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  let t0 = -Infinity
  let t1 = Infinity
  for (const [pos, dir, max] of [
    [p.x, d.x, w],
    [p.y, d.y, h]
  ] as const) {
    if (dir === 0) {
      if (pos < 0 || pos > max) return null
      continue
    }
    const ta = (0 - pos) / dir
    const tb = (max - pos) / dir
    t0 = Math.max(t0, Math.min(ta, tb))
    t1 = Math.min(t1, Math.max(ta, tb))
  }
  if (t0 >= t1) return null
  return {
    a: { x: p.x + t0 * d.x, y: p.y + t0 * d.y },
    b: { x: p.x + t1 * d.x, y: p.y + t1 * d.y }
  }
}

/** Ejes de referencia del espejo como segmentos sobre el lienzo (para dibujarlos y agarrarlos). */
export function mirrorLines(m: LayerMirror, w: number, h: number): MirrorLine[] {
  const out: MirrorLine[] = []
  const hasV = m.type === 'v' || m.type === 'vh'
  const hasH = m.type === 'h' || m.type === 'vh'
  const has45 = m.type === 'd45' || m.type === 'd45-135'
  const has135 = m.type === 'd135' || m.type === 'd45-135'
  if (hasV && m.x > 0 && m.x < w) out.push({ id: 'v', a: { x: m.x, y: 0 }, b: { x: m.x, y: h } })
  if (hasH && m.y > 0 && m.y < h) out.push({ id: 'h', a: { x: 0, y: m.y }, b: { x: w, y: m.y } })
  const c = { x: m.x + 0.5, y: m.y + 0.5 }
  if (has45) {
    const s = clipLine(c, { x: 1, y: -1 }, w, h)
    if (s) out.push({ id: 'd45', ...s })
  }
  if (has135) {
    const s = clipLine(c, { x: 1, y: 1 }, w, h)
    if (s) out.push({ id: 'd135', ...s })
  }
  return out
}
