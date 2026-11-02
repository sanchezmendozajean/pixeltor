import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  ShapeRotate,
  addShape,
  color,
  getShape,
  makeAppearance,
  makeRect,
  moveShapesToLayer,
  shapesBox
} from '@core/index'

const RED = color(255, 0, 0)

describe('rotar y mover entre capas', () => {
  it('girar 90° un rectángulo mantiene su centro, sigue siendo rectángulo y se deshace', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 10, 12, 4, makeAppearance(RED, null))
    addShape(s, r)
    const box = shapesBox(s, [r.id])!
    const rot = new ShapeRotate(s, [r.id], box)
    rot.rotateTo(Math.PI / 2)
    rot.end()
    const sh = getShape(s, r.id)!
    expect(sh.kind).toBe('rect')
    const b = shapesBox(s, [r.id])!
    expect(b.x + b.w / 2).toBeCloseTo(10)
    expect(b.y + b.h / 2).toBeCloseTo(12)
    expect(b.w).toBeCloseTo(4)
    expect(b.h).toBeCloseTo(12)
    s.undo()
    expect(shapesBox(s, [r.id])!.w).toBeCloseTo(12)
  })

  it('mover formas a otra capa las quita de la origen y se deshace', () => {
    const s = DocumentSession.create(16, 16)
    const r = makeRect(1, 1, 4, 4, makeAppearance(RED, null))
    addShape(s, r)
    const l1 = s.activeLayerId
    const l2 = s.addLayer()!
    expect(moveShapesToLayer(s, [r.id], l2.id)).toBe(true)
    expect(s.image.layers.find((l) => l.id === l1)!.shapes).toHaveLength(0)
    expect(s.image.layers.find((l) => l.id === l2.id)!.shapes).toHaveLength(1)
    s.undo()
    expect(s.image.layers.find((l) => l.id === l1)!.shapes).toHaveLength(1)
  })
})

describe('widget de radio', () => {
  it('arrastrar el widget redondea todas las esquinas y Alt solo una; se deshace', async () => {
    const { RectRadiusDrag, getShape: get } = await import('@core/index')
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 20, 20, makeAppearance(RED, null))
    addShape(s, r)
    const d = new RectRadiusDrag(s, r.id)
    d.moveTo(4 + 6, 4 + 6)
    d.end()
    const a = get(s, r.id)!
    expect(a.kind === 'rect' && a.radius).toEqual([6, 6, 6, 6])
    const d2 = new RectRadiusDrag(s, r.id)
    d2.moveTo(4 + 99, 4 + 99, true)
    d2.end()
    const b = get(s, r.id)!
    expect(b.kind === 'rect' && b.radius).toEqual([10, 6, 6, 6])
    s.undo()
    s.undo()
    const c = get(s, r.id)!
    expect(c.kind === 'rect' && c.radius).toEqual([0, 0, 0, 0])
  })
})

describe('posición del tirador de radio', () => {
  it('queda dentro de la forma aunque sea pequeña y llega al arco con el radio máximo', async () => {
    const { radiusHandleT } = await import('@core/index')
    // forma de 6 px: radio máximo 3; el desplazamiento de 20 px de pantalla no debe sacarlo
    expect(radiusHandleT(0, 3, 20)).toBeCloseTo(1.5)
    expect(radiusHandleT(3, 3, 20)).toBeCloseTo(3)
    expect(radiusHandleT(1.5, 3, 20)).toBeGreaterThan(radiusHandleT(0, 3, 20))
    // forma grande: parte a la distancia indicada
    expect(radiusHandleT(0, 40, 6)).toBeCloseTo(6)
    expect(radiusHandleT(40, 40, 6)).toBeCloseTo(40)
  })
})
