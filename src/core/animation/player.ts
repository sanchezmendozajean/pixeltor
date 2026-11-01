// Reproducción de la animación (specs/08): qué imagen toca mostrar en un instante dado. Es una
// función pura del tiempo transcurrido; el reloj (performance.now) vive en el renderer.

import type { PxImage } from '../model/types'

export type LoopMode = 'loop' | 'pingpong' | 'once'

export interface Playlist {
  /** Índices en `doc.images` de las imágenes incluidas en la animación, en orden. */
  indices: number[]
  durations: number[]
}

/** Imágenes incluidas en la animación (las excluidas no se reproducen). */
export function playlist(images: readonly PxImage[]): Playlist {
  const indices: number[] = []
  const durations: number[] = []
  images.forEach((img, i) => {
    if (img.includeInAnimation) {
      indices.push(i)
      durations.push(Math.max(1, img.durationMs))
    }
  })
  return { indices, durations }
}

export interface FrameAt {
  /** Posición dentro de la lista de reproducción. */
  pos: number
  /** `once`: la reproducción terminó. */
  done: boolean
}

/**
 * Posición de la lista que se ve tras `elapsedMs` de reproducción a velocidad `speed`.
 * Ping-pong: ida y vuelta sin repetir los extremos (0 1 2 3 2 1 0 1 …).
 */
export function frameAt(
  durations: readonly number[],
  mode: LoopMode,
  speed: number,
  elapsedMs: number
): FrameAt {
  const n = durations.length
  if (n === 0) return { pos: 0, done: true }
  // secuencia de posiciones y duración de cada una
  const order: number[] = durations.map((_, i) => i)
  if (mode === 'pingpong') for (let i = n - 2; i >= 1; i--) order.push(i)
  const total = order.reduce((s, p) => s + durations[p]!, 0)
  const t = Math.max(0, elapsedMs) * Math.max(0.01, speed)
  let at = t
  if (mode === 'once') {
    if (t >= total) return { pos: n - 1, done: true }
  } else at = t % total
  for (const p of order) {
    const d = durations[p]!
    if (at < d) return { pos: p, done: false }
    at -= d
  }
  return { pos: order[order.length - 1]!, done: false }
}
