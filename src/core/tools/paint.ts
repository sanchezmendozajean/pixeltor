// Herramientas de pintura sobre una sesión: cada gesto = una Transaction = un paso de historial.

import type { ID } from '../model/types'
import { Bitmap, clipRect } from '../raster/bitmap'
import { DirtyTracker, type PaintTarget, brushOffsets, linePoints, putPixel } from '../raster/draw'
import { type FloodOptions, selectSimilar } from '../raster/fill'
import { type PixelMap, type Symmetry, isSymmetric, symmetryMaps } from '../raster/symmetry'
import { PixelMask, combineMasks } from '../raster/mask'
import { composeImage } from '../render/compose'
import { type DocumentSession, Transaction } from '../session'

export interface StrokeOptions {
  tool: 'pencil' | 'brush' | 'eraser'
  /** 0xRRGGBBAA */
  color: number
  size: number
  shape: 'square' | 'round'
  /** Simetría respecto al centro del lienzo (opcional). */
  symmetry?: Symmetry
  /** El tamaño del pincel y del borrador sigue la presión (tableta); `size` es el máximo. */
  pressure?: boolean
}

export type PaintBlock = 'hidden' | 'locked' | 'floating' | 'group' | null

/** Motivo por el que no se puede pintar en la capa activa (para el cursor y la barra de estado). */
export function paintBlockReason(s: DocumentSession): PaintBlock {
  const l = s.activeLayer
  if (s.selection.floating) return 'floating'
  if (l.isGroup) return 'group'
  if (!l.visible) return 'hidden'
  if (l.locked) return 'locked'
  return null
}

export class Stroke {
  private readonly tx: Transaction
  private readonly layerId: ID
  private readonly target: PaintTarget
  private offsets: [number, number][]
  private readonly offsetCache = new Map<number, [number, number][]>()
  /** Tamaño de la punta del punto que se está pintando. */
  private curSize: number
  private lastPressure = 1
  private readonly dirty = new DirtyTracker()
  /** Copia del ráster antes del trazo: permite deshacer píxeles al aplicar pixel-perfect. */
  private readonly base: Bitmap | null
  private readonly maps: PixelMap[]
  private kept: [number, number][] = []
  private last: [number, number] | null = null

  constructor(
    private readonly s: DocumentSession,
    private readonly opt: StrokeOptions
  ) {
    const layer = s.activeLayer
    this.layerId = layer.id
    const bitmap = s.bitmapOf(layer.id)
    this.target = { bitmap, mask: s.selection.mask, lockAlpha: layer.lockAlpha }
    const size = opt.tool === 'pencil' ? 1 : opt.size
    this.curSize = size
    this.offsets = brushOffsets(size, opt.shape)
    this.offsetCache.set(size, this.offsets)
    this.maps = isSymmetric(opt.symmetry)
      ? symmetryMaps(opt.symmetry, bitmap.width, bitmap.height)
      : []
    this.base = opt.tool === 'pencil' ? bitmap.clone() : null
    this.tx = s.begin(
      opt.tool === 'eraser'
        ? 'Borrador'
        : opt.tool === 'pencil'
          ? 'Trazo de lápiz'
          : 'Trazo de pincel'
    )
  }

  private paint(x: number, y: number): void {
    // El tx.touch debe cubrir toda la punta (y sus reflejos) antes de pintar.
    const r = this.opt.tool === 'pencil' ? 0 : Math.ceil(this.curSize)
    const bw = this.target.bitmap.width
    const bh = this.target.bitmap.height
    this.tx.touch(this.layerId, { x: x - r, y: y - r, w: 2 * r + 1, h: 2 * r + 1 })
    for (const m of this.maps) {
      const a = m(x - r, y - r)
      const b = m(x + r, y + r)
      const x0 = Math.min(a[0], b[0])
      const y0 = Math.min(a[1], b[1])
      const rect = clipRect(
        { x: x0, y: y0, w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1 },
        bw,
        bh
      )
      if (rect.w > 0 && rect.h > 0) this.tx.touch(this.layerId, rect)
    }
    const erase = this.opt.tool === 'eraser'
    for (const [ox, oy] of this.offsets) {
      const px = x + ox
      const py = y + oy
      if (putPixel(this.target, px, py, this.opt.color, erase)) this.dirty.add(px, py)
      for (const m of this.maps) {
        const [qx, qy] = m(px, py)
        if (putPixel(this.target, qx, qy, this.opt.color, erase)) this.dirty.add(qx, qy)
      }
    }
  }

  /** Tamaño de la punta para una presión (0..1): entero ≥ 1, nunca mayor que `opt.size`. */
  private sizeFor(pressure: number): number {
    const p = Math.min(1, Math.max(0, pressure))
    return Math.max(1, Math.round(this.opt.size * p))
  }

