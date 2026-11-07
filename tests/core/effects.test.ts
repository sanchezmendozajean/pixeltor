import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  EFFECTS,
  addEffect,
  addShape,
  color,
  composeImage,
  getEffects,
  makeAppearance,
  makeRect,
  updateEffect,
  removeEffect,
  effectsInfluence,
  applyEffectPreset,
  rasterizeLayerEffects,
  stampShapes,
  loadDocument,
  saveDocument,
  cloneShape,
  type Effect
} from '@core/index'

const RED = color(255, 0, 0)
const compose = (s: DocumentSession, rect?: { x: number; y: number; w: number; h: number }) => {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out, rect)
  return out
}
const alphaAt = (b: Bitmap, x: number, y: number) => b.data[(y * b.width + x) * 4 + 3]!
const px = (b: Bitmap, x: number, y: number) =>
  Array.from(b.data.subarray((y * b.width + x) * 4, (y * b.width + x) * 4 + 4))

function squareDoc() {
  const s = DocumentSession.create(32, 32)
  const r = makeRect(12, 12, 8, 8, makeAppearance(RED, null))
  addShape(s, r)
  return { s, r }
}

describe('efectos', () => {
  it('catálogo: todos los efectos tienen valores por defecto válidos', () => {
    expect(EFFECTS.size).toBeGreaterThanOrEqual(23)
    for (const d of EFFECTS.values())
      expect(() =>
        addEffect(DocumentSession.create(4, 4), { kind: 'layer', id: 'x' }, d.type)
      ).not.toThrow()
  })

  it('sombra paralela dura: aparece desplazada y la forma queda intacta', () => {
    const { s, r } = squareDoc()
    const fx = addEffect(s, { kind: 'shape', id: r.id }, 'drop-shadow')!
    updateEffect(s, { kind: 'shape', id: r.id }, fx.id, {
      params: { dx: 3, dy: 3, opacity: 100, color: '#000000' }
    })
    const out = compose(s)
    expect(px(out, 12, 12)).toEqual([255, 0, 0, 255]) // la forma
    expect(px(out, 21, 21)).toEqual([0, 0, 0, 255]) // sombra (20+... esquina inferior)
    expect(alphaAt(out, 25, 25)).toBe(0)
  })

  it('contorno de píxel exterior (4 conexiones) rodea el cuadrado sin esquinas', () => {
    const { s, r } = squareDoc()
    addEffect(s, { kind: 'shape', id: r.id }, 'pixel-outline')
    const out = compose(s)
    let n = 0
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i]) n++
    expect(n).toBe(64 + 32) // 8×8 + anillo de 4·8 (sin esquinas)
    expect(alphaAt(out, 11, 11)).toBe(0)
    expect(px(out, 11, 15)).toEqual([0, 0, 0, 255])
  })

  it('ningún efecto altera el ráster base ni el modelo de la forma', () => {
    const s = DocumentSession.create(32, 32)
    const before = s.bitmapOf(s.activeLayer.id).clone()
    s.bitmapOf(s.activeLayer.id).set(5, 5, 0xff0000ff)
    const snap = s.bitmapOf(s.activeLayer.id).clone()
    for (const type of EFFECTS.keys()) addEffect(s, { kind: 'layer', id: s.activeLayer.id }, type)
    compose(s)
    expect(Array.from(s.bitmapOf(s.activeLayer.id).data)).toEqual(Array.from(snap.data))
    expect(before.data.length).toBe(snap.data.length)
  })

  it('componer por regiones equivale a componer todo (radio de influencia)', () => {
    const s = DocumentSession.create(40, 40)
    const bmp = s.bitmapOf(s.activeLayer.id)
    for (let y = 10; y < 20; y++) for (let x = 12; x < 24; x++) bmp.set(x, y, 0xff8000ff)
    const L = { kind: 'layer', id: s.activeLayer.id } as const
    const b = addEffect(s, L, 'gaussian-blur')!
    updateEffect(s, L, b.id, { params: { radius: 3 } })
    const sh = addEffect(s, L, 'drop-shadow')!
    updateEffect(s, L, sh.id, { params: { dx: 2, dy: 2, blur: 2, opacity: 80 } })
    const full = compose(s)
    const part = new Bitmap(40, 40)
    // el borde de las regiones cae dentro de la mancha: se componen por cuadrantes
    for (const r of [
      { x: 0, y: 0, w: 20, h: 20 },
      { x: 20, y: 0, w: 20, h: 20 },
      { x: 0, y: 20, w: 20, h: 20 },
      { x: 20, y: 20, w: 20, h: 20 }
    ])
      composeImage(s.image, s.rasters, part, r)
    expect(Array.from(part.data)).toEqual(Array.from(full.data))
    expect(effectsInfluence(getEffects(s, L), { width: 40, height: 40 })).toBeGreaterThan(0)
  })

  it('el desenfoque es determinista y conserva aproximadamente el alfa total', () => {
    const run = () => {
      const s = DocumentSession.create(32, 32)
      const b = s.bitmapOf(s.activeLayer.id)
      for (let y = 12; y < 20; y++) for (let x = 12; x < 20; x++) b.set(x, y, 0xffffffff)
      const L = { kind: 'layer', id: s.activeLayer.id } as const
      const fx = addEffect(s, L, 'gaussian-blur')!
      updateEffect(s, L, fx.id, { params: { radius: 4 } })
      return compose(s)
    }
    const a = run()
    const b = run()
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    let sum = 0
    for (let i = 3; i < a.data.length; i += 4) sum += a.data[i]!
    expect(sum / 255).toBeGreaterThan(55)
    expect(sum / 255).toBeLessThan(73)
  })

  it('iluminación direccional aclara el lado que mira a la luz y oscurece el opuesto', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const fx = addEffect(s, T, 'directional-light')!
    updateEffect(s, T, fx.id, { params: { angle: 180, intensity: 100, steps: 0 } })
    const out = compose(s)
    // luz desde la izquierda (180°): el borde izquierdo más claro que el derecho
    expect(px(out, 12, 16)[0]).toBeGreaterThan(px(out, 19, 16)[0]!)
    expect(px(out, 16, 16)).toEqual([255, 0, 0, 255]) // el centro no cambia
  })

  it('reemplazar colores y mapa de degradado recolorean sin tocar el alfa', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const fx = addEffect(s, T, 'color-replace')!
    updateEffect(s, T, fx.id, { params: { from: '#ff0000', to: '#00ff00' } })
    expect(px(compose(s), 15, 15)).toEqual([0, 255, 0, 255])
    updateEffect(s, T, fx.id, { enabled: false })
    addEffect(s, T, 'gradient-map')
    const o = px(compose(s), 15, 15)
    expect(o[3]).toBe(255)
    expect(o.slice(0, 3)).not.toEqual([255, 0, 0])
  })

  it('torsión, ondulación y desenfoque de movimiento no fallan y son deterministas', () => {
    const run = (type: string) => {
      const { s, r } = squareDoc()
      addEffect(s, { kind: 'shape', id: r.id }, type)
      return Array.from(compose(s).data)
    }
    for (const t of ['twirl', 'ripple', 'motion-blur', 'bevel', 'inner-glow'])
      expect(run(t)).toEqual(run(t))
  })

  it('«Salida» con umbral deja el alfa binaria', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const fx = addEffect(s, T, 'outer-glow')!
    updateEffect(s, T, fx.id, {
      params: { radius: 3, opacity: 100 },
      output: { alpha: 'threshold', threshold: 128 }
    })
    const out = compose(s)
    for (let i = 3; i < out.data.length; i += 4) expect([0, 255]).toContain(out.data[i])
  })

  it('desplazamiento con envoltura reaparece por el otro lado', () => {
    const s = DocumentSession.create(16, 16)
    s.bitmapOf(s.activeLayer.id).set(14, 3, 0xff0000ff)
    const L = { kind: 'layer', id: s.activeLayer.id } as const
    const fx = addEffect(s, L, 'offset')!
    updateEffect(s, L, fx.id, { params: { dx: 4, dy: 0, wrap: true } })
    expect(px(compose(s), 2, 3)).toEqual([255, 0, 0, 255])
  })

  it('añadir, editar y quitar son deshacibles', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const fx = addEffect(s, T, 'invert') as Effect
    expect(getEffects(s, T)).toHaveLength(1)
    updateEffect(s, T, fx.id, { enabled: false })
    expect(getEffects(s, T)[0]!.enabled).toBe(false)
    removeEffect(s, T, fx.id)
    expect(getEffects(s, T)).toHaveLength(0)
    s.undo()
    s.undo()
    expect(getEffects(s, T)[0]!.enabled).toBe(true)
    s.undo()
    expect(getEffects(s, T)).toHaveLength(0)
  })

  it('estampar una forma con efectos y rasterizar los de capa conservan el render', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const sh = addEffect(s, T, 'drop-shadow')!
    updateEffect(s, T, sh.id, { params: { dx: 2, dy: 2, blur: 2, opacity: 90 } })
    addEffect(s, T, 'pixel-outline')
    const before = Array.from(compose(s).data)
    stampShapes(s, [r.id])
    expect(s.activeLayer.shapes).toHaveLength(0)
    expect(Array.from(compose(s).data)).toEqual(before)

    const L = { kind: 'layer', id: s.activeLayer.id } as const
    const g = addEffect(s, L, 'gaussian-blur')!
    updateEffect(s, L, g.id, { params: { radius: 2 } })
    const withLayerFx = Array.from(compose(s).data)
    expect(rasterizeLayerEffects(s, s.activeLayer.id)).toBe(true)
    expect(getEffects(s, L)).toHaveLength(0)
    expect(Array.from(compose(s).data)).toEqual(withLayerFx)
    s.undo()
    expect(getEffects(s, L)).toHaveLength(1)
    expect(Array.from(compose(s).data)).toEqual(withLayerFx)
  })

  it('un preset añade varios efectos en un solo paso', () => {
    const { s, r } = squareDoc()
    const T = { kind: 'shape', id: r.id } as const
    const n = s.history.entries.length
    applyEffectPreset(s, T, [
      { type: 'pixel-outline', enabled: true, params: { thickness: 2 } },
      { type: 'drop-shadow', enabled: true, params: { dx: 1 } },
      { type: 'no-existe', enabled: true, params: {} }
    ])
    expect(getEffects(s, T)).toHaveLength(2)
    expect(s.history.entries.length).toBe(n + 1)
    expect(getEffects(s, T)[0]!.params['thickness']).toBe(2)
  })

  it('Aplicar efecto: estampa la capa hasta ese efecto y conserva el render', () => {
    const { s, r } = squareDoc()
    stampShapes(s, [r.id])
    const L = { kind: 'layer', id: s.activeLayer.id } as const
    const a = addEffect(s, L, 'pixel-outline')!
    const b = addEffect(s, L, 'drop-shadow')!
    updateEffect(s, L, b.id, { params: { dx: 3, dy: 3 } })
    const before = Array.from(compose(s).data)
    expect(rasterizeLayerEffects(s, s.activeLayer.id, a.id)).toBe(true)
    expect(getEffects(s, L).map((e) => e.id)).toEqual([b.id])
    expect(Array.from(compose(s).data)).toEqual(before)
    s.undo()
    expect(getEffects(s, L)).toHaveLength(2)
  })
})

