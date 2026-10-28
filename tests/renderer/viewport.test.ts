import { describe, expect, it } from 'vitest'
import { Viewport } from '@/viewport/Viewport'

describe('Viewport', () => {
  it('convierte entre pantalla e imagen', () => {
    const v = new Viewport(32, 32)
    v.resize(800, 600)
    v.zoom = 8
    v.panX = 100
    v.panY = 50
    expect(v.toImage(108, 58)).toEqual({ x: 1, y: 1 })
    expect(v.toScreen(1, 1)).toEqual({ x: 108, y: 58 })
  })

  it('encaja con zoom entero y centra', () => {
    const v = new Viewport(32, 32)
    v.resize(800, 600)
    v.fit()
    expect(Number.isInteger(v.zoom)).toBe(true)
    expect(v.panX).toBe((800 - 32 * v.zoom) / 2)
  })

  it('el zoom con rueda mantiene el píxel bajo el cursor', () => {
    const v = new Viewport(64, 64)
    v.resize(800, 600)
    v.fit()
    const before = v.toImage(300, 200)
    v.stepZoom(1, 300, 200)
    const after = v.toImage(300, 200)
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
  })

  it('recorre los niveles preferentes sin salirse de rango', () => {
    const v = new Viewport(8, 8)
    v.resize(100, 100)
    v.zoom = 1
    v.stepZoom(1)
    expect(v.zoom).toBe(2)
    v.zoom = 64
    v.stepZoom(1)
    expect(v.zoom).toBe(64)
    v.zoom = 0.25
    v.stepZoom(-1)
    expect(v.zoom).toBe(0.25)
  })
})
