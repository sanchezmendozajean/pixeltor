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
