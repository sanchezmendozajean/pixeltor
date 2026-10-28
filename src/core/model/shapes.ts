// Formas vectoriales y apariencia (specs/02, 05). F2: relleno y contorno sólidos.

import type { BlendMode, ID, RGBA } from './types'
import { newId } from './ids'

export type Vec2 = { x: number; y: number }
export type Mat2D = [number, number, number, number, number, number]

export interface Anchor {
  p: Vec2
  in: Vec2 | null
  out: Vec2 | null
  type: 'corner' | 'smooth' | 'symmetric'
}
export interface SubPath {
  closed: boolean
  anchors: Anchor[]
}

export interface SolidPaint {
  type: 'solid'
  color: RGBA
}
export interface GradientStop {
  /** 0..1 */
  offset: number
  color: RGBA
  /** Punto medio hacia la parada siguiente (0..1 del tramo; por defecto 0,5). */
  mid?: number
}

export type DitherMatrix = 'bayer2' | 'bayer4' | 'bayer8' | 'checker'

/** Cómo se convierte el degradado continuo en píxeles (specs/12). */
export type GradientPixelMode =
  | { mode: 'smooth' }
  | { mode: 'bands'; steps: number }
  | { mode: 'dither'; matrix: DitherMatrix; steps: number }
  /** Cuantiza a la paleta indicada (colores en línea), con tramado ordenado opcional. */
  | { mode: 'palette'; colors: RGBA[]; dither: boolean }

export interface GradientPaint {
  type: 'linear' | 'radial' | 'angular'
  stops: GradientStop[]
  /** Coordenadas locales de la forma. */
  from: Vec2
  to: Vec2
  pixelMode: GradientPixelMode
}

export type Paint = SolidPaint | GradientPaint

export interface Fill {
  id: ID
  enabled: boolean
  paint: Paint
  opacity: number
  blendMode: BlendMode
}

export interface Stroke {
  id: ID
  enabled: boolean
  paint: Paint
  opacity: number
  blendMode: BlendMode
  /** Entero ≥ 1 (px). */
  width: number
  align: 'center' | 'inside' | 'outside'
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  miterLimit: number
  /** Eliminar esquinas en "L" en trazos de 1 px. */
  pixelPerfect: boolean
  /** Desplazamiento hacia fuera/dentro (solo con align inside/outside). */
  offset: number
}

export interface Appearance {
  /** Orden de dibujo de abajo hacia arriba (ids de rellenos y contornos). */
  stack: ID[]
  fills: Fill[]
  strokes: Stroke[]
}

interface ShapeBase {
  id: ID
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  /** Local → imagen. */
  transform: Mat2D
  appearance: Appearance
  antialias: boolean
}

export interface RectShape extends ShapeBase {
  kind: 'rect'
  w: number
  h: number
  /** tl, tr, br, bl */
  radius: [number, number, number, number]
}
export interface EllipseShape extends ShapeBase {
  kind: 'ellipse'
  rx: number
  ry: number
}
export interface LineShape extends ShapeBase {
  kind: 'line'
  a: Vec2
  b: Vec2
}
export interface PolygonShape extends ShapeBase {
  kind: 'polygon'
  sides: number
  radius: number
}
export interface StarShape extends ShapeBase {
  kind: 'star'
  points: number
  r1: number
  r2: number
}
export interface PathShape extends ShapeBase {
  kind: 'path'
  subpaths: SubPath[]
  fillRule: 'nonzero' | 'evenodd'
}

/** Agrupa formas: se componen juntas y después se aplican su opacidad, modo y transformación. */
export interface GroupShape extends ShapeBase {
  kind: 'group'
  /** [0] = inferior. Sus transformaciones son locales al grupo. */
  children: Shape[]
}

export type Shape =
  RectShape | EllipseShape | LineShape | PolygonShape | StarShape | PathShape | GroupShape
export type ShapeKind = Shape['kind']

export const color = (r: number, g: number, b: number, a = 255): RGBA => ({ r, g, b, a })

export function solidFill(c: RGBA): Fill {
  return {
    id: newId(),
    enabled: true,
    paint: { type: 'solid', color: c },
    opacity: 1,
    blendMode: 'normal'
  }
}

export function solidStroke(c: RGBA, width = 1): Stroke {
  return {
    id: newId(),
    enabled: true,
    paint: { type: 'solid', color: c },
    opacity: 1,
    blendMode: 'normal',
    width,
    align: 'center',
    cap: 'butt',
    join: 'miter',
    miterLimit: 4,
    pixelPerfect: true,
    offset: 0
  }
}

export function makeAppearance(
  fill: RGBA | null,
  stroke: RGBA | null,
  strokeWidth = 1
): Appearance {
  const fills = fill ? [solidFill(fill)] : []
  const strokes = stroke ? [solidStroke(stroke, strokeWidth)] : []
  return { stack: [...fills.map((f) => f.id), ...strokes.map((s) => s.id)], fills, strokes }
}

function base(name: string, x: number, y: number, appearance: Appearance): ShapeBase {
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    transform: [1, 0, 0, 1, x, y],
    appearance,
    antialias: false
  }
}

export const makeRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  ap: Appearance
): RectShape => ({
  ...base('Rectángulo', x, y, ap),
  kind: 'rect',
  w,
  h,
  radius: [0, 0, 0, 0]
})

/** Elipse con centro en (cx, cy). */
export const makeEllipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ap: Appearance
): EllipseShape => ({
  ...base('Elipse', cx, cy, ap),
  kind: 'ellipse',
  rx,
  ry
})

export const makeLine = (a: Vec2, b: Vec2, ap: Appearance): LineShape => ({
  ...base('Línea', 0, 0, ap),
  kind: 'line',
  a,
  b
})

export const makePolygon = (
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  ap: Appearance
): PolygonShape => ({
  ...base('Polígono', cx, cy, ap),
  kind: 'polygon',
  sides: Math.max(3, Math.round(sides)),
  radius
})

export const makeStar = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  points: number,
  ap: Appearance
): StarShape => ({
  ...base('Estrella', cx, cy, ap),
  kind: 'star',
  points: Math.max(3, Math.round(points)),
  r1,
  r2
})

export const makePath = (subpaths: SubPath[], ap: Appearance): PathShape => ({
  ...base('Trazado', 0, 0, ap),
  kind: 'path',
  subpaths,
  fillRule: 'nonzero'
})

export const makeGroup = (children: Shape[]): GroupShape => ({
  ...base('Grupo', 0, 0, { stack: [], fills: [], strokes: [] }),
  kind: 'group',
  children
})

export const corner = (x: number, y: number): Anchor => ({
  p: { x, y },
  in: null,
  out: null,
  type: 'corner'
})

/** Copia profunda (las formas son JSON puro). */
export function cloneShape<T extends Shape>(s: T): T {
  return JSON.parse(JSON.stringify(s)) as T
}
