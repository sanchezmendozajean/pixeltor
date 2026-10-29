import { defineStore } from 'pinia'
import type { ThemeId } from '@shared/ipc'

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
    /** Pide a un grupo de paneles que muestre la pestaña con este id. */
    requestTab: '',
    /** Paleta de comandos abierta (Ctrl+K). */
    palette: false,
    /** Diálogo modal abierto. */
    dialog: null as null | 'new' | 'export' | 'recovery',
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
    /** Selector de color abierto para este destino. */
    colorPicker: null as null | 'fill' | 'stroke',
    snap: { grid: true, anchor: true, paths: false, guides: true, canvas: false, smart: true }
  }),
  actions: {
    async loadSettings() {
      const s = await window.pixeltor.settings.get()
      this.applyTheme(s.theme)
      this.toolbarColumns = s.toolbarColumns
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
