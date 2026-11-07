// Posición de los tiradores de la caja de selección. Los de las esquinas y los bordes se colocan en
// el centro del píxel del borde (no en la arista entre dos píxeles), para que queden encima de un
// píxel de la forma; los tiradores intermedios van en el centro exacto de la caja (con un número
// par de píxeles caen sobre la arista central).

export interface HandleBox {
  x: number
  y: number
  w: number
  h: number
}

/** Posición en esa fracción: 0 = centro del primer píxel, 1 = del último, 0,5 = centro de la caja. */
function along(start: number, size: number, f: number): number {
  if (size < 1) return start + size * f // caja degenerada: no hay píxel al que ceñirse
  if (f <= 0) return start + 0.5
  if (f >= 1) return start + size - 0.5
  return start + size / 2
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
