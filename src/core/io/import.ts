// Importar animaciones y hojas de sprites (specs/07): decodificador GIF, troceado de hojas y
// documentos a partir de fotogramas. Sin DOM.

import { createDocument } from '../model/document'
import { newId } from '../model/ids'
import type { ID, PixeltorDocument } from '../model/types'
import { Bitmap } from '../raster/bitmap'

export interface ImportedFrame {
  bitmap: Bitmap
  name: string
  delayMs: number
}

const MAX_GIF_PIXELS = 2048 * 2048

/** Decodifica un GIF (87a/89a) componiendo cada fotograma sobre el anterior según su disposición. */
export function decodeGif(b: Uint8Array): {
  width: number
  height: number
  frames: ImportedFrame[]
} {
  const sig = String.fromCharCode(...b.subarray(0, 6))
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('No es un GIF válido.')
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const width = dv.getUint16(6, true)
  const height = dv.getUint16(8, true)
  if (!width || !height || width * height > MAX_GIF_PIXELS)
    throw new Error('El GIF tiene un tamaño no admitido.')
  const flags = b[10]!
  let p = 13
  let globalPal: number[][] | null = null
  if (flags & 0x80) {
    const n = 2 << (flags & 7)
    globalPal = []
    for (let i = 0; i < n; i++, p += 3) globalPal.push([b[p]!, b[p + 1]!, b[p + 2]!])
  }

  const frames: ImportedFrame[] = []
  let canvas = new Bitmap(width, height)
  let gce: { delay: number; transparent: number; disposal: number } = {
    delay: 10,
    transparent: -1,
    disposal: 0
  }
  const skipBlocks = (): void => {
    while (b[p] !== 0) {
      if (p >= b.length) throw new Error('GIF truncado.')
      p += b[p]! + 1
    }
    p++
  }

  while (p < b.length && b[p] !== 0x3b) {
    if (b[p] === 0x21) {
      const label = b[p + 1]!
      if (label === 0xf9) {
        const f = b[p + 3]!
        gce = {
          disposal: (f >> 2) & 7,
          transparent: f & 1 ? b[p + 6]! : -1,
          delay: dv.getUint16(p + 4, true)
        }
      }
      p += 2
      skipBlocks()
    } else if (b[p] === 0x2c) {
      const fx = dv.getUint16(p + 1, true)
      const fy = dv.getUint16(p + 3, true)
      const fw = dv.getUint16(p + 5, true)
      const fh = dv.getUint16(p + 7, true)
      const lf = b[p + 9]!
      p += 10
      let pal = globalPal
      if (lf & 0x80) {
        const n = 2 << (lf & 7)
        pal = []
        for (let i = 0; i < n; i++, p += 3) pal.push([b[p]!, b[p + 1]!, b[p + 2]!])
      }
      const interlaced = !!(lf & 0x40)
      const minCode = b[p++]!
      const data: number[] = []
      while (b[p] !== 0) {
        if (p >= b.length) throw new Error('GIF truncado.')
        for (let k = 0; k < b[p]!; k++) data.push(b[p + 1 + k]!)
        p += b[p]! + 1
      }
      p++
      const idx = lzwDecode(data, minCode, fw * fh)

      const before = gce.disposal === 3 ? canvas.clone() : null
      // filas en orden de entrelazado
      const rows: number[] = []
      if (interlaced) {
        for (const [start, step] of [
          [0, 8],
          [4, 8],
          [2, 4],
          [1, 2]
        ] as const)
          for (let y = start; y < fh; y += step) rows.push(y)
      } else for (let y = 0; y < fh; y++) rows.push(y)
      rows.forEach((y, i) => {
        for (let x = 0; x < fw; x++) {
          const ci = idx[i * fw + x]!
          const cx = fx + x
          const cy = fy + y
          if (ci === gce.transparent || cx >= width || cy >= height || !pal) continue
          const c = pal[ci] ?? [0, 0, 0]
          canvas.data.set([c[0]!, c[1]!, c[2]!, 255], (cy * width + cx) * 4)
        }
      })
      frames.push({
        bitmap: canvas.clone(),
        name: `Imagen ${frames.length + 1}`,
        delayMs: Math.max(10, (gce.delay || 10) * 10)
      })
      // disposición: 2 = fondo (transparente), 3 = restaurar el estado previo
      if (gce.disposal === 2) {
        for (let y = fy; y < Math.min(height, fy + fh); y++)
          canvas.data.fill(0, (y * width + fx) * 4, (y * width + Math.min(width, fx + fw)) * 4)
      } else if (gce.disposal === 3 && before) canvas = before
      gce = { delay: 10, transparent: -1, disposal: 0 }
    } else throw new Error('GIF dañado.')
  }
  if (!frames.length) throw new Error('El GIF no contiene imágenes.')
  return { width, height, frames }
}

