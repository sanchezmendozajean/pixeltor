import { describe, expect, it } from 'vitest'
import { DocumentSession, Stroke, rgba } from '@core/index'

const BLACK = rgba(0, 0, 0)

/** Alto (en píxeles pintados) de la columna x. */
function thickness(s: DocumentSession, x: number): number {
  const b = s.bitmapOf(s.activeLayerId)
  let n = 0
  for (let y = 0; y < b.height; y++) if (b.get(x, y) & 255) n++
  return n
}

describe('presión de tableta', () => {
  it('el pincel engorda con la presión a lo largo del trazo', () => {
    const s = DocumentSession.create(64, 32)
    const st = new Stroke(s, {
      tool: 'brush',
      color: BLACK,
      size: 9,
      shape: 'square',
      pressure: true
    })
    st.move(4, 16, 0.2)
    st.move(58, 16, 1)
    st.end()
    expect(thickness(s, 6)).toBeLessThan(thickness(s, 30))
    expect(thickness(s, 30)).toBeLessThan(thickness(s, 55))
    expect(thickness(s, 55)).toBeLessThanOrEqual(9 + 0)
  })

  it('sin la opción activada o con el lápiz el tamaño no cambia', () => {
    for (const opt of [
      { tool: 'brush' as const, pressure: false },
      { tool: 'pencil' as const, pressure: true }
    ]) {
      const s = DocumentSession.create(64, 32)
      const st = new Stroke(s, { ...opt, color: BLACK, size: 9, shape: 'square' })
      st.move(4, 16, 0.1)
      st.move(58, 16, 1)
      st.end()
      expect(thickness(s, 8)).toBe(thickness(s, 50))
    }
  })

  it('el tamaño mínimo es 1 px aunque la presión sea 0', () => {
    const s = DocumentSession.create(32, 32)
    const st = new Stroke(s, {
      tool: 'brush',
      color: BLACK,
      size: 9,
      shape: 'square',
      pressure: true
    })
    st.move(4, 16, 0)
    st.move(20, 16, 0)
    st.end()
    expect(thickness(s, 12)).toBe(1)
  })

  it('el borrador también sigue la presión y todo es un solo paso deshacible', () => {
    const s = DocumentSession.create(64, 32)
    const b = s.bitmapOf(s.activeLayerId)
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) b.set(x, y, BLACK)
    const st = new Stroke(s, {
      tool: 'eraser',
      color: BLACK,
      size: 9,
      shape: 'square',
      pressure: true
    })
    st.move(4, 16, 0.2)
    st.move(58, 16, 1)
    st.end()
    expect(32 - thickness(s, 6)).toBeLessThan(32 - thickness(s, 55))
    s.undo()
    expect(thickness(s, 30)).toBe(32)
  })
})
