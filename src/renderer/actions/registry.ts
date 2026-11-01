// Runtime del registro de acciones: manejadores, ejecución, etiquetas y atajos.
import { reactive } from 'vue'
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

/** Atajos personalizados (id → atajo canónico; '' = sin atajo). Reactivo para menús y tooltips. */
const overrides = reactive(new Map<string, string>())

/** atajo canónico → id de acción */
const byShortcut = new Map<string, string>()

/** Atajo vigente de una acción: el personalizado o el de fábrica ('' = ninguno). */
export function effectiveShortcut(id: string): string {
  return overrides.get(id) ?? ACTION_MAP.get(id)?.shortcut ?? ''
}

function rebuild(): void {
  byShortcut.clear()
  for (const def of ACTIONS) {
    const custom = overrides.get(def.id)
    const list = custom !== undefined ? [custom] : [def.shortcut, ...(def.alt ?? [])]
    for (const s of list) if (s) byShortcut.set(s, def.id)
  }
}
rebuild()

/** Acción que ya usa ese atajo, si hay alguna. */
export function shortcutOwner(shortcut: string): string | undefined {
  return byShortcut.get(shortcut)
}

export function hasCustomShortcut(id: string): boolean {
  return overrides.has(id)
}

/** Fija (o quita con '') el atajo de una acción; null restablece el de fábrica. */
export function setShortcut(id: string, shortcut: string | null): void {
  if (!ACTION_MAP.has(id)) return
  if (shortcut === null || shortcut === (ACTION_MAP.get(id)?.shortcut ?? '')) overrides.delete(id)
  else overrides.set(id, shortcut)
  rebuild()
}

export function resetShortcuts(): void {
  overrides.clear()
  rebuild()
}

/** Sólo las diferencias respecto a los atajos de fábrica (lo que se guarda en ajustes). */
export function shortcutOverrides(): Record<string, string> {
  return Object.fromEntries(overrides)
}

export function loadShortcutOverrides(saved: Record<string, string>): void {
  overrides.clear()
  for (const [id, s] of Object.entries(saved)) if (ACTION_MAP.has(id)) overrides.set(id, s)
  rebuild()
}

export function registerHandler(id: string, handler: ActionHandler): void {
  if (!ACTION_MAP.has(id)) throw new Error(`Acción desconocida: ${id}`)
  handlers.set(id, handler)
}

export function actionLabel(id: string): string {
  return t(`actions.${id}` as I18nKey)
}

export function actionShortcut(id: string): string | undefined {
  const s = effectiveShortcut(id)
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
