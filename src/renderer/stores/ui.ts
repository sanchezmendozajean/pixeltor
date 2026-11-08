import { defineStore } from 'pinia'
import type { ThemeId } from '@shared/ipc'
import {
  DEFAULT_WORKSPACE,
  PANEL_IDS,
  type PanelId,
  type SavedWorkspace,
  type WorkspaceLayout
} from '@shared/workspaces'
import { loadWorkspaces } from '@/app/workspaces'
import { loadShortcutOverrides } from '@/actions/registry'
import { DEFAULT_EXPORT, type ExportOptions } from '@/app/exportOps'
import type { SheetImportState } from '@/app/importOps'

export interface DockSize {
  width: number
  propsH: number
  colorH: number
}
export const DOCK_LIMITS = {
  width: [220, 560],
  propsH: [60, 520],
  colorH: [120, 640]
} as const
const DOCK_KEY = 'pixeltor.dock'
const clampDock = (k: keyof DockSize, v: number): number =>
  Math.round(Math.min(DOCK_LIMITS[k][1], Math.max(DOCK_LIMITS[k][0], v)))
function loadDockSize(): DockSize {
  const out: DockSize = { width: 260, propsH: 150, colorH: 300 }
  try {
    const raw = JSON.parse(localStorage.getItem(DOCK_KEY) ?? '{}') as Partial<DockSize>
    for (const k of Object.keys(out) as (keyof DockSize)[])
      if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) out[k] = clampDock(k, raw[k]!)
  } catch {
    /* sin almacenamiento: tamaños por defecto */
  }
  return out
}

export type PanelsHidden = 'none' | 'all' | 'keepTools'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'oscuro' as ThemeId,
    panelsHidden: 'none' as PanelsHidden,
    pixelGrid: true,
    showPaths: true,
    /** Mostrar las guías del lienzo (Ctrl+;). */
    showGuides: true,
    /** Mostrar los ejes de referencia del espejo de la capa activa (Ver › Ver líneas espejo). */
    showMirrorLines: true,
    /** Menú de tipos de espejo abierto en esta posición de pantalla. */
    mirrorMenu: null as null | { x: number; y: number },
    /** Hay efectos calculándose en los workers. */
    fxBusy: false,
    /** Opciones de «Exportar como…» (se recuerdan durante la sesión). */
    exportOptions: { ...DEFAULT_EXPORT } as ExportOptions,
    /** Reproducción en curso, modo, velocidad y FPS efectivos. */
    playing: false,
    speed: 1,
    fps: 0,
    /** Papel cebolla (O): imágenes anteriores/siguientes, opacidad base y tinte. */
    onion: { enabled: false, before: 1, after: 1, opacity: 0.4, tint: true },
    /** Panel Imágenes desplegado (miniaturas grandes con duración). */
    stripExpanded: false,
    /** Espacio de trabajo: paneles visibles, panel Imágenes, visores por defecto. */
    dockVisible: true,
    panelsVisible: [...PANEL_IDS] as PanelId[],
    stripHidden: false,
    viewerPreset: 'single' as WorkspaceLayout['viewers'],
    workspaceId: DEFAULT_WORKSPACE,
    customWorkspaces: [] as SavedWorkspace[],
    /** Diálogo de nombre de espacio de trabajo: nuevo o renombrar el activo. */
    workspaceDialog: null as null | 'new' | 'rename',
    /** Imágenes seleccionadas en el panel Imágenes. */
    selectedImages: [] as string[],
    /** Pide a un grupo de paneles que muestre la pestaña con este id. */
    requestTab: '',
    /** Paleta de comandos abierta (Ctrl+K). */
    palette: false,
    /** Diálogo modal abierto. */
    dialog: null as
      null | 'new' | 'export' | 'recovery' | 'sheet' | 'canvas' | 'imageSize' | 'prefs' | 'about',
    /** Configuración del diálogo «Importar hoja de sprites». */
    sheetImport: null as SheetImportState | null,
    /** Mensaje breve no bloqueante (errores y avisos). */
    toast: '',
    /** Relleno o contorno que editan los paneles Apariencia y Degradado. */
    activeAttr: '' as string,
    /** Índice de la parada de degradado seleccionada (panel Degradado y herramienta G). */
    activeStop: 0,
    /** Objeto clave del panel Alinear (forma que no se mueve al alinear). */
    keyShape: '' as string,
    /** Columnas de la barra de herramientas (se recuerda entre sesiones). */
    toolbarColumns: 1 as 1 | 2,
    /** Escala de la interfaz (se recuerda entre sesiones). */
    uiScale: 1,
    /** Buscar actualizaciones al iniciar. */
    autoUpdate: true,
    /** Número de anclas seleccionadas con la Selección directa (para habilitar botones). */
    anchorCount: 0,
    /** Lados (entrada / salida) que admiten tirador en las anclas seleccionadas. */
    anchorSides: { in: false, out: false },
    /** Diálogo de atajos de teclado abierto. */
    shortcutsDialog: false,
    /** Punto de referencia de la caja en Propiedades (fracción 0, 0,5 o 1 por eje). */
    boxOrigin: { fx: 0, fy: 0 },
    /** Proporcionalidad de An y Al en Propiedades. */
    boxLock: false,
    /** Tamaño del dock derecho: ancho y alto del cuerpo de los grupos Propiedades y Color. */
    dock: loadDockSize(),
    /** Diálogo de posición de una guía (doble clic sobre ella). */
    guideDialog: null as null | { id: string; axis: 'h' | 'v' },
    /** Modo vista previa (sin overlays): guarda qué estaba visible para restaurarlo. */
    preview: null as null | { paths: boolean; grid: boolean; guides: boolean },
    snap: { grid: true, anchor: true, paths: false, guides: true, canvas: false, smart: true }
  }),
  actions: {
    async loadSettings() {
      const s = await window.pixeltor.settings.get()
      this.applyTheme(s.theme)
      this.toolbarColumns = s.toolbarColumns
      loadShortcutOverrides(s.shortcuts)
      this.uiScale = s.uiScale
      this.autoUpdate = s.autoUpdate
      this.workspaceId = s.activeWorkspace
      loadWorkspaces(s.workspaces)
      window.pixeltor.ui.setScale(s.uiScale)
    },
    async setUiScale(f: number) {
      this.uiScale = f
      window.pixeltor.ui.setScale(f)
      await window.pixeltor.settings.set({ uiScale: f })
    },
    async setAutoUpdate(on: boolean) {
      this.autoUpdate = on
      await window.pixeltor.settings.set({ autoUpdate: on })
    },
    /** Cambia el tamaño del dock (se recuerda entre sesiones). */
    setDockSize(k: keyof DockSize, v: number) {
      this.dock[k] = clampDock(k, v)
    },
    saveDockSize() {
      try {
        localStorage.setItem(DOCK_KEY, JSON.stringify(this.dock))
      } catch {
        /* sin almacenamiento */
      }
    },
    async setToolbarColumns(n: 1 | 2) {
      this.toolbarColumns = n
      await window.pixeltor.settings.set({ toolbarColumns: n })
    },
    applyTheme(theme: ThemeId) {
      this.theme = theme
      document.documentElement.dataset['theme'] = theme
    },
    async setTheme(theme: ThemeId) {
      this.applyTheme(theme)
      await window.pixeltor.settings.set({ theme })
    },
    togglePanels(mode: Exclude<PanelsHidden, 'none'>) {
      this.panelsHidden = this.panelsHidden === mode ? 'none' : mode
    }
  }
})
