import { defineStore } from 'pinia'
import type { ThemeId } from '@shared/ipc'

export type PanelsHidden = 'none' | 'all' | 'keepTools'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'oscuro' as ThemeId,
    panelsHidden: 'none' as PanelsHidden,
    pixelGrid: true,
    showPaths: true,
    /** Diálogo modal abierto. */
    dialog: null as null | 'new' | 'export' | 'recovery',
    /** Mensaje breve no bloqueante (errores y avisos). */
    toast: '',
    /** Relleno o contorno que editan los paneles Apariencia y Degradado. */
    activeAttr: '' as string,
    /** Índice de la parada de degradado seleccionada (panel Degradado y herramienta G). */
    activeStop: 0,
    snap: { grid: true, anchor: true, paths: false, guides: true, canvas: false, smart: true }
  }),
  actions: {
    async loadSettings() {
      const s = await window.pixeltor.settings.get()
      this.applyTheme(s.theme)
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
