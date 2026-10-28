import { describe, expect, it } from 'vitest'
import {
  AnchorDrag,
  Bitmap,
  DocumentSession,
  ShapeScale,
  addAnchorAt,
  addShape,
  color,
  composeImage,
  convertAnchor,
  convertToPath,
  deleteAnchor,
  getShape,
  makeAppearance,
  makeEllipse,
  makePolygon,
  makeRect,
  makeStar,
  renderShape,
  shapesBox,
  type PathShape
} from '@core/index'

const RED = color(255, 0, 0)
const render = (s: DocumentSession) => {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out)
  return out
}

describe('convertir en trazado', () => {
  it('rectángulo, polígono y estrella conservan los píxeles', () => {
    for (const make of [
      () => makeRect(3, 4, 12, 9, makeAppearance(RED, null)),
      () => makePolygon(16, 16, 10, 6, makeAppearance(RED, null)),
      () => makeStar(16, 16, 12, 5, 5, makeAppearance(RED, null))
    ]) {
      const s = DocumentSession.create(32, 32)
      const sh = make()
      addShape(s, sh)
      const before = render(s).data.slice()
      expect(convertToPath(s, [sh.id])).toBe(true)
      expect(getShape(s, sh.id)!.kind).toBe('path')
      expect(render(s).data).toEqual(before)
      s.undo()
      expect(getShape(s, sh.id)!.kind).not.toBe('path')
    }
  })

  it('el rectángulo redondeado y la elipse se convierten a Bézier (aproximado)', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(2, 2, 20, 20, makeAppearance(RED, null))
    r.radius = [6, 6, 6, 6]
    addShape(s, r)
    const before = render(s).data.slice()
    convertToPath(s, [r.id])
    const after = render(s).data
    let diff = 0
    for (let i = 3; i < after.length; i += 4) if (!!after[i] !== !!before[i]) diff++
    expect(diff).toBeLessThan(12)
    const e = makeEllipse(16, 16, 8, 8, makeAppearance(RED, null))
    addShape(s, e)
    expect(convertToPath(s, [e.id])).toBe(true)
    expect((getShape(s, e.id) as PathShape).subpaths[0]!.anchors).toHaveLength(4)
  })
})

describe('anclas', () => {
  function triangle() {
    const s = DocumentSession.create(32, 32)
    const p = makePolygon(16, 16, 10, 3, makeAppearance(RED, null))
    addShape(s, p)
    convertToPath(s, [p.id])
    return { s, id: p.id }
  }

  it('mover un ancla es un único paso y se deshace', () => {
    const { s, id } = triangle()
    const n = s.history.entries.length
    const d = new AnchorDrag(s, id, [{ subpath: 0, index: 0, part: 'p' }])
    d.moveBy(2, 0)
    d.moveBy(4, 0)
    d.end()
    expect(s.history.entries.length).toBe(n + 1)
    const sh = getShape(s, id) as PathShape
    expect(sh.subpaths[0]!.anchors[0]!.p.x).toBeCloseTo(4)
    s.undo()
    expect((getShape(s, id) as PathShape).subpaths[0]!.anchors[0]!.p.x).toBeCloseTo(0)
  })

  it('editar un ancla de una forma paramétrica la convierte a trazado', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(2, 2, 10, 10, makeAppearance(RED, null))
    addShape(s, r)
    new AnchorDrag(s, r.id, [{ subpath: 0, index: 1, part: 'p' }]).end()
    expect(getShape(s, r.id)!.kind).toBe('path')
    s.undo()
    expect(getShape(s, r.id)!.kind).toBe('rect')
  })

  it('añadir ancla sobre un segmento, convertir y eliminar', () => {
    const { s, id } = triangle()
    const sh = getShape(s, id) as PathShape
    const a = sh.subpaths[0]!.anchors[0]!.p
    const b = sh.subpaths[0]!.anchors[1]!.p
    const mid = { x: (a.x + b.x) / 2 + sh.transform[4], y: (a.y + b.y) / 2 + sh.transform[5] }
    expect(addAnchorAt(s, id, mid.x, mid.y)).toBe(true)
    expect((getShape(s, id) as PathShape).subpaths[0]!.anchors).toHaveLength(4)
    expect(addAnchorAt(s, id, 0, 0)).toBe(false)
    expect(convertAnchor(s, { shapeId: id, subpath: 0, index: 1 }, true)).toBe(true)
    expect((getShape(s, id) as PathShape).subpaths[0]!.anchors[1]!.out).not.toBeNull()
    convertAnchor(s, { shapeId: id, subpath: 0, index: 1 }, false)
    expect((getShape(s, id) as PathShape).subpaths[0]!.anchors[1]!.out).toBeNull()
    expect(deleteAnchor(s, { shapeId: id, subpath: 0, index: 1 })).toBe(true)
    expect((getShape(s, id) as PathShape).subpaths[0]!.anchors).toHaveLength(3)
  })
})

describe('escalado con la caja', () => {
  it('un rectángulo escalado sigue siendo rectángulo con sus parámetros', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 8, 6, makeAppearance(RED, null))
    addShape(s, r)
    const box = shapesBox(s, [r.id])!
    const sc = new ShapeScale(s, [r.id], box)
    sc.scaleBy({ x: box.x, y: box.y }, 2, 2)
    sc.scaleBy({ x: box.x, y: box.y }, 3, 2)
    sc.end()
    const sh = getShape(s, r.id)!
    expect(sh.kind).toBe('rect')
    if (sh.kind === 'rect') {
      expect(sh.w).toBe(24)
      expect(sh.h).toBe(12)
      expect(sh.transform[4]).toBe(4)
    }
    s.undo()
    const back = getShape(s, r.id)!
    if (back.kind === 'rect') expect(back.w).toBe(8)
  })

  it('escalar con factor negativo voltea respecto al punto fijo', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 8, 6, makeAppearance(RED, null))
    addShape(s, r)
    const sc = new ShapeScale(s, [r.id], shapesBox(s, [r.id])!)
    sc.scaleBy({ x: 12, y: 4 }, -1, 1)
    sc.end()
    const sh = getShape(s, r.id)!
    expect(sh.transform[4]).toBe(12)
  })

  it('renderiza igual tras escalar 1:1', () => {
    const s = DocumentSession.create(32, 32)
    const e = makeEllipse(16, 16, 6, 5, makeAppearance(RED, null))
    addShape(s, e)
    const before = renderShape(e, 32, 32).data.slice()
    const sc = new ShapeScale(s, [e.id], shapesBox(s, [e.id])!)
    sc.scaleBy({ x: 10, y: 11 }, 1, 1)
    sc.end()
    expect(renderShape(getShape(s, e.id)!, 32, 32).data).toEqual(before)
  })
})
