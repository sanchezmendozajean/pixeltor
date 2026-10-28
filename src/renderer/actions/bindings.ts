// Conecta las acciones del registro con los stores y el core.
import {
  type Bitmap,
  commitFloating,
  cancelFloating,
  copyPixels,
  deletePixels,
  deselect,
  fillPixels,
  invertSelection,
  pasteFloating,
  selectAll,
  SelectionMove
} from '@core/index'
import { ACTIONS } from './definitions'
import { registerHandler } from './registry'
import { closeWorkspace, exportPng, openFile, saveWorkspace } from '@/app/documentOps'
import { useColorsStore } from '@/stores/colors'
import { hexToRgba } from '@/stores/colorUtil'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { ThemeId } from '@shared/ipc'

/** Portapapeles interno de píxeles (el del sistema llega con la importación de imágenes). */
let clipboard: { bitmap: Bitmap; x: number; y: number } | null = null

export function registerAppActions(): void {
  const tools = useToolsStore()
  const ui = useUiStore()
  const docs = useDocumentsStore()

  const has = () => !!docs.active
  const ws = () => docs.active!
  const ses = () => docs.active!.session

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
  registerHandler('brush.sizeDown', { run: () => tools.setBrushSize(tools.brushSize - 1) })
  registerHandler('brush.sizeUp', { run: () => tools.setBrushSize(tools.brushSize + 1) })

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

  // ---------- Archivo ----------
  registerHandler('file.new', { run: () => (ui.dialog = 'new') })
  registerHandler('file.open', { run: () => void openFile() })
  registerHandler('file.save', { enabled: has, run: () => void saveWorkspace(ws()) })
  registerHandler('file.saveAs', { enabled: has, run: () => void saveWorkspace(ws(), true) })
  registerHandler('file.export', { enabled: has, run: () => (ui.dialog = 'export') })
  registerHandler('file.exportAgain', {
    enabled: () => has() && !!ws().lastExport,
    run: () => void exportPng(ws(), ws().lastExport!.scale, true)
  })
  registerHandler('file.close', { enabled: has, run: () => void closeWorkspace(docs.activeId) })
  registerHandler('file.quit', { run: () => window.close() })

  // ---------- Editar ----------
  registerHandler('edit.undo', {
    enabled: () => has() && (docs.rev, ses().history.canUndo),
    run: () => ses().undo()
  })
  registerHandler('edit.redo', {
    enabled: () => has() && (docs.rev, ses().history.canRedo),
    run: () => ses().redo()
  })
  registerHandler('edit.copy', {
    enabled: has,
    run: () => (clipboard = copyPixels(ses()))
  })
  registerHandler('edit.cut', {
    enabled: has,
    run: () => {
      clipboard = copyPixels(ses())
      deletePixels(ses())
    }
  })
  registerHandler('edit.paste', {
    enabled: () => has() && !!clipboard,
    run: () => {
      if (clipboard) pasteFloating(ses(), clipboard.bitmap, clipboard.x, clipboard.y)
    }
  })
  registerHandler('edit.delete', { enabled: has, run: () => void deletePixels(ses()) })
  registerHandler('selection.fill', {
    enabled: has,
    run: () => void fillPixels(ses(), hexToRgba(colors.fill))
  })

  // ---------- Seleccionar ----------
  registerHandler('select.all', { enabled: has, run: () => selectAll(ses()) })
  registerHandler('select.none', { enabled: has, run: () => deselect(ses()) })
  registerHandler('select.invert', { enabled: has, run: () => invertSelection(ses()) })
  registerHandler('selection.commit', {
    enabled: () => has() && !!ses().selection.floating,
    run: () => commitFloating(ses())
  })
  registerHandler('selection.cancel', {
    enabled: () => has() && !!(ses().selection.floating || ses().selection.mask),
    run: () => {
      if (ses().selection.floating) cancelFloating(ses())
      else deselect(ses())
    }
  })
  const nudge = (id: string, dx: number, dy: number) =>
    registerHandler(id, {
      enabled: () => has() && !!ses().selection.mask,
      run: () => {
        const mv = new SelectionMove(ses(), true)
        mv.moveBy(dx, dy)
        mv.end()
      }
    })
  nudge('selection.left', -1, 0)
  nudge('selection.right', 1, 0)
  nudge('selection.up', 0, -1)
  nudge('selection.down', 0, 1)
  nudge('selection.left10', -10, 0)
  nudge('selection.right10', 10, 0)
  nudge('selection.up10', 0, -10)
  nudge('selection.down10', 0, 10)

  // ---------- Capa ----------
  registerHandler('layer.new', { enabled: has, run: () => void ses().addLayer() })
  registerHandler('layer.duplicate', {
    enabled: has,
    run: () => void ses().duplicateLayer(ses().activeLayerId)
  })
  registerHandler('layer.delete', {
    enabled: () => has() && (docs.rev, ses().image.layers.length > 1),
    run: () => void ses().deleteLayer(ses().activeLayerId)
  })
  registerHandler('layer.lockAlpha', {
    enabled: has,
    run: () =>
      ses().setLayerProps(ses().activeLayerId, { lockAlpha: !ses().activeLayer.lockAlpha }),
    checked: () => (docs.rev, has() && ses().activeLayer.lockAlpha)
  })

  // ---------- Ver ----------
  const zoom = (fn: (w: ReturnType<typeof ws>) => void) => () => {
    fn(ws())
    ws().refreshView()
  }
  registerHandler('view.zoomIn', { enabled: has, run: zoom((w) => w.viewport.stepZoom(1)) })
  registerHandler('view.zoomOut', { enabled: has, run: zoom((w) => w.viewport.stepZoom(-1)) })
  registerHandler('view.zoom100', {
    enabled: has,
    run: zoom((w) => w.viewport.setZoom(1))
  })
  registerHandler('view.zoomFit', { enabled: has, run: zoom((w) => w.viewport.fit()) })
}
