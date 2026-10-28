import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import {
  DocumentSession,
  type ID,
  type Layer,
  type PixeltorDocument,
  type Bitmap
} from '@core/index'
import { Workspace } from '@/session/workspace'

export interface DocTab {
  id: string
  name: string
  filePath: string | null
  dirty: boolean
}

export interface LayerRow {
  id: ID
  name: string
  visible: boolean
  locked: boolean
  lockAlpha: boolean
  opacity: number
  blendMode: Layer['blendMode']
  color: string
  active: boolean
  /** De arriba abajo. */
  shapes: { id: ID; name: string; visible: boolean; selected: boolean }[]
}

export interface HistoryRow {
  label: string
  /** Número de pasos aplicados cuando este paso es el último. */
  position: number
  undone: boolean
}

// Los Workspace (buffers incluidos) viven fuera del estado reactivo.
const workspaces = new Map<string, Workspace>()
let counter = 0

export const useDocumentsStore = defineStore('documents', () => {
  const tabs = ref<DocTab[]>([])
  const activeId = ref('')
  /** Se incrementa con cada cambio de la sesión activa; los getters dependen de él. */
  const rev = ref(0)
  const zoomPercent = ref(100)
  const cursor = shallowRef<{ x: number; y: number } | null>(null)

  const active = computed(() => {
    void rev.value
    return workspaces.get(activeId.value) ?? null
  })
  const session = computed(() => active.value?.session ?? null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value))

  const layers = computed<LayerRow[]>(() => {
    void rev.value
    const s = session.value
    if (!s) return []
    // De arriba abajo, como se muestra en el panel.
    return [...s.image.layers].reverse().map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      lockAlpha: l.lockAlpha,
      opacity: l.opacity,
      blendMode: l.blendMode,
      color: l.color,
      active: l.id === s.activeLayerId,
      shapes: [...l.shapes].reverse().map((sh) => ({
        id: sh.id,
        name: sh.name,
        visible: sh.visible,
        selected: s.selectedShapes.includes(sh.id)
      }))
    }))
  })

  const history = computed<HistoryRow[]>(() => {
    void rev.value
    const s = session.value
    if (!s) return []
    return s.history.entries.map((c, i) => ({
      label: c.label,
      position: i + 1,
      undone: i >= s.history.position
    }))
  })

  function refreshTab(id: string): void {
    const ws = workspaces.get(id)
    const tab = tabs.value.find((t) => t.id === id)
    if (!ws || !tab) return
    tab.dirty = ws.session.history.isDirty
    tab.name = ws.name
    tab.filePath = ws.filePath
  }

  function add(session: DocumentSession, filePath: string | null = null): Workspace {
    const id = `doc-${++counter}`
    const ws = markRaw(new Workspace(id, session))
    ws.filePath = filePath
    workspaces.set(id, ws)
    tabs.value.push({ id, name: session.doc.name, filePath, dirty: false })
    session.onChange(() => {
      if (id === activeId.value) rev.value++
      refreshTab(id)
    })
    activeId.value = id
    rev.value++
    return ws
  }

  function newDocument(width: number, height: number, name?: string): Workspace {
    return add(DocumentSession.create(width, height, name ?? `Sin título-${counter + 1}`))
  }

  function openLoaded(
    doc: PixeltorDocument,
    rasters: Map<ID, Bitmap>,
    filePath: string | null
  ): Workspace {
    return add(new DocumentSession(doc, rasters), filePath)
  }

  function activate(id: string): void {
    if (!workspaces.has(id)) return
    activeId.value = id
    rev.value++
  }

  function close(id: string): void {
    const i = tabs.value.findIndex((t) => t.id === id)
    if (i < 0) return
    workspaces.get(id)?.dispose()
    workspaces.delete(id)
    tabs.value.splice(i, 1)
    if (activeId.value === id) activeId.value = tabs.value[Math.max(0, i - 1)]?.id ?? ''
    rev.value++
  }

  function workspace(id: string): Workspace | undefined {
    return workspaces.get(id)
  }

  function markSaved(id: string, filePath: string | null): void {
    const ws = workspaces.get(id)
    if (!ws) return
    ws.session.history.markSaved()
    if (filePath) {
      ws.filePath = filePath
      ws.session.doc.name = filePath
        .split(/[\\/]/)
        .pop()!
        .replace(/\.pixeltor$/i, '')
    }
    refreshTab(id)
    rev.value++
  }

  function touch(): void {
    rev.value++
    for (const t of tabs.value) refreshTab(t.id)
  }

  return {
    tabs,
    activeId,
    rev,
    zoomPercent,
    cursor,
    active,
    activeTab,
    session,
    layers,
    history,
    add,
    newDocument,
    openLoaded,
    activate,
    close,
    workspace,
    markSaved,
    touch
  }
})
