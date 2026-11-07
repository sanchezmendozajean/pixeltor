import { describe, expect, it } from 'vitest'
import {
  AsyncFxProvider,
  Bitmap,
  type FxJob,
  applyEffects,
  newEffect,
  regionFromBitmap
} from '@core/index'

const ctx = { width: 200, height: 200 }
const bigRect = { x: 0, y: 0, w: 200, h: 200 }
function image(): Bitmap {
  const b = new Bitmap(200, 200)
  for (let y = 80; y < 120; y++) for (let x = 80; x < 120; x++) b.set(x, y, 0xff0000ff)
  return b
}
const flush = () => new Promise((r) => setTimeout(r, 0))

function setup(fail = false) {
  const jobs: FxJob[] = []
  let ready = 0
  const prov = new AsyncFxProvider(
    async (job) => {
      jobs.push(job)
      if (fail) throw new Error('boom')
      return applyEffects(job.effects, job.input, job.out, job.ctx).data
    },
    () => ready++
  )
  return { prov, jobs, ready: () => ready }
}

describe('efectos asíncronos', () => {
  it('áreas pequeñas se calculan en línea sin worker', () => {
    const { prov, jobs } = setup()
    const fx = newEffect('invert')!
    const r = prov.apply('l', [fx], regionFromBitmap(image()), { x: 90, y: 90, w: 8, h: 8 }, ctx)
    expect(jobs).toHaveLength(0)
    expect(Array.from(r.data.subarray(0, 4))).toEqual([0, 255, 255, 255])
  })

  it('muestra la entrada, calcula en el ejecutor y luego sirve el resultado en caché', async () => {
    const { prov, jobs, ready } = setup()
    const fx = newEffect('invert')!
    const src = regionFromBitmap(image())
    const first = prov.apply('l', [fx], src, bigRect, ctx)
    expect(
      Array.from(first.data.subarray((100 * 200 + 100) * 4, (100 * 200 + 100) * 4 + 4))
    ).toEqual([255, 0, 0, 255])
    await flush()
    expect(ready()).toBe(1)
    const second = prov.apply('l', [fx], src, bigRect, ctx)
    expect(
      Array.from(second.data.subarray((100 * 200 + 100) * 4, (100 * 200 + 100) * 4 + 4))
    ).toEqual([0, 255, 255, 255])
    expect(jobs).toHaveLength(1) // la segunda llamada salió de la caché
  })

  it('con peticiones seguidas sólo se calcula la última de cada ranura', async () => {
    const { prov, jobs } = setup()
    const src = regionFromBitmap(image())
    const mk = (r: number) => {
      const fx = newEffect('gaussian-blur')!
      fx.params['radius'] = r
      return [fx]
    }
    prov.apply('l', mk(1), src, bigRect, ctx)
    prov.apply('l', mk(2), src, bigRect, ctx)
    prov.apply('l', mk(3), src, bigRect, ctx)
    await flush()
    await flush()
    expect(jobs.map((j) => j.effects[0]!.params['radius'])).toEqual([1, 3])
  })

  it('mientras llega el nuevo resultado se conserva el último válido', async () => {
    const { prov } = setup()
    const src = regionFromBitmap(image())
    const a = newEffect('invert')!
    prov.apply('l', [a], src, bigRect, ctx)
    await flush()
    const valid = prov.apply('l', [a], src, bigRect, ctx)
    const b = newEffect('posterize')!
    const during = prov.apply('l', [b], src, bigRect, ctx)
    expect(during).toBe(valid)
  })

  it('un fallo del worker no provoca reintentos en bucle', async () => {
    const { prov, jobs } = setup(true)
    const fx = newEffect('invert')!
    const src = regionFromBitmap(image())
    prov.apply('l', [fx], src, bigRect, ctx)
    await flush()
    prov.apply('l', [fx], src, bigRect, ctx)
    await flush()
    expect(jobs).toHaveLength(1)
  })
})

describe('caché de efectos', () => {
  it('formas negras opacas de distinto tamaño no comparten resultado', async () => {
    // Regresión: con un hash débil (FNV por palabras) los estados que sólo difieren en el byte
    // alto (0xFF000000 vs 0) colisionaban y se mostraba el resultado de otro tamaño.
    const { prov } = setup()
    const fx = newEffect('smooth-edges')!
    const out = { x: 0, y: 0, w: 200, h: 200 }
    const black = (w: number, h: number) => {
      const b = new Bitmap(200, 200)
      for (let y = 10; y < 10 + h; y++) for (let x = 10; x < 10 + w; x++) b.set(x, y, 0x000000ff)
      return regionFromBitmap(b, 0, 0)
    }
    const sizes: [number, number][] = []
    for (let w = 100; w <= 160; w += 4) sizes.push([w, w - 7], [w + 1, w])
    for (const [w, h] of sizes) {
      prov.apply('s', [fx], black(w, h), out, ctx)
      await flush()
      await flush()
    }
    for (const [w, h] of sizes) {
      const r = prov.apply('s', [fx], black(w, h), out, ctx)
      // el resultado cacheado corresponde a ESTE tamaño: su extremo derecho/inferior coincide
      const at = (x: number, y: number) => r.data[(y * 200 + x) * 4 + 3]!
      expect(at(10 + w - 1, 10 + Math.floor(h / 2))).toBeGreaterThan(0)
      expect(at(10 + w + 1, 10 + Math.floor(h / 2))).toBe(0)
      expect(at(10 + Math.floor(w / 2), 10 + h - 1)).toBeGreaterThan(0)
      expect(at(10 + Math.floor(w / 2), 10 + h + 1)).toBe(0)
    }
  })
})
