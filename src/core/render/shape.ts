// Rasterización de formas: geometría → polilíneas → cobertura → ShapeBitmap (specs/03).

import { Bitmap } from '../raster/bitmap'
import { compositeAt, compositeOver } from '../raster/blend'
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
import { apply, flattenCubic, isTranslateOnly, multiply } from '../geometry/geometry'
import type { GroupShape, Shape, Stroke, SubPath, Vec2 } from '../model/shapes'

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
    case 'group':
      return []
  }
}

/** Hijos del grupo con la transformación del grupo ya compuesta (coordenadas de imagen). */
function flatChildren(g: GroupShape): Shape[] {
  return g.children.map((c) => ({ ...c, transform: multiply(g.transform, c.transform) }))
}

/** Polilíneas en coordenadas de imagen. */
export function shapeLines(s: Shape): Polyline[] {
  if (s.kind === 'group') return flatChildren(s).flatMap(shapeLines)
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

function renderShapeFull(s: Shape, w: number, h: number): Bitmap {
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
    const c = attr.paint.color
    if (attr.blendMode === 'normal' && attr.opacity === 1 && c.a === 255) {
      // Relleno opaco: se escribe directo en el bitmap.
      const d = out.data
      for (let i = 0; i < cov.length; i++) {
        if (!cov[i]) continue
        d[i * 4] = c.r
        d[i * 4 + 1] = c.g
        d[i * 4 + 2] = c.b
        d[i * 4 + 3] = 255
      }
    } else compositeOver(out, paintBitmap(cov, c, w, h), attr.blendMode, attr.opacity)
  }
  return out
}

/** Resultado de rasterizar una forma: bitmap recortado a su caja, colocado en (x, y) de la imagen. */
export interface ShapeBitmap {
  x: number
  y: number
  bitmap: Bitmap
}

/**
 * Rasteriza solo la caja de la forma (más el margen que necesitan sus contornos), recortada a la
 * imagen. El borde de la región coincide con el de la imagen o queda vacío, así que el resultado
 * es idéntico al de rasterizar la imagen entera.
 */
export function renderShapeRegion(s: Shape, w: number, h: number): ShapeBitmap | null {
  if (s.kind === 'group') return renderGroup(s, w, h)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const l of shapeLines(s))
    for (const p of l.pts) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  if (x0 === Infinity) return null
  let margin = 2
  for (const st of s.appearance.strokes) {
    if (!st.enabled) continue
    const reach = Math.max(st.width + st.offset, (st.width * Math.max(1, st.miterLimit)) / 2)
    margin = Math.max(margin, Math.ceil(reach) + 2)
  }
  // La región puede salirse del lienzo hasta `margin` px: así un contorno interior no se pierde
  // cuando la forma toca el borde del lienzo, y uno que cruza el borde no deja anillo en él.
  const rx = Math.max(-margin, Math.floor(x0) - margin)
  const ry = Math.max(-margin, Math.floor(y0) - margin)
  const rw = Math.min(w + margin, Math.ceil(x1) + margin + 1) - rx
  const rh = Math.min(h + margin, Math.ceil(y1) + margin + 1) - ry
  if (rw <= 0 || rh <= 0) return null
  const t = s.transform
  const shifted: Shape = { ...s, transform: [t[0], t[1], t[2], t[3], t[4] - rx, t[5] - ry] }
  return { x: rx, y: ry, bitmap: renderShapeFull(shifted, rw, rh) }
}

/** Un grupo se compone aparte (hijos de abajo arriba) y después se aplica como una sola forma. */
function renderGroup(g: GroupShape, w: number, h: number): ShapeBitmap | null {
  const parts: { sh: Shape; r: ShapeBitmap }[] = []
  for (const c of flatChildren(g)) {
    if (!c.visible) continue
    const r = renderShapeRegion(c, w, h)
    if (r) parts.push({ sh: c, r })
  }
  if (!parts.length) return null
  const x0 = Math.min(...parts.map((p) => p.r.x))
  const y0 = Math.min(...parts.map((p) => p.r.y))
  const x1 = Math.max(...parts.map((p) => p.r.x + p.r.bitmap.width))
  const y1 = Math.max(...parts.map((p) => p.r.y + p.r.bitmap.height))
  const out = new Bitmap(x1 - x0, y1 - y0)
  for (const { sh, r } of parts)
    compositeAt(out, r.bitmap, r.x - x0, r.y - y0, sh.blendMode, sh.opacity)
  return { x: x0, y: y0, bitmap: out }
}

/** Rasteriza la forma a una imagen completa (estampado y pruebas). */
export function renderShape(s: Shape, w: number, h: number): Bitmap {
  const out = new Bitmap(w, h)
  const r = renderShapeRegion(s, w, h)
  if (!r) return out
  const x0 = Math.max(0, r.x)
  const x1 = Math.min(w, r.x + r.bitmap.width)
  for (let y = Math.max(0, r.y); y < Math.min(h, r.y + r.bitmap.height); y++)
    out.data.set(
      r.bitmap.data.subarray(
        ((y - r.y) * r.bitmap.width + (x0 - r.x)) * 4,
        ((y - r.y) * r.bitmap.width + (x1 - r.x)) * 4
      ),
      (y * w + x0) * 4
    )
  return out
}

/** Alfa del ShapeBitmap en el píxel (x, y) de la imagen. */
export function shapeAlphaAt(r: ShapeBitmap | null, x: number, y: number): number {
  if (!r) return 0
  const px = x - r.x
  const py = y - r.y
  if (px < 0 || py < 0 || px >= r.bitmap.width || py >= r.bitmap.height) return 0
  return r.bitmap.data[(py * r.bitmap.width + px) * 4 + 3]!
}

const cache = new Map<string, ShapeBitmap | null>()
const CACHE_MAX = 64

/** Como `renderShapeRegion`, con caché por contenido (la forma es JSON puro). */
export function renderShapeCached(s: Shape, w: number, h: number): ShapeBitmap | null {
  const key = `${w}x${h}|${JSON.stringify(s)}`
  if (cache.has(key)) {
    const hit = cache.get(key)!
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const r = renderShapeRegion(s, w, h)
  cache.set(key, r)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return r
}
