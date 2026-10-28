import { defineStore } from 'pinia'

// Maqueta de F0: proyección mínima para dibujar pestañas, visor y barra de estado.
// El modelo real (DocumentSession, capas, historial) llega en F1 desde src/core.
export interface DocTab {
  id: string
  name: string
  width: number
  height: number
  /** Zoom en porcentaje. */
  zoom: number
  dirty: boolean
}

export const useDocumentsStore = defineStore('documents', {
  state: () => ({
    tabs: [
      { id: 'doc-1', name: 'Sin título-1', width: 32, height: 32, zoom: 1200, dirty: false }
    ] as DocTab[],
    activeId: 'doc-1'
  }),
  getters: {
    active: (s): DocTab | undefined => s.tabs.find((t) => t.id === s.activeId)
  }
})
