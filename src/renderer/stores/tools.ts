import { defineStore } from 'pinia'
import { TOOLBAR, DEFAULT_TOOL } from '@/tools/catalog'

function groupOf(tool: string): string | undefined {
  for (const item of TOOLBAR) {
    if (item.kind === 'group' && item.tools.includes(tool)) return item.id
  }
  return undefined
}

export const useToolsStore = defineStore('tools', {
  state: () => ({
    active: DEFAULT_TOOL,
    /** Herramienta visible de cada grupo con flyout. */
    shown: Object.fromEntries(
      TOOLBAR.flatMap((i) => (i.kind === 'group' ? [[i.id, i.tools[0]!]] : []))
    ) as Record<string, string>,
    /** Opciones de herramientas de píxeles (barra de control). */
    brushSize: 1,
    brushShape: 'square' as 'square' | 'round',
    tolerance: 0,
    contiguous: true,
    sampleAll: false
  }),
  actions: {
    setBrushSize(n: number) {
      this.brushSize = Math.min(64, Math.max(1, Math.round(n) || 1))
    },
    activate(tool: string) {
      const g = groupOf(tool)
      if (!g) return
      this.shown[g] = tool
      this.active = tool
    }
  }
})
