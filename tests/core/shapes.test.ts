import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  addShape,
  copyShapes,
  setShapesColor,
  setShapesPaint,
  shapePaintsTarget,
  shapeTouchesRect,
  shapesColor,
  shapesBox,
  setSingleHandle,
  anchorSides,
  getShape,
  type PathShape,
  setShapesBox,
  resolveShape,
  pasteShapes,
  removeShapes,
  color,
  composeImage,
  corner,
  ellipseMasks,
  makeAppearance,
  makeEllipse,
  makeLine,
  makePath,
  makePolygon,
  makeRect,
  makeStar,
  moveShapes,
  renderShape,
  stampAllShapes,
  shapesPixelSize,
  stampShapes
} from '@core/index'

const RED = color(255, 0, 0)
const BLUE = color(0, 0, 255)
const count = (b: Bitmap) => {
  let n = 0
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) n++
  return n
}
const render = (s: DocumentSession) => {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out)
  return out
}

describe('rasterizador de formas', () => {
  it('el relleno usa el centro del píxel: rectángulo entero = w×h píxeles exactos', () => {
    const b = renderShape(makeRect(2, 3, 5, 4, makeAppearance(RED, null)), 16, 16)
    expect(count(b)).toBe(20)
    expect(b.get(2, 3)).toBe(0xff0000ff)
    expect(b.get(6, 6)).toBe(0xff0000ff)
    expect(b.get(7, 3)).toBe(0)
  })

  it('círculos de 3 a 64 px son simétricos y con el área esperada', () => {
    const hashes: string[] = []
    for (let d = 3; d <= 64; d++) {
      const size = d + 4
      const sh = makeEllipse(2 + d / 2, 2 + d / 2, d / 2, d / 2, makeAppearance(RED, null))
      const b = renderShape(sh, size, size)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          expect(b.get(x, y), `d=${d} (${x},${y}) H`).toBe(b.get(4 + d - 1 - x, y))
          expect(b.get(x, y), `d=${d} (${x},${y}) V`).toBe(b.get(x, 4 + d - 1 - y))
        }
      const ideal = Math.PI * (d / 2) ** 2
      expect(Math.abs(count(b) - ideal) / ideal, `d=${d}`).toBeLessThan(d < 8 ? 0.35 : 0.12)
      hashes.push(`${d}:${createHash('sha256').update(b.data).digest('hex').slice(0, 12)}`)
    }
    // Golden: huella de los 62 círculos. Si cambia el algoritmo hay que justificar la regeneración.
    expect(createHash('sha256').update(hashes.join('|')).digest('hex')).toMatchSnapshot()
  })

  it('el círculo de 5 px tiene la forma clásica de pixel art', () => {
    const { fill } = ellipseMasks(0, 0, 4, 4, 5, 5)
    const rows = [0, 1, 2, 3, 4].map((y) =>
      [0, 1, 2, 3, 4].map((x) => (fill[y * 5 + x] ? '#' : '.')).join('')
    )
    expect(rows).toEqual(['.###.', '#####', '#####', '#####', '.###.'])
  })

  it('contorno de 1 px de un rectángulo con coordenadas .5 es el borde exacto', () => {
    const b = renderShape(makeRect(1.5, 1.5, 4, 4, makeAppearance(null, RED)), 10, 10)
    expect(count(b)).toBe(16)
    expect(b.get(3, 3)).toBe(0)
  })

  it('el contorno interior y exterior de grosor 2 no invade el otro lado', () => {
    const ins = makeAppearance(null, RED, 2)
    ins.strokes[0]!.align = 'inside'
    const inside = renderShape(makeRect(2, 2, 8, 8, ins), 16, 16)
    expect(inside.get(2, 2)).toBe(0xff0000ff)
    expect(inside.get(1, 2)).toBe(0)
    expect(inside.get(4, 4)).toBe(0)
    const out = makeAppearance(null, RED, 2)
    out.strokes[0]!.align = 'outside'
    const outside = renderShape(makeRect(4, 4, 8, 8, out), 16, 16)
    expect(outside.get(3, 6)).toBe(0xff0000ff)
    expect(outside.get(2, 6)).toBe(0xff0000ff)
    expect(outside.get(4, 6)).toBe(0)
  })

  it('una línea diagonal de 1 px pixel-perfect no tiene esquinas en L', () => {
    const b = renderShape(
      makeLine({ x: 0.5, y: 0.5 }, { x: 7.5, y: 3.5 }, makeAppearance(null, RED)),
      10,
      10
    )
    expect(count(b)).toBeGreaterThan(5)
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        if (!b.get(x, y)) continue
        const h = b.get(x + 1, y) ? 1 : 0
        const v = b.get(x, y + 1) ? 1 : 0
        const d = b.get(x + 1, y + 1) ? 1 : 0
        expect(Boolean(h && v && !d), `L en ${x},${y}`).toBe(false)
      }
  })

  it('polígono, estrella y trazado Bézier cerrado se rellenan', () => {
    expect(
      count(renderShape(makePolygon(16, 16, 10, 6, makeAppearance(RED, null)), 32, 32))
    ).toBeGreaterThan(150)
    expect(
      count(renderShape(makeStar(16, 16, 12, 5, 5, makeAppearance(RED, null)), 32, 32))
    ).toBeGreaterThan(60)
    const a = corner(4, 4)
    const b = corner(20, 4)
    b.out = { x: 28, y: 12 }
    const c = corner(12, 24)
    const path = makePath([{ closed: true, anchors: [a, b, c] }], makeAppearance(RED, null))
    expect(count(renderShape(path, 32, 32))).toBeGreaterThan(100)
  })

  it('las esquinas redondeadas quitan píxeles de las esquinas', () => {
    const sq = makeRect(0, 0, 10, 10, makeAppearance(RED, null))
    const rd = makeRect(0, 0, 10, 10, makeAppearance(RED, null))
    rd.radius = [4, 4, 4, 4]
    const a = renderShape(sq, 10, 10)
    const b = renderShape(rd, 10, 10)
    expect(a.get(0, 0)).not.toBe(0)
    expect(b.get(0, 0)).toBe(0)
    expect(count(b)).toBeLessThan(count(a))
  })
})

