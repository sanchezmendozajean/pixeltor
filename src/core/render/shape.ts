// Rasterización de formas: geometría → polilíneas → cobertura → ShapeBitmap (specs/03).

import { Bitmap } from '../raster/bitmap'
import { compositeOver } from '../raster/blend'
import { ellipseMasks } from '../raster/ellipse'
import {
  type Coverage,
  coverageSub,
  dilate,
  emptyCoverage,
  erode,
  fillPolygons
} from '../raster/scan'
import { type Polyline, thickStroke, thinStroke } from '../raster/stroke'
import { apply, flattenCubic, isTranslateOnly } from '../geometry/geometry'
import type { Shape, Stroke, SubPath, Vec2 } from '../model/shapes'

const TOL = 0.1

function arc(cx: number, cy: number, r: number, a0: number, a1: number, out: Vec2[]): void {
  const n = Math.max(4, Math.ceil(r * 1.5))
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
}

function flattenSubPath(sp: SubPath): Polyline {
  const pts: Vec2[] = []
  const n = sp.anchors.length
  if (n === 0) return { pts, closed: sp.closed }
  pts.push(sp.anchors[0]!.p)
  const segs = sp.closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const a = sp.anchors[i]!
    const b = sp.anchors[(i + 1) % n]!
    if (!a.out && !b.in) pts.push(b.p)
    else flattenCubic(a.p, a.out ?? a.p, b.in ?? b.p, b.p, TOL, pts)
  }
  if (sp.closed && pts.length > 1) pts.pop() // el último coincide con el primero
  return { pts, closed: sp.closed }
}

/** Polilíneas de la forma en coordenadas locales. */
function localLines(s: Shape): Polyline[] {
  switch (s.kind) {
    case 'rect': {
      const [tl, tr, br, bl] = s.radius.map((r) => Math.min(r, s.w / 2, s.h / 2)) as [
        number,
        number,
        number,
        number
      ]
      const pts: Vec2[] = []
      const { w, h } = s
      if (tl > 0) arc(tl, tl, tl, Math.PI, 1.5 * Math.PI, pts)
      else pts.push({ x: 0, y: 0 })
      if (tr > 0) arc(w - tr, tr, tr, 1.5 * Math.PI, 2 * Math.PI, pts)
      else pts.push({ x: w, y: 0 })
      if (br > 0) arc(w - br, h - br, br, 0, 0.5 * Math.PI, pts)
      else pts.push({ x: w, y: h })
      if (bl > 0) arc(bl, h - bl, bl, 0.5 * Math.PI, Math.PI, pts)
      else pts.push({ x: 0, y: h })
      return [{ pts, closed: true }]
    }
    case 'ellipse': {
      const n = Math.max(24, Math.ceil(Math.max(s.rx, s.ry) * 4))
      const pts: Vec2[] = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        pts.push({ x: Math.cos(a) * s.rx, y: Math.sin(a) * s.ry })
      }
      return [{ pts, closed: true }]
    }
    case 'line':
      return [{ pts: [s.a, s.b], closed: false }]
    case 'polygon': {
      const pts: Vec2[] = []
      for (let i = 0; i < s.sides; i++) {
        const a = -Math.PI / 2 + (i / s.sides) * Math.PI * 2
        pts.push({ x: Math.cos(a) * s.radius, y: Math.sin(a) * s.radius })
      }
      return [{ pts, closed: true }]
    }
    case 'star': {
      const pts: Vec2[] = []
      for (let i = 0; i < s.points * 2; i++) {
        const a = -Math.PI / 2 + (i / (s.points * 2)) * Math.PI * 2
        const r = i % 2 === 0 ? s.r1 : s.r2
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
      }
      return [{ pts, closed: true }]
    }
    case 'path':
      return s.subpaths.map(flattenSubPath)
  }
}

/** Polilíneas en coordenadas de imagen. */
export function shapeLines(s: Shape): Polyline[] {
  return localLines(s).map((l) => ({
    closed: l.closed,
    pts: l.pts.map((p) => apply(s.transform, p))
  }))
}

