import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  LIBRARY,
  activePalette,
  addShape,
  addSwatch,
  appendColors,
  color,
  extractColors,
  getShape,
  libraryColors,
  loadDocument,
  saveDocument,
  linkPaint,
  makeAppearance,
  makePalette,
  makeRamp,
  makeRect,
  moveSwatch,
  parsePalette,
  removeSwatch,
  serializePalette,
  setSwatchColor,
  sortSwatches,
  swatchUsage,
  type PaletteFormat
} from '@core/index'

const enc = (s: string) => new TextEncoder().encode(s)
const COLORS = [color(255, 0, 0), color(0, 128, 255), color(10, 20, 30)]

describe('formatos de paleta', () => {
  it.each(['gpl', 'pal', 'hex', 'png'] as PaletteFormat[])('ida y vuelta %s', (fmt) => {
    const p = makePalette('Prueba', COLORS)
    const back = parsePalette(serializePalette(p, fmt), fmt, 'x')
    expect(back.swatches.map((s) => s.color)).toEqual(COLORS)
  })

  it('lee un .gpl con nombres, comentarios y cabecera', () => {
    const p = parsePalette(
      enc(
        'GIMP Palette\nName: Mía\nColumns: 4\n# nota\n255   0   0\tRojo\n  0 255 0 Verde claro\n'
      ),
      'gpl',
      'f'
    )
    expect(p.name).toBe('Mía')
    expect(p.swatches.map((s) => s.name)).toEqual(['Rojo', 'Verde claro'])
    expect(p.swatches[1]!.color).toEqual(color(0, 255, 0))
  })

  it('rechaza formatos inválidos y paletas vacías', () => {
    expect(() => parsePalette(enc('hola'), 'gpl', 'f')).toThrow()
    expect(() => parsePalette(enc('hola'), 'pal', 'f')).toThrow()
    expect(() => parsePalette(enc('nada\n'), 'hex', 'f')).toThrow()
  })

  it('hex acepta con y sin #, y RRGGBBAA', () => {
    const p = parsePalette(enc('#ff0000\n00ff00\n0000ff80\n'), 'hex', 'f')
    expect(p.swatches[2]!.color).toEqual({ r: 0, g: 0, b: 255, a: 128 })
  })
})

describe('rampas y orden', () => {
  it('conserva los extremos y genera n tonos', () => {
    const r = makeRamp(color(0, 0, 0), color(255, 255, 255), 5)
    expect(r).toHaveLength(5)
    expect(r[0]).toEqual(color(0, 0, 0))
    expect(r[4]).toEqual(color(255, 255, 255))
    expect(r[2]!.r).toBe(r[2]!.g) // gris
  })

  it('el desplazamiento de tono no mueve los extremos y cambia el centro', () => {
    const a = color(40, 20, 80)
    const b = color(250, 230, 150)
    const plain = makeRamp(a, b, 5, 0)
    const shifted = makeRamp(a, b, 5, 30)
    expect(shifted[0]).toEqual(plain[0])
    expect(shifted[4]).toEqual(plain[4])
    expect(shifted[2]).not.toEqual(plain[2])
  })

  it('ordena por luminosidad de forma estable', () => {
    const p = makePalette('o', [color(255, 255, 255), color(0, 0, 0), color(128, 128, 128)])
    expect(sortSwatches(p.swatches, 'lightness').map((s) => s.color.r)).toEqual([0, 128, 255])
  })

  it('extrae colores distintos ignorando transparentes', () => {
    const b = new Bitmap(2, 2)
    b.data.set([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255])
    expect(extractColors(b)).toEqual([color(255, 0, 0), color(0, 255, 0)])
  })

  it('la biblioteca tiene colores válidos', () => {
    for (const l of LIBRARY) {
      expect(libraryColors(l).length).toBe(l.colors.length)
      expect(new Set(l.colors).size).toBe(l.colors.length)
    }
    expect(LIBRARY.find((l) => l.key === 'endesga32')!.colors).toHaveLength(32)
  })
})

