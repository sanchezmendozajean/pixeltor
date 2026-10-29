// Paletas: modelo, formatos de intercambio (.gpl, .pal, .hex, .png), rampas, orden y extracción.
// TypeScript puro; determinista.

import { strFromU8, strToU8 } from 'fflate'
import { newId } from '../model/ids'
import type { ID, RGBA } from '../model/types'
import { Bitmap } from '../raster/bitmap'
import { decodePng, encodePng } from '../io/png'

export interface Swatch {
  id: ID
  name?: string
  color: RGBA
}

export interface Palette {
  id: ID
  name: string
  swatches: Swatch[]
}

export type PaletteFormat = 'gpl' | 'pal' | 'hex' | 'png'

export const MAX_SWATCHES = 4096

const h2 = (n: number): string => n.toString(16).padStart(2, '0')
export const colorHex = (c: RGBA): string => `${h2(c.r)}${h2(c.g)}${h2(c.b)}`
const clamp8 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)))

export function makeSwatch(color: RGBA, name?: string): Swatch {
  const s: Swatch = { id: newId(), color: { ...color } }
  if (name) s.name = name
  return s
}

export function makePalette(name: string, colors: RGBA[] = []): Palette {
  return { id: newId(), name, swatches: colors.map((c) => makeSwatch(c)) }
}

export function clonePalette(p: Palette): Palette {
  return {
    ...p,
    swatches: p.swatches.map((s) => ({ ...s, color: { ...s.color } }))
  }
}

export function hexToColor(hex: string): RGBA | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim())
  if (!m) return null
  const v = m[1]!
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
    a: v.length === 8 ? Number.parseInt(v.slice(6, 8), 16) : 255
  }
}

// ---------- Importar ----------

/** Lee una paleta de texto (`gpl`, `pal` JASC o `hex`) o de un PNG (1 píxel por color). */
export function parsePalette(bytes: Uint8Array, format: PaletteFormat, name: string): Palette {
  if (format === 'png') return parsePng(bytes, name)
  const raw0 = strFromU8(bytes)
  const text = raw0.charCodeAt(0) === 0xfeff ? raw0.slice(1) : raw0 // quita la marca BOM
  const lines = text.split(/\r?\n/)
  const out: Swatch[] = []
  let title = name
  if (format === 'gpl') {
    if (!/^GIMP Palette/i.test(lines[0] ?? '')) throw new Error('No es una paleta GIMP (.gpl).')
    for (const raw of lines.slice(1)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const nm = /^Name:\s*(.+)$/i.exec(line)
      if (nm) {
        title = nm[1]!.trim()
        continue
      }
      if (/^Columns:/i.test(line)) continue
      const m = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(.*)$/.exec(line)
      if (!m) continue
      out.push(
        makeSwatch(
          { r: clamp8(+m[1]!), g: clamp8(+m[2]!), b: clamp8(+m[3]!), a: 255 },
          m[4]?.trim() || undefined
        )
      )
    }
  } else if (format === 'pal') {
    if ((lines[0] ?? '').trim() !== 'JASC-PAL') throw new Error('No es una paleta JASC (.pal).')
    for (const raw of lines.slice(3)) {
      const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/.exec(raw)
      if (m)
        out.push(makeSwatch({ r: clamp8(+m[1]!), g: clamp8(+m[2]!), b: clamp8(+m[3]!), a: 255 }))
    }
  } else {
    for (const raw of lines) {
      const c = hexToColor(raw)
      if (c) out.push(makeSwatch(c))
    }
  }
  if (!out.length) throw new Error('La paleta no contiene colores.')
  return { id: newId(), name: title, swatches: out.slice(0, MAX_SWATCHES) }
}

function parsePng(bytes: Uint8Array, name: string): Palette {
  const bmp = decodePng(bytes)
  const seen = new Set<number>()
  const out: Swatch[] = []
  for (let i = 0; i < bmp.width * bmp.height && out.length < MAX_SWATCHES; i++) {
    const r = bmp.data[i * 4]!
    const g = bmp.data[i * 4 + 1]!
    const b = bmp.data[i * 4 + 2]!
    const a = bmp.data[i * 4 + 3]!
    if (a === 0) continue
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
    if (seen.has(key)) continue
    seen.add(key)
    out.push(makeSwatch({ r, g, b, a }))
  }
  if (!out.length) throw new Error('La imagen no contiene colores.')
  return { id: newId(), name, swatches: out }
}

