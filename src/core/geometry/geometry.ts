// Geometría 2D: vectores, matrices afines y aplanado de Bézier.

import type { Mat2D, Vec2 } from '../model/shapes'

export type { Mat2D }

/** [a, b, c, d, e, f]: x' = a·x + c·y + e ; y' = b·x + d·y + f */

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0]

export const translation = (x: number, y: number): Mat2D => [1, 0, 0, 1, x, y]

export function multiply(m: Mat2D, n: Mat2D): Mat2D {
  // m ∘ n: primero n, después m
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ]
}

export function apply(m: Mat2D, p: Vec2): Vec2 {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

export function invert(m: Mat2D): Mat2D | null {
  const det = m[0] * m[3] - m[1] * m[2]
  if (Math.abs(det) < 1e-12) return null
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

export const isTranslateOnly = (m: Mat2D): boolean =>
  m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1

/** Aplana una Bézier cúbica con subdivisión adaptativa (tolerancia en px). */
export function flattenCubic(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  tol: number,
  out: Vec2[]
): void {
  const flat = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean => {
    // distancia de los puntos de control a la cuerda
    const dx = d.x - a.x
    const dy = d.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-9)
      return Math.hypot(b.x - a.x, b.y - a.y) <= tol && Math.hypot(c.x - a.x, c.y - a.y) <= tol
    const d1 = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len
    const d2 = Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) / len
    return d1 <= tol && d2 <= tol
  }
  const rec = (a: Vec2, b: Vec2, c: Vec2, d: Vec2, depth: number): void => {
    if (depth > 16 || flat(a, b, c, d)) {
      out.push(d)
      return
    }
    const mid = (u: Vec2, v: Vec2): Vec2 => ({ x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 })
    const ab = mid(a, b)
    const bc = mid(b, c)
    const cd = mid(c, d)
    const abc = mid(ab, bc)
    const bcd = mid(bc, cd)
    const m = mid(abc, bcd)
    rec(a, ab, abc, m, depth + 1)
    rec(m, bcd, cd, d, depth + 1)
  }
  rec(p0, p1, p2, p3, 0)
}
