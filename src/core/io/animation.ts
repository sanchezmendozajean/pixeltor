// Codificadores de animación e iconos (specs/07): GIF, APNG, ICO y hoja de sprites. Sin DOM.

import { zlibSync } from 'fflate'
import { Bitmap } from '../raster/bitmap'
import { SIGNATURE, chunk, encodePng, scaleNearest } from './png'

export interface Frame {
  bitmap: Bitmap
  /** Duración en ms. */
  delayMs: number
}

/** Centra cada bitmap en un lienzo transparente del tamaño del mayor (imágenes de distinto tamaño). */
export function uniformFrames(frames: Frame[]): Frame[] {
  const w = Math.max(...frames.map((f) => f.bitmap.width))
  const h = Math.max(...frames.map((f) => f.bitmap.height))
  return frames.map((f) => {
    if (f.bitmap.width === w && f.bitmap.height === h) return f
    const out = new Bitmap(w, h)
    const ox = Math.floor((w - f.bitmap.width) / 2)
    const oy = Math.floor((h - f.bitmap.height) / 2)
    for (let y = 0; y < f.bitmap.height; y++)
      out.data.set(
        f.bitmap.data.subarray(y * f.bitmap.width * 4, (y + 1) * f.bitmap.width * 4),
        ((y + oy) * w + ox) * 4
      )
    return { bitmap: out, delayMs: f.delayMs }
  })
}

export function scaleFrames(frames: Frame[], factor: number): Frame[] {
  return factor <= 1
    ? frames
    : frames.map((f) => ({ bitmap: scaleNearest(f.bitmap, factor), delayMs: f.delayMs }))
}

// ---------- GIF ----------

/** Cuantización por corte mediano (determinista) a como mucho `max` colores RGB. */
export function quantize(colors: number[][], max: number): number[][] {
  if (colors.length <= max) return colors
  type Box = number[][]
  const boxes: Box[] = [colors]
  while (boxes.length < max) {
    // la caja con más colores y mayor rango se parte por su canal más ancho
    let bi = -1
    let best = 0
    boxes.forEach((b, i) => {
      if (b.length < 2) return
      const score = b.length
      if (score > best) {
        best = score
        bi = i
      }
    })
    if (bi < 0) break
    const box = boxes[bi]!
    const range = [0, 1, 2].map((c) => {
      let lo = 255
      let hi = 0
      for (const p of box) {
        lo = Math.min(lo, p[c]!)
        hi = Math.max(hi, p[c]!)
      }
      return hi - lo
    })
    const ch = range.indexOf(Math.max(...range))
    const sorted = [...box].sort(
      (a, b) => a[ch]! - b[ch]! || a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!
    )
    const mid = sorted.length >> 1
    boxes.splice(bi, 1, sorted.slice(0, mid), sorted.slice(mid))
  }
  return boxes.map((b) => {
    const avg = [0, 1, 2].map((c) => Math.round(b.reduce((s, p) => s + p[c]!, 0) / b.length))
    return avg
  })
}

function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  const out: number[] = []
  let cur = 0
  let nbits = 0
  let size = minCode + 1
  let next = eoi + 1
  const write = (code: number): void => {
    cur |= code << nbits
    nbits += size
    while (nbits >= 8) {
      out.push(cur & 255)
      cur >>>= 8
      nbits -= 8
    }
  }
  // tras cada código de datos, si el siguiente que se asignaría ya no cabe, crece el tamaño
  const data = (code: number): void => {
    write(code)
    if (next > (1 << size) - 1 && size < 12) size++
  }
  let dict = new Map<number, number>()
  write(clear)
  let prefix = indices[0]!
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!
    const key = (prefix << 8) | k
    const hit = dict.get(key)
    if (hit !== undefined) {
      prefix = hit
      continue
    }
    data(prefix)
    if (next < 4096) dict.set(key, next++)
    else {
      write(clear)
      dict = new Map()
      next = eoi + 1
      size = minCode + 1
    }
    prefix = k
  }
  data(prefix)
  write(eoi)
  if (nbits > 0) out.push(cur & 255)
  return Uint8Array.from(out)
}

/**
 * GIF animado. Paleta global de ≤ 255 colores (+1 transparente, alfa < 128), duración por imagen
 * redondeada a 10 ms (mínimo 20 ms) y bucle infinito (`loops` = 0) o N veces.
 */