/** Rectángulo de píxeles de una elipse paramétrica sin rotar, o null si necesita el camino genérico. */
function ellipsePixelRect(s: Shape): [number, number, number, number] | null {
  if (s.kind !== 'ellipse' || !isTranslateOnly(s.transform)) return null
  const cx = s.transform[4]
  const cy = s.transform[5]
  const x0 = Math.round(cx - s.rx)
  const y0 = Math.round(cy - s.ry)
  const x1 = Math.max(x0, Math.round(cx + s.rx) - 1)
  const y1 = Math.max(y0, Math.round(cy + s.ry) - 1)
  return [x0, y0, x1, y1]
}

export interface ShapeMasks {
  fill: Coverage
  /** Contorno de 1 px centrado ya calculado por el camino rápido, si existe. */
  thin?: Coverage
}

function fillMask(s: Shape, lines: Polyline[], w: number, h: number): ShapeMasks {
  if (s.kind === 'line') return { fill: emptyCoverage(w, h) }
  const er = ellipsePixelRect(s)
  if (er) {
    const m = ellipseMasks(er[0], er[1], er[2], er[3], w, h)
    return { fill: m.fill, thin: m.outline }
  }
  const rule = s.kind === 'path' ? s.fillRule : 'nonzero'
  return {
    fill: fillPolygons(
      lines.map((l) => l.pts),
      rule,
      w,
      h
    )
  }
}

function strokeMask(st: Stroke, lines: Polyline[], m: ShapeMasks, w: number, h: number): Coverage {
  const g = { cap: st.cap, join: st.join, miterLimit: st.miterLimit }
  const closedShape = lines.every((l) => l.closed)
  const width = Math.max(1, Math.round(st.width))
  const off = Math.max(0, Math.round(st.offset))
  if (!closedShape || st.align === 'center') {
    if (width === 1) return m.thin ?? thinStroke(lines, st.pixelPerfect, w, h)
    return thickStroke(lines, width, g, w, h)
  }
  // Anillos de píxeles: erosión hacia dentro / dilatación hacia fuera del relleno.
  if (st.align === 'outside')
    return coverageSub(dilate(m.fill, w, h, off + width), dilate(m.fill, w, h, off))
  return coverageSub(erode(m.fill, w, h, off), erode(m.fill, w, h, off + width))
}

function paintBitmap(
  cov: Coverage,
  c: { r: number; g: number; b: number; a: number },
  w: number,
  h: number
): Bitmap {
  const bmp = new Bitmap(w, h)
  const d = bmp.data
  for (let i = 0; i < cov.length; i++) {
    if (!cov[i]) continue
    d[i * 4] = c.r
    d[i * 4 + 1] = c.g
    d[i * 4 + 2] = c.b
    d[i * 4 + 3] = c.a
  }
  return bmp
}

/** Renderiza la apariencia de la forma (rellenos y contornos en el orden de la pila). */
export function renderShape(s: Shape, w: number, h: number): Bitmap {
  const out = new Bitmap(w, h)
  const lines = shapeLines(s)
  const masks = fillMask(s, lines, w, h)
  const ap = s.appearance
  for (const id of ap.stack) {
    const f = ap.fills.find((x) => x.id === id)
    const st = f ? null : ap.strokes.find((x) => x.id === id)
    const attr = f ?? st
    if (!attr || !attr.enabled) continue
    const cov = f ? masks.fill : strokeMask(st!, lines, masks, w, h)
    compositeOver(out, paintBitmap(cov, attr.paint.color, w, h), attr.blendMode, attr.opacity)
  }
  return out
}

const cache = new Map<string, Bitmap>()
const CACHE_MAX = 64

/** Como `renderShape`, con caché por contenido (la forma es JSON puro). */
export function renderShapeCached(s: Shape, w: number, h: number): Bitmap {
  const key = `${w}x${h}|${JSON.stringify(s)}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const bmp = renderShape(s, w, h)
  cache.set(key, bmp)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return bmp
}
