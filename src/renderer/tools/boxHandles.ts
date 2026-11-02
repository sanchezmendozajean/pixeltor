// Posición de los tiradores de la caja de selección. Cada tirador se coloca en el centro del píxel
// del borde que le corresponde (no en la arista entre dos píxeles), para que quede siempre encima
// de un píxel de la forma.

export interface HandleBox {
  x: number
  y: number
  w: number
  h: number
}

/** Centro del píxel de la caja en esa fracción (0 = primero, 0,5 = el del medio, 1 = último). */
function along(start: number, size: number, f: number): number {
  if (size < 1) return start + size * f // caja degenerada: no hay píxel al que ceñirse
  if (f <= 0) return start + 0.5
  if (f >= 1) return start + size - 0.5
  return Math.min(start + size - 0.5, start + Math.floor(size / 2) + 0.5)
}

/** Posición en imagen del tirador (hx, hy ∈ {0, 0.5, 1}). */
export function handlePoint(b: HandleBox, hx: number, hy: number): { x: number; y: number } {
  return { x: along(b.x, b.w, hx), y: along(b.y, b.h, hy) }
}

/**
 * Arista de la caja que se lleva al píxel `p` al arrastrar un tirador: el tirador de la izquierda
 * o de arriba queda sobre ese píxel (arista = su inicio) y el de la derecha o de abajo también
 * (arista = su final).
 */
export function edgeForPixel(f: number, h: number): number {
  return h === 0 ? Math.floor(f) : h === 1 ? Math.floor(f) + 1 : Math.round(f)
}
