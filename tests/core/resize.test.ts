import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  PixelMask,
  addShape,
  color,
  cropToSelection,
  makeAppearance,
  makeRect,
  resizeCanvas,
  resizeImage
} from '@core/index'

function setup() {
  const s = DocumentSession.create(8, 8)
  s.bitmapOf(s.activeLayer.id).set(1, 2, 0xff0000ff)
  addShape(s, makeRect(3, 3, 2, 2, makeAppearance(color(0, 255, 0), null)))
  return s
}

describe('tamaño de lienzo', () => {
  it('amplía anclando al centro y desplaza píxeles y formas', () => {
    const s = setup()
    expect(resizeCanvas(s, 12, 10, { x: 1, y: 1 })).toBe(true)
    expect(s.image.width).toBe(12)
    expect(s.image.height).toBe(10)
    const bmp = s.bitmapOf(s.activeLayer.id)
    expect(bmp.width).toBe(12)
    expect(bmp.get(3, 3)).toBe(0xff0000ff)
    expect(s.activeLayer.shapes[0]!.transform[4]).toBeGreaterThanOrEqual(2)
    expect(s.activeLayer.raster.width).toBe(12)
  })

  it('recorta y se deshace/rehace con los píxeles originales', () => {
    const s = setup()
    resizeCanvas(s, 4, 4, { x: 0, y: 0 })
    expect(s.bitmapOf(s.activeLayer.id).width).toBe(4)
    s.undo()
    expect(s.image.width).toBe(8)
    expect(s.bitmapOf(s.activeLayer.id).get(1, 2)).toBe(0xff0000ff)
    s.redo()
    expect(s.image.width).toBe(4)
    expect(s.bitmapOf(s.activeLayer.id).get(1, 2)).toBe(0xff0000ff)
  })

  it('rechaza tamaños inválidos o iguales', () => {
    const s = setup()
    expect(resizeCanvas(s, 8, 8)).toBe(false)
    expect(resizeCanvas(s, 0, 8)).toBe(false)
    expect(resizeCanvas(s, 99999, 8)).toBe(false)
  })

  it('recorta a la selección', () => {
    const s = setup()
    s.selection = { mask: PixelMask.rect(8, 8, { x: 1, y: 2, w: 3, h: 3 }), floating: null }
    expect(cropToSelection(s)).toBe(true)
    expect(s.image.width).toBe(3)
    expect(s.bitmapOf(s.activeLayer.id).get(0, 0)).toBe(0xff0000ff)
  })
})

describe('tamaño de imagen', () => {
  it('escala por vecino más cercano, escala formas y se deshace', () => {
    const s = setup()
    expect(resizeImage(s, 16, 16)).toBe(true)
    const bmp = s.bitmapOf(s.activeLayer.id)
    expect(bmp.width).toBe(16)
    expect(bmp.get(2, 4)).toBe(0xff0000ff)
    expect(bmp.get(3, 5)).toBe(0xff0000ff)
    expect(s.activeLayer.shapes[0]!.transform[0]).toBe(2)
    s.undo()
    expect(s.image.width).toBe(8)
    expect(s.bitmapOf(s.activeLayer.id).get(1, 2)).toBe(0xff0000ff)
  })
})