describe('borrador de desenfoque (arrastrar un parámetro)', () => {
  function scene() {
    const s = DocumentSession.create(160, 160)
    const bmp = s.bitmapOf(s.activeLayer.id)
    for (let y = 40; y < 120; y++) for (let x = 30; x < 130; x++) bmp.set(x, y, 0xff8000ff)
    const L = { kind: 'layer', id: s.activeLayer.id } as const
    const b = addEffect(s, L, 'gaussian-blur')!
    updateEffect(s, L, b.id, { params: { radius: 12 } })
    return s
  }
  const render = (s: DocumentSession, draft?: boolean) => {
    const out = new Bitmap(s.image.width, s.image.height)
    composeImage(s.image, s.rasters, out, undefined, { draft })
    return out
  }

  it('sin borrador el resultado es el exacto de siempre', () => {
    const s = scene()
    expect(render(s, false).data).toEqual(render(s).data)
  })

  it('el borrador se parece al resultado exacto (diferencia media pequeña)', () => {
    const s = scene()
    const exact = render(s)
    const draft = render(s, true)
    let diff = 0
    for (let i = 3; i < exact.data.length; i += 4) diff += Math.abs(exact.data[i]! - draft.data[i]!)
    expect(diff / (exact.width * exact.height)).toBeLessThan(4) // sobre 255
    expect(draft.data).not.toEqual(exact.data)
  })
})

