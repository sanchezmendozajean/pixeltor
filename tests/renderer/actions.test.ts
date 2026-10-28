import { describe, expect, it } from 'vitest'
import { ACTIONS, ACTION_MAP } from '@/actions/definitions'
import { MENUS, type MenuNode } from '@/actions/menus'
import { eventToShortcut, formatShortcut } from '@/actions/shortcuts'
import { actionLabel } from '@/actions/registry'
import { t, type I18nKey } from '@/i18n'

const ev = (key: string, code: string, mods: Partial<Record<string, boolean>> = {}) => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods
})

describe('registro de acciones', () => {
  it('los ids son únicos', () => {
    expect(new Set(ACTIONS.map((a) => a.id)).size).toBe(ACTIONS.length)
  })

  it('ningún atajo se repite', () => {
    const seen = new Map<string, string>()
    for (const a of ACTIONS) {
      for (const s of [a.shortcut, ...(a.alt ?? [])]) {
        if (!s) continue
        expect(seen.get(s), `${s} usado por ${seen.get(s)} y ${a.id}`).toBeUndefined()
        seen.set(s, a.id)
      }
    }
  })

  it('toda acción tiene etiqueta en es.json', () => {
    for (const a of ACTIONS) expect(actionLabel(a.id), a.id).not.toBe(`actions.${a.id}`)
  })

  it('los menús solo referencian acciones existentes', () => {
    const walk = (nodes: MenuNode[]) => {
      for (const n of nodes) {
        if (n.type === 'action') expect(ACTION_MAP.has(n.id), n.id).toBe(true)
        if (n.type === 'submenu') walk(n.items)
      }
    }
    for (const m of MENUS) {
      expect(t(m.label)).not.toBe(m.label)
      walk(m.items)
    }
  })

  it('t() devuelve la clave si falta y sustituye parámetros', () => {
    expect(t('nope.nada' as I18nKey)).toBe('nope.nada')
    expect(t('docs.untitled', { n: 3 })).toBe('Sin título-3')
  })
})

describe('atajos de teclado', () => {
  it('normaliza letras y modificadores', () => {
    expect(eventToShortcut(ev('n', 'KeyN', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+N')
    expect(eventToShortcut(ev('V', 'KeyV'))).toBe('V')
    expect(eventToShortcut(ev('s', 'KeyS', { ctrlKey: true, altKey: true, shiftKey: true }))).toBe(
      'Ctrl+Alt+Shift+S'
    )
  })

  it('normaliza símbolos con Mayús', () => {
    expect(eventToShortcut(ev('}', 'BracketRight', { ctrlKey: true, shiftKey: true }))).toBe(
      'Ctrl+Shift+]'
    )
    expect(eventToShortcut(ev('+', 'Equal', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl++')
  })

  it('ignora modificadores solos', () => {
    expect(eventToShortcut(ev('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull()
  })

  it('formatea para mostrar en español', () => {
    expect(formatShortcut('Ctrl+Shift+N')).toBe('Ctrl+Mayús+N')
    expect(formatShortcut('Ctrl++')).toBe('Ctrl++')
    expect(formatShortcut('Delete')).toBe('Supr')
  })
})
