import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addShape,
  alignShapes,
  color,
  distributeShapes,
  distributeSpacing,
  makeAppearance,
  makeEllipse,
  makeRect,
  shapeBounds
} from '@core/index'

const RED = color(255, 0, 0)
const rect = (x: number, y: number, w: number, h: number) =>
  makeRect(x, y, w, h, makeAppearance(RED, null))

function setup() {
  const s = DocumentSession.create(64, 64)
  const a = rect(4, 6, 10, 8)
  const b = rect(20, 10, 6, 12)
  const c = rect(40, 2, 8, 8)
  for (const sh of [a, b, c]) addShape(s, sh)
  return { s, a, b, c, ids: [a.id, b.id, c.id] }
}

describe('alinear y distribuir', () => {
  it('alinea a la izquierda, derecha y centros respecto a la selección', () => {
    const { s, a, b, c, ids } = setup()
    alignShapes(s, ids, 'left', 'selection')
    for (const sh of [a, b, c]) expect(shapeBounds(s, sh.id)!.x).toBe(4)
    alignShapes(s, ids, 'right', 'selection')
    for (const sh of [a, b, c]) {
      const bb = shapeBounds(s, sh.id)!
      expect(bb.x + bb.w).toBe(14)
    }
    alignShapes(s, ids, 'centerV', 'selection')
    const cs = [a, b, c].map((sh) => {
      const bb = shapeBounds(s, sh.id)!
      return bb.y + bb.h / 2
    })
    // el redondeo entero deja como mucho medio píxel de diferencia
    expect(Math.max(...cs) - Math.min(...cs)).toBeLessThanOrEqual(0.5)
  })

  it('un paso de historial por operación y se deshace', () => {
    const { s, ids, a } = setup()
    const n = s.history.entries.length
    alignShapes(s, ids, 'top', 'selection')
    expect(s.history.entries.length).toBe(n + 1)
    s.undo()
    expect(shapeBounds(s, a.id)!.y).toBe(6)
  })

  it('al lienzo y al objeto clave (que no se mueve)', () => {
    const { s, a, b, c, ids } = setup()
    alignShapes(s, [a.id], 'centerH', 'canvas')
    const ba = shapeBounds(s, a.id)!
    expect(ba.x + ba.w / 2).toBe(32)
    alignShapes(s, ids, 'bottom', 'key', c.id)
    const bc = shapeBounds(s, c.id)!
    expect(bc.y).toBe(2)
    expect(shapeBounds(s, b.id)!.y + shapeBounds(s, b.id)!.h).toBe(10)
  })

  it('distribuye por centros con extremos fijos', () => {
    const { s, a, b, c, ids } = setup()
    const before = [shapeBounds(s, a.id)!, shapeBounds(s, c.id)!]
    distributeShapes(s, ids, 'h', 'center')
    expect(shapeBounds(s, a.id)!.x).toBe(before[0]!.x)
    expect(shapeBounds(s, c.id)!.x).toBe(before[1]!.x)
    const centre = (id: string) => shapeBounds(s, id)!.x + shapeBounds(s, id)!.w / 2
    expect(
      Math.abs(centre(b.id) - centre(a.id) - (centre(c.id) - centre(b.id)))
    ).toBeLessThanOrEqual(1)
  })

  it('espaciado fijo en píxeles entre bordes', () => {
    const { s, a, b, c, ids } = setup()
    distributeSpacing(s, ids, 'h', 5)
    const A = shapeBounds(s, a.id)!
    const B = shapeBounds(s, b.id)!
    const C = shapeBounds(s, c.id)!
    expect(B.x - (A.x + A.w)).toBe(5)
    expect(C.x - (B.x + B.w)).toBe(5)
  })

  it('usa los píxeles visibles: una elipse de 9×9 se alinea por su caja real', () => {
    const s = DocumentSession.create(32, 32)
    const e = makeEllipse(10.5, 10.5, 4.5, 4.5, makeAppearance(RED, null))
    const r = rect(20, 4, 6, 6)
    addShape(s, e)
    addShape(s, r)
    alignShapes(s, [e.id, r.id], 'left', 'selection')
    expect(shapeBounds(s, e.id)!.x).toBe(shapeBounds(s, r.id)!.x)
  })

  it('con menos formas de las necesarias no hace nada', () => {
    const { s, a } = setup()
    expect(alignShapes(s, [a.id], 'left', 'selection')).toBe(false)
    expect(distributeShapes(s, [a.id], 'h', 'center')).toBe(false)
  })
})
