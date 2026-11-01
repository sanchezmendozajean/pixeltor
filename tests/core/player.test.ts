import { describe, expect, it } from 'vitest'
import { createImage, frameAt, playlist } from '@core/index'

const D = [100, 100, 200]

describe('reproducción', () => {
  it('bucle: recorre las duraciones y vuelve al principio', () => {
    const f = (t: number) => frameAt(D, 'loop', 1, t).pos
    expect([0, 99, 100, 199, 200, 399, 400, 401, 799].map(f)).toEqual([0, 0, 1, 1, 2, 2, 0, 0, 2])
  })

  it('ping-pong no repite los extremos', () => {
    const seq = (t: number) => frameAt([100, 100, 100, 100], 'pingpong', 1, t).pos
    expect([0, 100, 200, 300, 400, 500, 600, 700].map(seq)).toEqual([0, 1, 2, 3, 2, 1, 0, 1])
  })

  it('una vez: se detiene en la última imagen y avisa', () => {
    expect(frameAt(D, 'once', 1, 399)).toEqual({ pos: 2, done: false })
    expect(frameAt(D, 'once', 1, 400)).toEqual({ pos: 2, done: true })
    expect(frameAt(D, 'once', 1, 5000).done).toBe(true)
  })

  it('la velocidad escala el tiempo', () => {
    expect(frameAt(D, 'loop', 2, 50).pos).toBe(1) // 50 ms a 2× = 100 ms
    expect(frameAt(D, 'loop', 0.5, 150).pos).toBe(0) // 150 ms a 0,5× = 75 ms
  })

  it('la lista omite las imágenes excluidas', () => {
    const a = createImage(8, 8, 'a')
    const b = { ...createImage(8, 8, 'b'), includeInAnimation: false, durationMs: 50 }
    const c = { ...createImage(8, 8, 'c'), durationMs: 300 }
    const p = playlist([a, b, c])
    expect(p.indices).toEqual([0, 2])
    expect(p.durations).toEqual([100, 300])
    expect(frameAt([], 'loop', 1, 10).done).toBe(true)
  })
})
