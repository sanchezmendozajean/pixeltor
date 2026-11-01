// Reproducción de la animación en el visor (specs/08). El reloj acumula tiempo con
// performance.now(); qué imagen toca lo decide el core (`frameAt`).

import { type LoopMode, frameAt, playlist } from '@core/index'
import type { Workspace } from './workspace'
import type { ViewerState } from './viewer'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'

let raf = 0
let owner: { ws: Workspace; viewer: ViewerState } | null = null

export function stopPlayback(): void {
  cancelAnimationFrame(raf)
  const ui = useUiStore()
  ui.playing = false
  ui.fps = 0
  owner?.ws.setViewerPlay(owner.viewer, null)
  owner = null
}

export function startPlayback(ws: Workspace, mode: LoopMode): void {
  stopPlayback()
  const s = ws.session
  const ui = useUiStore()
  const pl = playlist(s.doc.images)
  if (!pl.indices.length) return
  const viewer = ws.activeViewer
  owner = { ws, viewer }
  ui.playing = true
  // empieza por la imagen activa si forma parte de la animación
  const active = s.doc.images.findIndex((i) => i.id === s.activeImageId)
  const startPos = Math.max(0, pl.indices.indexOf(active))
  const offset = pl.durations.slice(0, startPos).reduce((a, b) => a + b, 0) / ui.speed
  const t0 = performance.now() - offset
  let shown = ''
  let frames = 0
  let fpsStart = performance.now()
  const docs = useDocumentsStore()
  const tab = docs.activeId

  const tick = (now: number): void => {
    if (docs.activeId !== tab || !ws.viewer(viewer.id)) return stopPlayback() // otro documento o visor cerrado
    const f = frameAt(pl.durations, mode, ui.speed, now - t0)
    const id = s.doc.images[pl.indices[f.pos]!]!.id
    if (id !== shown) {
      shown = id
      ws.setViewerPlay(viewer, id)
      frames++
    }
    if (now - fpsStart >= 500) {
      ui.fps = Math.round((frames * 1000) / (now - fpsStart))
      frames = 0
      fpsStart = now
    }
    if (f.done) return stopPlayback()
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}
