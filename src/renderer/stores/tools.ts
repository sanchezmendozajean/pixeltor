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
    /** El tamaño del pincel y del borrador sigue la presión del lápiz de tableta. */
    pressure: true,
    /** Simetría del lápiz, pincel y borrador (respecto al centro del lienzo). */
    symmetry: { x: false, y: false, rot: 1 as 1 | 2 | 4 },
    tolerance: 0,
    contiguous: true,
    sampleAll: false,
    /** Opciones de formas. */
    useFill: true,
    useStroke: true,
    strokeWidth: 1,
    cornerRadius: 0,
    polygonSides: 6,
    starPoints: 5,
    starRatio: 0.5
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
