// Qué relleno o contorno de una forma edita el panel Degradado y la herramienta Degradado.

import type { Fill, Shape } from '@core/index'
import type { Stroke } from '@core/model/shapes'

export type Attr = Fill | Stroke

/** El atributo elegido en Apariencia o, si no, el primer degradado de la pila (de arriba abajo). */
export function findGradientAttr(sh: Shape, activeId: string): Attr | null {
  const all: Attr[] = [...sh.appearance.fills, ...sh.appearance.strokes]
  const byId = all.find((a) => a.id === activeId)
  if (byId) return byId
  for (const id of [...sh.appearance.stack].reverse()) {
    const a = all.find((x) => x.id === id)
    if (a && a.paint.type !== 'solid') return a
  }
  return null
}
