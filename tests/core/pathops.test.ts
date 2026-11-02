import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  addShape,
  color,
  convertToPath,
  addMidAnchors,
  cutAtAnchors,
  joinAnchors,
  findSegment,
  SegmentDrag,
  replaceSubpath,
  reverseAnchors,
  AnchorDrag,
  AnchorPull,
  hitSegment,
  deleteAnchors,
  convertAnchors,
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

describe('edición de anclas', () => {
  const setup = () => {
    const s = DocumentSession.create(40, 40)
    const r = makeRect(5, 5, 20, 20, makeAppearance(RED, null))
    addShape(s, r)
    convertToPath(s, [r.id])
    return { s, id: r.id }
  }

  it('añadir puntos de ancla duplica las anclas sin cambiar el dibujo', () => {
    const { s, id } = setup()
    const before = count(s, id)
    expect(addMidAnchors(s, [id])).toBe(true)
    expect(path(s, id).subpaths[0]!.anchors).toHaveLength(8)
    expect(count(s, id)).toBe(before)
    s.undo()
    expect(path(s, id).subpaths[0]!.anchors).toHaveLength(4)
  })

  it('eliminar varias anclas en un paso y deshacer', () => {
    const { s, id } = setup()
    addMidAnchors(s, [id])
    const n = s.history.entries.length
    const refs = [1, 3, 5].map((index) => ({ shapeId: id, subpath: 0, index }))
    expect(deleteAnchors(s, refs)).toBe(true)
    expect(s.history.entries.length).toBe(n + 1)
    expect(path(s, id).subpaths[0]!.anchors).toHaveLength(5)
    s.undo()
    expect(path(s, id).subpaths[0]!.anchors).toHaveLength(8)
  })

  it('eliminar casi todas las anclas elimina la forma', () => {
    const { s, id } = setup()
    deleteAnchors(
      s,
      [0, 1, 2].map((index) => ({ shapeId: id, subpath: 0, index }))
    )
    expect(getShape(s, id)).toBeNull()
  })

  it('convertir anclas en suaves y de nuevo en esquina', () => {
    const { s, id } = setup()
    const refs = [0, 1, 2, 3].map((index) => ({ shapeId: id, subpath: 0, index }))
    expect(convertAnchors(s, refs, true)).toBe(true)
    expect(path(s, id).subpaths[0]!.anchors.every((a) => a.in && a.out)).toBe(true)
    convertAnchors(s, refs, false)
    expect(path(s, id).subpaths[0]!.anchors.every((a) => !a.in && !a.out)).toBe(true)
  })
})

describe('tiradores', () => {
  it('Alt: mover un tirador sin arrastrar al opuesto; sin Alt el opuesto lo refleja', () => {
    for (const independent of [false, true]) {
      const s = DocumentSession.create(40, 40)
      const r = makeRect(5, 5, 20, 20, makeAppearance(RED, null))
      addShape(s, r)
      convertToPath(s, [r.id])
      const ref = { shapeId: r.id, subpath: 0, index: 0 }
      convertAnchors(s, [ref], true)
      const a0 = path(s, r.id).subpaths[0]!.anchors[0]!
      const opp = { ...a0.in! }
      const d = new AnchorDrag(s, r.id, [{ subpath: 0, index: 0, part: 'out' }], independent)
      d.moveBy(0, 6)
      d.end()
      const a = path(s, r.id).subpaths[0]!.anchors[0]!
      if (independent) expect(a.in).toEqual(opp)
      else expect(a.in).not.toEqual(opp)
    }
  })

  it('sacar tiradores arrastrando un ancla de esquina', () => {
    const s = DocumentSession.create(40, 40)
    const r = makeRect(5, 5, 20, 20, makeAppearance(RED, null))
    addShape(s, r)
    convertToPath(s, [r.id])
    const pull = new AnchorPull(s, { shapeId: r.id, subpath: 0, index: 1 })
    pull.pullTo(35, 12)
    pull.end()
    const a = path(s, r.id).subpaths[0]!.anchors[1]!
    expect(a.out).toEqual({ x: 30.5, y: 7.5 }) // el tirador cae en el centro de un píxel
    // el rectángulo se convierte con las anclas en el centro de sus píxeles (el rectángulo se encoge medio píxel: ancla en x = 19,5)
    expect(a.in).toEqual({ x: 8.5, y: -6.5 })
    expect(hitSegment(s, r.id, 15, 25, 1)).toBe(true)
    expect(hitSegment(s, r.id, 15, 15, 1)).toBe(false)
    s.undo()
    expect(path(s, r.id).subpaths[0]!.anchors[1]!.out).toBeNull()
  })
})

