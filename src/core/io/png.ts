// Codec PNG mínimo y determinista (8 bits, sin entrelazado). Sin DOM: corre en Node y Workers.

import { unzlibSync, zlibSync } from 'fflate'
import { Bitmap } from '../raster/bitmap'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 255]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

export function encodePng(bmp: Bitmap): Uint8Array {
  const { width: w, height: h } = bmp
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8 // profundidad
  ihdr[9] = 6 // RGBA
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filtro "ninguno"
    raw.set(bmp.data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1)
  }
  const idat = zlibSync(raw, { level: 6 })
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0))
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(bytes: Uint8Array): Bitmap {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new Error('PNG: firma inválida')
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 8
  let w = 0
  let h = 0
  let depth = 0
  let colorType = 0
  let interlace = 0
  let palette: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  while (pos + 8 <= bytes.length) {
    const len = dv.getUint32(pos)
    const type = String.fromCharCode(
      bytes[pos + 4]!,
      bytes[pos + 5]!,
      bytes[pos + 6]!,
      bytes[pos + 7]!
    )
    const body = bytes.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      w = dv.getUint32(pos + 8)
      h = dv.getUint32(pos + 12)
      depth = body[8]!
      colorType = body[9]!
      interlace = body[12]!
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (!w || !h) throw new Error('PNG: sin cabecera')
  if (interlace) throw new Error('PNG: entrelazado no soportado')
  if (depth !== 8 && !(colorType === 3 && depth <= 8))
    throw new Error(`PNG: profundidad ${depth} no soportada`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error('PNG: tipo de color no soportado')

  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of idat) {
    joined.set(p, o)
    o += p.length
  }
  const data = unzlibSync(joined)
  const bpp = Math.max(1, (channels * depth) / 8)
  const stride = Math.ceil((w * channels * depth) / 8)
  const pixels = new Uint8Array(stride * h)
  for (let y = 0; y < h; y++) {
    const ft = data[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    for (let x = 0; x < stride; x++) {
      const raw = data[src + x]!
      const a = x >= bpp ? pixels[y * stride + x - bpp]! : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x]! : 0
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp]! : 0
      const v =
        ft === 0
          ? raw
          : ft === 1
            ? raw + a
            : ft === 2
              ? raw + b
              : ft === 3
                ? raw + ((a + b) >> 1)
                : raw + paeth(a, b, c)
      pixels[y * stride + x] = v & 255
    }
  }

  const out = new Bitmap(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4
      const s = y * stride
      if (colorType === 6) {
        for (let k = 0; k < 4; k++) out.data[d + k] = pixels[s + x * 4 + k]!
      } else if (colorType === 2) {
        for (let k = 0; k < 3; k++) out.data[d + k] = pixels[s + x * 3 + k]!
        out.data[d + 3] = 255
      } else if (colorType === 0) {
        const g = pixels[s + x]!
        out.data.set([g, g, g, 255], d)
      } else if (colorType === 4) {
        const g = pixels[s + x * 2]!
        out.data.set([g, g, g, pixels[s + x * 2 + 1]!], d)
      } else {
        let idx: number
        if (depth === 8) idx = pixels[s + x]!
        else {
          const per = 8 / depth
          const byte = pixels[s + Math.floor(x / per)]!
          idx = (byte >> (8 - depth * ((x % per) + 1))) & ((1 << depth) - 1)
        }
        if (!palette) throw new Error('PNG: falta la paleta')
        out.data.set(
          [palette[idx * 3]!, palette[idx * 3 + 1]!, palette[idx * 3 + 2]!, trns?.[idx] ?? 255],
          d
        )
      }
    }
  }
  return out
}

/** Escala por vecino más cercano un entero `factor` ≥ 1 (exportación pixel-perfect). */
export function scaleNearest(bmp: Bitmap, factor: number): Bitmap {
  const f = Math.max(1, Math.round(factor))
  if (f === 1) return bmp
  const out = new Bitmap(bmp.width * f, bmp.height * f)
  const W = out.width
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / f)
    for (let x = 0; x < W; x++) {
      const s = (sy * bmp.width + Math.floor(x / f)) * 4
      out.data.set(bmp.data.subarray(s, s + 4), (y * W + x) * 4)
    }
  }
  return out
}
