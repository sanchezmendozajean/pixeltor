// Simetría de pintura: espejos y giros respecto al centro del lienzo. Trabaja sobre píxeles
// enteros, así que el resultado es exacto (también con puntas de tamaño par).

export interface Symmetry {
  /** Espejo respecto al eje vertical central (izquierda ↔ derecha). */
  x: boolean
  /** Espejo respecto al eje horizontal central (arriba ↔ abajo). */
  y: boolean
  /** Repeticiones por giro: 1 = sin giro, 2 = 180°, 4 = 90°. */
  rot: 1 | 2 | 4
}

export type PixelMap = (x: number, y: number) => [number, number]

export const NO_SYMMETRY: Symmetry = { x: false, y: false, rot: 1 }

export function isSymmetric(s: Symmetry | undefined): s is Symmetry {
  return !!s && (s.x || s.y || s.rot > 1)
}

/**
 * Transformaciones (sin la identidad) de un lienzo de w × h. El giro de 90° usa el centro del
 * lienzo; en lienzos no cuadrados el resultado puede salirse del lienzo y se recorta al pintar.
 */
export function symmetryMaps(s: Symmetry, w: number, h: number): PixelMap[] {
  const out: PixelMap[] = []
  const cx = w / 2
  const cy = h / 2
  const rot90: PixelMap = (x, y) => [Math.round(cx + cy - y - 1), Math.round(cy - cx + x)]
  const rotations = s.rot === 4 ? [0, 1, 2, 3] : s.rot === 2 ? [0, 2] : [0]
  for (const fx of s.x ? [false, true] : [false])
    for (const fy of s.y ? [false, true] : [false])
      for (const r of rotations) {
        if (!fx && !fy && r === 0) continue
        out.push((x, y) => {
          let p: [number, number] = [fx ? w - 1 - x : x, fy ? h - 1 - y : y]
          for (let i = 0; i < r; i++) p = rot90(p[0], p[1])
          return p
        })
      }
  return out
}