describe('formas en la sesión', () => {
  it('se componen sobre el ráster y se deshacen', () => {
    const s = DocumentSession.create(16, 16)
    addShape(s, makeRect(2, 2, 4, 4, makeAppearance(RED, null)))
    expect(render(s).get(3, 3)).toBe(0xff0000ff)
    s.undo()
    expect(render(s).get(3, 3)).toBe(0)
    s.redo()
    moveShapes(s, s.selectedShapes, 5, 5)
    expect(render(s).get(8, 8)).toBe(0xff0000ff)
    expect(render(s).get(3, 3)).toBe(0)
    s.undo()
    expect(render(s).get(3, 3)).toBe(0xff0000ff)
  })

  it('INVARIANTE: estampar no cambia el render de la imagen', () => {
    const s = DocumentSession.create(32, 32)
    s.bitmapOf(s.activeLayerId).set(5, 5, 0x336699ff)
    addShape(s, makeRect(2, 2, 12, 12, makeAppearance(RED, BLUE, 2)))
    const e = makeEllipse(14, 14, 8, 6, makeAppearance(BLUE, RED, 1))
    e.opacity = 0.6
    addShape(s, e)
    const m = makeRect(20, 4, 8, 8, makeAppearance(color(0, 255, 0, 128), null))
    m.blendMode = 'multiply'
    addShape(s, m)
    const before = render(s).data.slice()

    // La elipse se solapa con la inferior: la regla de orden arrastra a las de abajo.
    const r = stampShapes(s, [e.id])!
    expect(r.includedBelow).toBe(true)
    expect(render(s).data).toEqual(before)
    expect(s.activeLayer.shapes).toHaveLength(1)

    const r2 = stampAllShapes(s)!
    expect(r2.stamped).toHaveLength(1)
    expect(render(s).data).toEqual(before)
    expect(s.activeLayer.shapes).toHaveLength(0)

    s.undo()
    s.undo()
    expect(render(s).data).toEqual(before)
    expect(s.activeLayer.shapes).toHaveLength(3)
  })

  it('estampar una forma que no se solapa con las de debajo no arrastra a las demás', () => {
    const s = DocumentSession.create(32, 32)
    addShape(s, makeRect(0, 0, 4, 4, makeAppearance(RED, null)))
    const far = makeRect(20, 20, 4, 4, makeAppearance(BLUE, null))
    addShape(s, far)
    const before = render(s).data.slice()
    const r = stampShapes(s, [far.id])!
    expect(r.includedBelow).toBe(false)
    expect(s.activeLayer.shapes).toHaveLength(1)
    expect(render(s).data).toEqual(before)
  })
})

