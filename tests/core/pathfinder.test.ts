import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addShape,
  color,
  getShape,
  makeAppearance,
  makeRect,
  pathfinder,
  renderShape,
  type PathShape
} from '@core/index'

const RED = color(255, 0, 0)
const BLUE = color(0, 0, 255)

function setup() {
  const s = DocumentSession.create(40, 40)
  // dos cuadrados de 10×10 que se solapan en un 5×5 (el B está delante)
  const a = makeRect(5, 5, 10, 10, makeAppearance(RED, null))
  const b = makeRect(10, 10, 10, 10, makeAppearance(BLUE, null))
  addShape(s, a)
  addShape(s, b)
  return { s, a, b }
}

const pixels = (s: DocumentSession, id: string): number => {
  const r = renderShape(getShape(s, id)!, s.image.width, s.image.height)
  let n = 0
  if (r) for (let i = 3; i < r.data.length; i += 4) if (r.data[i]) n++
  return n
}

describe('Buscatrazos', () => {
  it('unir: área de la unión, una sola forma con la apariencia de la frontal', () => {
    const { s, a, b } = setup()
    const id = pathfinder(s, [a.id, b.id], 'unite')!
    expect(pixels(s, id)).toBe(100 + 100 - 25)
    expect(getShape(s, a.id)).toBeFalsy()
    expect(getShape(s, b.id)).toBeFalsy()
    const out = getShape(s, id) as PathShape
    expect(out.appearance.fills[0]!.paint).toMatchObject({ type: 'solid', color: BLUE })
  })

  it('restar la frontal: deja la de atrás menos el solape y conserva su apariencia', () => {
    const { s, a, b } = setup()
    const id = pathfinder(s, [a.id, b.id], 'minusFront')!
    expect(pixels(s, id)).toBe(100 - 25)
    expect((getShape(s, id) as PathShape).appearance.fills[0]!.paint).toMatchObject({ color: RED })
  })

  it('intersecar: sólo el solape', () => {
    const { s, a, b } = setup()
    const id = pathfinder(s, [a.id, b.id], 'intersect')!
    expect(pixels(s, id)).toBe(25)
  })

  it('excluir: todo menos el solape (deja un hueco)', () => {
    const { s, a, b } = setup()
    const id = pathfinder(s, [a.id, b.id], 'exclude')!
    expect(pixels(s, id)).toBe(100 + 100 - 2 * 25)
  })

  it('bordes coincidentes: dos cuadrados contiguos se unen en un rectángulo', () => {
    const s = DocumentSession.create(40, 40)
    const a = makeRect(5, 5, 10, 10, makeAppearance(RED, null))
    const b = makeRect(15, 5, 10, 10, makeAppearance(RED, null))
    addShape(s, a)
    addShape(s, b)
    const id = pathfinder(s, [a.id, b.id], 'unite')!
    expect(pixels(s, id)).toBe(200)
    expect((getShape(s, id) as PathShape).subpaths).toHaveLength(1)
  })

  it('intersección vacía elimina las formas; todo es deshacible', () => {
    const s = DocumentSession.create(40, 40)
    const a = makeRect(0, 0, 5, 5, makeAppearance(RED, null))
    const b = makeRect(20, 20, 5, 5, makeAppearance(BLUE, null))
    addShape(s, a)
    addShape(s, b)
    expect(pathfinder(s, [a.id, b.id], 'intersect')).toBeNull()
    expect(getShape(s, a.id)).toBeFalsy()
    s.undo()
    expect(getShape(s, a.id)).toBeTruthy()
    expect(getShape(s, b.id)).toBeTruthy()
  })

  it('con una sola forma no hace nada', () => {
    const { s, a } = setup()
    expect(pathfinder(s, [a.id], 'unite')).toBeNull()
    expect(getShape(s, a.id)).toBeTruthy()
  })
})
