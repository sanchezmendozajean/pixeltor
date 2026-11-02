// Teclado de los controles de color (cuadro de saturación/brillo y barra de tono).

/** Desplazamiento (x, y) en fracción de 0..1 para una flecha (Mayús = paso grande), o null. */
export function arrowStep(e: KeyboardEvent): [number, number] | null {
  const d = e.shiftKey ? 0.1 : 0.01
  const k: Record<string, [number, number]> = {
    ArrowLeft: [-d, 0],
    ArrowRight: [d, 0],
    ArrowUp: [0, -d],
    ArrowDown: [0, d]
  }
  const v = k[e.key]
  if (v) e.preventDefault()
  return v ?? null
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
