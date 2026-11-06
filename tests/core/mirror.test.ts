import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  addShape,
  color,
  makeAppearance,
  makeRect,
  MIRROR_TYPES,
  MirrorDrag,
  composeImage,
  loadDocument,
  mergeDown,
  mirrorClosure,
  mirrorLines,
  removeLayerMirror,
  saveDocument,
  setLayerMirrorEnabled,
  setLayerMirrorType
} from '@core/index'

const RED = 0xff0000ff

function render(s: DocumentSession, rect?: { x: number; y: number; w: number; h: number }): Bitmap {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out, rect)
  return out
}

/** Coordenadas (x,y) de los píxeles con alfa > 0. */
function lit(b: Bitmap): string[] {
  const out: string[] = []
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) if (b.get(x, y) & 0xff) out.push(`${x},${y}`)
  return out.sort()
}

function setup(w = 8, h = 8) {
  const s = DocumentSession.create(w, h)
  return { s, id: s.activeLayer.id, bmp: s.bitmapOf(s.activeLayer.id) }
}

describe('espejo de capa', () => {
  it('vertical: el eje queda entre dos píxeles y el ráster no cambia', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 2, RED)
    setLayerMirrorType(s, id, 'v') // eje en x = 4 (entre los píxeles 3 y 4)
    expect(lit(render(s))).toEqual(['1,2', '6,2'])
    expect(lit(bmp)).toEqual(['1,2']) // sólo píxeles: el ráster conserva un único lado
  })

  it('horizontal', () => {
    const { s, id, bmp } = setup()
    bmp.set(3, 1, RED)
    setLayerMirrorType(s, id, 'h')
    expect(lit(render(s))).toEqual(['3,1', '3,6'])
  })

  it('vertical y horizontal: tres reflejos', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 1, RED)
    setLayerMirrorType(s, id, 'vh')
    expect(lit(render(s))).toEqual(['1,1', '1,6', '6,1', '6,6'])
  })

  it('diagonales atraviesan los píxeles', () => {
    const { s, id, bmp } = setup()
    bmp.set(5, 2, RED)
    setLayerMirrorType(s, id, 'd135') // «\» por el píxel (4,4): intercambia desplazamientos
    expect(lit(render(s))).toEqual(['2,5', '5,2'])
    setLayerMirrorType(s, id, 'd45') // «/» por (4,4)
    // (5,2): dx = 1, dy = -2 → (4 + 2, 4 - 1) = (6, 3)
    expect(lit(render(s))).toEqual(['5,2', '6,3'])
  })

  it('45° y 135° juntos: tres reflejos incluido el giro de 180°', () => {
    const { s, id, bmp } = setup()
    bmp.set(5, 2, RED)
    setLayerMirrorType(s, id, 'd45-135')
    expect(lit(render(s))).toEqual(['2,5', '3,6', '5,2', '6,3'])
    expect(lit(render(s))).toHaveLength(4)
  })

  it('cada reflexión es una involución sobre una imagen cuadrada', () => {
    for (const type of MIRROR_TYPES) {
      const { s, id, bmp } = setup(9, 9)
      bmp.set(2, 3, RED)
      bmp.set(6, 1, 0x00ff00ff)
      setLayerMirrorType(s, id, type)
      const once = render(s)
      // el resultado es simétrico: copiarlo a un ráster y reflejarlo de nuevo no añade píxeles
      const { s: s2, id: id2, bmp: b2 } = setup(9, 9)
      b2.data.set(once.data)
      setLayerMirrorType(s2, id2, type)
      expect(lit(render(s2))).toEqual(lit(once))
    }
  })

  it('las formas se reflejan como píxeles sin duplicar el vector', () => {
    const { s, id } = setup(16, 16)
    // una forma de relleno propio a la izquierda del eje
    addShape(s, makeRect(1, 1, 3, 3, makeAppearance(color(255, 0, 0), null)))
    const layer = s.image.layers.find((l) => l.id === id)!
    expect(layer.shapes).toHaveLength(1)
    const before = lit(render(s))
    setLayerMirrorType(s, id, 'v')
    const after = lit(render(s))
    expect(layer.shapes).toHaveLength(1)
    expect(after.length).toBe(before.length * 2)
  })

  it('desactivar conserva la configuración; quitar la borra; todo se deshace', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 2, RED)
    setLayerMirrorType(s, id, 'v')
    expect(setLayerMirrorEnabled(s, id, false)).toBe(true)
    expect(lit(render(s))).toEqual(['1,2'])
    expect(s.activeLayer.mirror).toMatchObject({ type: 'v', enabled: false })
    setLayerMirrorEnabled(s, id, true)
    expect(lit(render(s))).toHaveLength(2)
    expect(removeLayerMirror(s, id)).toBe(true)
    expect(s.activeLayer.mirror).toBeUndefined()
    s.undo()
    expect(s.activeLayer.mirror?.type).toBe('v')
    s.undo()
    expect(lit(render(s))).toEqual(['1,2'])
  })

  it('arrastrar el eje es un único paso de historial', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 2, RED)
    setLayerMirrorType(s, id, 'v')
    const steps = s.history.entries.length
    const d = new MirrorDrag(s, id, 'x')
    d.moveTo(2.4, 0)
    d.moveTo(2.6, 0)
    d.end()
    expect(s.history.entries.length).toBe(steps + 1)
    expect(s.activeLayer.mirror?.x).toBe(3)
    expect(lit(render(s))).toEqual(['1,2', '4,2']) // 2·3 − 1 − 1 = 4
    s.undo()
    expect(s.activeLayer.mirror?.x).toBe(4)
  })

  it('recomponer una región incluye los reflejos', () => {
    const { s, id, bmp } = setup()
    setLayerMirrorType(s, id, 'v')
    const out = render(s)
    bmp.set(1, 2, RED)
    composeImage(s.image, s.rasters, out, { x: 1, y: 2, w: 1, h: 1 })
    expect(lit(out)).toEqual(['1,2', '6,2'])
    expect(mirrorClosure(s.image.layers, { x: 1, y: 2, w: 1, h: 1 }, 8, 8)).toEqual({
      x: 1,
      y: 2,
      w: 6,
      h: 1
    })
  })

  it('combinar hacia abajo no cambia el render', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 2, RED)
    setLayerMirrorType(s, id, 'vh')
    s.addLayer()
    s.bitmapOf(s.activeLayer.id).set(3, 3, 0x00ff00ff)
    const before = render(s).data.slice()
    expect(mergeDown(s)).toBe(true)
    expect(render(s).data).toEqual(before)
    expect(s.activeLayer.mirror).toBeUndefined()
  })

  it('se guarda y se carga con el documento', () => {
    const { s, id, bmp } = setup()
    bmp.set(1, 2, RED)
    setLayerMirrorType(s, id, 'd45-135')
    setLayerMirrorEnabled(s, id, false)
    const loaded = loadDocument(saveDocument(s.doc, s.rasters))
    expect(loaded.doc.images[0]!.layers[0]!.mirror).toEqual({
      type: 'd45-135',
      enabled: false,
      x: 4,
      y: 4
    })
  })

  it('las líneas de referencia se recortan al lienzo', () => {
    const lines = mirrorLines({ type: 'd45-135', enabled: true, x: 4, y: 4 }, 8, 8)
    expect(lines.map((l) => l.id)).toEqual(['d45', 'd135'])
    expect(lines[1]!.a).toEqual({ x: 0, y: 0 })
    expect(lines[1]!.b).toEqual({ x: 8, y: 8 })
    expect(mirrorLines({ type: 'vh', enabled: true, x: 3, y: 5 }, 8, 8)).toHaveLength(2)
  })
})
