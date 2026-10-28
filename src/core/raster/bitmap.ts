// Bitmap RGBA8 no premultiplicado. Los buffers nunca son reactivos (CLAUDE.md, regla 3).

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export class Bitmap {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(width: number, height: number, data?: Uint8ClampedArray) {
    this.width = width
    this.height = height
    this.data = data ?? new Uint8ClampedArray(width * height * 4)
    if (this.data.length !== width * height * 4)
      throw new Error('Bitmap: tamaño de buffer inválido')
  }

  clone(): Bitmap {
    return new Bitmap(this.width, this.height, this.data.slice())
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  /** Lee el píxel como entero 0xRRGGBBAA sin signo. */
  get(x: number, y: number): number {
    const i = (y * this.width + x) * 4
    const d = this.data
    return ((d[i]! << 24) | (d[i + 1]! << 16) | (d[i + 2]! << 8) | d[i + 3]!) >>> 0
  }

  set(x: number, y: number, rgba: number): void {
    const i = (y * this.width + x) * 4
    const d = this.data
    d[i] = (rgba >>> 24) & 255
    d[i + 1] = (rgba >>> 16) & 255
    d[i + 2] = (rgba >>> 8) & 255
    d[i + 3] = rgba & 255
  }

  isEmpty(): boolean {
    const d = this.data
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false
    return true
  }

  /** Copia el rectángulo (recortado a los límites) a un buffer nuevo. */
  readRect(r: Rect): { rect: Rect; data: Uint8ClampedArray } {
    const rect = clipRect(r, this.width, this.height)
    const out = new Uint8ClampedArray(rect.w * rect.h * 4)
    for (let y = 0; y < rect.h; y++) {
      const s = ((rect.y + y) * this.width + rect.x) * 4
      out.set(this.data.subarray(s, s + rect.w * 4), y * rect.w * 4)
    }
    return { rect, data: out }
  }

  writeRect(rect: Rect, data: Uint8ClampedArray): void {
    for (let y = 0; y < rect.h; y++) {
      const d = ((rect.y + y) * this.width + rect.x) * 4
      this.data.set(data.subarray(y * rect.w * 4, (y + 1) * rect.w * 4), d)
    }
  }
}

export function rgba(r: number, g: number, b: number, a = 255): number {
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0
}

export function clipRect(r: Rect, w: number, h: number): Rect {
  const x0 = Math.max(0, r.x)
  const y0 = Math.max(0, r.y)
  const x1 = Math.min(w, r.x + r.w)
  const y1 = Math.min(h, r.y + r.h)
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b }
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x + a.w, b.x + b.w)
  const y1 = Math.max(a.y + a.h, b.y + b.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
