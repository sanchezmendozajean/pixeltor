import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addShape,
  color,
  makeAppearance,
  makeRect,
  reorderShapes
} from '@core/index'

function setup() {
  const s = DocumentSession.create(32, 32)
  const [a, b, c] = [0, 1, 2].map((i) =>
    makeRect(i, i, 4, 4, makeAppearance(color(255, 0, 0), null))
  )
  for (const sh of [a!, b!, c!]) addShape(s, sh)
  return { s, a: a!, b: b!, c: c! }
}
const ids = (s: DocumentSession) => s.activeLayer.shapes.map((x) => x.id)

describe('reordenar formas desde el panel Capas', () => {
  it('encima y debajo del destino, y se deshace', () => {
    const { s, a, b, c } = setup()
    expect(reorderShapes(s, [a.id], c.id, 'above')).toBe(true)
    expect(ids(s)).toEqual([b.id, c.id, a.id])
    expect(reorderShapes(s, [a.id], b.id, 'below')).toBe(true)
    expect(ids(s)).toEqual([a.id, b.id, c.id])
    s.undo()
    expect(ids(s)).toEqual([b.id, c.id, a.id])
  })

  it('varias formas conservan su orden relativo', () => {
    const { s, a, b, c } = setup()
    reorderShapes(s, [c.id, a.id], b.id, 'below')
    expect(ids(s)).toEqual([a.id, c.id, b.id])
  })

  it('una capa bloqueada no se reordena', () => {
    const { s, a, c } = setup()
    s.activeLayer.locked = true
    expect(reorderShapes(s, [a.id], c.id, 'above')).toBe(false)
  })
})
