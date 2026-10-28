// Contornos: Bresenham pixel-perfect para 1 px y polígono de contorno para el resto (specs/03 §3).

import type { Vec2 } from '../model/shapes'
import { linePoints, pixelPerfect } from './draw'
import { type Coverage, emptyCoverage, fillPolygons } from './scan'

export interface Polyline {
  pts: Vec2[]
  closed: boolean
}

export interface StrokeGeom {
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  miterLimit: number
}

function dedupe(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of pts) {
    const l = out[out.length - 1]
    if (!l || Math.abs(l.x - p.x) > 1e-9 || Math.abs(l.y - p.y) > 1e-9) out.push(p)
  }
  return out
}

/** Contorno de 1 px: Bresenham sobre los vértices (píxel = floor de la coordenada). */
export function thinStroke(lines: Polyline[], perfect: boolean, w: number, h: number): Coverage {
  const cov = emptyCoverage(w, h)
  for (const l of lines) {
    const pts = dedupe(l.pts)
    if (l.closed && pts.length > 1) {
      const f = pts[0]!
      const e = pts[pts.length - 1]!
      if (Math.abs(f.x - e.x) > 1e-9 || Math.abs(f.y - e.y) > 1e-9) pts.push(f)
    }
    // Se parte la polilínea en las esquinas marcadas (giro > 45°) para que pixel-perfect no las
    // recorte: solo debe limpiar las escaleras de los tramos suaves (curvas, diagonales).
    const runs: Vec2[][] = [[]]
    for (let i = 0; i < pts.length; i++) {
      runs[runs.length - 1]!.push(pts[i]!)
      const p = pts[i - 1]
      const c = pts[i]!
      const n = pts[i + 1]
      if (p && n) {
        const ax = c.x - p.x
        const ay = c.y - p.y
        const bx = n.x - c.x
        const by = n.y - c.y
        const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))
        if (cos < 0.7) runs.push([c])
      }
    }
    for (const run of runs) {
      let seq: [number, number][] = []
      for (let i = 0; i < run.length; i++) {
        const px = Math.floor(run[i]!.x)
        const py = Math.floor(run[i]!.y)
        if (i === 0) {
          seq.push([px, py])
          continue
        }
        const last = seq[seq.length - 1]!
        for (const q of linePoints(last[0], last[1], px, py).slice(1)) seq.push(q)
      }
      if (perfect) seq = pixelPerfect(seq)
      for (const [x, y] of seq) if (x >= 0 && y >= 0 && x < w && y < h) cov[y * w + x] = 255
    }
  }
  return cov
}

function circle(c: Vec2, r: number): Vec2[] {
  const n = Math.max(8, Math.ceil(r * 6))
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
  }
  return out
}

/** Normaliza la orientación a positiva para que la unión con `nonzero` no se anule. */
function orient(poly: Vec2[]): Vec2[] {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    area += a.x * b.y - b.x * a.y
  }
  return area < 0 ? poly.slice().reverse() : poly
}

/** Polígonos cuya unión es el contorno centrado de ancho `width`. */
export function strokePolygons(lines: Polyline[], width: number, g: StrokeGeom): Vec2[][] {
  const hw = width / 2
  const polys: Vec2[][] = []
  for (const l of lines) {
    const pts = dedupe(l.pts)
    if (l.closed && pts.length > 1) {
      const f = pts[0]!
      const e = pts[pts.length - 1]!
      if (Math.abs(f.x - e.x) < 1e-9 && Math.abs(f.y - e.y) < 1e-9) pts.pop()
    }
    if (pts.length === 1) {
      if (g.cap === 'round') polys.push(circle(pts[0]!, hw))
      else if (g.cap === 'square')
        polys.push([
          { x: pts[0]!.x - hw, y: pts[0]!.y - hw },
          { x: pts[0]!.x + hw, y: pts[0]!.y - hw },
          { x: pts[0]!.x + hw, y: pts[0]!.y + hw },
          { x: pts[0]!.x - hw, y: pts[0]!.y + hw }
        ])
      continue
    }
    const n = pts.length
    const segs = l.closed ? n : n - 1
    const dirs: Vec2[] = []
    for (let i = 0; i < segs; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % n]!
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      dirs.push({ x: (b.x - a.x) / len, y: (b.y - a.y) / len })
    }
    for (let i = 0; i < segs; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % n]!
      const d = dirs[i]!
      const nx = -d.y * hw
      const ny = d.x * hw
      let ax = a.x
      let ay = a.y
      let bx = b.x
      let by = b.y
      if (!l.closed && g.cap === 'square') {
        if (i === 0) {
          ax -= d.x * hw
          ay -= d.y * hw
        }
        if (i === segs - 1) {
          bx += d.x * hw
          by += d.y * hw
        }
      }
      polys.push(
        orient([
          { x: ax + nx, y: ay + ny },
          { x: bx + nx, y: by + ny },
          { x: bx - nx, y: by - ny },
          { x: ax - nx, y: ay - ny }
        ])
      )
    }
    // Uniones en vértices interiores (y en todos si es cerrado)
    for (let i = 0; i < n; i++) {
      if (!l.closed && (i === 0 || i === n - 1)) continue
      const d1 = dirs[(i - 1 + segs) % segs]!
      const d2 = dirs[i % segs]!
      const v = pts[i]!
      if (g.join === 'round') {
        polys.push(circle(v, hw))
        continue
      }
      const cross = d1.x * d2.y - d1.y * d2.x
      if (Math.abs(cross) < 1e-9) continue
      const sgn = cross > 0 ? -1 : 1
      const p1 = { x: v.x + sgn * -d1.y * hw, y: v.y + sgn * d1.x * hw }
      const p2 = { x: v.x + sgn * -d2.y * hw, y: v.y + sgn * d2.x * hw }
      const tri = [v, p1, p2]
      if (g.join === 'miter') {
        const dot = d1.x * d2.x + d1.y * d2.y
        // longitud del pico / ancho = 1 / sin(θ/2), con θ el ángulo entre segmentos
        const sinHalf = Math.sqrt(Math.max(0, (1 - dot) / 2))
        const cosHalf = Math.sqrt(Math.max(0, (1 + dot) / 2))
        if (sinHalf > 1e-6 && cosHalf > 1e-6 && 1 / cosHalf <= g.miterLimit) {
          // el pico está en la bisectriz exterior a distancia hw / cos(φ/2), φ = giro
          const mx = p1.x + p2.x - 2 * v.x
          const my = p1.y + p2.y - 2 * v.y
          const ml = Math.hypot(mx, my)
          const dist = hw / cosHalf
          tri.splice(2, 0, { x: v.x + (mx / ml) * dist, y: v.y + (my / ml) * dist })
        }
      }
      polys.push(orient(tri))
    }
    if (!l.closed && g.cap === 'round') {
      polys.push(circle(pts[0]!, hw), circle(pts[n - 1]!, hw))
    }
  }
  return polys
}

export function thickStroke(
  lines: Polyline[],
  width: number,
  g: StrokeGeom,
  w: number,
  h: number
): Coverage {
  return fillPolygons(strokePolygons(lines, width, g), 'nonzero', w, h)
}
