import { describe, expect, it } from 'vitest'
import { Bitmap, EFFECTS, applyEffects, newEffect, regionFromBitmap } from '@core/index'

function noisy(n: number): Bitmap {
  const b = new Bitmap(n, n)
  for (let y = 100; y < n - 100; y++)
    for (let x = 100; x < n - 100; x++)
      if (((x >> 4) + (y >> 4)) & 1) b.data.set([200, 80, 40, 255], (y * n + x) * 4)
  return b
}

const best = (fn: () => void): number => {
  let t = Infinity
  for (let i = 0; i < 3; i++) {
    const s = performance.now()
    fn()
    t = Math.min(t, performance.now() - s)
  }
  return t
}

describe('rendimiento de efectos (1000×1000)', () => {
  const src = noisy(1000)
  const rect = { x: 0, y: 0, w: 1000, h: 1000 }
  const ctx = { width: 1000, height: 1000 }
  it.each([
    ['gaussian-blur', 150],
    ['drop-shadow', 300],
    ['pixel-outline', 300],
    ['hsl', 150]
  ])('%s', (type, limit) => {
    const fx = newEffect(type)!
    const ms = best(() => applyEffects([fx], regionFromBitmap(src), rect, ctx))
    console.log(`${type}: ${ms.toFixed(0)} ms`)
    expect(ms).toBeLessThan(limit * 3) // margen amplio: el objetivo estricto se mide aparte
    expect(EFFECTS.has(type)).toBe(true)
  })
})

describe('desenfoque de contenido pequeño en una imagen grande', () => {
  it('sólo cuesta lo que ocupa el contenido (forma de 100×100 en 1000×1000)', () => {
    const small = new Bitmap(1000, 1000)
    for (let y = 100; y < 200; y++) for (let x = 100; x < 200; x++) small.set(x, y, 0xff0000ff)
    const fx = newEffect('gaussian-blur')!
    fx.params['radius'] = 8
    const ms = best(() =>
      applyEffects(
        [fx],
        regionFromBitmap(small),
        { x: 0, y: 0, w: 1000, h: 1000 },
        { width: 1000, height: 1000 }
      )
    )
    console.log(`gaussian-blur (100×100 en 1000×1000): ${ms.toFixed(0)} ms`)
    expect(ms).toBeLessThan(60)
  })
})