export function encodeGif(input: Frame[], loops = 0): Uint8Array {
  const frames = uniformFrames(input)
  const { width: w, height: h } = frames[0]!.bitmap
  const seen = new Map<number, number[]>()
  for (const f of frames)
    for (let i = 0; i < f.bitmap.data.length; i += 4) {
      if (f.bitmap.data[i + 3]! < 128) continue
      const key = (f.bitmap.data[i]! << 16) | (f.bitmap.data[i + 1]! << 8) | f.bitmap.data[i + 2]!
      if (!seen.has(key))
        seen.set(key, [f.bitmap.data[i]!, f.bitmap.data[i + 1]!, f.bitmap.data[i + 2]!])
    }
  const colors = [...seen.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
  const palette = quantize(colors, 255)
  const lookup = new Map<number, number>()
  const nearest = (r: number, g: number, b: number): number => {
    const key = (r << 16) | (g << 8) | b
    const hit = lookup.get(key)
    if (hit !== undefined) return hit
    let bi = 0
    let bd = Infinity
    palette.forEach((p, i) => {
      const d = (p[0]! - r) ** 2 + (p[1]! - g) ** 2 + (p[2]! - b) ** 2
      if (d < bd) {
        bd = d
        bi = i
      }
    })
    lookup.set(key, bi)
    return bi
  }
  const TRANSPARENT = 255
  // tamaño de la paleta: potencia de 2 (mínimo 2) con el índice transparente al final
  let bits = 1
  while (1 << bits < palette.length + 1) bits++
  const palSize = 1 << bits
  const tIndex = palSize - 1
  void TRANSPARENT

  const out: number[] = []
  const u16 = (v: number): void => void out.push(v & 255, (v >> 8) & 255)
  out.push(...Array.from('GIF89a', (c) => c.charCodeAt(0)))
  u16(w)
  u16(h)
  out.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0)
  for (let i = 0; i < palSize; i++) out.push(...(palette[i] ?? [0, 0, 0]))
  // extensión de bucle de Netscape
  out.push(0x21, 0xff, 11, ...Array.from('NETSCAPE2.0', (c) => c.charCodeAt(0)), 3, 1)
  u16(loops)
  out.push(0)
  const minCode = Math.max(2, bits)
  for (const f of frames) {
    const delay = Math.max(2, Math.round(f.delayMs / 10))
    // control gráfico: disposición 2 (restaurar fondo) y color transparente
    out.push(0x21, 0xf9, 4, (2 << 2) | 1, delay & 255, (delay >> 8) & 255, tIndex, 0)
    out.push(0x2c)
    u16(0)
    u16(0)
    u16(w)
    u16(h)
    out.push(0)
    const idx = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const d = f.bitmap.data
      idx[i] = d[i * 4 + 3]! < 128 ? tIndex : nearest(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!)
    }
    out.push(minCode)
    const data = lzw(idx, minCode)
    for (let o = 0; o < data.length; o += 255) {
      const n = Math.min(255, data.length - o)
      out.push(n)
      for (let k = 0; k < n; k++) out.push(data[o + k]!)
    }
    out.push(0)
  }
  out.push(0x3b)
  return Uint8Array.from(out)
}

// ---------- APNG ----------

function rawScanlines(bmp: Bitmap): Uint8Array {
  const { width: w, height: h } = bmp
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++)
    raw.set(bmp.data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1)
  return raw
}

