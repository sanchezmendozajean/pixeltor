import { describe, expect, it } from 'vitest'
import {
  AnchorDrag,
  Bitmap,
  DocumentSession,
  ShapeScale,
  addAnchorAt,
  addMidAnchors,
  centerAnchors,
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
    expect(diff).toBeLessThan(30)
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
    // el ancla acaba en el centro de un píxel: 0 + 4 → 4,5
    expect(sh.subpaths[0]!.anchors[0]!.p.x).toBeCloseTo(4.5)
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

describe('anclas en el centro de los píxeles', () => {
  function triangle() {
    const s = DocumentSession.create(32, 32)
    const p = makePolygon(16, 16, 10, 3, makeAppearance(RED, null))
    addShape(s, p)
    convertToPath(s, [p.id])
    return { s, id: p.id }
  }

  const frac = (v: number) => Math.abs(v - Math.floor(v) - 0.5)
  const allCentered = (sh: PathShape) =>
    sh.subpaths.every((sp) => sp.anchors.every((a) => frac(a.p.x) < 1e-9 && frac(a.p.y) < 1e-9))

  it('arrastrar un ancla (también con desplazamientos fraccionarios) la deja en un centro', () => {
    const { s, id } = triangle()
    for (const [dx, dy] of [
      [3, 5],
      [0.3, -0.4],
      [-7, 2]
    ] as const) {
      const d = new AnchorDrag(s, id, [{ subpath: 0, index: 1, part: 'p' }])
      d.moveBy(dx, dy)
      d.end()
      const a = (getShape(s, id) as PathShape).subpaths[0]!.anchors[1]!
      expect(frac(a.p.x)).toBeLessThan(1e-9)
      expect(frac(a.p.y)).toBeLessThan(1e-9)
    }
  })

  it('los tiradores acompañan al ancla al centrarla', () => {
    const { s, id } = triangle()
    const sh = getShape(s, id) as PathShape
    const a0 = sh.subpaths[0]!.anchors[0]!
    a0.out = { x: a0.p.x + 5, y: a0.p.y }
    const d = new AnchorDrag(s, id, [{ subpath: 0, index: 0, part: 'p' }])
    d.moveBy(2, 3)
    d.end()
    const a = (getShape(s, id) as PathShape).subpaths[0]!.anchors[0]!
    expect(a.out!.x - a.p.x).toBeCloseTo(5) // la longitud del tirador no cambia
    expect(a.out!.y - a.p.y).toBeCloseTo(0)
  })

  it('añadir un ancla sobre un segmento (o puntos medios) crea anclas en centros', () => {
    const { s, id } = triangle()
    const sh = getShape(s, id) as PathShape
    const a0 = sh.subpaths[0]!.anchors[0]!
    const a1 = sh.subpaths[0]!.anchors[1]!
    expect(
      addAnchorAt(
        s,
        id,
        (a0.p.x + a1.p.x) / 2 + sh.transform[4],
        (a0.p.y + a1.p.y) / 2 + sh.transform[5],
        4
      )
    ).toBe(true)
    const after = getShape(s, id) as PathShape
    // sólo la nueva (índice 1) tiene que estar centrada
    expect(frac(after.subpaths[0]!.anchors[1]!.p.x)).toBeLessThan(1e-9)
    expect(frac(after.subpaths[0]!.anchors[1]!.p.y)).toBeLessThan(1e-9)
    centerAnchors(s, [id])
    expect(addMidAnchors(s, [id])).toBe(true)
    expect(allCentered(getShape(s, id) as PathShape)).toBe(true)
  })

  it('añadir un ancla con la pluma centra también las anclas que ya había (rect redondeado)', () => {
    const s = DocumentSession.create(64, 64)
    const r = makeRect(7, 9, 26, 20, makeAppearance(RED, null))
    r.radius = [4, 4, 4, 4]
    addShape(s, r)
    expect(addAnchorAt(s, r.id, 20, 9, 4)).toBe(true)
    expect(allCentered(getShape(s, r.id) as PathShape)).toBe(true)
    s.undo()
    expect(getShape(s, r.id)!.kind).toBe('rect')
  })

  it('«centrar anclas» arregla formas con anclas entre píxeles, es un paso y se deshace', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 10, 10, makeAppearance(RED, null))
    addShape(s, r)
    const n = s.history.entries.length
    expect(centerAnchors(s, [r.id])).toBe(true)
    expect(s.history.entries.length).toBe(n + 1)
    expect(allCentered(getShape(s, r.id) as PathShape)).toBe(true)
    expect(centerAnchors(s, [r.id])).toBe(false) // ya están centradas
    s.undo()
    expect(getShape(s, r.id)!.kind).toBe('rect')
  })
})