function lzwDecode(data: number[], minCode: number, expected: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  const out = new Uint8Array(expected)
  let n = 0
  let size = minCode + 1
  // tabla como pares (prefijo, byte) para no crear arrays por entrada
  const prefix = new Int32Array(4096)
  const suffix = new Uint8Array(4096)
  const lengths = new Uint16Array(4096)
  let next = eoi + 1
  for (let i = 0; i < clear; i++) {
    suffix[i] = i
    lengths[i] = 1
  }
  let bits = 0
  let cur = 0
  let pos = 0
  let prev = -1
  const stack = new Uint8Array(4097)
  const write = (code: number): number => {
    const len = lengths[code]!
    const first = len
    let c = code
    let k = len
    while (k > 0) {
      stack[--k] = suffix[c]!
      c = prefix[c]!
    }
    for (let i = 0; i < first && n < expected; i++) out[n++] = stack[i]!
    return stack[0]!
  }
  while (n < expected) {
    while (bits < size) {
      if (pos >= data.length) return out
      cur |= data[pos++]! << bits
      bits += 8
    }
    const code = cur & ((1 << size) - 1)
    cur >>>= size
    bits -= size
    if (code === clear) {
      next = eoi + 1
      size = minCode + 1
      prev = -1
      continue
    }
    if (code === eoi) break
    if (prev < 0) {
      write(code)
      prev = code
      continue
    }
    let firstByte: number
    if (code < next) firstByte = write(code)
    else {
      // caso especial (KwKwK): prev seguido de su propio primer byte
      let c = prev
      while (lengths[c]! > 1) c = prefix[c]!
      firstByte = suffix[c]!
      write(prev)
      if (n < expected) out[n++] = firstByte
    }
    if (next < 4096) {
      prefix[next] = prev
      suffix[next] = firstByte
      lengths[next] = lengths[prev]! + 1
      next++
      if (next === 1 << size && size < 12) size++
    }
    prev = code
  }
  return out
}

// ---------- Hojas de sprites y secuencias ----------

export interface SliceOptions {
  cellW: number
  cellH: number
  margin: number
  spacing: number
  /** Orden de lectura: por filas (izquierda → derecha) o por columnas. */
  order: 'rows' | 'columns'
  /** Descarta las celdas totalmente transparentes. */
  skipEmpty: boolean
}

export function sliceSheet(sheet: Bitmap, o: SliceOptions): Bitmap[] {
  const { cellW, cellH, margin, spacing } = o
  if (cellW < 1 || cellH < 1) throw new Error('El tamaño de celda no es válido.')
  const cols = Math.floor((sheet.width - 2 * margin + spacing) / (cellW + spacing))
  const rows = Math.floor((sheet.height - 2 * margin + spacing) / (cellH + spacing))
  const cells: Bitmap[] = []
  const grab = (cx: number, cy: number): void => {
    const x0 = margin + cx * (cellW + spacing)
    const y0 = margin + cy * (cellH + spacing)
    const cell = new Bitmap(cellW, cellH)
    for (let y = 0; y < cellH; y++)
      cell.data.set(
        sheet.data.subarray(
          ((y0 + y) * sheet.width + x0) * 4,
          ((y0 + y) * sheet.width + x0 + cellW) * 4
        ),
        y * cellW * 4
      )
    if (o.skipEmpty && cell.isEmpty()) return
    cells.push(cell)
  }
  if (o.order === 'rows') for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grab(c, r)
  else for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) grab(c, r)
  if (cells.length > 1024) throw new Error('La hoja produce demasiadas imágenes (máximo 1024).')
  return cells
}

/** Comparación de nombres «natural»: img2 antes que img10. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

/** Documento con una imagen (de una capa) por fotograma. */
export function documentFromFrames(
  name: string,
  frames: ImportedFrame[]
): { doc: PixeltorDocument; rasters: Map<ID, Bitmap> } {
  if (!frames.length) throw new Error('No hay imágenes que importar.')
  const first = frames[0]!.bitmap
  const doc = createDocument(first.width, first.height, name)
  const rasters = new Map<ID, Bitmap>()
  const template = doc.images[0]!
  doc.images = frames.map((f, i) => {
    const img =
      i === 0
        ? template
        : {
            ...template,
            id: newId(),
            layers: template.layers.map((l) => ({
              ...l,
              shapes: [],
              effects: [],
              id: newId(),
              raster: { id: newId(), width: f.bitmap.width, height: f.bitmap.height }
            }))
          }
    img.name = f.name
    img.width = f.bitmap.width
    img.height = f.bitmap.height
    img.durationMs = f.delayMs
    for (const l of img.layers) {
      l.raster.width = f.bitmap.width
      l.raster.height = f.bitmap.height
      rasters.set(l.raster.id, f.bitmap)
    }
    return img
  })
  return { doc, rasters }
}
