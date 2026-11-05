import { describe, expect, it } from 'vitest'
import { DocumentSession, composeImage, Bitmap, flattenLayers, mergeDown } from '@core/index'

function render(s: DocumentSession): Uint8ClampedArray {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out)
  return out.data
}

function setup() {
  const s = DocumentSession.create(4, 4)
  s.bitmapOf(s.activeLayer.id).set(0, 0, 0xff0000ff)
  s.addLayer()
  s.bitmapOf(s.activeLayer.id).set(1, 1, 0x00ff00ff)
  s.addLayer()
  s.bitmapOf(s.activeLayer.id).set(2, 2, 0x0000ff80)
  return s
}

describe('combinar capas', () => {
  it('combinar hacia abajo no cambia el render y se deshace', () => {
    const s = setup()
    const before = render(s)
    const n = s.image.layers.length
    expect(mergeDown(s)).toBe(true)
    expect(s.image.layers).toHaveLength(n - 1)
    expect(render(s)).toEqual(before)
    s.undo()
    expect(s.image.layers).toHaveLength(n)
    expect(render(s)).toEqual(before)
    s.redo()
    expect(render(s)).toEqual(before)
  })

  it('aplanar deja una sola capa con el mismo render', () => {
    const s = setup()
    const before = render(s)
    expect(flattenLayers(s, false)).toBe(true)
    expect(s.image.layers).toHaveLength(1)
    expect(render(s)).toEqual(before)
    s.undo()
    expect(render(s)).toEqual(before)
    expect(s.image.layers.length).toBeGreaterThan(1)
  })

  it('no combina hacia abajo la capa inferior', () => {
    const s = setup()
    s.setActiveLayer(s.image.layers[0]!.id)
    expect(mergeDown(s)).toBe(false)
  })
})
