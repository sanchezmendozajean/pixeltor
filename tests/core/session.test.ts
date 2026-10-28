import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  PixelMask,
  Stroke,
  SelectionMove,
  bucketFill,
  commitFloating,
  composeImage,
  deletePixels,
  rgba,
  selectRect
} from '@core/index'

const RED = rgba(255, 0, 0)
const BLUE = rgba(0, 0, 255)

function pencil(s: DocumentSession, color: number, pts: [number, number][]): void {
  const st = new Stroke(s, { tool: 'pencil', color, size: 1, shape: 'square' })
  for (const [x, y] of pts) st.move(x, y)
  st.end()
}

describe('DocumentSession', () => {
  it('pinta, deshace y rehace un trazo como un único paso', () => {
    const s = DocumentSession.create(8, 8)
    pencil(s, RED, [
      [1, 1],
      [4, 1]
    ])
    const bmp = s.bitmapOf(s.activeLayerId)
    expect(bmp.get(1, 1)).toBe(RED)
    expect(bmp.get(4, 1)).toBe(RED)
    expect(s.history.entries).toHaveLength(1)
    s.undo()
    expect(bmp.isEmpty()).toBe(true)
    s.redo()
    expect(bmp.get(3, 1)).toBe(RED)
  })

  it('el lápiz pixel-perfect elimina las esquinas en L', () => {
    const s = DocumentSession.create(8, 8)
    pencil(s, RED, [
      [0, 0],
      [1, 0],
      [1, 1]
    ])
    const bmp = s.bitmapOf(s.activeLayerId)
    expect(bmp.get(1, 0)).toBe(0)
    expect(bmp.get(0, 0)).toBe(RED)
    expect(bmp.get(1, 1)).toBe(RED)
  })

  it('el lápiz respeta bloquear transparencia', () => {
    const s = DocumentSession.create(4, 4)
    pencil(s, RED, [[0, 0]])
    s.setLayerProps(s.activeLayerId, { lockAlpha: true })
    pencil(s, BLUE, [
      [0, 0],
      [1, 0]
    ])
    const bmp = s.bitmapOf(s.activeLayerId)
    expect(bmp.get(0, 0)).toBe(BLUE)
    expect(bmp.get(1, 0)).toBe(0)
  })

  it('deshacer 100 pasos y rehacerlos reproduce el mismo estado', () => {
    const s = DocumentSession.create(32, 32)
    for (let i = 0; i < 100; i++) pencil(s, rgba(i, 255 - i, 7), [[i % 32, Math.floor(i / 32)]])
    const final = s.bitmapOf(s.activeLayerId).data.slice()
    expect(s.history.entries).toHaveLength(100)
    for (let i = 0; i < 100; i++) s.undo()
    expect(s.bitmapOf(s.activeLayerId).isEmpty()).toBe(true)
    for (let i = 0; i < 100; i++) s.redo()
    expect(s.bitmapOf(s.activeLayerId).data).toEqual(final)
  })

  it('el bote rellena contiguo y respeta la selección', () => {
    const s = DocumentSession.create(6, 6)
    selectRect(s, { x: 0, y: 0, w: 3, h: 6 })
    expect(bucketFill(s, 1, 1, RED, { tolerance: 0, contiguous: true, sampleAll: false })).toBe(
      true
    )
    const bmp = s.bitmapOf(s.activeLayerId)
    expect(bmp.get(2, 5)).toBe(RED)
    expect(bmp.get(3, 5)).toBe(0)
  })

  it('no permite eliminar la última capa y fusiona cambios de opacidad', () => {
    const s = DocumentSession.create(4, 4)
    expect(s.deleteLayer(s.activeLayerId)).toBe(false)
    const l2 = s.addLayer()!
    const n = s.history.entries.length
    s.setLayerProps(l2.id, { opacity: 0.8 })
    s.setLayerProps(l2.id, { opacity: 0.5 })
    expect(s.history.entries).toHaveLength(n + 1)
    s.undo()
    expect(s.activeLayer.opacity).toBe(1)
  })

  it('duplicar capa copia los píxeles con un ráster propio', () => {
    const s = DocumentSession.create(4, 4)
    pencil(s, RED, [[2, 2]])
    const copy = s.duplicateLayer(s.activeLayerId)!
    expect(s.bitmapOf(copy.id).get(2, 2)).toBe(RED)
    s.setActiveLayer(s.image.layers[0]!.id)
    pencil(s, BLUE, [[0, 0]])
    expect(s.bitmapOf(copy.id).get(0, 0)).toBe(0)
    s.undo()
    s.undo()
    expect(s.image.layers).toHaveLength(1)
  })

  it('mover píxeles levanta, desplaza y fija; deshacer lo restaura', () => {
    const s = DocumentSession.create(8, 8)
    pencil(s, RED, [[1, 1]])
    s.history.markSaved()
    selectRect(s, { x: 0, y: 0, w: 3, h: 3 })
    const mv = new SelectionMove(s, true)
    mv.moveBy(4, 2)
    mv.end()
    commitFloating(s)
    const bmp = s.bitmapOf(s.activeLayerId)
    expect(bmp.get(1, 1)).toBe(0)
    expect(bmp.get(5, 3)).toBe(RED)
    s.history.goTo(1)
    expect(bmp.get(1, 1)).toBe(RED)
    expect(bmp.get(5, 3)).toBe(0)
  })

  it('borrar con selección solo afecta a la región', () => {
    const s = DocumentSession.create(4, 4)
    s.bitmapOf(s.activeLayerId).data.fill(255)
    s.selection = { mask: PixelMask.rect(4, 4, { x: 1, y: 1, w: 2, h: 2 }), floating: null }
    deletePixels(s)
    const b = s.bitmapOf(s.activeLayerId)
    expect(b.get(1, 1)).toBe(0)
    expect(b.get(0, 0)).toBe(0xffffffff)
  })

  it('el historial detecta cambios sin guardar', () => {
    const s = DocumentSession.create(4, 4)
    expect(s.history.isDirty).toBe(false)
    pencil(s, RED, [[0, 0]])
    expect(s.history.isDirty).toBe(true)
    s.history.markSaved()
    expect(s.history.isDirty).toBe(false)
    s.undo()
    expect(s.history.isDirty).toBe(true)
    s.redo()
    expect(s.history.isDirty).toBe(false)
  })

  it('compone capas con opacidad y modos de fusión', () => {
    const s = DocumentSession.create(2, 1)
    s.bitmapOf(s.activeLayerId).set(0, 0, rgba(100, 100, 100))
    const top = s.addLayer()!
    s.bitmapOf(top.id).set(0, 0, rgba(255, 255, 255))
    s.setLayerProps(top.id, { opacity: 0.5 })
    const out = new Bitmap(2, 1)
    composeImage(s.image, s.rasters, out)
    expect(out.get(0, 0)).toBe(rgba(178, 178, 178))
  })
})