describe('duplicar capa', () => {
  it('la copia tiene formas y efectos con identificadores propios', () => {
    const { s, r } = squareDoc()
    addEffect(s, { kind: 'layer', id: s.activeLayerId }, 'gaussian-blur')
    const src = s.activeLayerId
    const copy = s.duplicateLayer(src)!
    const orig = s.image.layers.find((l) => l.id === src)!
    expect(copy.shapes[0]!.id).not.toBe(r.id)
    expect(copy.shapes[0]!.id).not.toBe(orig.shapes[0]!.id)
    expect(copy.effects[0]!.id).not.toBe(orig.effects[0]!.id)
    expect(copy.effects[0]!.params).not.toBe(orig.effects[0]!.params)
  })
})

describe('archivos con ids de forma repetidos', () => {
  it('al abrir se reparan los identificadores duplicados entre capas', () => {
    const { s, r } = squareDoc()
    const second = s.duplicateLayer(s.activeLayerId)!
    second.shapes = [cloneShape(r)] // mismo id que la forma original (como guardaban las versiones antiguas)
    const loaded = loadDocument(saveDocument(s.doc, s.rasters)).doc
    const ids = loaded.images[0]!.layers.flatMap((l) => l.shapes.map((sh) => sh.id))
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(2)
  })
})
