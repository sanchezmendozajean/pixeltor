// Espacios de trabajo (specs/11): aplicar, capturar, guardar, renombrar y eliminar.
// Un espacio guarda qué paneles se ven, el panel Imágenes, la disposición de visores por defecto
// y las columnas de la barra de herramientas. No guarda dónde está cada panel (el dock es fijo).

import {
  BUILTIN_WORKSPACES,
  DEFAULT_WORKSPACE,
  MAX_WORKSPACES,
  type WorkspaceLayout,
  sanitizeLayout
} from '@shared/workspaces'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { mirrorViewerFlags } from '@/session/viewer'
import { t, type I18nKey } from '@/i18n'

export interface WorkspaceEntry {
  id: string
  name: string
  builtin: boolean
}

/** Lista para el selector: los integrados y después los del usuario. */
export function workspaceEntries(): WorkspaceEntry[] {
  const ui = useUiStore()
  return [
    ...BUILTIN_WORKSPACES.map((b) => ({ id: b.id, name: t(b.label as I18nKey), builtin: true })),
    ...ui.customWorkspaces.map((w) => ({ id: w.id, name: w.name, builtin: false }))
  ]
}

export function workspaceName(id: string): string {
  return workspaceEntries().find((w) => w.id === id)?.name ?? t('workspaces.essentials')
}

function layoutOf(id: string): WorkspaceLayout | undefined {
  const ui = useUiStore()
  return (
    BUILTIN_WORKSPACES.find((b) => b.id === id)?.layout ??
    ui.customWorkspaces.find((w) => w.id === id)?.layout
  )
}

/** El estado actual de la ventana como diseño (lo que guarda «Nuevo espacio de trabajo»). */
export function captureLayout(): WorkspaceLayout {
  const ui = useUiStore()
  return {
    dock: ui.dockVisible,
    panels: [...ui.panelsVisible],
    strip: ui.stripHidden ? 'hidden' : ui.stripExpanded ? 'expanded' : 'collapsed',
    viewers: ui.viewerPreset,
    toolbarColumns: ui.toolbarColumns
  }
}

/** Pone ese diseño en la interfaz (y la disposición de visores del documento activo). */
export function applyLayout(layout: WorkspaceLayout, withColumns = true): void {
  const ui = useUiStore()
  ui.dockVisible = layout.dock
  ui.panelsVisible = [...layout.panels]
  ui.stripHidden = layout.strip === 'hidden'
  ui.stripExpanded = layout.strip === 'expanded'
  ui.viewerPreset = layout.viewers
  if (withColumns && ui.toolbarColumns !== layout.toolbarColumns)
    void ui.setToolbarColumns(layout.toolbarColumns)
  const ws = useDocumentsStore().active
  if (ws) {
    ws.applyPreset(layout.viewers)
    mirrorViewerFlags(ws)
  }
}

async function persist(): Promise<void> {
  const ui = useUiStore()
  await window.pixeltor.settings.set({
    // copia plana: los objetos reactivos de Vue no se pueden clonar por IPC
    workspaces: JSON.parse(JSON.stringify(ui.customWorkspaces)),
    activeWorkspace: ui.workspaceId
  })
}

export async function switchWorkspace(id: string): Promise<void> {
  const layout = layoutOf(id)
  if (!layout) return
  useUiStore().workspaceId = id
  applyLayout(layout)
  await persist()
}

/** Al arrancar: vuelve a poner el último espacio de trabajo. */
export function restoreWorkspace(): void {
  const ui = useUiStore()
  const layout = layoutOf(ui.workspaceId) ?? layoutOf(DEFAULT_WORKSPACE)!
  // las columnas de la barra de herramientas ya se recuerdan por separado entre sesiones
  applyLayout(layout, false)
}

/** Restablece el espacio activo: el integrado vuelve a su diseño de fábrica; el propio, al guardado. */
export function resetWorkspace(): void {
  const ui = useUiStore()
  const layout = layoutOf(ui.workspaceId)
  if (layout) applyLayout(layout)
}

export function canCreateWorkspace(): boolean {
  return useUiStore().customWorkspaces.length < MAX_WORKSPACES
}

/** Guarda el estado actual como espacio nuevo y pasa a usarlo. */
export async function createWorkspace(name: string): Promise<void> {
  const ui = useUiStore()
  const clean = name.trim().slice(0, 40)
  if (!clean || !canCreateWorkspace()) return
  const id = `ws-${Date.now().toString(36)}`
  ui.customWorkspaces.push({ id, name: clean, layout: captureLayout() })
  ui.workspaceId = id
  await persist()
}

/** Sobrescribe el espacio propio activo con el estado actual de la ventana. */
export async function saveCurrentWorkspace(): Promise<void> {
  const ui = useUiStore()
  const w = ui.customWorkspaces.find((x) => x.id === ui.workspaceId)
  if (!w) return
  w.layout = captureLayout()
  await persist()
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const w = useUiStore().customWorkspaces.find((x) => x.id === id)
  const clean = name.trim().slice(0, 40)
  if (!w || !clean) return
  w.name = clean
  await persist()
}

export async function deleteWorkspace(id: string): Promise<void> {
  const ui = useUiStore()
  const i = ui.customWorkspaces.findIndex((x) => x.id === id)
  if (i < 0) return
  ui.customWorkspaces.splice(i, 1)
  if (ui.workspaceId === id) {
    ui.workspaceId = DEFAULT_WORKSPACE
    applyLayout(layoutOf(DEFAULT_WORKSPACE)!)
  }
  await persist()
}

/** Valida y fija la lista guardada (al cargar los ajustes). */
export function loadWorkspaces(saved: { id: string; name: string; layout: unknown }[]): void {
  const ui = useUiStore()
  ui.customWorkspaces = saved.flatMap((w) => {
    const layout = sanitizeLayout(w.layout)
    return layout ? [{ id: w.id, name: w.name, layout }] : []
  })
}
