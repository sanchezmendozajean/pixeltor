// Conecta las acciones del registro con los stores. En F0 solo hay herramientas, tema, paneles y toggles de vista.
import { ACTIONS } from './definitions'
import { registerHandler } from './registry'
import { useColorsStore } from '@/stores/colors'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { ThemeId } from '@shared/ipc'

export function registerAppActions(): void {
  const tools = useToolsStore()
  const ui = useUiStore()

  for (const def of ACTIONS) {
    if (def.id.startsWith('tool.')) {
      const tool = def.id.slice(5)
      registerHandler(def.id, {
        run: () => tools.activate(tool),
        checked: () => tools.active === tool
      })
    }
  }

  for (const theme of ['oscuro', 'gris', 'claro'] as ThemeId[]) {
    registerHandler(`theme.${theme}`, {
      run: () => void ui.setTheme(theme),
      checked: () => ui.theme === theme
    })
  }

  const colors = useColorsStore()
  registerHandler('colors.swap', { run: () => colors.swap() })
  registerHandler('colors.default', { run: () => colors.reset() })
  registerHandler('colors.toggleActive', { run: () => colors.toggleTarget() })

  registerHandler('window.hidePanels', { run: () => ui.togglePanels('all') })
  registerHandler('window.hidePanelsKeepTools', { run: () => ui.togglePanels('keepTools') })
  registerHandler('view.pixelGrid', {
    run: () => (ui.pixelGrid = !ui.pixelGrid),
    checked: () => ui.pixelGrid
  })
  registerHandler('view.hidePaths', {
    run: () => (ui.showPaths = !ui.showPaths),
    checked: () => !ui.showPaths
  })
  registerHandler('view.smartGuides', {
    run: () => (ui.snap.smart = !ui.snap.smart),
    checked: () => ui.snap.smart
  })
}
