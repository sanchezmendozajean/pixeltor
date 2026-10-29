// Núcleos numéricos de los efectos: planos de alfa, dilatación/erosión y desenfoque. Aritmética
// con +, −, × y ÷ de doble precisión (determinista entre plataformas).

import type { RGBA } from '../model/types'
import { type Region, regionIndex } from './region'
import type { Rect } from '../raster/bitmap'

export type Plane = Float64Array

/** Plano de un canal (0..255) de `src` sobre `rect`; fuera de la región vale 0. */
export function channelPlane(src: Region, rect: Rect, ch: number): Plane {
  const out = new Float64Array(rect.w * rect.h)
  for (let y = 0; y < rect.h; y++)
    for (let x = 0; x < rect.w; x++) {
      const i = regionIndex(src, rect.x + x, rect.y + y)
      if (i >= 0) out[y * rect.w + x] = src.data[i + ch]!
    }
  return out
}

/** Copia desplazada: out(x, y) = p(x − dx, y − dy). */
export function shiftPlane(p: Plane, w: number, h: number, dx: number, dy: number): Plane {
  const out = new Float64Array(p.length)
  for (let y = 0; y < h; y++) {
    const sy = y - dy
    if (sy < 0 || sy >= h) continue
    for (let x = 0; x < w; x++) {
      const sx = x - dx
      if (sx >= 0 && sx < w) out[y * w + x] = p[sy * w + sx]!
    }
  }
  return out
}

/** Un paso de dilatación (máximo) con vecindad 8 (cuadrada) o 4 (cruz). */
export function dilateStep(p: Plane, w: number, h: number, eight: boolean): Plane {
  const out = new Float64Array(p.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = p[y * w + x]!
      if (x > 0) m = Math.max(m, p[y * w + x - 1]!)
      if (x < w - 1) m = Math.max(m, p[y * w + x + 1]!)
      if (y > 0) m = Math.max(m, p[(y - 1) * w + x]!)
      if (y < h - 1) m = Math.max(m, p[(y + 1) * w + x]!)
      if (eight) {
        if (x > 0 && y > 0) m = Math.max(m, p[(y - 1) * w + x - 1]!)
        if (x < w - 1 && y > 0) m = Math.max(m, p[(y - 1) * w + x + 1]!)
        if (x > 0 && y < h - 1) m = Math.max(m, p[(y + 1) * w + x - 1]!)
        if (x < w - 1 && y < h - 1) m = Math.max(m, p[(y + 1) * w + x + 1]!)
      }
      out[y * w + x] = m
    }
  return out
}

export function dilate(p: Plane, w: number, h: number, n: number, eight = true): Plane {
  let cur = p
  for (let i = 0; i < n; i++) cur = dilateStep(cur, w, h, eight)
  return cur
}

export function invertPlane(p: Plane, max = 255): Plane {
  const out = new Float64Array(p.length)
  for (let i = 0; i < p.length; i++) out[i] = max - p[i]!
  return out
}

/** Desenfoque de caja separable de radios (rx, ry) con bordes a 0. */
function boxPass(p: Plane, w: number, h: number, rx: number, ry: number): Plane {
  let cur = p
  if (rx > 0) {
    const out = new Float64Array(cur.length)
    const d = 2 * rx + 1
    for (let y = 0; y < h; y++) {
      let sum = 0
      for (let x = -rx; x <= rx; x++) if (x >= 0 && x < w) sum += cur[y * w + x]!
      for (let x = 0; x < w; x++) {
        out[y * w + x] = sum / d
        const add = x + rx + 1
        const sub = x - rx
        if (add < w) sum += cur[y * w + add]!
        if (sub >= 0) sum -= cur[y * w + sub]!
      }
    }
    cur = out
  }
  if (ry > 0) {
    const out = new Float64Array(cur.length)
    const d = 2 * ry + 1
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -ry; y <= ry; y++) if (y >= 0 && y < h) sum += cur[y * w + x]!
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / d
        const add = y + ry + 1
        const sub = y - ry
        if (add < h) sum += cur[add * w + x]!
        if (sub >= 0) sum -= cur[sub * w + x]!
      }
    }
    cur = out
  }
  return cur
}

export function boxBlur(
  p: Plane,
  w: number,
  h: number,
  rx: number,
  ry: number,
  iterations = 1
): Plane {
  let cur = p
  for (let i = 0; i < iterations; i++) cur = boxPass(cur, w, h, Math.round(rx), Math.round(ry))
  return cur
}

/** Radio de caja de cada una de las 3 pasadas que aproximan un gaussiano de `sigma`. */
function gaussBoxes(sigma: number): number[] {
  const n = 3
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4))
  return Array.from({ length: n }, (_, i) => ((i < m ? wl : wu) - 1) / 2)
}

/** Aproximación gaussiana con tres desenfoques de caja; `radius` ≈ 2σ. */
export function gaussianBlur(p: Plane, w: number, h: number, radius: number): Plane {
  if (radius <= 0) return p
  let cur = p
  for (const r of gaussBoxes(Math.max(0.4, radius / 2))) cur = boxPass(cur, w, h, r, r)
  return cur
}

/** Píxeles que lee un desenfoque gaussiano de ese radio. */
export const blurReach = (radius: number): number => (radius <= 0 ? 0 : Math.ceil(radius * 1.5) + 2)

export const clampByte = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

export function parseColor(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const v = m ? m[1]! : '000000'
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
    a: 255
  }
}
