// Conversión de eventos de teclado a atajos canónicos y formato para mostrar.

/** Símbolos que se obtienen con Mayús: se normalizan a la tecla base. */
const SHIFTED: Record<string, string> = {
  '{': '[',
  '}': ']',
  '<': ',',
  '>': '.',
  '|': '\\',
  '"': "'",
  ':': ';',
  '?': '/',
  _: '-'
}

interface KeyLike {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey?: boolean
}

/** Convierte un evento de teclado al formato canónico "Ctrl+Alt+Shift+Tecla", o null si es solo un modificador. */
export function eventToShortcut(e: KeyLike): string | null {
  let key = e.key
  if (['Control', 'Shift', 'Alt', 'Meta', 'Dead', 'AltGraph'].includes(key)) return null
  let shift = e.shiftKey

  if (e.code.startsWith('Key')) key = e.code.slice(3)
  else if (e.code.startsWith('Digit')) key = e.code.slice(5)
  else if (e.code === 'NumpadAdd') {
    key = '+'
    shift = false
  } else if (e.code === 'NumpadSubtract') key = '-'
  else if (key === '+')
    shift = false // Ctrl++ es Mayús+= en teclado US
  else if (key in SHIFTED) key = SHIFTED[key]!
  else if (key === ' ') key = 'Space'
  else if (key === 'Esc') key = 'Escape'
  else if (key.length === 1) key = key.toUpperCase()

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (shift) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

const DISPLAY: Record<string, string> = {
  Shift: 'Mayús',
  Delete: 'Supr',
  Enter: 'Intro',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Espacio'
}

/** Formato para menús y tooltips ("Ctrl+Mayús+N"). */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split(/\+(?=.)/)
    .map((p) => DISPLAY[p] ?? p)
    .join('+')
}

/** ¿El atajo es de una sola tecla sin Ctrl/Alt (se ignora al escribir en un campo)? */
export function isBareShortcut(shortcut: string): boolean {
  return !/^(Ctrl|Alt)\+/.test(shortcut)
}
