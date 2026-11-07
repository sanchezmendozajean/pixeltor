import { describe, expect, it } from 'vitest'
import { Bitmap, applyEffects, newEffect, regionFromBitmap } from '@core/index'

function run(
  src: Bitmap,
  params: Record<string, number | string | boolean> = {}
): Uint8ClampedArray {
  const fx = newEffect('smooth-edges')!
  Object.assign(fx.params, params)
  const out = applyEffects(
    [fx],
    regionFromBitmap(src),
    { x: 0, y: 0, w: src.width, h: src.height },
    { width: src.width, height: src.height }
  )
  return out.data
}

const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3]!

/** Triángulo rectángulo escalonado (diagonal) y un rectángulo de bordes rectos. */
function sprite(): Bitmap {
  const b = new Bitmap(24, 24)
  const set = (x: number, y: number) => b.data.set([200, 40, 40, 255], (y * 24 + x) * 4)
  for (let y = 4; y < 16; y++) for (let x = 4; x <= y; x++) set(x, y)
  for (let y = 4; y < 10; y++) for (let x = 14; x < 20; x++) set(x, y)
  return b
}

describe('efecto Suavizar bordes', () => {
  it('con intensidad 0 no cambia nada', () => {
    const src = sprite()
    expect(Array.from(run(src, { intensity: 0 }))).toEqual(Array.from(src.data))
  })

  it('suaviza los escalones de la diagonal con alfa parcial', () => {
    const d = run(sprite())
    let partial = 0
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0 && d[i]! < 255) partial++
    expect(partial).toBeGreaterThan(0)
  })

  it('deja intactos el interior y los bordes rectos', () => {
    const d = run(sprite())
    // rectángulo 14..19 × 4..9: los lados rectos siguen duros (las 4 esquinas sí se redondean)
    for (let y = 5; y < 9; y++) {
      expect(alpha(d, 24, 14, y)).toBe(255)
      expect(alpha(d, 24, 19, y)).toBe(255)
      expect(alpha(d, 24, 13, y)).toBe(0)
      expect(alpha(d, 24, 20, y)).toBe(0)
    }
    for (let x = 15; x < 19; x++) {
      expect(alpha(d, 24, x, 4)).toBe(255)
      expect(alpha(d, 24, x, 9)).toBe(255)
    }
    expect(alpha(d, 24, 10, 12)).toBe(255)
  })

  it('es determinista y no modifica la entrada', () => {
    const src = sprite()
    const before = Array.from(src.data)
    expect(Array.from(run(src))).toEqual(Array.from(run(src)))
    expect(Array.from(src.data)).toEqual(before)
  })
})

describe('Suavizar bordes: suavidad extra', () => {
  it('con 0 es idéntico y con valor suaviza más (también los lados rectos)', () => {
    const src = sprite()
    const base = run(src)
    expect(Array.from(run(src, { softness: 0 }))).toEqual(Array.from(base))
    const soft = run(src, { softness: 100 })
    let basePartial = 0
    let softPartial = 0
    for (let i = 3; i < base.length; i += 4) {
      if (base[i]! > 0 && base[i]! < 255) basePartial++
      if (soft[i]! > 0 && soft[i]! < 255) softPartial++
    }
    expect(softPartial).toBeGreaterThan(basePartial)
  })

  it('admite hasta 4 pasadas', () => {
    const d = run(sprite(), { passes: 4 })
    expect(d.length).toBe(24 * 24 * 4)
  })
})

describe('Suavizar bordes: conservar trazo original', () => {
  it('los píxeles opacos de origen siguen opacos y el halo se mantiene', () => {
    const src = sprite()
    const d = run(src, { softness: 100, keepOriginal: true })
    const plain = run(src, { softness: 100 })
    let lost = 0
    let halo = 0
    for (let i = 3; i < d.length; i += 4) {
      if (src.data[i] === 255 && d[i] !== 255) lost++
      if (src.data[i] === 0 && d[i]! > 0 && plain[i]! > 0) halo++
    }
    expect(lost).toBe(0)
    expect(halo).toBeGreaterThan(0)
    // sin la opción, la suavidad sí aclara píxeles del trazo
    let thinned = 0
    for (let i = 3; i < plain.length; i += 4) if (src.data[i] === 255 && plain[i] !== 255) thinned++
    expect(thinned).toBeGreaterThan(0)
  })
})
