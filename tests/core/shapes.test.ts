import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  addShape,
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
    expect(shapesPixelSize(s, [r.id, e.id])).toEqual({ w: 20, h: 18 })
  })
})
