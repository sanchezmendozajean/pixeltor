import { describe, expect, it } from 'vitest'
import { Bitmap, DocumentSession, composeImage, newPrefixCache, rgba } from '@core/index'

function best(fn: () => void, n = 5): number {
  let t = Infinity
  for (let i = 0; i < n; i++) {
    const s = performance.now()
    fn()
    t = Math.min(t, performance.now() - s)
  }
  return t
}

describe('caché de composición (1000×1000, 20 capas con contenido)', () => {
  it('recomponer la capa activa reutilizando lo de debajo es mucho más barato', () => {
    const s = DocumentSession.create(1000, 1000)
    const ids = [s.activeLayerId]
    for (let i = 1; i < 20; i++) ids.push(s.addLayer()!.id)
    ids.forEach((id, i) => {
      const bmp = s.bitmapOf(id)
      for (let y = 50 + i * 10; y < 750 + i * 10; y++)
        for (let x = 50 + i * 10; x < 750 + i * 10; x++) bmp.set(x, y, rgba(i * 10, 100, 200, 180))
    })
    const out = new Bitmap(1000, 1000)
    const hot = ids[15]! // quedan 4 capas por encima
    const full = best(() => composeImage(s.image, s.rasters, out))
    const cache = newPrefixCache()
    composeImage(s.image, s.rasters, out, undefined, { prefix: cache, hotLayerId: hot }) // construye
    const cached = best(() =>
      composeImage(s.image, s.rasters, out, undefined, { prefix: cache, hotLayerId: hot })
    )
    console.log(
      `composición completa: ${full.toFixed(0)} ms · con caché (capa 16/20): ${cached.toFixed(0)} ms`
    )
    expect(cached).toBeLessThan(full * 0.5)
  }, 60_000)
})
