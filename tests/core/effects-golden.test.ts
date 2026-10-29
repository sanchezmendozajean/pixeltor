// «Golden» de efectos: huella (FNV-1a de los bytes RGBA) de cada efecto con parámetros por defecto
// sobre una imagen fija. Un cambio de huella exige explicar por qué cambió el efecto.
import { describe, expect, it } from 'vitest'
import { Bitmap, EFFECT_LIST, applyEffects, newEffect, regionFromBitmap } from '@core/index'

function sprite(): Bitmap {
  const b = new Bitmap(48, 48)
  for (let y = 8; y < 40; y++)
    for (let x = 8; x < 40; x++) {
      const inCircle = (x - 24) ** 2 + (y - 24) ** 2 <= 14 * 14
      const inSquare = x < 22 && y < 22
      if (inCircle || inSquare)
        b.data.set(
          inCircle ? [60 + x * 4, 120, 200 - y * 3, 255] : [220, 60, 60, 255],
          (y * 48 + x) * 4
        )
    }
  return b
}

function fnv(d: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i]!, 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}

describe('golden de efectos', () => {
  const src = sprite()
  for (const def of EFFECT_LIST) {
    it(def.type, () => {
      const fx = newEffect(def.type)!
      const out = applyEffects(
        [fx],
        regionFromBitmap(src),
        { x: 0, y: 0, w: 48, h: 48 },
        {
          width: 48,
          height: 48
        }
      )
      expect(fnv(out.data)).toMatchSnapshot()
    })
  }
})