describe('convertir un rectángulo en trazado', () => {
  const pixels = (s: DocumentSession, id: string): string => {
    const r = renderShape(getShape(s, id)!, s.image.width, s.image.height)
    return r ? [...r.data].filter((_, i) => i % 4 === 3).map((v) => (v ? 1 : 0)).join('') : ''
  }

  it('lleva las anclas al centro de los píxeles sin cambiar el relleno', () => {
    for (const stroke of [null, color(0, 0, 255)]) {
      const s = DocumentSession.create(64, 64)
      const r = makeRect(7, 9, 26, 20, makeAppearance(RED, stroke))
      addShape(s, r)
      const before = pixels(s, r.id)
      convertToPath(s, [r.id])
      const sh = getShape(s, r.id) as PathShape
      for (const a of sh.subpaths[0]!.anchors) {
        expect(a.p.x - Math.floor(a.p.x)).toBeCloseTo(0.5)
        expect(a.p.y - Math.floor(a.p.y)).toBeCloseTo(0.5)
      }
      // el relleno es idéntico; el contorno de 1 px queda sobre el borde en vez de una fila fuera
      if (!stroke) expect(pixels(s, r.id)).toBe(before)
    }
  })

  it('un rectángulo redondeado apenas cambia al convertirlo', () => {
    const s = DocumentSession.create(64, 64)
    const r = makeRect(7, 9, 26, 20, makeAppearance(RED, null))
    r.radius = [4, 4, 4, 4]
    addShape(s, r)
    const before = pixels(s, r.id)
    convertToPath(s, [r.id])
    const after = pixels(s, r.id)
    let diff = 0
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) diff++
    expect(diff).toBeLessThan(30)
  })
})

describe('trazados con las anclas en centros de píxel', () => {
  const alpha = (sh: PathShape) =>
    [...renderShape(sh, 32, 32)!.data].filter((_, i) => i % 4 === 3).map((v): number => (v ? 1 : 0))

  it('pintan también los píxeles que su contorno atraviesa (borde incluido en todos los lados)', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 10, 8, makeAppearance(RED, null))
    addShape(s, r)
    convertToPath(s, [r.id])
    const sh = getShape(s, r.id) as PathShape
    const px = alpha(sh)
    expect(px.reduce((a, b) => a + b, 0)).toBe(80) // 10 × 8, como el rectángulo
    expect(px[4 * 32 + 4]).toBe(1) // esquina superior izquierda
    expect(px[11 * 32 + 13]).toBe(1) // esquina inferior derecha
    expect(px[12 * 32 + 13]).toBe(0)
  })

  it('la caja de selección cubre los píxeles pintados', () => {
    const s = DocumentSession.create(32, 32)
    const r = makeRect(4, 4, 10, 8, makeAppearance(RED, null))
    addShape(s, r)
    convertToPath(s, [r.id])
    expect(shapesBox(s, [r.id])).toEqual({ x: 4, y: 4, w: 10, h: 8 })
  })

  it('añadir un ancla a un rectángulo redondeado no cambia el dibujo', () => {
    const s = DocumentSession.create(64, 64)
    const r = makeRect(7, 9, 26, 20, makeAppearance(RED, null))
    r.radius = [4, 4, 4, 4]
    addShape(s, r)
    convertToPath(s, [r.id])
    const before = alpha(getShape(s, r.id) as PathShape)
    expect(addAnchorAt(s, r.id, 20, 9.5, 4)).toBe(true)
    const after = alpha(getShape(s, r.id) as PathShape)
    expect(after).toEqual(before)
  })
})
