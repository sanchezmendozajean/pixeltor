// Selector de color único de la aplicación: cualquier cuadro de color lo abre con `openColorDialog`,
// indicando el elemento junto al que debe aparecer, el color actual y qué hacer con los cambios.
// Los cambios se aplican en vivo; Aceptar los confirma y Cancelar/Esc los deshace.

import { shallowRef } from 'vue'

export interface ColorDialogHandlers {
  /** Se llama con cada cambio de color (#RRGGBB o #RRGGBBAA, conservando el alfa inicial). */
  onChange: (hex: string) => void
  /** Aceptar: cierra los cambios en vivo (un paso de historial). */
  onEnd?: () => void
  /** Cancelar: restaura estado que no es del documento (el historial lo restaura el selector). */
  onRevert?: () => void
}

export interface ColorDialogRequest extends ColorDialogHandlers {
  /** Rectángulo (px de ventana) del elemento que lo abrió; el diálogo aparece junto a él. */
  anchor: { left: number; top: number; right: number; bottom: number } | null
  /** Color inicial: #RRGGBB o #RRGGBBAA. */
  color: string
}

export const colorDialog = shallowRef<ColorDialogRequest | null>(null)

export function openColorDialog(
  anchor: Element | null,
  color: string,
  handlers: ColorDialogHandlers
): void {
  const r = anchor?.getBoundingClientRect()
  colorDialog.value = {
    anchor: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null,
    color,
    ...handlers
  }
}

export function closeColorDialog(): void {
  colorDialog.value = null
}