describe('formas junto al borde del lienzo', () => {
  it('el contorno interior no desaparece en el lado que toca el borde', () => {
    const ap = makeAppearance(null, RED, 1)
    ap.strokes[0]!.align = 'inside'
    const b = renderShape(makeRect(0, 0, 8, 8, ap), 16, 16)
    expect(count(b)).toBe(28)
    expect(b.get(0, 3)).toBe(0xff0000ff)
    expect(b.get(3, 0)).toBe(0xff0000ff)
    const c = renderShape(makeRect(8, 8, 8, 8, ap), 16, 16)
    expect(c.get(15, 12)).toBe(0xff0000ff)
    expect(c.get(12, 15)).toBe(0xff0000ff)
  })

  it('una forma que cruza el borde recorta su contorno sin dibujar un anillo en el borde', () => {
    const ap = makeAppearance(null, RED, 1)
    ap.strokes[0]!.align = 'inside'
    const b = renderShape(makeRect(-4, -4, 10, 10, ap), 16, 16)
    expect(b.get(0, 2)).toBe(0)
    expect(b.get(2, 0)).toBe(0)
    expect(b.get(5, 2)).toBe(0xff0000ff)
  })

  it('las elipses pegadas al borde se mantienen', () => {
    const e = renderShape(makeEllipse(4, 4, 4, 4, makeAppearance(RED, null)), 16, 16)
    expect(e.get(0, 3)).toBe(0xff0000ff)
    expect(e.get(3, 0)).toBe(0xff0000ff)
  })
})

describe('tamaño en píxeles de las formas', () => {
  it('un cuadrado de 12×12 mide 12×12 con contorno interior y tras estirar una esquina', () => {
    const s = DocumentSession.create(32, 32)
    const ap = makeAppearance(RED, BLUE, 2)
    ap.strokes[0]!.align = 'inside' // como las crea la herramienta
    const r = makeRect(4, 4, 12, 12, ap)
    addShape(s, r)
    expect(shapesPixelSize(s, [r.id])).toEqual({ w: 12, h: 12 })
    const e = makeEllipse(20, 20, 4, 3, makeAppearance(RED, null))
    addShape(s, e)
    expect(shapesPixelSize(s, [e.id])).toEqual({ w: 8, h: 6 })
    expect(shapesPixelSize(s, [r.id, e.id])).toEqual({ w: 20, h: 19 })
  })
})

describe('portapapeles de formas', () => {
  it('cortar y pegar mueve la forma a otra capa como copia independiente y se deshace', () => {
    const s = DocumentSession.create(16, 16)
    addShape(s, makeRect(2, 2, 4, 4, makeAppearance(RED, null)))
    const first = s.activeLayer.id
    const id = s.selectedShapes[0]!
    const clip = copyShapes(s, [id])
    expect(clip).toHaveLength(1)
    removeShapes(s, [id])
    expect(s.image.layers.find((l) => l.id === first)!.shapes).toHaveLength(0)
    s.addLayer()
    const ids = pasteShapes(s, clip, 3, 0)
    expect(ids).toHaveLength(1)
    expect(ids[0]).not.toBe(id)
    expect(s.activeLayer.shapes).toHaveLength(1)
    expect(s.selectedShapes).toEqual(ids)
    // pegar dos veces no comparte objetos
    pasteShapes(s, clip)
    expect(s.activeLayer.shapes[0]).not.toBe(s.activeLayer.shapes[1])
    s.undo()
    expect(s.activeLayer.shapes).toHaveLength(1)
  })
})