describe('paleta del documento y muestras globales', () => {
  it('añadir, reordenar y eliminar son deshacibles', () => {
    const s = DocumentSession.create(32, 32)
    const n0 = activePalette(s).swatches.length
    const sw = addSwatch(s, color(1, 2, 3))!
    expect(activePalette(s).swatches).toHaveLength(n0 + 1)
    expect(addSwatch(s, color(1, 2, 3))!.id).toBe(sw.id) // no duplica
    moveSwatch(s, sw.id, 0)
    expect(activePalette(s).swatches[0]!.id).toBe(sw.id)
    removeSwatch(s, sw.id)
    expect(activePalette(s).swatches).toHaveLength(n0)
    s.undo()
    s.undo()
    s.undo()
    expect(activePalette(s).swatches).toHaveLength(n0)
    s.redo()
    expect(activePalette(s).swatches.at(-1)!.id).toBe(sw.id)
  })

  it('appendColors no repite colores', () => {
    const s = DocumentSession.create(8, 8)
    const n0 = activePalette(s).swatches.length
    expect(appendColors(s, [color(1, 1, 1), color(1, 1, 1), color(0, 0, 0)], 'Rampa')).toBe(1)
    expect(activePalette(s).swatches).toHaveLength(n0 + 1)
  })

  it('editar una muestra recolorea las formas enlazadas y se deshace entero', () => {
    const s = DocumentSession.create(32, 32)
    const sw = addSwatch(s, color(200, 0, 0))!
    const a = makeRect(2, 2, 8, 8, makeAppearance(color(200, 0, 0), null))
    const b = makeRect(12, 2, 8, 8, makeAppearance(color(200, 0, 0), null))
    addShape(s, a)
    addShape(s, b)
    const fillA = a.appearance.fills[0]!.paint
    if (fillA.type === 'solid') linkPaint(fillA, sw.id)
    // a está enlazada; b no
    expect(swatchUsage(s, sw.id)).toBe(1)
    const n = s.history.entries.length
    setSwatchColor(s, sw.id, color(0, 0, 255))
    setSwatchColor(s, sw.id, color(0, 255, 0)) // se fusiona con el anterior
    expect(s.history.entries.length).toBe(n + 1)
    const pa = getShape(s, a.id)!.appearance.fills[0]!.paint
    const pb = getShape(s, b.id)!.appearance.fills[0]!.paint
    expect(pa.type === 'solid' && pa.color).toEqual(color(0, 255, 0))
    expect(pb.type === 'solid' && pb.color).toEqual(color(200, 0, 0))
    s.undo()
    const pa2 = getShape(s, a.id)!.appearance.fills[0]!.paint
    expect(pa2.type === 'solid' && pa2.color).toEqual(color(200, 0, 0))
    expect(activePalette(s).swatches.find((x) => x.id === sw.id)!.color).toEqual(color(200, 0, 0))
  })

  it('eliminar una muestra desenlaza sin cambiar el color', () => {
    const s = DocumentSession.create(16, 16)
    const sw = addSwatch(s, color(9, 9, 9))!
    const a = makeRect(0, 0, 4, 4, makeAppearance(color(9, 9, 9), null))
    addShape(s, a)
    const p = a.appearance.fills[0]!.paint
    if (p.type === 'solid') linkPaint(p, sw.id)
    removeSwatch(s, sw.id)
    const q = getShape(s, a.id)!.appearance.fills[0]!.paint
    expect(q.type === 'solid' && q.swatchId).toBeUndefined()
    expect(q.type === 'solid' && q.color).toEqual(color(9, 9, 9))
  })
})

describe('persistencia', () => {
  it('la paleta y los enlaces sobreviven a guardar y abrir', () => {
    const s = DocumentSession.create(16, 16)
    const sw = addSwatch(s, color(7, 8, 9), 'Mi color')!
    const a = makeRect(0, 0, 4, 4, makeAppearance(color(7, 8, 9), null))
    addShape(s, a)
    const p = a.appearance.fills[0]!.paint
    if (p.type === 'solid') linkPaint(p, sw.id)
    const loaded = loadDocument(saveDocument(s.doc, s.rasters))
    const pal = loaded.doc.palettes![0]!
    expect(pal.swatches.find((x) => x.id === sw.id)!.name).toBe('Mi color')
    const q = loaded.doc.images[0]!.layers[0]!.shapes[0]!.appearance.fills[0]!.paint
    expect(q.type === 'solid' && q.swatchId).toBe(sw.id)
  })
})
