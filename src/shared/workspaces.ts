// Espacios de trabajo (specs/11): qué paneles se ven y cómo arranca la ventana. Lógica pura y
// compartida entre main (validar ajustes) y renderer (aplicar y capturar).

export const PANEL_IDS = [
  'properties',
  'navigator',
  'history',
  'layers',
  'appearance',
  'align',
  'effects',
  'color',
  'swatches',
  'gradient'
] as const
export type PanelId = (typeof PANEL_IDS)[number]

export const STRIP_MODES = ['hidden', 'collapsed', 'expanded'] as const
export const VIEWER_PRESETS = ['single', '2v', '2h', '1+2', '2x2'] as const

export interface WorkspaceLayout {
  /** Dock derecho y columna de iconos. */
  dock: boolean
  /** Paneles del dock que se ven (el resto de sus pestañas se oculta). */
  panels: PanelId[]
  /** Panel Imágenes/Animación de abajo. */
  strip: (typeof STRIP_MODES)[number]
  /** Disposición de visores para los documentos que no traen la suya. */
  viewers: (typeof VIEWER_PRESETS)[number]
  toolbarColumns: 1 | 2
}

export interface SavedWorkspace {
  id: string
  name: string
  layout: WorkspaceLayout
}

export interface BuiltinWorkspace {
  id: string
  /** Clave i18n del nombre. */
  label: string
  layout: WorkspaceLayout
}

export const BUILTIN_WORKSPACES: BuiltinWorkspace[] = [
  {
    id: 'essentials',
    label: 'workspaces.essentials',
    layout: {
      dock: true,
      panels: [...PANEL_IDS],
      strip: 'collapsed',
      viewers: 'single',
      toolbarColumns: 1
    }
  },
  {
    id: 'animation',
    label: 'workspaces.animation',
    layout: {
      dock: true,
      panels: ['layers', 'color', 'swatches'],
      strip: 'expanded',
      viewers: 'single',
      toolbarColumns: 1
    }
  },
  {
    id: 'vectors',
    label: 'workspaces.vectors',
    layout: {
      dock: true,
      panels: ['properties', 'appearance', 'gradient', 'align', 'effects', 'layers'],
      strip: 'hidden',
      viewers: 'single',
      toolbarColumns: 2
    }
  },
  {
    id: 'minimal',
    label: 'workspaces.minimal',
    layout: { dock: false, panels: [], strip: 'hidden', viewers: 'single', toolbarColumns: 1 }
  }
]

export const DEFAULT_WORKSPACE = 'essentials'
export const MAX_WORKSPACES = 20

/** Valida un diseño leído de los ajustes; null si no es utilizable. */
export function sanitizeLayout(raw: unknown): WorkspaceLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const panels = Array.isArray(r['panels'])
    ? PANEL_IDS.filter((p) => (r['panels'] as unknown[]).includes(p))
    : null
  if (!panels) return null
  const strip = STRIP_MODES.find((m) => m === r['strip'])
  const viewers = VIEWER_PRESETS.find((m) => m === r['viewers'])
  if (!strip || !viewers) return null
  return {
    dock: r['dock'] !== false,
    panels,
    strip,
    viewers,
    toolbarColumns: r['toolbarColumns'] === 2 ? 2 : 1
  }
}

/** Valida la lista de espacios personalizados: ids únicos, nombres acotados, máximo 20. */
export function sanitizeWorkspaces(raw: unknown): SavedWorkspace[] {
  if (!Array.isArray(raw)) return []
  const out: SavedWorkspace[] = []
  const seen = new Set<string>(BUILTIN_WORKSPACES.map((b) => b.id))
  for (const w of raw as Record<string, unknown>[]) {
    if (out.length >= MAX_WORKSPACES) break
    if (!w || typeof w['id'] !== 'string' || typeof w['name'] !== 'string') continue
    const id = w['id']
    const name = w['name'].trim().slice(0, 40)
    const layout = sanitizeLayout(w['layout'])
    if (!id || id.length > 64 || !name || !layout || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name, layout })
  }
  return out
}
