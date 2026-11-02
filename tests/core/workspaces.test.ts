import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WORKSPACES,
  MAX_WORKSPACES,
  PANEL_IDS,
  sanitizeLayout,
  sanitizeWorkspaces
} from '@shared/workspaces'

const layout = {
  dock: true,
  panels: ['layers', 'color'],
  strip: 'collapsed',
  viewers: '2v',
  toolbarColumns: 2
}

describe('espacios de trabajo', () => {
  it('los integrados son válidos y cubren los cuatro de la spec', () => {
    expect(BUILTIN_WORKSPACES.map((b) => b.id)).toEqual([
      'essentials',
      'animation',
      'vectors',
      'minimal'
    ])
    for (const b of BUILTIN_WORKSPACES) {
      const clean = sanitizeLayout(b.layout)!
      expect(clean.panels.sort()).toEqual([...b.layout.panels].sort())
      expect({ ...clean, panels: [] }).toEqual({ ...b.layout, panels: [] })
      for (const p of b.layout.panels) expect(PANEL_IDS).toContain(p)
    }
  })

  it('un diseño correcto se conserva y los paneles desconocidos se descartan', () => {
    expect(sanitizeLayout(layout)).toEqual(layout)
    expect(sanitizeLayout({ ...layout, panels: ['layers', 'hacker', 7] })!.panels).toEqual([
      'layers'
    ])
  })

  it('rechaza diseños mal formados', () => {
    expect(sanitizeLayout(null)).toBeNull()
    expect(sanitizeLayout({ ...layout, strip: 'enorme' })).toBeNull()
    expect(sanitizeLayout({ ...layout, viewers: '9x9' })).toBeNull()
    expect(sanitizeLayout({ ...layout, panels: 'todos' })).toBeNull()
    expect(sanitizeLayout({ ...layout, toolbarColumns: 7 })!.toolbarColumns).toBe(1)
  })

  it('la lista de espacios propios: ids únicos, sin pisar los integrados, nombres acotados y tope', () => {
    const ok = { id: 'a', name: '  Mi espacio  ', layout }
    const list = sanitizeWorkspaces([
      ok,
      { ...ok }, // id repetido
      { id: 'essentials', name: 'Falso', layout }, // pisa un integrado
      { id: 'b', name: '', layout }, // sin nombre
      { id: 'c', name: 'x'.repeat(100), layout },
      { id: 'd', name: 'roto', layout: { ...layout, strip: 'nada' } }
    ])
    expect(list.map((w) => w.id)).toEqual(['a', 'c'])
    expect(list[0]!.name).toBe('Mi espacio')
    expect(list[1]!.name).toHaveLength(40)
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `w${i}`, name: `W${i}`, layout }))
    expect(sanitizeWorkspaces(many)).toHaveLength(MAX_WORKSPACES)
    expect(sanitizeWorkspaces('no es una lista')).toEqual([])
  })
})
