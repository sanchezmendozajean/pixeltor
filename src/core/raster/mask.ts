import type { Bitmap, Rect } from './bitmap'

/** Máscara binaria de selección (0 / 255) del tamaño de la imagen. */
export class PixelMask {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array

  constructor(width: number, height: number, data?: Uint8Array) {
    this.width = width
    this.height = height
    this.data = data ?? new Uint8Array(width * height)
  }

  static rect(width: number, height: number, r: Rect): PixelMask {
    const m = new PixelMask(width, height)
    const x1 = Math.min(width, r.x + r.w)
    const y1 = Math.min(height, r.y + r.h)
    for (let y = Math.max(0, r.y); y < y1; y++)
      for (let x = Math.max(0, r.x); x < x1; x++) m.data[y * width + x] = 255
    return m
  }

  static all(width: number, height: number): PixelMask {
    return new PixelMask(width, height, new Uint8Array(width * height).fill(255))
  }

  has(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.data[y * this.width + x]! !== 0
    )
  }

  isEmpty(): boolean {
    return this.bounds() === null
  }

  bounds(): Rect | null {
    let x0 = this.width
    let y0 = this.height
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (this.data[y * this.width + x]) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  }

  invert(): PixelMask {
    const out = new PixelMask(this.width, this.height)
    for (let i = 0; i < this.data.length; i++) out.data[i] = this.data[i] ? 0 : 255
    return out
  }

  /** Desplaza la máscara (los píxeles que salen del lienzo se pierden). */
  translate(dx: number, dy: number): PixelMask {
    const out = new PixelMask(this.width, this.height)
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (this.data[y * this.width + x]) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height)
            out.data[ny * this.width + nx] = 255
        }
    return out
  }
}

export type MaskOp = 'replace' | 'add' | 'subtract' | 'intersect'

export function combineMasks(base: PixelMask | null, next: PixelMask, op: MaskOp): PixelMask {
  if (!base || op === 'replace') return next
  const out = new PixelMask(next.width, next.height)
  for (let i = 0; i < out.data.length; i++) {
    const a = base.data[i]! !== 0
    const b = next.data[i]! !== 0
    const v = op === 'add' ? a || b : op === 'subtract' ? a && !b : a && b
    out.data[i] = v ? 255 : 0
  }
  return out
}

/** Píxeles flotantes: contenido levantado de una capa que aún no se ha fijado. */
export interface FloatingPixels {
  bitmap: Bitmap
  x: number
  y: number
}
