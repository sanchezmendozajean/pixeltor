import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addImage,
  addShape,
  color,
  deleteImages,
  duplicateImages,
  makeAppearance,
  makeRect,
  moveImage,
  renameImage,
  reverseImages,
  setActiveImage,
  setImageDuration,
  setImageIncluded,
  totalDuration
} from '@core/index'

const names = (s: DocumentSession) => s.doc.images.map((i) => i.name)

function setup() {
  const s = DocumentSession.create(16, 16)
  s.bitmapOf(s.activeLayer.id).set(2, 2, 0xff0000ff)
  addShape(s, makeRect(4, 4, 4, 4, makeAppearance(color(0, 255, 0), null)))
  return s
}

describe('varias imágenes', () => {
  it('duplicar copia píxeles y formas con ids nuevos; vacía deja las mismas capas sin contenido', () => {
    const s = setup()
    const first = s.activeImageId
    const dup = addImage(s, 'duplicate')!
    expect(s.activeImageId).toBe(dup)
    expect(s.doc.images).toHaveLength(2)
    expect(s.bitmapOf(s.activeLayer.id).get(2, 2)).toBe(0xff0000ff)
    expect(s.activeLayer.shapes).toHaveLength(1)
    expect(s.activeLayer.shapes[0]!.id).not.toBe(s.doc.images[0]!.layers[0]!.shapes[0]!.id)
    // editar la copia no toca el original
    s.bitmapOf(s.activeLayer.id).set(2, 2, 0)
    setActiveImage(s, first)
    expect(s.bitmapOf(s.activeLayer.id).get(2, 2)).toBe(0xff0000ff)

    const empty = addImage(s, 'empty')!
    expect(s.activeImageId).toBe(empty)
    expect(s.activeLayer.shapes).toHaveLength(0)
    expect(s.bitmapOf(s.activeLayer.id).get(2, 2)).toBe(0)
    expect(s.activeLayer.name).toBe(s.doc.images[0]!.layers[0]!.name)
  })

  it('todo es deshacible y rehacible', () => {
    const s = setup()
    addImage(s, 'duplicate')
    expect(s.doc.images).toHaveLength(2)
    s.undo()
    expect(s.doc.images).toHaveLength(1)
    s.redo()
    expect(s.doc.images).toHaveLength(2)
    expect(s.bitmapOf(s.activeLayer.id).get(2, 2)).toBe(0xff0000ff)
  })

  it('eliminar deja siempre una imagen y reordenar/invertir cambian el orden', () => {
    const s = setup()
    addImage(s, 'empty')
    addImage(s, 'empty')
    const [a, b, c] = s.doc.images.map((i) => i.id) as [string, string, string]
    expect(deleteImages(s, [a, b, c])).toBe(false)
    expect(moveImage(s, c, 0)).toBe(true)
    expect(s.doc.images.map((i) => i.id)).toEqual([c, a, b])
    expect(reverseImages(s, [c, a, b])).toBe(true)
    expect(s.doc.images.map((i) => i.id)).toEqual([b, a, c])
    expect(deleteImages(s, [a])).toBe(true)
    expect(s.doc.images.map((i) => i.id)).toEqual([b, c])
    s.undo()
    expect(s.doc.images).toHaveLength(3)
  })

  it('duración (acotada), excluir y total', () => {
    const s = setup()
    addImage(s, 'empty')
    const ids = s.doc.images.map((i) => i.id)
    expect(totalDuration(s)).toBe(200)
    setImageDuration(s, [ids[0]!], 250)
    setImageDuration(s, [ids[1]!], 1)
    expect(s.doc.images[1]!.durationMs).toBe(10)
    expect(totalDuration(s)).toBe(260)
    setImageIncluded(s, [ids[1]!], false)
    expect(totalDuration(s)).toBe(250)
    expect(renameImage(s, ids[0]!, 'Inicio')).toBe(true)
    expect(names(s)[0]).toBe('Inicio')
  })

  it('duplicar varias imágenes y cambiar de imagen conserva la capa por nombre', () => {
    const s = setup()
    s.addLayer('Sombras')
    addImage(s, 'duplicate')
    expect(s.activeLayer.name).toBe('Sombras')
    const copies = duplicateImages(
      s,
      s.doc.images.map((i) => i.id)
    )
    expect(copies).toHaveLength(2)
    expect(s.doc.images).toHaveLength(4)
    s.setActiveLayer(s.image.layers[0]!.id)
    setActiveImage(s, s.doc.images[0]!.id)
    expect(s.activeLayer.name).toBe('Capa 1')
  })
})
