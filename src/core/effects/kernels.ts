// Núcleos numéricos de los efectos: planos de alfa, dilatación/erosión y desenfoque. Aritmética
// con +, −, × y ÷ de doble precisión (determinista entre plataformas).

import type { RGBA } from '../model/types'
import type { Region } from './region'
import type { Rect } from '../raster/bitmap'

export type Plane = Float32Array

/** Plano de un canal (0..255) de `src` sobre `rect`; fuera de la región vale 0. */
export function channelPlane(src: Region, rect: Rect, ch: number): Plane {
  const out = new Float32Array(rect.w * rect.h)
  const x0 = Math.max(rect.x, src.rect.x)
  const x1 = Math.min(rect.x + rect.w, src.rect.x + src.rect.w)
  if (x1 <= x0) return out
  const y0 = Math.max(rect.y, src.rect.y)
  const y1 = Math.min(rect.y + rect.h, src.rect.y + src.rect.h)
  for (let y = y0; y < y1; y++) {
    let si = ((y - src.rect.y) * src.rect.w + (x0 - src.rect.x)) * 4 + ch
    let oi = (y - rect.y) * rect.w + (x0 - rect.x)
    for (let x = x0; x < x1; x++, si += 4, oi++) out[oi] = src.data[si]!
  }
  return out
}

/** Copia desplazada: out(x, y) = p(x − dx, y − dy). */
export function shiftPlane(p: Plane, w: number, h: number, dx: number, dy: number): Plane {
  const out = new Float32Array(p.length)
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
  const out = new Float32Array(p.length)
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
  const out = new Float32Array(p.length)
  for (let i = 0; i < p.length; i++) out[i] = max - p[i]!
  return out
}

/** Desenfoque de caja separable de radios (rx, ry) con bordes a 0. */
function boxPass(p: Plane, w: number, h: number, rx: number, ry: number): Plane {
  let cur = p
  if (rx > 0) {
    const out = new Float32Array(cur.length)
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
    // por filas (acceso secuencial): una suma deslizante por columna
    const out = new Float32Array(cur.length)
    const d = 2 * ry + 1
    const sum = new Float32Array(w)
    for (let y = 0; y <= Math.min(ry, h - 1); y++)
      for (let x = 0; x < w; x++) sum[x]! += cur[y * w + x]!
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) out[y * w + x] = sum[x]! / d
      const add = y + ry + 1
      const sub = y - ry
      if (add < h) for (let x = 0; x < w; x++) sum[x]! += cur[add * w + x]!
      if (sub >= 0) for (let x = 0; x < w; x++) sum[x]! -= cur[sub * w + x]!
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
