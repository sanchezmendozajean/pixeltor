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

export type PanelsHidden = 'none' | 'all' | 'keepTools'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'oscuro' as ThemeId,
    panelsHidden: 'none' as PanelsHidden,
    pixelGrid: true,
    showPaths: true,
    /** Mostrar las guías del lienzo (Ctrl+;). */
    showGuides: true,
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
    dialog: null as null | 'new' | 'export' | 'recovery' | 'sheet' | 'canvas' | 'imageSize' | 'prefs' | 'about',
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
    /** Selector de color abierto para este destino. */
    colorPicker: null as null | 'fill' | 'stroke',
    /** Diálogo de atajos de teclado abierto. */
    shortcutsDialog: false,
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
