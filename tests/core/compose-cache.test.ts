import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  Stroke,
  addEffect,
  composeImage,
  invalidatePrefix,
  newPrefixCache,
  rgba,
  type Rect
} from '@core/index'

const W = 64
const H = 64

/** Reproduce lo que hace el Workspace: recompone por regiones con la caché y la invalida por evento. */
function harness(s: DocumentSession) {
  const cache = newPrefixCache()
  const out = new Bitmap(W, H)
  const recompose = (rect: Rect | null) =>
    composeImage(s.image, s.rasters, out, rect ?? undefined, {
      prefix: cache,
      hotLayerId: s.activeLayerId
    })
  s.onChange((e) => {
    invalidatePrefix(cache, s.image, e.layerIds)
    recompose(e.structure ? null : e.dirty)
  })
  recompose(null)
  return {
    out,
    cache,
    /** La composición con caché debe ser idéntica, byte a byte, a la completa sin caché. */
    expectExact() {
      const ref = new Bitmap(W, H)
      composeImage(s.image, s.rasters, ref)
      expect(out.data).toEqual(ref.data)
    }
  }
}

function setup() {
  const s = DocumentSession.create(W, H)
  const modes = ['normal', 'multiply', 'screen', 'overlay', 'normal'] as const
  const colors = [rgba(200, 30, 30), rgba(30, 200, 30), rgba(30, 30, 200), rgba(220, 220, 40)]
  const ids = [s.activeLayerId]
  for (let i = 1; i < 5; i++) ids.push(s.addLayer()!.id)
  ids.forEach((id, i) => {
    const bmp = s.bitmapOf(id)
    for (let y = i * 6; y < i * 6 + 30; y++)
      for (let x = i * 5; x < i * 5 + 30; x++) bmp.set(x, y, colors[i % 4]!)
    s.setLayerProps(id, { blendMode: modes[i]!, opacity: 0.6 + i * 0.08 })
  })
  return { s, ids }
}

function paint(
  s: DocumentSession,
  layerId: string,
  x: number,
  y: number,
  color = rgba(255, 255, 255)
) {
  s.setActiveLayer(layerId)
  const st = new Stroke(s, { tool: 'pencil', color, size: 1, shape: 'square' })
  st.move(x, y)
  st.move(x + 20, y + 10)
  st.end()
}

describe('caché de composición por capas', () => {
  it('pintar en la capa activa: la composición parcial es idéntica a la completa', () => {
    const { s, ids } = setup()
    s.setActiveLayer(ids[2]!)
    const h = harness(s)
    h.expectExact()
    expect(h.cache.valid).toBe(true)
    paint(s, ids[2]!, 3, 3)
    expect(h.cache.valid).toBe(true) // pintar en la caliente no invalida lo de debajo
    h.expectExact()
    paint(s, ids[2]!, 10, 40, rgba(0, 0, 0))
    h.expectExact()
  })

  it('cambiar una capa inferior invalida; una superior no', () => {
    const { s, ids } = setup()
    s.setActiveLayer(ids[2]!)
    const h = harness(s)
    h.expectExact()
    // capa superior (índice 4): la caché de lo que queda debajo de la 2 sigue valiendo
    s.setActiveLayer(ids[2]!)
    h.cache.valid = true
    invalidatePrefix(h.cache, s.image, [ids[4]!])
    expect(h.cache.valid).toBe(true)
    // capa inferior (índice 0): hay que reconstruir
    invalidatePrefix(h.cache, s.image, [ids[0]!])
    expect(h.cache.valid).toBe(false)
  })

  it('editar una capa de debajo y volver a la caliente da el resultado exacto', () => {
    const { s, ids } = setup()
    s.setActiveLayer(ids[3]!)
    const h = harness(s)
    h.expectExact()
    paint(s, ids[1]!, 8, 8) // cambia el activo y pinta debajo de la antigua caliente
    h.expectExact()
    paint(s, ids[3]!, 20, 20)
    h.expectExact()
    s.undo()
    h.expectExact()
    s.undo()
    h.expectExact()
    s.redo()
    h.expectExact()
  })

  it('propiedades de capa, orden y visibilidad (cambios sin capa conocida)', () => {
    const { s, ids } = setup()
    s.setActiveLayer(ids[3]!)
    const h = harness(s)
    s.setLayerProps(ids[1]!, { opacity: 0.2 })
    h.expectExact()
    s.setLayerProps(ids[0]!, { visible: false })
    h.expectExact()
    s.setLayerProps(ids[2]!, { blendMode: 'screen' })
    h.expectExact()
    s.moveLayer(ids[1]!, 3)
    h.expectExact()
    s.undo()
    s.undo()
    h.expectExact()
  })

  it('efectos en una capa inferior', () => {
    const { s, ids } = setup()
    const h = harness(s)
    s.setActiveLayer(ids[3]!)
    h.expectExact()
    addEffect(s, { kind: 'layer', id: ids[1]! }, 'invert')
    h.expectExact()
    paint(s, ids[3]!, 5, 5)
    h.expectExact()
  })

  it('con grupos o recortes no usa la caché y sigue siendo exacto', () => {
    const { s, ids } = setup()
    s.setLayerProps(ids[3]!, { clip: true })
    s.setActiveLayer(ids[2]!)
    const h = harness(s)
    paint(s, ids[2]!, 4, 4)
    h.expectExact()
  })
})

describe('la caché se usa de verdad', () => {
  it('sin invalidar, un cambio oculto en una capa inferior no se ve (prueba de que hay caché)', () => {
    const { s, ids } = setup()
    s.setActiveLayer(ids[3]!)
    const h = harness(s)
    s.bitmapOf(ids[0]!).set(1, 1, rgba(1, 2, 3)) // sin evento: nadie invalida
    composeImage(
      s.image,
      s.rasters,
      h.out,
      { x: 0, y: 0, w: W, h: H },
      { prefix: h.cache, hotLayerId: ids[3]! }
    )
    const ref = new Bitmap(W, H)
    composeImage(s.image, s.rasters, ref)
    expect(h.out.data).not.toEqual(ref.data)
  })
})
