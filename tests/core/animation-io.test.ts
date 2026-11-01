import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  buildSpriteSheet,
  decodePng,
  encodeApng,
  encodeGif,
  encodeIco,
  quantize,
  uniformFrames
} from '@core/index'

/** Decodificador GIF mínimo (sólo lo que produce nuestro codificador) para comprobar el ida y vuelta. */
function decodeGif(b: Uint8Array) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  expect(String.fromCharCode(...b.subarray(0, 6))).toBe('GIF89a')
  const w = dv.getUint16(6, true)
  const h = dv.getUint16(8, true)
  const flags = b[10]!
  const palSize = 2 << (flags & 7)
  const pal: number[][] = []
  let p = 13
  for (let i = 0; i < palSize; i++, p += 3) pal.push([b[p]!, b[p + 1]!, b[p + 2]!])
  const frames: { px: Uint8ClampedArray; delay: number }[] = []
  let delay = 0
  let tIndex = -1
  let loops = -1
  while (b[p] !== 0x3b) {
    if (b[p] === 0x21) {
      const label = b[p + 1]!
      if (label === 0xf9) {
        delay = dv.getUint16(p + 4, true)
        tIndex = b[p + 6]!
      }
      if (label === 0xff) loops = dv.getUint16(p + 16, true)
      p += 2
      while (b[p] !== 0) p += b[p]! + 1
      p++
    } else if (b[p] === 0x2c) {
      p += 10
      const minCode = b[p++]!
      const data: number[] = []
      while (b[p] !== 0) {
        for (let k = 0; k < b[p]!; k++) data.push(b[p + 1 + k]!)
        p += b[p]! + 1
      }
      p++
      // LZW
      const clear = 1 << minCode
      const eoi = clear + 1
      let size = minCode + 1
      let table: number[][] = []
      const reset = (): void => {
        table = []
        for (let i = 0; i < clear; i++) table.push([i])
        table.push([], [])
        size = minCode + 1
      }
      reset()
      const out: number[] = []
      let bits = 0
      let cur = 0
      let pos = 0
      let prev: number[] | null = null
      for (;;) {
        while (bits < size) {
          cur |= (data[pos++] ?? 0) << bits
          bits += 8
        }
        const code = cur & ((1 << size) - 1)
        cur >>>= size
        bits -= size
        if (code === clear) {
          reset()
          prev = null
          continue
        }
        if (code === eoi) break
        let entry: number[]
        if (code < table.length) entry = table[code]!
        else entry = [...prev!, prev![0]!]
        out.push(...entry)
        if (prev) table.push([...prev, entry[0]!])
        prev = entry
        if (table.length === 1 << size && size < 12) size++
      }
      const px = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < w * h; i++) {
        const idx = out[i]!
        if (idx === tIndex) continue
        px.set([...pal[idx]!, 255], i * 4)
      }
      frames.push({ px, delay })
    } else throw new Error('bloque GIF desconocido')
  }
  return { w, h, frames, loops }
}