describe('cortar, unir y curvar', () => {
  const rectPath = () => {
    const s = DocumentSession.create(40, 40)
    const r = makeRect(5, 5, 20, 20, makeAppearance(RED, null))
    addShape(s, r)
    convertToPath(s, [r.id])
    return { s, id: r.id }
  }

  it('cortar un trazado cerrado en una ancla lo deja abierto; en dos, en dos piezas', () => {
    const { s, id } = rectPath()
    expect(cutAtAnchors(s, [{ shapeId: id, subpath: 0, index: 0 }])).toBe(true)
    let p = path(s, id)
    expect(p.subpaths[0]!.closed).toBe(false)
    expect(p.subpaths[0]!.anchors).toHaveLength(5) // 4 + duplicada
    s.undo()
    expect(path(s, id).subpaths[0]!.closed).toBe(true)
    cutAtAnchors(s, [
      { shapeId: id, subpath: 0, index: 0 },
      { shapeId: id, subpath: 0, index: 2 }
    ])
    expect(s.activeLayer.shapes).toHaveLength(2)
    p = s.activeLayer.shapes[0] as PathShape
    expect(p.subpaths[0]!.anchors).toHaveLength(3)
  })

  it('unir los extremos de un trazado abierto lo cierra, y unir dos trazados los funde', () => {
    const { s, id } = rectPath()
    cutAtAnchors(s, [{ shapeId: id, subpath: 0, index: 0 }])
    // los extremos coinciden: unir fusiona y cierra con 4 anclas
    expect(
      joinAnchors(s, [
        { shapeId: id, subpath: 0, index: 0 },
        { shapeId: id, subpath: 0, index: 4 }
      ])
    ).toBe(true)
    expect(path(s, id).subpaths[0]!.closed).toBe(true)
    expect(path(s, id).subpaths[0]!.anchors).toHaveLength(4)

    // dos formas abiertas distintas
    const t = DocumentSession.create(40, 40)
    const a = makeLine({ x: 2, y: 2 }, { x: 10, y: 2 }, makeAppearance(null, RED, 1))
    const b = makeLine({ x: 20, y: 2 }, { x: 30, y: 2 }, makeAppearance(null, RED, 1))
    addShape(t, a)
    addShape(t, b)
    convertToPath(t, [a.id, b.id])
    expect(
      joinAnchors(t, [
        { shapeId: a.id, subpath: 0, index: 1 },
        { shapeId: b.id, subpath: 0, index: 0 }
      ])
    ).toBe(true)
    expect(t.activeLayer.shapes).toHaveLength(1)
    expect((t.activeLayer.shapes[0] as PathShape).subpaths[0]!.anchors).toHaveLength(4)
    t.undo()
    expect(t.activeLayer.shapes).toHaveLength(2)
  })

  it('curvar un segmento mueve los tiradores y deja las anclas', () => {
    const { s, id } = rectPath()
    const hit = findSegment(s, id, 15, 5, 1)!
    expect(hit.index).toBe(0)
    const before = path(s, id).subpaths[0]!.anchors.map((a) => ({ ...a.p }))
    const d = new SegmentDrag(s, id, hit)
    d.moveBy(0, 6)
    d.end()
    const a = path(s, id).subpaths[0]!
    expect(a.anchors.map((x) => x.p)).toEqual(before)
    expect(a.anchors[0]!.out).not.toBeNull()
    expect(a.anchors[1]!.in).not.toBeNull()
    // el segmento superior se ha hundido hacia abajo
    expect(a.anchors[0]!.out!.y).toBeGreaterThan(0)
  })

  it('continuar un trazado abierto sustituye su subtrazado', () => {
    const s = DocumentSession.create(40, 40)
    const l = makeLine({ x: 2, y: 2 }, { x: 10, y: 2 }, makeAppearance(null, RED, 1))
    addShape(s, l)
    convertToPath(s, [l.id])
    const base = path(s, l.id).subpaths[0]!.anchors
    const more = [...base, { p: { x: 10, y: 12 }, in: null, out: null, type: 'corner' as const }]
    expect(replaceSubpath(s, l.id, 0, more, false)).toBe(true)
    expect(path(s, l.id).subpaths[0]!.anchors).toHaveLength(3)
    expect(reverseAnchors(more)[0]!.p).toEqual({ x: 10, y: 12 })
  })
})
