import { describe, expect, it } from 'vitest'
import { DocumentSession, Stroke, rgba, symmetryMaps } from '@core/index'

const RED = rgba(255, 0, 0, 255)
const px = (s: DocumentSession, x: number, y: number) => s.bitmapOf(s.activeLayer.id).get(x, y)

function draw(
  s: DocumentSession,
  sym: { x: boolean; y: boolean; rot: 1 | 2 | 4 },
  tool: 'pencil' | 'brush' = 'pencil',
  size = 1
) {
  const st = new Stroke(s, { tool, color: RED, size, shape: 'square', symmetry: sym })
  st.move(2, 1)
  st.end()
}

describe('simetría de pintura', () => {
  it('espejo horizontal: pinta el reflejo respecto al centro', () => {
    const s = DocumentSession.create(10, 10)
    draw(s, { x: true, y: false, rot: 1 })
    expect(px(s, 2, 1)).toBe(RED)
    expect(px(s, 7, 1)).toBe(RED)
    expect(px(s, 2, 8)).toBe(0)
  })

  it('cuatro cuadrantes y giro de 90° dan 4 y 8 puntos distintos', () => {
    const s = DocumentSession.create(10, 10)
    draw(s, { x: true, y: true, rot: 1 })
    let n = 0
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (px(s, x, y) === RED) n++
    expect(n).toBe(4)
    const t = DocumentSession.create(10, 10)
    draw(t, { x: true, y: false, rot: 4 })
    n = 0
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (px(t, x, y) === RED) n++
    expect(n).toBe(8)
  })

  it('el pincel de tamaño par es exactamente simétrico y se deshace en un paso', () => {
    const s = DocumentSession.create(12, 12)
    draw(s, { x: true, y: false, rot: 1 }, 'brush', 4)
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 6; x++) expect(px(s, x, y)).toBe(px(s, 11 - x, y))
    s.undo()
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) expect(px(s, x, y)).toBe(0)
  })

  it('sin simetría no hay transformaciones', () => {
    expect(symmetryMaps({ x: false, y: false, rot: 1 }, 8, 8)).toHaveLength(0)
  })
})
