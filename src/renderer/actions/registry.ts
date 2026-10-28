// Runtime del registro de acciones: manejadores, ejecución, etiquetas y atajos.
import { t, type I18nKey } from '@/i18n'
import { ACTION_MAP, ACTIONS } from './definitions'
import { eventToShortcut, formatShortcut, isBareShortcut } from './shortcuts'

export interface ActionHandler {
  run: () => void
  enabled?: () => boolean
  /** Si existe, la acción es conmutable y muestra una marca en los menús. */
  checked?: () => boolean
}

const handlers = new Map<string, ActionHandler>()

/** atajo canónico → id de acción */
const byShortcut = new Map<string, string>()
for (const def of ACTIONS) {
  for (const s of [def.shortcut, ...(def.alt ?? [])]) {
    if (s) byShortcut.set(s, def.id)
  }
}

export function registerHandler(id: string, handler: ActionHandler): void {
  if (!ACTION_MAP.has(id)) throw new Error(`Acción desconocida: ${id}`)
  handlers.set(id, handler)
}

export function actionLabel(id: string): string {
  return t(`actions.${id}` as I18nKey)
}

export function actionShortcut(id: string): string | undefined {
  const s = ACTION_MAP.get(id)?.shortcut
  return s ? formatShortcut(s) : undefined
}

export function actionIcon(id: string): string | undefined {
  return ACTION_MAP.get(id)?.icon
}

export function isEnabled(id: string): boolean {
  const h = handlers.get(id)
  return !!h && (h.enabled?.() ?? true)
}

export function isChecked(id: string): boolean | undefined {
  return handlers.get(id)?.checked?.()
}

export function execute(id: string): boolean {
  const h = handlers.get(id)
  if (!h || !(h.enabled?.() ?? true)) return false
  h.run()
  return true
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
}

/** Edición de texto nativa que no debe interceptarse dentro de un campo. */
const NATIVE_TEXT = new Set([
  'Ctrl+Z',
  'Ctrl+Y',
  'Ctrl+Shift+Z',
  'Ctrl+X',
  'Ctrl+C',
  'Ctrl+V',
  'Ctrl+A'
])

/** Despacha un evento de teclado; devuelve true si ejecutó una acción. */
export function handleKeydown(e: KeyboardEvent): boolean {
  if (e.repeat) return false
  const shortcut = eventToShortcut(e)
  if (!shortcut) return false
  const id = byShortcut.get(shortcut)
  if (!id) return false
  if (isEditable(e.target) && (isBareShortcut(shortcut) || NATIVE_TEXT.has(shortcut))) return false
  if (!execute(id)) return false
  e.preventDefault()
  return true
}