// ---------- Exportar ----------

export function serializePalette(p: Palette, format: PaletteFormat): Uint8Array {
  const enc = (s: string): Uint8Array => strToU8(s)
  if (format === 'png') {
    const bmp = new Bitmap(Math.max(1, p.swatches.length), 1)
    p.swatches.forEach((s, i) => {
      bmp.data.set([s.color.r, s.color.g, s.color.b, s.color.a], i * 4)
    })
    return encodePng(bmp)
  }
  if (format === 'hex') return enc(p.swatches.map((s) => colorHex(s.color)).join('\n') + '\n')
  if (format === 'pal')
    return enc(
      [
        'JASC-PAL',
        '0100',
        String(p.swatches.length),
        ...p.swatches.map((s) => `${s.color.r} ${s.color.g} ${s.color.b}`)
      ].join('\r\n') + '\r\n'
    )
  return enc(
    [
      'GIMP Palette',
      `Name: ${p.name}`,
      'Columns: 8',
      '#',
      ...p.swatches.map(
        (s) =>
          `${String(s.color.r).padStart(3)} ${String(s.color.g).padStart(3)} ${String(s.color.b).padStart(3)}\t${s.name ?? colorHex(s.color).toUpperCase()}`
      )
    ].join('\n') + '\n'
  )
}

// ---------- Color ----------

export function rgbToHsl(c: RGBA): { h: number; s: number; l: number } {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

export function hslToRgb(h: number, s: number, l: number, a = 255): RGBA {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x]
  const m = l - c / 2
  return { r: clamp8((r1 + m) * 255), g: clamp8((g1 + m) * 255), b: clamp8((b1 + m) * 255), a }
}

/**
 * Rampa de `n` tonos entre `a` y `b` (ambos incluidos). `hueShift` (grados) desplaza el tono hacia
 * el extremo claro de forma parabólica (hue shifting): las sombras viran a un lado y las luces al
 * otro, sin mover los extremos.
 */
export function makeRamp(a: RGBA, b: RGBA, n: number, hueShift = 0): RGBA[] {
  const count = Math.max(2, Math.min(64, Math.round(n)))
  const ha = rgbToHsl(a)
  const hb = rgbToHsl(b)
  // interpolar el tono por el camino corto (los grises conservan el tono del otro extremo)
  let dh = hb.h - ha.h
  if (ha.s === 0) dh = 0
  if (Math.abs(dh) > 180) dh -= Math.sign(dh) * 360
  const baseH = ha.s === 0 ? hb.h : ha.h
  const out: RGBA[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    if (i === 0) out.push({ ...a })
    else if (i === count - 1) out.push({ ...b })
    else {
      const shift = hueShift * 4 * t * (1 - t) // 0 en los extremos, máximo en el centro
      out.push(
        hslToRgb(
          baseH + dh * t + shift,
          ha.s + (hb.s - ha.s) * t,
          ha.l + (hb.l - ha.l) * t,
          clamp8(a.a + (b.a - a.a) * t)
        )
      )
    }
  }
  return out
}

// ---------- Orden y extracción ----------

export type SortKey = 'hue' | 'lightness'

/** Orden estable; los grises (sin tono) van al principio al ordenar por tono. */
export function sortSwatches(list: Swatch[], by: SortKey): Swatch[] {
  const key = (s: Swatch): [number, number] => {
    const c = rgbToHsl(s.color)
    return by === 'hue' ? [c.s < 0.05 ? -1 : c.h, c.l] : [c.l, c.h]
  }
  return list
    .map((s, i) => ({ s, i, k: key(s) }))
    .sort((p, q) => p.k[0] - q.k[0] || p.k[1] - q.k[1] || p.i - q.i)
    .map((x) => x.s)
}

/** Colores opacos distintos de un mapa de bits, por orden de aparición (hasta `max`). */
export function extractColors(bmp: Bitmap, max = 256): RGBA[] {
  const seen = new Set<number>()
  const out: RGBA[] = []
  for (let i = 0; i < bmp.width * bmp.height && out.length < max; i++) {
    const a = bmp.data[i * 4 + 3]!
    if (a === 0) continue
    const r = bmp.data[i * 4]!
    const g = bmp.data[i * 4 + 1]!
    const b = bmp.data[i * 4 + 2]!
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ r, g, b, a })
  }
  return out
}