describe('color de las formas seleccionadas', () => {
  it('pinta el relleno o el contorno, conserva el alfa y los arrastres son un solo paso', () => {
    const s = DocumentSession.create(16, 16)
    addShape(s, makeRect(2, 2, 6, 6, makeAppearance(color(255, 0, 0, 128), BLUE)))
    const ids = s.selectedShapes
    expect(shapesColor(s, ids, 'fill')).toEqual({ r: 255, g: 0, b: 0, a: 128 })
    const steps = s.history.entries.length
    setShapesColor(s, ids, 'fill', color(0, 255, 0))
    setShapesColor(s, ids, 'fill', color(0, 0, 255))
    expect(s.history.entries.length).toBe(steps + 1)
    expect(shapesColor(s, ids, 'fill')).toEqual({ r: 0, g: 0, b: 255, a: 128 })
    setShapesColor(s, ids, 'stroke', color(9, 9, 9))
    expect(shapesColor(s, ids, 'stroke')).toEqual({ r: 9, g: 9, b: 9, a: 255 })
    s.undo()
    expect(shapesColor(s, ids, 'stroke')).toEqual({ r: 0, g: 0, b: 255, a: 255 })
    s.undo()
    expect(shapesColor(s, ids, 'fill')).toEqual({ r: 255, g: 0, b: 0, a: 128 })
  })
})

describe('relleno y contorno «ninguno»', () => {
  it('desactiva y reactiva el relleno de la forma seleccionada, con deshacer', () => {
    const s = DocumentSession.create(16, 16)
    addShape(s, makeRect(2, 2, 6, 6, makeAppearance(RED, null)))
    const id = s.selectedShapes[0]!
    expect(shapePaintsTarget(s, id, 'fill')).toBe(true)
    expect(setShapesPaint(s, [id], 'fill', false, RED)).toBe(true)
    expect(shapePaintsTarget(s, id, 'fill')).toBe(false)
    expect(render(s).get(4, 4)).toBe(0)
    // repetir no cambia nada ni crea un paso de historial
    expect(setShapesPaint(s, [id], 'fill', false, RED)).toBe(false)
    expect(setShapesPaint(s, [id], 'fill', true, BLUE)).toBe(true)
    expect(render(s).get(4, 4)).toBe(0xff0000ff)
    s.undo()
    expect(shapePaintsTarget(s, id, 'fill')).toBe(false)
  })

  it('al activar un contorno que no existe crea uno liso', () => {
    const s = DocumentSession.create(16, 16)
    addShape(s, makeRect(2, 2, 8, 8, makeAppearance(RED, null)))
    const id = s.selectedShapes[0]!
    expect(shapePaintsTarget(s, id, 'stroke')).toBe(false)
    setShapesPaint(s, [id], 'stroke', true, BLUE)
    expect(shapePaintsTarget(s, id, 'stroke')).toBe(true)
  })
})

describe('selección por marco', () => {
  it('un marco en el hueco de un trazado no lo toca; uno que cruza el trazo sí', () => {
    const s = DocumentSession.create(32, 32)
    addShape(s, makeRect(2, 2, 24, 24, makeAppearance(null, RED, 1)))
    const id = s.selectedShapes[0]!
    expect(shapeTouchesRect(s, id, { x0: 8, y0: 8, x1: 18, y1: 14 })).toBe(false)
    expect(shapeTouchesRect(s, id, { x0: 0, y0: 10, x1: 5, y1: 14 })).toBe(true)
    expect(shapeTouchesRect(s, id, { x0: 28, y0: 28, x1: 31, y1: 31 })).toBe(false)
  })
})

