// Operaciones de selección de píxeles y píxeles flotantes (specs/04 › Selección de píxeles).

import { Bitmap, type Rect } from '../raster/bitmap'
import { type MaskOp, PixelMask, combineMasks } from '../raster/mask'
import { stampOnto } from '../render/compose'
import type { DocumentSession } from '../session'

export function selectMask(
  s: DocumentSession,
  mask: PixelMask,
  op: MaskOp = 'replace',
  label = 'Selección'
): void {
  if (s.selection.floating) commitFloating(s)
  const tx = s.begin(label)
  const next = combineMasks(s.selection.mask, mask, op)
  s.selection = { mask: next.isEmpty() ? null : next, floating: null }
  tx.commit({ model: true })
}

export function selectRect(s: DocumentSession, r: Rect, op: MaskOp = 'replace'): void {
  selectMask(s, PixelMask.rect(s.image.width, s.image.height, r), op, 'Marco rectangular')
}

export function selectAll(s: DocumentSession): void {
  selectMask(s, PixelMask.all(s.image.width, s.image.height), 'replace', 'Seleccionar todo')
}

export function deselect(s: DocumentSession): void {
  if (s.selection.floating) commitFloating(s)
  if (!s.selection.mask) return
  const tx = s.begin('Deseleccionar')
  s.selection = { mask: null, floating: null }
  tx.commit({ model: true })
}

export function invertSelection(s: DocumentSession): void {
  if (s.selection.floating) commitFloating(s)
  const tx = s.begin('Invertir selección')
  const m = s.selection.mask ?? new PixelMask(s.image.width, s.image.height)
  const inv = m.invert()
  s.selection = { mask: inv.isEmpty() ? null : inv, floating: null }
  tx.commit({ model: true })
}

/** Copia los píxeles seleccionados de la capa activa (o la capa entera sin selección). */
export function copyPixels(s: DocumentSession): { bitmap: Bitmap; x: number; y: number } | null {
  const src = s.bitmapOf(s.activeLayerId)
  const mask = s.selection.mask
  const b = mask ? mask.bounds() : { x: 0, y: 0, w: src.width, h: src.height }
  if (!b) return null
  const out = new Bitmap(b.w, b.h)
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (mask && !mask.has(b.x + x, b.y + y)) continue
      out.set(x, y, src.get(b.x + x, b.y + y))
    }
  return { bitmap: out, x: b.x, y: b.y }
}

/** Borra los píxeles seleccionados (o toda la capa sin selección). */
export function deletePixels(s: DocumentSession): boolean {
  const layer = s.activeLayer
  if (layer.locked || !layer.visible || s.selection.floating) return false
  const bmp = s.bitmapOf(layer.id)
  const mask = s.selection.mask
  const b = mask ? mask.bounds() : { x: 0, y: 0, w: bmp.width, h: bmp.height }
  if (!b) return false
  const tx = s.begin('Borrar')
  tx.touch(layer.id, b)
  forEachMasked(b, mask, (x, y) => {
    if (!layer.lockAlpha) bmp.set(x, y, 0)
  })
  return tx.commit()
}

export function fillPixels(s: DocumentSession, color: number): boolean {
  const layer = s.activeLayer
  if (layer.locked || !layer.visible || s.selection.floating) return false
  const bmp = s.bitmapOf(layer.id)
  const mask = s.selection.mask
  const b = mask ? mask.bounds() : { x: 0, y: 0, w: bmp.width, h: bmp.height }
  if (!b) return false
  const tx = s.begin('Rellenar')
  tx.touch(layer.id, b)
  forEachMasked(b, mask, (x, y) => {
    const a = bmp.get(x, y) & 255
    if (layer.lockAlpha && a === 0) return
    bmp.set(x, y, layer.lockAlpha ? ((color & 0xffffff00) | a) >>> 0 : color)
  })
  return tx.commit()
}

function forEachMasked(b: Rect, mask: PixelMask | null, fn: (x: number, y: number) => void): void {
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) if (!mask || mask.has(x, y)) fn(x, y)
}

/** Pega píxeles como flotantes en la capa activa. */
export function pasteFloating(s: DocumentSession, bitmap: Bitmap, x: number, y: number): boolean {
  const layer = s.activeLayer
  if (layer.locked || !layer.visible) return false
  if (s.selection.floating) commitFloating(s)
  const tx = s.begin('Pegar')
  s.selection = {
    mask: PixelMask.rect(s.image.width, s.image.height, {
      x,
      y,
      w: bitmap.width,
      h: bitmap.height
    }),
    floating: { bitmap: bitmap.clone(), x, y }
  }
  tx.commit({ model: true })
  return true
}

/** Fija los píxeles flotantes en la capa activa. */
export function commitFloating(s: DocumentSession): void {
  const f = s.selection.floating
  if (!f) return
  const layer = s.activeLayer
  const bmp = s.bitmapOf(layer.id)
  const tx = s.begin('Fijar píxeles')
  tx.touch(layer.id, { x: f.x, y: f.y, w: f.bitmap.width, h: f.bitmap.height })
  stampOnto(bmp, f)
  s.selection = { mask: s.selection.mask, floating: null }
  tx.commit({ model: true })
}

/** Cancela los píxeles flotantes deshaciendo hasta el paso que los creó. */
export function cancelFloating(s: DocumentSession): void {
  while (s.selection.floating && s.history.canUndo) s.undo()
}

/**
 * Movimiento interactivo de la selección. `withPixels` levanta los píxeles de la capa
 * (flotantes); sin él solo se desplaza la máscara. Todo el arrastre es un único paso.
 */
export class SelectionMove {
  private readonly tx
  private readonly startMask: PixelMask
  private readonly startFloat

  constructor(
    private readonly s: DocumentSession,
    withPixels: boolean
  ) {
    const mask = s.selection.mask
    if (!mask) throw new Error('SelectionMove sin selección')
    this.tx = s.begin(withPixels || s.selection.floating ? 'Mover píxeles' : 'Mover selección')
    this.startMask = mask
    if (!s.selection.floating && withPixels) {
      const layer = s.activeLayer
      const bmp = s.bitmapOf(layer.id)
      const b = mask.bounds()!
      const lifted = copyPixels(s)!
      this.tx.touch(layer.id, b)
      if (!layer.lockAlpha) {
        for (let y = b.y; y < b.y + b.h; y++)
          for (let x = b.x; x < b.x + b.w; x++) if (mask.has(x, y)) bmp.set(x, y, 0)
      }
      s.selection = { mask, floating: { bitmap: lifted.bitmap, x: lifted.x, y: lifted.y } }
    }
    this.startFloat = s.selection.floating
  }

  /** Desplazamiento acumulado desde el inicio del arrastre. */
  moveBy(dx: number, dy: number): void {
    const f = this.startFloat
    this.s.selection = {
      mask: this.startMask.translate(dx, dy),
      floating: f ? { bitmap: f.bitmap, x: f.x + dx, y: f.y + dy } : null
    }
    const { width: w, height: h } = this.s.image
    this.s.emit({ imageId: this.s.activeImageId, dirty: { x: 0, y: 0, w, h }, structure: true })
  }

  end(): boolean {
    return this.tx.commit({ model: true })
  }
}
