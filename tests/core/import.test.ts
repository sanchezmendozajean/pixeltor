import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  buildSpriteSheet,
  decodeGif,
  documentFromFrames,
  encodeGif,
  naturalCompare,
  sliceSheet
} from '@core/index'

function frame(w: number, h: number, seed: number): Bitmap {
  const b = new Bitmap(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((x * 3 + y + seed) % 5 !== 0) {
        const c = (x + y + seed) % 6
        b.data.set([c * 40, 255 - c * 30, (c * 90) & 255, 255], (y * w + x) * 4)
      }
  return b
}

describe('importar GIF', () => {
  it('ida y vuelta de varias imágenes: píxeles, transparencia y duración', () => {
    const frames = [frame(20, 14, 0), frame(20, 14, 1), frame(20, 14, 2)].map((bitmap, i) => ({
      bitmap,
      delayMs: [100, 250, 40][i]!
    }))
    const back = decodeGif(encodeGif(frames))
    expect([back.width, back.height, back.frames.length]).toEqual([20, 14, 3])
    back.frames.forEach((f, i) => {
      expect(Array.from(f.bitmap.data)).toEqual(Array.from(frames[i]!.bitmap.data))
      expect(f.delayMs).toBe(frames[i]!.delayMs)
    })
  })

  it('imágenes con muchos colores y grandes (LZW con reinicios de tabla)', () => {
    const big = new Bitmap(120, 90)
    for (let y = 0; y < 90; y++)
      for (let x = 0; x < 120; x++)
        big.data.set([(x * 7 + y * 3) & 255, (x * y) & 255, (x ^ y) & 255, 255], (y * 120 + x) * 4)
    const back = decodeGif(encodeGif([{ bitmap: big, delayMs: 100 }]))
    expect(back.frames[0]!.bitmap.data.length).toBe(big.data.length)
    // cuantizado: todo sigue opaco
    for (let i = 3; i < big.data.length; i += 4) expect(back.frames[0]!.bitmap.data[i]).toBe(255)
  })

  it('rechaza datos que no son un GIF', () => {
    expect(() => decodeGif(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow()
  })
})

describe('hojas de sprites y secuencias', () => {
  it('trocear una hoja devuelve las celdas originales', () => {
    const cells = [0, 1, 2, 3, 4, 5].map((i) => frame(8, 6, i))
    const { sheet } = buildSpriteSheet(
      cells.map((c, i) => ({ bitmap: c, delayMs: 100, name: `c${i}` })),
      { layout: 'grid', columns: 3, padding: 2 }
    )
    const out = sliceSheet(sheet, {
      cellW: 8,
      cellH: 6,
      margin: 2,
      spacing: 2,
      order: 'rows',
      skipEmpty: false
    })
    expect(out).toHaveLength(6)
    out.forEach((c, i) => expect(Array.from(c.data)).toEqual(Array.from(cells[i]!.data)))
    const cols = sliceSheet(sheet, {
      cellW: 8,
      cellH: 6,
      margin: 2,
      spacing: 2,
      order: 'columns',
      skipEmpty: false
    })
    expect(Array.from(cols[1]!.data)).toEqual(Array.from(cells[3]!.data))
  })

  it('omite celdas vacías y valida el tamaño de celda', () => {
    const sheet = new Bitmap(16, 8)
    sheet.set(1, 1, 0xff0000ff)
    const o = { cellW: 8, cellH: 8, margin: 0, spacing: 0, order: 'rows' as const }
    expect(sliceSheet(sheet, { ...o, skipEmpty: true })).toHaveLength(1)
    expect(sliceSheet(sheet, { ...o, skipEmpty: false })).toHaveLength(2)
    expect(() => sliceSheet(sheet, { ...o, cellW: 0, skipEmpty: false })).toThrow()
  })

  it('orden natural y documento a partir de fotogramas', () => {
    expect(['f10.png', 'f2.png', 'f1.png'].sort(naturalCompare)).toEqual([
      'f1.png',
      'f2.png',
      'f10.png'
    ])
    const { doc, rasters } = documentFromFrames('Anim', [
      { bitmap: frame(8, 8, 0), name: 'A', delayMs: 70 },
      { bitmap: frame(12, 6, 1), name: 'B', delayMs: 130 }
    ])
    expect(doc.images.map((i) => [i.name, i.width, i.height, i.durationMs])).toEqual([
      ['A', 8, 8, 70],
      ['B', 12, 6, 130]
    ])
    const s = new DocumentSession(doc, rasters)
    expect(s.doc.images).toHaveLength(2)
    expect(s.bitmapOf(doc.images[1]!.layers[0]!.id).width).toBe(12)
    // las capas de cada imagen son independientes
    expect(doc.images[0]!.layers[0]!.shapes).not.toBe(doc.images[1]!.layers[0]!.shapes)
  })
})