/** APNG con alfa completo; cada imagen es un fotograma completo (sin optimizar diferencias). */
export function encodeApng(input: Frame[], loops = 0): Uint8Array {
  const frames = uniformFrames(input)
  const { width: w, height: h } = frames[0]!.bitmap
  const parts: Uint8Array[] = [new Uint8Array(SIGNATURE)]
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8
  ihdr[9] = 6
  parts.push(chunk('IHDR', ihdr))
  const actl = new Uint8Array(8)
  const av = new DataView(actl.buffer)
  av.setUint32(0, frames.length)
  av.setUint32(4, loops)
  parts.push(chunk('acTL', actl))
  let seq = 0
  frames.forEach((f, i) => {
    const fctl = new Uint8Array(26)
    const fv = new DataView(fctl.buffer)
    fv.setUint32(0, seq++)
    fv.setUint32(4, w)
    fv.setUint32(8, h)
    fv.setUint32(12, 0)
    fv.setUint32(16, 0)
    fv.setUint16(20, Math.max(1, Math.round(f.delayMs)))
    fv.setUint16(22, 1000)
    fctl[24] = 1 // dispose_op: fondo
    fctl[25] = 0 // blend_op: fuente
    parts.push(chunk('fcTL', fctl))
    const z = zlibSync(rawScanlines(f.bitmap), { level: 6 })
    if (i === 0) parts.push(chunk('IDAT', z))
    else {
      const fd = new Uint8Array(4 + z.length)
      new DataView(fd.buffer).setUint32(0, seq++)
      fd.set(z, 4)
      parts.push(chunk('fdAT', fd))
    }
  })
  parts.push(chunk('IEND', new Uint8Array(0)))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

// ---------- ICO ----------

/** ICO con entradas PNG (Windows Vista+). Cada imagen debe medir ≤ 256 × 256. */
export function encodeIco(images: Bitmap[]): Uint8Array {
  for (const b of images)
    if (b.width > 256 || b.height > 256) throw new Error('ICO: el tamaño máximo es 256 × 256.')
  const pngs = images.map((b) => encodePng(b))
  const head = 6 + 16 * images.length
  const out = new Uint8Array(head + pngs.reduce((n, p) => n + p.length, 0))
  const dv = new DataView(out.buffer)
  dv.setUint16(2, 1, true) // tipo: icono
  dv.setUint16(4, images.length, true)
  let off = head
  images.forEach((b, i) => {
    const e = 6 + 16 * i
    out[e] = b.width === 256 ? 0 : b.width
    out[e + 1] = b.height === 256 ? 0 : b.height
    dv.setUint16(e + 4, 1, true) // planos
    dv.setUint16(e + 6, 32, true) // bits por píxel
    dv.setUint32(e + 8, pngs[i]!.length, true)
    dv.setUint32(e + 12, off, true)
    out.set(pngs[i]!, off)
    off += pngs[i]!.length
  })
  return out
}

// ---------- Hoja de sprites ----------

export type SheetLayout = 'horizontal' | 'vertical' | 'grid'

export interface SheetOptions {
  layout: SheetLayout
  /** Columnas en la disposición de rejilla. */
  columns?: number
  padding?: number
}

export interface SheetFrameInfo {
  name: string
  frame: { x: number; y: number; w: number; h: number }
  sourceSize: { w: number; h: number }
  duration: number
}

/** Une los fotogramas en una hoja y devuelve también los metadatos (formato «array» de Aseprite). */
export function buildSpriteSheet(
  frames: (Frame & { name: string })[],
  opt: SheetOptions
): { sheet: Bitmap; json: string; frames: SheetFrameInfo[] } {
  const pad = Math.max(0, opt.padding ?? 0)
  const n = frames.length
  const cw = Math.max(...frames.map((f) => f.bitmap.width))
  const ch = Math.max(...frames.map((f) => f.bitmap.height))
  const cols =
    opt.layout === 'horizontal'
      ? n
      : opt.layout === 'vertical'
        ? 1
        : Math.max(1, opt.columns ?? Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const sheet = new Bitmap(cols * cw + (cols + 1) * pad, rows * ch + (rows + 1) * pad)
  const info: SheetFrameInfo[] = []
  frames.forEach((f, i) => {
    const x = pad + (i % cols) * (cw + pad)
    const y = pad + Math.floor(i / cols) * (ch + pad)
    for (let r = 0; r < f.bitmap.height; r++)
      sheet.data.set(
        f.bitmap.data.subarray(r * f.bitmap.width * 4, (r + 1) * f.bitmap.width * 4),
        ((y + r) * sheet.width + x) * 4
      )
    info.push({
      name: f.name,
      frame: { x, y, w: f.bitmap.width, h: f.bitmap.height },
      sourceSize: { w: f.bitmap.width, h: f.bitmap.height },
      duration: f.delayMs
    })
  })
  const json = JSON.stringify(
    {
      frames: info.map((f) => ({
        filename: f.name,
        frame: f.frame,
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: f.sourceSize.w, h: f.sourceSize.h },
        sourceSize: f.sourceSize,
        duration: f.duration
      })),
      meta: { app: 'Pixeltor', size: { w: sheet.width, h: sheet.height }, scale: '1' }
    },
    null,
    2
  )
  return { sheet, json, frames: info }
}
