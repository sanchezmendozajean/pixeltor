import { describe, expect, it } from 'vitest'
import {
  AnchorDrag,
  Bitmap,
  DocumentSession,
  addShape,
  color,
  composeImage,
  convertToPath,
  makeAppearance,
  makeEllipse
} from '@core/index'

// Objetivo (specs/03): arrastrar un ancla de una forma con 2 contornos en 1000×1000 a ≥ 30 fps.
describe('rendimiento: edición de anclas en 1000×1000', () => {
  it('un fotograma de arrastre (editar + recomponer) tarda < 33 ms de media', () => {
    const s = DocumentSession.create(1000, 1000)
    const ap = makeAppearance(color(200, 40, 40), color(255, 255, 255), 3)
    ap.strokes.push({ ...ap.strokes[0]!, id: 'second', width: 1, align: 'outside' })
    ap.stack.push('second')
    const e = makeEllipse(500, 500, 300, 250, ap)
    addShape(s, e)
    convertToPath(s, [e.id])
    const out = new Bitmap(1000, 1000)
    const N = 20
    const drag = new AnchorDrag(s, e.id, [{ subpath: 0, index: 0, part: 'p' }])
    const t0 = performance.now()
    for (let i = 0; i < N; i++) {
      drag.moveBy(i, i / 2)
      composeImage(s.image, s.rasters, out)
    }
    const avg = (performance.now() - t0) / N
    drag.end()
    console.log(`fotograma de edición de ancla: ${avg.toFixed(1)} ms de media`)
    expect(avg).toBeLessThan(33)
  })
})
