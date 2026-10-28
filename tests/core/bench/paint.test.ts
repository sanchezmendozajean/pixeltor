import { describe, expect, it } from 'vitest'
import { DocumentSession, Stroke, rgba } from '@core/index'

// Vitest 5 ya no trae `bench`: medimos con un temporizador y un umbral del objetivo (specs/03).
describe('rendimiento: pintura en 1000×1000 con 20 capas', () => {
  it('un segmento de pincel de 8 px tarda < 16 ms de media', () => {
    const s = DocumentSession.create(1000, 1000)
    for (let i = 0; i < 19; i++) s.addLayer()
    const N = 50
    const t0 = performance.now()
    for (let i = 0; i < N; i++) {
      const st = new Stroke(s, { tool: 'brush', color: rgba(255, 0, 0), size: 8, shape: 'round' })
      st.move(100, 100 + i)
      st.move(160, 130 + i)
      st.end()
    }
    const avg = (performance.now() - t0) / N
    console.log(`segmento de pincel: ${avg.toFixed(2)} ms de media`)
    expect(avg).toBeLessThan(16)
  })
})
