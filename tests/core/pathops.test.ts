import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addShape,
  color,
  convertToPath,
  flattenSubpath,
  getShape,
  makeAppearance,
  makeRect,
  makeStar,
  makeLine,
  makeCompound,
  offsetPaths,
  offsetPolygon,
  outlineStroke,
  releaseCompound,
  renderShape,
  simplifyPaths,
  type PathShape
} from '@core/index'

const RED = color(255, 0, 0)
const count = (s: DocumentSession, id: string) => {
  const sh = getShape(s, id)!
  const r = renderShape(sh, s.image.width, s.image.height)
  let n = 0
  if (r) for (let i = 3; i < r.data.length; i += 4) if (r.data[i]) n++
  return n
}
const path = (s: DocumentSession, id: string) => getShape(s, id) as PathShape

describe('operaciones de trazado', () => {
  it('offsetPolygon expande y contrae un cuadrado', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    const out = offsetPolygon(sq, 2)
    expect(out.map((p) => [p.x, p.y])).toEqual([
      [-2, -2],
      [12, -2],
      [12, 12],
      [-2, 12]
    ])
    // misma orientación inversa
    const inn = offsetPolygon([...sq].reverse(), -2)
    expect(Math.min(...inn.map((p) => p.x))).toBe(2)
    expect(Math.max(...inn.map((p) => p.x))).toBe(8)
  })

  it('expandir un rectángulo aumenta sus píxeles y se deshace', () => {
    const s = DocumentSession.create(40, 40)
    const r = makeRect(10, 10, 10, 10, makeAppearance(RED, null))
    addShape(s, r)
    const before = count(s, r.id)
    expect(offsetPaths(s, [r.id], 2)).toBe(true)
    expect(count(s, r.id)).toBe(14 * 14)
    expect(before).toBe(100)
    s.undo()
    expect(getShape(s, r.id)!.kind).toBe('rect')
  })

  it('simplificar reduce las anclas de un círculo aplanado', () => {
    const s = DocumentSession.create(64, 64)
    const star = makeStar(32, 32, 20, 10, 12, makeAppearance(RED, null))
    addShape(s, star)
    convertToPath(s, [star.id])
    const n0 = path(s, star.id).subpaths[0]!.anchors.length
    simplifyPaths(s, [star.id], 0.5)
    expect(path(s, star.id).subpaths[0]!.anchors.length).toBeLessThanOrEqual(n0)
    // un polígono con puntos colineales pierde los intermedios
    const s2 = DocumentSession.create(32, 32)
    const l = makeRect(2, 2, 10, 10, makeAppearance(RED, null))
    addShape(s2, l)
    convertToPath(s2, [l.id])
    const p = path(s2, l.id)
    const a = p.subpaths[0]!.anchors
    a.splice(1, 0, { p: { x: 5, y: 0 }, in: null, out: null, type: 'corner' })
    simplifyPaths(s2, [l.id], 0.5)
    expect(path(s2, l.id).subpaths[0]!.anchors).toHaveLength(4)
  })

  it('compuesto: un anillo con hueco y liberar vuelve a separar', () => {
    const s = DocumentSession.create(40, 40)
    const a = makeRect(5, 5, 20, 20, makeAppearance(RED, null))
    const b = makeRect(10, 10, 10, 10, makeAppearance(RED, null))
    addShape(s, a)
    addShape(s, b)
    const id = makeCompound(s, [a.id, b.id])!
    expect(path(s, id).subpaths).toHaveLength(2)
    expect(count(s, id)).toBe(400 - 100)
    expect(releaseCompound(s, [id])).toBe(true)
    expect(s.activeLayer.shapes).toHaveLength(2)
    s.undo()
    expect(s.activeLayer.shapes).toHaveLength(1)
    s.undo()
    expect(s.activeLayer.shapes).toHaveLength(2)
  })

  it('contorno de trazo: un rectángulo con trazo centrado de 2 px da un anillo', () => {
    const s = DocumentSession.create(40, 40)
    const r = makeRect(10, 10, 20, 20, makeAppearance(null, RED, 2))
    addShape(s, r)
    const id = r.id
    expect(outlineStroke(s, [id])).toBe(true)
    const sh = path(s, id)
    expect(sh.appearance.strokes).toHaveLength(0)
    expect(sh.appearance.fills).toHaveLength(1)
    // anillo de 2 px de ancho: 22² − 18² = 160
    expect(count(s, id)).toBe(160)
  })

  it('contorno de trazo de una línea abierta', () => {
    const s = DocumentSession.create(40, 40)
    const l = makeLine({ x: 5, y: 20 }, { x: 35, y: 20 }, makeAppearance(null, RED, 4))
    addShape(s, l)
    expect(outlineStroke(s, [l.id])).toBe(true)
    expect(count(s, l.id)).toBe(30 * 4)
    expect(flattenSubpath(path(s, l.id).subpaths[0]!).closed).toBe(true)
  })
})
