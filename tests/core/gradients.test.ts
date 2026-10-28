import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  type DitherMatrix,
  type GradientPaint,
  type GradientPixelMode,
  Bitmap,
  color,
  colorAt,
  defaultGradient,
  ditherThreshold,
  makeAppearance,
  makeRect,
  renderShape
} from '@core/index'

const BLACK = color(0, 0, 0)
const WHITE = color(255, 255, 255)

function gradRect(
  x: number,
  y: number,
  w: number,
  h: number,
  g: Partial<GradientPaint> & { pixelMode?: GradientPixelMode }
): ReturnType<typeof makeRect> {
  const r = makeRect(x, y, w, h, makeAppearance(BLACK, null))
  const base = defaultGradient(r, g.type ?? 'linear', BLACK, WHITE)
  r.appearance.fills[0]!.paint = { ...base, ...g }
  return r
}

const distinct = (b: Bitmap) => {
  const set = new Set<number>()
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) set.add(b.get(x, y))
  set.delete(0)
  return set
}

describe('degradados', () => {
  it('colorAt interpola entre paradas y satura en los extremos', () => {
    const stops = [
      { offset: 0, color: BLACK },
      { offset: 0.5, color: color(100, 0, 0) },
      { offset: 1, color: WHITE }
    ]
    expect(colorAt(stops, 0)).toEqual(BLACK)
    expect(colorAt(stops, 0.25)).toEqual(color(50, 0, 0))
    expect(colorAt(stops, 1)).toEqual(WHITE)
    expect(colorAt(stops, 2)).toEqual(WHITE)
  })

  it('el degradado lineal suave es monótono de izquierda a derecha', () => {
    const b = renderShape(gradRect(0, 0, 32, 4, {}), 32, 4)
    let prev = -1
    for (let x = 0; x < 32; x++) {
      const v = b.get(x, 1) >>> 24
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(b.get(0, 1) >>> 24).toBeLessThan(10)
    expect(b.get(31, 1) >>> 24).toBeGreaterThan(245)
  })

  it('bandas: exactamente N colores, en escalones de igual ancho', () => {
    const b = renderShape(gradRect(0, 0, 32, 2, { pixelMode: { mode: 'bands', steps: 4 } }), 32, 2)
    expect(distinct(b).size).toBe(4)
    expect(b.get(0, 0)).toBe(b.get(7, 0))
    expect(b.get(7, 0)).not.toBe(b.get(8, 0))
  })

  it('tramado: solo usa los N niveles y las mismas posiciones en cada ejecución', () => {
    const mk = (m: DitherMatrix) =>
      renderShape(
        gradRect(0, 0, 32, 8, { pixelMode: { mode: 'dither', matrix: m, steps: 3 } }),
        32,
        8
      )
    for (const m of ['bayer2', 'bayer4', 'bayer8', 'checker'] as const) {
      const a = mk(m)
      expect(distinct(a).size).toBeLessThanOrEqual(3)
      expect(mk(m).data).toEqual(a.data)
    }
  })

  it('el tramado está anclado a la imagen: dos formas contiguas casan con una sola', () => {
    const mode: GradientPixelMode = { mode: 'dither', matrix: 'bayer4', steps: 4 }
    const base = defaultGradient(
      makeRect(0, 0, 32, 8, makeAppearance(BLACK, null)),
      'linear',
      BLACK,
      WHITE
    )
    const whole = gradRect(0, 0, 32, 8, { ...base, pixelMode: mode })
    // mitades con el mismo degradado en coordenadas de imagen (se compensa la posición local)
    const left = gradRect(0, 0, 16, 8, { ...base, pixelMode: mode })
    const right = gradRect(16, 0, 16, 8, {
      ...base,
      from: { x: base.from.x - 16, y: base.from.y },
      to: { x: base.to.x - 16, y: base.to.y },
      pixelMode: mode
    })
    const w = renderShape(whole, 32, 8)
    const l = renderShape(left, 32, 8)
    const r = renderShape(right, 32, 8)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 32; x++) expect((x < 16 ? l : r).get(x, y), `${x},${y}`).toBe(w.get(x, y))
  })

  it('las matrices de Bayer usan todos los umbrales una vez por celda', () => {
    for (const [m, n] of [
      ['bayer2', 2],
      ['bayer4', 4],
      ['bayer8', 8]
    ] as const) {
      const set = new Set<number>()
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) set.add(ditherThreshold(m, x, y))
      expect(set.size).toBe(n * n)
    }
  })

  it('radial y angular producen simetría esperada', () => {
    const rad = renderShape(
      gradRect(0, 0, 17, 17, {
        type: 'radial',
        from: { x: 8.5, y: 8.5 },
        to: { x: 17, y: 8.5 }
      }),
      17,
      17
    )
    expect(rad.get(8, 8) >>> 24).toBeLessThan(5)
    expect(rad.get(8, 0)).toBe(rad.get(0, 8))
    const ang = renderShape(
      gradRect(0, 0, 16, 16, { type: 'angular', from: { x: 8, y: 8 }, to: { x: 16, y: 8 } }),
      16,
      16
    )
    // a las 3 en punto empieza el giro; justo debajo (ángulo pequeño) es oscuro y justo encima, claro
    expect(ang.get(15, 9) >>> 24).toBeLessThan(ang.get(15, 6) >>> 24)
  })

  it('modo paleta: solo aparecen colores de la paleta', () => {
    const palette = [color(10, 20, 30), color(200, 100, 50), color(250, 250, 250)]
    const b = renderShape(
      gradRect(0, 0, 32, 8, { pixelMode: { mode: 'palette', colors: palette, dither: true } }),
      32,
      8
    )
    const allowed = new Set(
      palette.map((c) => ((c.r << 24) | (c.g << 16) | (c.b << 8) | 255) >>> 0)
    )
    for (const c of distinct(b)) expect(allowed.has(c)).toBe(true)
  })

  it('GOLDEN: huella de los degradados con tramado en las cuatro matrices', () => {
    const parts: string[] = []
    for (const m of ['bayer2', 'bayer4', 'bayer8', 'checker'] as const) {
      for (const type of ['linear', 'radial', 'angular'] as const) {
        const b = renderShape(
          gradRect(0, 0, 24, 24, {
            type,
            pixelMode: { mode: 'dither', matrix: m, steps: 4 }
          }),
          24,
          24
        )
        parts.push(`${m}-${type}:${createHash('sha256').update(b.data).digest('hex').slice(0, 12)}`)
      }
    }
    expect(parts.join('|')).toMatchSnapshot()
  })
})

describe('puntos medios', () => {
  it('el punto medio desplaza el 50 % del color dentro del tramo', () => {
    const stops = [
      { offset: 0, color: BLACK, mid: 0.25 },
      { offset: 1, color: WHITE }
    ]
    expect(colorAt(stops, 0.25).r).toBe(128)
    expect(colorAt(stops, 0).r).toBe(0)
    expect(colorAt(stops, 1).r).toBe(255)
    // con mid 0,5 es el degradado normal
    expect(
      colorAt(
        [stops[0]!, stops[1]!].map((s) => ({ ...s, mid: 0.5 })),
        0.25
      ).r
    ).toBe(64)
  })
})