function gradient(w: number, h: number, seed: number): Bitmap {
  const b = new Bitmap(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((x + y + seed) % 7 !== 0)
        b.data.set([(x * 37 + seed) & 255, (y * 53) & 255, (x * y) & 255, 255], (y * w + x) * 4)
  return b
}

describe('GIF', () => {
  it('ida y vuelta con pocos colores: píxeles, transparencia, duración y bucle', () => {
    const a = new Bitmap(6, 4)
    a.set(1, 1, 0xff0000ff)
    a.set(2, 1, 0x00ff00ff)
    a.set(3, 2, 0x0000ffff)
    const gif = encodeGif(
      [
        { bitmap: a, delayMs: 120 },
        { bitmap: a, delayMs: 55 }
      ],
      0
    )
    const d = decodeGif(gif)
    expect([d.w, d.h, d.loops]).toEqual([6, 4, 0])
    expect(d.frames.map((f) => f.delay)).toEqual([12, 6]) // 120 ms → 12 cs; 55 ms → 6 cs (redondeo)
    const px = d.frames[0]!.px
    expect(Array.from(px.subarray((1 * 6 + 1) * 4, (1 * 6 + 1) * 4 + 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(px.subarray((2 * 6 + 3) * 4, (2 * 6 + 3) * 4 + 4))).toEqual([0, 0, 255, 255])
    expect(px[3]).toBe(0) // transparente
  })

  it('una imagen con muchos colores se cuantiza a ≤ 255 y se decodifica entera', () => {
    const g = gradient(64, 48, 3)
    const d = decodeGif(encodeGif([{ bitmap: g, delayMs: 100 }]))
    expect(d.frames[0]!.px.length).toBe(64 * 48 * 4)
    // los píxeles opacos siguen opacos y los huecos siguen transparentes
    for (let i = 0; i < 64 * 48; i++)
      expect(d.frames[0]!.px[i * 4 + 3]).toBe(g.data[i * 4 + 3] === 255 ? 255 : 0)
    expect(
      quantize(
        Array.from({ length: 1000 }, (_, i) => [i & 255, (i * 7) & 255, (i * 13) & 255]),
        255
      ).length
    ).toBeLessThanOrEqual(255)
  })

  it('es determinista', () => {
    const g = gradient(32, 32, 1)
    const a = encodeGif([{ bitmap: g, delayMs: 100 }])
    const b = encodeGif([{ bitmap: g, delayMs: 100 }])
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('imágenes de distinto tamaño se centran en el lienzo mayor', () => {
    const small = new Bitmap(2, 2)
    small.set(0, 0, 0xff0000ff)
    const big = new Bitmap(6, 6)
    const u = uniformFrames([
      { bitmap: small, delayMs: 10 },
      { bitmap: big, delayMs: 10 }
    ])
    expect(u[0]!.bitmap.width).toBe(6)
    expect(u[0]!.bitmap.get(2, 2)).toBe(0xff0000ff)
  })
})

describe('APNG, ICO y hoja de sprites', () => {
  it('APNG: acTL con el número de fotogramas y el primero es un PNG válido', () => {
    const a = gradient(8, 8, 1)
    const b = gradient(8, 8, 2)
    const apng = encodeApng([
      { bitmap: a, delayMs: 40 },
      { bitmap: b, delayMs: 80 }
    ])
    const text = String.fromCharCode(...apng)
    expect(text).toContain('acTL')
    expect(text.match(/fcTL/g)).toHaveLength(2)
    expect(text.match(/fdAT/g)).toHaveLength(1)
    // los decodificadores sin soporte de APNG ven el primer fotograma
    expect(Array.from(decodePng(apng).data)).toEqual(Array.from(a.data))
  })

  it('ICO: cabecera, entradas PNG y rechazo de tamaños > 256', () => {
    const ico = encodeIco([gradient(16, 16, 1), gradient(32, 32, 2)])
    const dv = new DataView(ico.buffer, ico.byteOffset)
    expect([dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true)]).toEqual([0, 1, 2])
    expect(ico[6]).toBe(16)
    expect(ico[6 + 16]).toBe(32)
    const off = dv.getUint32(6 + 12, true)
    expect(decodePng(ico.subarray(off, off + dv.getUint32(6 + 8, true))).width).toBe(16)
    expect(() => encodeIco([new Bitmap(300, 10)])).toThrow()
  })

  it('hoja de sprites: disposiciones, relleno y JSON', () => {
    const frames = [0, 1, 2, 3, 4].map((i) => ({
      bitmap: gradient(8, 6, i),
      delayMs: 100 + i,
      name: `f${i}`
    }))
    const h = buildSpriteSheet(frames, { layout: 'horizontal' })
    expect([h.sheet.width, h.sheet.height]).toEqual([40, 6])
    const g = buildSpriteSheet(frames, { layout: 'grid', columns: 3, padding: 2 })
    expect([g.sheet.width, g.sheet.height]).toEqual([3 * 8 + 4 * 2, 2 * 6 + 3 * 2])
    expect(g.frames[4]!.frame).toEqual({ x: 2 + 1 * 10, y: 2 + 1 * 8, w: 8, h: 6 })
    const meta = JSON.parse(g.json)
    expect(meta.frames).toHaveLength(5)
    expect(meta.frames[2].duration).toBe(102)
    // los píxeles de la hoja coinciden con los fotogramas
    const f = g.frames[4]!.frame
    expect(g.sheet.get(f.x + 3, f.y + 2)).toBe(frames[4]!.bitmap.get(3, 2))
  })
})