  private useSize(size: number): void {
    if (size === this.curSize) return
    let o = this.offsetCache.get(size)
    if (!o) this.offsetCache.set(size, (o = brushOffsets(size, this.opt.shape)))
    this.curSize = size
    this.offsets = o
  }

  /**
   * Añade un punto (coordenadas enteras de píxel). Interpola con Bresenham desde el anterior.
   * `pressure` (0..1) sólo cuenta con `opt.pressure` en pincel y borrador; entre dos puntos la
   * presión se interpola, así el tamaño cambia de forma continua a lo largo del segmento.
   */
  move(x: number, y: number, pressure = 1): void {
    const pts = this.last
      ? linePoints(this.last[0], this.last[1], x, y).slice(1)
      : [[x, y] as [number, number]]
    this.last = [x, y]
    const variable = !!this.opt.pressure && this.opt.tool !== 'pencil'
    const from = this.lastPressure
    this.lastPressure = pressure
    pts.forEach((p, i) => {
      if (this.opt.tool === 'pencil') return this.addPencilPoint(p)
      if (variable) this.useSize(this.sizeFor(from + ((pressure - from) * (i + 1)) / pts.length))
      this.paint(p[0], p[1])
    })
  }

  private addPencilPoint(p: [number, number]): void {
    const k = this.kept
    const n = k.length
    if (n >= 2) {
      const a = k[n - 2]!
      const b = k[n - 1]!
      const diagonal = Math.abs(a[0] - p[0]) === 1 && Math.abs(a[1] - p[1]) === 1
      const isL = (b[0] === a[0] && b[1] === p[1]) || (b[1] === a[1] && b[0] === p[0])
      if (diagonal && isL) {
        // El punto central sobra: restaurar su píxel original y sustituirlo por el nuevo.
        k.pop()
        const old = this.base!.get(b[0], b[1])
        const t = this.target
        if (t.bitmap.inBounds(b[0], b[1])) t.bitmap.set(b[0], b[1], old)
        for (const m of this.maps) {
          const [qx, qy] = m(b[0], b[1])
          if (t.bitmap.inBounds(qx, qy)) t.bitmap.set(qx, qy, this.base!.get(qx, qy))
        }
      }
    }
    k.push(p)
    this.paint(p[0], p[1])
  }

  /** Región modificada hasta ahora (para repintar el visor). */
  get dirtyRect() {
    return this.dirty.rect
  }

  end(): boolean {
    const ok = this.tx.commit()
    return ok
  }
}

export interface BucketOptions extends FloodOptions {
  /** Muestrear la composición de todas las capas en vez de la capa activa. */
  sampleAll: boolean
}

export function bucketFill(
  s: DocumentSession,
  x: number,
  y: number,
  color: number,
  opt: BucketOptions
): boolean {
  if (paintBlockReason(s)) return false
  const layer = s.activeLayer
  const bmp = s.bitmapOf(layer.id)
  let source = bmp
  if (opt.sampleAll) {
    source = new Bitmap(bmp.width, bmp.height)
    composeImage(s.image, s.rasters, source)
  }
  let mask = selectSimilar(source, x, y, opt)
  if (s.selection.mask) mask = combineMasks(s.selection.mask, mask, 'intersect')
  const tx = s.begin('Bote de pintura')
  tx.touch(layer.id, { x: 0, y: 0, w: bmp.width, h: bmp.height })
  const target: PaintTarget = { bitmap: bmp, mask: null, lockAlpha: layer.lockAlpha }
  for (let yy = 0; yy < bmp.height; yy++)
    for (let xx = 0; xx < bmp.width; xx++)
      if (mask.data[yy * bmp.width + xx]) putPixel(target, xx, yy, color)
  return tx.commit()
}

/** Cuentagotas: devuelve 0xRRGGBBAA del píxel de la capa activa o de la composición. */
export function pickColor(
  s: DocumentSession,
  x: number,
  y: number,
  sampleAll: boolean
): number | null {
  const img = s.image
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null
  if (!sampleAll) return s.bitmapOf(s.activeLayerId).get(x, y)
  const out = new Bitmap(img.width, img.height)
  composeImage(img, s.rasters, out, { x, y, w: 1, h: 1 })
  return out.get(x, y)
}

/** Varita mágica: devuelve la máscara (sin aplicarla). */
export function wandMask(s: DocumentSession, x: number, y: number, opt: BucketOptions): PixelMask {
  let source = s.bitmapOf(s.activeLayerId)
  if (opt.sampleAll) {
    source = new Bitmap(s.image.width, s.image.height)
    composeImage(s.image, s.rasters, source)
  }
  return selectSimilar(source, x, y, opt)
}