describe('posición y tamaño de la selección', () => {
  it('fija x, y, ancho y alto en un único paso deshacible', () => {
    const s = DocumentSession.create(64, 64)
    addShape(s, makeRect(4, 6, 10, 8, makeAppearance(RED, null)))
    const id = s.selectedShapes[0]!
    expect(setShapesBox(s, [id], { w: 20, h: 16 })).toBe(true)
    expect(shapesBox(s, [id])).toEqual({ x: 4, y: 6, w: 20, h: 16 })
    expect(setShapesBox(s, [id], { x: 30, y: 2 })).toBe(true)
    expect(shapesBox(s, [id])).toEqual({ x: 30, y: 2, w: 20, h: 16 })
    expect(count(renderShape(resolveShape(s, id)!, 64, 64))).toBe(320)
    expect(setShapesBox(s, [id], { x: 30 })).toBe(false)
    expect(setShapesBox(s, [id], { w: 0 })).toBe(false)
    s.undo()
    expect(shapesBox(s, [id])).toEqual({ x: 4, y: 6, w: 20, h: 16 })
  })
  it('mover un trazado no cambia su tamaño', () => {
    const s = DocumentSession.create(64, 64)
    addShape(
      s,
      makePath(
        [{ anchors: [corner(10, 10), corner(30, 12), corner(20, 30)], closed: true }],
        makeAppearance(RED, null)
      )
    )
    const id = s.selectedShapes[0]!
    const b = shapesBox(s, [id])!
    setShapesBox(s, [id], { x: b.x + 5, y: b.y + 7 })
    expect(shapesBox(s, [id])).toEqual({ ...b, x: b.x + 5, y: b.y + 7 })
  })
})

describe('un solo tirador', () => {
  const setup = (closed: boolean) => {
    const s = DocumentSession.create(64, 64)
    addShape(
      s,
      makePath(
        [{ anchors: [corner(10, 10), corner(30, 12), corner(20, 30)], closed }],
        makeAppearance(RED, null)
      )
    )
    const id = s.selectedShapes[0]!
    const anchor = (i: number) => (getShape(s, id) as PathShape).subpaths[0]!.anchors[i]!
    return { s, id, anchor }
  }
  it('deja solo el tirador de salida o de entrada y es deshacible', () => {
    const { s, id, anchor } = setup(true)
    const ref = { shapeId: id, subpath: 0, index: 1 }
    expect(setSingleHandle(s, [ref], 'out')).toBe(true)
    expect(anchor(1).in).toBeNull()
    expect(anchor(1).out).toBeTruthy()
    expect(anchor(1).type).toBe('corner')
    expect(setSingleHandle(s, [ref], 'in')).toBe(true)
    expect(anchor(1).out).toBeNull()
    expect(anchor(1).in).toBeTruthy()
    s.undo()
    expect(anchor(1).out).toBeTruthy()
  })
  it('en los extremos de un trazado abierto no aplica el lado que no existe', () => {
    const { s, id, anchor } = setup(false)
    const first = { shapeId: id, subpath: 0, index: 0 }
    const last = { shapeId: id, subpath: 0, index: 2 }
    expect(anchorSides(s, [first])).toEqual({ in: false, out: true })
    expect(anchorSides(s, [last])).toEqual({ in: true, out: false })
    expect(anchorSides(s, [first, last])).toEqual({ in: true, out: true })
    expect(setSingleHandle(s, [first], 'in')).toBe(false)
    expect(setSingleHandle(s, [last], 'out')).toBe(false)
    expect(setSingleHandle(s, [first], 'out')).toBe(true)
    expect(anchor(0).out).toBeTruthy()
    expect(anchor(0).in).toBeNull()
  })
})

describe('punto de referencia de la caja', () => {
  it('X/Y se refieren al punto y el tamaño lo deja fijo', () => {
    const s = DocumentSession.create(64, 64)
    addShape(s, makeRect(10, 10, 20, 10, makeAppearance(RED, null)))
    const id = s.selectedShapes[0]!
    // centro: el centro (20, 15) pasa a (40, 30)
    setShapesBox(s, [id], { x: 40, y: 30 }, { fx: 0.5, fy: 0.5 })
    expect(shapesBox(s, [id])).toEqual({ x: 30, y: 25, w: 20, h: 10 })
    // esquina inferior derecha fija (50, 35) al ensanchar
    setShapesBox(s, [id], { w: 30, h: 20 }, { fx: 1, fy: 1 })
    expect(shapesBox(s, [id])).toEqual({ x: 20, y: 15, w: 30, h: 20 })
    // centro fijo al cambiar el tamaño
    setShapesBox(s, [id], { w: 10 }, { fx: 0.5, fy: 0.5 })
    expect(shapesBox(s, [id])).toEqual({ x: 30, y: 15, w: 10, h: 20 })
  })
})
