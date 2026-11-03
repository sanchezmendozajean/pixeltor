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
  SelectionMove,
  arrangeShapes,
  groupShapes,
  ungroupShapes,
  isolateGroup,
  addEffect,
  addImage,
  deleteImages,
  duplicateImages,
  setActiveImage,
  addMidAnchors,
  rasterizeLayerEffects,
  convertToPath,
  makeCompound,
  centerAnchors,
  createGroup,
  toggleClip,
  ungroup,
  pathfinder,
  offsetPaths,
  outlineStroke,
  releaseCompound,
  simplifyPaths,
  getShape,
  moveShapes,
  removeShapes,
  selectShapes,
  stampAllShapes,
  stampShapes
} from '@core/index'
import { activeController } from '@/tools/controller'
import { mirrorViewerFlags } from '@/session/viewer'
import {
  canCreateWorkspace,
  deleteWorkspace,
  resetWorkspace,
  saveCurrentWorkspace
} from '@/app/workspaces'
import { PANEL_IDS } from '@shared/workspaces'
import type { Viewport } from '@/viewport/Viewport'
import { type LayoutPreset, MAX_VIEWERS, PRESET_COUNT } from '@core/index'
import { ACTIONS } from './definitions'
import { registerHandler } from './registry'
import { closeWorkspace, openFile, saveWorkspace } from '@/app/documentOps'
import { useColorsStore } from '@/stores/colors'
import { hexToRgba } from '@/stores/colorUtil'
import { startPlayback, stopPlayback } from '@/session/playback'
import { exportAs } from '@/app/exportOps'
import { importSequence, startSheetImport } from '@/app/importOps'
import { EFFECT_LIST as EFFECT_DEFS } from '@core/effects/registry'
import { useDocumentsStore } from '@/stores/documents'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { type ThemeId, UI_SCALES } from '@shared/ipc'

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

  for (const f of UI_SCALES)
    registerHandler(`view.uiScale.${Math.round(f * 100)}`, {
      run: () => void ui.setUiScale(f),
      checked: () => ui.uiScale === f
    })
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
  // Estos ajustes son de cada visor; la interfaz refleja los del visor activo (ui.*).
  const viewerFlag = (k: 'pixelGrid' | 'showPaths' | 'onion') => () => {
    const w = docs.active
    if (!w) return
    w.activeViewer[k] = !w.activeViewer[k]
    mirrorViewerFlags(w)
    w.refreshView()
  }
  registerHandler('view.pixelGrid', {
    run: viewerFlag('pixelGrid'),
    checked: () => ui.pixelGrid
  })
  registerHandler('view.hidePaths', {
    run: viewerFlag('showPaths'),
    checked: () => !ui.showPaths
  })
  registerHandler('help.shortcuts', { run: () => (ui.shortcutsDialog = true) })
  registerHandler('help.checkUpdates', { run: () => void window.pixeltor.updates.check() })
  registerHandler('help.autoUpdate', {
    run: () => void ui.setAutoUpdate(!ui.autoUpdate),
    checked: () => ui.autoUpdate
  })
  registerHandler('help.commandPalette', { run: () => (ui.palette = !ui.palette) })
  registerHandler('view.guides', {
    run: () => (ui.showGuides = !ui.showGuides),
    checked: () => ui.showGuides
  })
  registerHandler('view.smartGuides', {
    run: () => (ui.snap.smart = !ui.snap.smart),
    checked: () => ui.snap.smart
  })

  // ---------- Archivo ----------
  registerHandler('file.new', { run: () => (ui.dialog = 'new') })
  registerHandler('file.open', { run: () => void openFile() })
  registerHandler('file.importSequence', { run: () => void importSequence() })
  registerHandler('file.importSheet', { run: () => void startSheetImport() })
  registerHandler('file.save', { enabled: has, run: () => void saveWorkspace(ws()) })
  registerHandler('file.saveAs', { enabled: has, run: () => void saveWorkspace(ws(), true) })
  registerHandler('file.export', { enabled: has, run: () => (ui.dialog = 'export') })
  registerHandler('file.exportAgain', {
    enabled: () => has() && !!ws().lastExport,
    run: () => void exportAs(ws(), ws().lastExport!.options, true)
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
  registerHandler('edit.delete', {
    enabled: has,
    run: () => {
      // con anclas seleccionadas (Selección directa) Supr elimina las anclas, no la forma
      if (activeController?.shapes.deleteSelectedAnchors()) return
      if (ses().selectedShapes.length) removeShapes(ses(), ses().selectedShapes)
      else deletePixels(ses())
    }
  })
  registerHandler('selection.fill', {
    enabled: has,
    run: () => void fillPixels(ses(), hexToRgba(colors.fill))
  })

  // ---------- Seleccionar ----------
  registerHandler('select.all', { enabled: has, run: () => selectAll(ses()) })
  registerHandler('select.none', { enabled: has, run: () => deselect(ses()) })
  registerHandler('select.invert', { enabled: has, run: () => invertSelection(ses()) })
  registerHandler('selection.commit', {
    enabled: () => has() && (!!activeController?.shapes.penActive || !!ses().selection.floating),
    run: () => {
      if (activeController?.shapes.penActive) activeController.shapes.finishPen(false)
      else commitFloating(ses())
    }
  })
  registerHandler('selection.cancel', {
    enabled: () =>
      has() &&
      (!!activeController?.shapes.penActive ||
        !!ses().isolatedGroup ||
        !!ses().selection.floating ||
        !!ses().selection.mask ||
        ses().selectedShapes.length > 0),
    run: () => {
      if (activeController?.shapes.penActive) activeController.shapes.cancelPen()
      else if (ses().isolatedGroup) isolateGroup(ses(), null)
      else if (ses().selection.floating) cancelFloating(ses())
      else if (ses().selection.mask) deselect(ses())
      else selectShapes(ses(), [])
    }
  })
  const nudge = (id: string, dx: number, dy: number) =>
    registerHandler(id, {
      enabled: () => has() && (!!ses().selection.mask || ses().selectedShapes.length > 0),
      run: () => {
        if (activeController?.shapes.nudgeAnchors(dx, dy)) return
        if (!ses().selection.mask) {
          moveShapes(ses(), ses().selectedShapes, dx, dy, `nudge:${dx}:${dy}`)
          return
        }
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

  // ---------- Objeto ----------
  const shapesSelected = () => has() && (docs.rev, ses().selectedShapes.length > 0)
  registerHandler('object.group', {
    enabled: () => has() && (docs.rev, ses().selectedShapes.length > 1),
    run: () => void groupShapes(ses(), ses().selectedShapes)
  })
  registerHandler('object.ungroup', {
    enabled: () =>
      shapesSelected() && ses().selectedShapes.some((i) => getShape(ses(), i)?.kind === 'group'),
    run: () => void ungroupShapes(ses(), ses().selectedShapes)
  })
  registerHandler('object.convertToPath', {
    enabled: () =>
      shapesSelected() && ses().selectedShapes.some((i) => getShape(ses(), i)?.kind !== 'path'),
    run: () => void convertToPath(ses(), ses().selectedShapes)
  })
  // Efecto › añadir: a las formas seleccionadas o, si no hay, a la capa activa
  for (const def of EFFECT_DEFS) {
    registerHandler(`effect.add.${def.type}`, {
      enabled: has,
      run: () => {
        const s = ses()
        if (s.selectedShapes.length)
          for (const id of s.selectedShapes) addEffect(s, { kind: 'shape', id }, def.type)
        else addEffect(s, { kind: 'layer', id: s.activeLayerId }, def.type)
        ui.requestTab = 'effects'
      }
    })
  }
  const anchorsReady = () => shapesSelected() && !!activeController?.shapes.hasAnchorSelection
  registerHandler('anchor.delete', {
    enabled: anchorsReady,
    run: () => void activeController?.shapes.deleteSelectedAnchors()
  })
  registerHandler('view.play', {
    enabled: () => has() && (docs.rev, ses().doc.images.some((i) => i.includeInAnimation)),
    run: () => {
      if (ui.playing) stopPlayback()
      else startPlayback(ws(), ses().doc.animation.loop)
    },
    checked: () => ui.playing
  })
  registerHandler('view.onion', {
    enabled: has,
    run: viewerFlag('onion'),
    checked: () => ui.onion.enabled
  })
  // ---------- Imágenes ----------
  registerHandler('image.new', { enabled: has, run: () => void addImage(ses(), 'duplicate') })
  registerHandler('image.newEmpty', { enabled: has, run: () => void addImage(ses(), 'empty') })
  registerHandler('image.duplicate', {
    enabled: has,
    run: () => void duplicateImages(ses(), [ses().activeImageId])
  })
  registerHandler('image.delete', {
    enabled: () => has() && (docs.rev, ses().doc.images.length > 1),
    run: () => void deleteImages(ses(), [ses().activeImageId])
  })
  const stepImage = (id: string, d: number) =>
    registerHandler(id, {
      enabled: () => has() && (docs.rev, ses().doc.images.length > 1),
      run: () => {
        const imgs = ses().doc.images
        const i = imgs.findIndex((x) => x.id === ses().activeImageId)
        setActiveImage(ses(), imgs[(i + d + imgs.length) % imgs.length]!.id)
      }
    })
  stepImage('image.prev', -1)
  stepImage('image.next', 1)
  registerHandler('anchor.cut', {
    enabled: anchorsReady,
    run: () => void activeController?.shapes.cutSelectedAnchors()
  })
  registerHandler('anchor.join', {
    enabled: () => has() && ui.anchorCount === 2,
    run: () => void activeController?.shapes.joinSelectedAnchors()
  })
  registerHandler('anchor.toCorner', {
    enabled: anchorsReady,
    run: () => void activeController?.shapes.convertSelectedAnchors(false)
  })
  registerHandler('anchor.toSmooth', {
    enabled: anchorsReady,
    run: () => void activeController?.shapes.convertSelectedAnchors(true)
  })
  registerHandler('object.centerAnchors', {
    enabled: shapesSelected,
    run: () => void centerAnchors(ses(), ses().selectedShapes)
  })
  registerHandler('object.addAnchors', {
    enabled: shapesSelected,
    run: () => void addMidAnchors(ses(), ses().selectedShapes)
  })
  registerHandler('object.compound', {
    enabled: () => has() && (docs.rev, ses().selectedShapes.length > 1),
    run: () => void makeCompound(ses(), ses().selectedShapes)
  })
  for (const op of ['unite', 'minusFront', 'intersect', 'exclude'] as const)
    registerHandler(`object.pf.${op}`, {
      enabled: () => has() && (docs.rev, ses().selectedShapes.length > 1),
      run: () => void pathfinder(ses(), ses().selectedShapes, op)
    })
  registerHandler('object.releaseCompound', {
    enabled: () =>
      shapesSelected() &&
      ses().selectedShapes.some((i) => {
        const sh = getShape(ses(), i)
        return sh?.kind === 'path' && sh.subpaths.length > 1
      }),
    run: () => void releaseCompound(ses(), ses().selectedShapes)
  })
  registerHandler('object.simplify', {
    enabled: shapesSelected,
    run: () => void simplifyPaths(ses(), ses().selectedShapes)
  })
  registerHandler('object.offsetOut', {
    enabled: shapesSelected,
    run: () => void offsetPaths(ses(), ses().selectedShapes, 1)
  })
  registerHandler('object.offsetIn', {
    enabled: shapesSelected,
    run: () => void offsetPaths(ses(), ses().selectedShapes, -1)
  })
  registerHandler('object.outlineStroke', {
    enabled: shapesSelected,
    run: () => void outlineStroke(ses(), ses().selectedShapes)
  })
  registerHandler('object.stamp', {
    enabled: shapesSelected,
    run: () => void stampShapes(ses(), ses().selectedShapes)
  })
  registerHandler('object.stampAll', {
    enabled: () => has() && (docs.rev, ses().activeLayer.shapes.length > 0),
    run: () => void stampAllShapes(ses())
  })
  const arrange = (id: string, how: 'front' | 'forward' | 'backward' | 'back') =>
    registerHandler(id, {
      enabled: shapesSelected,
      run: () => arrangeShapes(ses(), ses().selectedShapes, how)
    })
  arrange('object.bringFront', 'front')
  arrange('object.bringForward', 'forward')
  arrange('object.sendBackward', 'backward')
  arrange('object.sendBack', 'back')

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
  registerHandler('layer.rasterizeEffects', {
    enabled: () =>
      has() &&
      (docs.rev, ses().activeLayer.shapes.length > 0 || ses().activeLayer.effects.length > 0),
    run: () => void rasterizeLayerEffects(ses(), ses().activeLayerId)
  })
  registerHandler('layer.group', {
    enabled: () => has() && (docs.rev, !ses().activeLayer.isGroup && !ses().activeLayer.groupId),
    run: () => void createGroup(ses())
  })
  registerHandler('layer.ungroup', {
    enabled: () => has() && (docs.rev, !!(ses().activeLayer.isGroup || ses().activeLayer.groupId)),
    run: () => {
      const l = ses().activeLayer
      void ungroup(ses(), l.isGroup ? l.id : l.groupId!)
    }
  })
  registerHandler('layer.clip', {
    enabled: () => has() && (docs.rev, !ses().activeLayer.isGroup || !!ses().activeLayer.clip),
    run: () => void toggleClip(ses()),
    checked: () => (docs.rev, has() && !!ses().activeLayer.clip)
  })
  registerHandler('layer.lockAlpha', {
    enabled: has,
    run: () =>
      ses().setLayerProps(ses().activeLayerId, { lockAlpha: !ses().activeLayer.lockAlpha }),
    checked: () => (docs.rev, has() && ses().activeLayer.lockAlpha)
  })

  // ---------- Ver ----------
  const zoom = (fn: (vp: Viewport) => void) => () => {
    const v = ws().activeViewer
    fn(v.viewport)
    ws().syncFrom(v)
    ws().refreshView()
  }
  registerHandler('view.zoomIn', { enabled: has, run: zoom((vp) => vp.stepZoom(1)) })
  registerHandler('view.zoomOut', { enabled: has, run: zoom((vp) => vp.stepZoom(-1)) })
  registerHandler('view.zoom100', {
    enabled: has,
    run: zoom((vp) => vp.setZoom(1))
  })
  registerHandler('view.zoomFit', { enabled: has, run: zoom((vp) => vp.fit()) })

  // ---------- Visores (specs/09) ----------
  registerHandler('window.splitV', {
    enabled: () => has() && ws().viewers.length < MAX_VIEWERS,
    run: () => void ws().splitViewer(ws().activeViewerId, 'v')
  })
  registerHandler('window.splitH', {
    enabled: () => has() && ws().viewers.length < MAX_VIEWERS,
    run: () => void ws().splitViewer(ws().activeViewerId, 'h')
  })
  for (const id of PANEL_IDS)
    registerHandler(`window.panel.${id}`, {
      run: () => {
        const i = ui.panelsVisible.indexOf(id)
        if (i >= 0) ui.panelsVisible.splice(i, 1)
        else ui.panelsVisible.push(id)
      },
      checked: () => ui.panelsVisible.includes(id)
    })
  const isCustom = () => ui.customWorkspaces.some((w) => w.id === ui.workspaceId)
  registerHandler('window.workspace.new', {
    enabled: canCreateWorkspace,
    run: () => (ui.workspaceDialog = 'new')
  })
  registerHandler('window.workspace.save', {
    enabled: isCustom,
    run: () => void saveCurrentWorkspace()
  })
  registerHandler('window.workspace.rename', {
    enabled: isCustom,
    run: () => (ui.workspaceDialog = 'rename')
  })
  registerHandler('window.workspace.delete', {
    enabled: isCustom,
    run: () => void deleteWorkspace(ui.workspaceId)
  })
  registerHandler('window.workspace.reset', { run: resetWorkspace })
  registerHandler('window.closeViewer', {
    enabled: () => has() && ws().viewers.length > 1,
    run: () => {
      ws().closeViewer(ws().activeViewerId)
      mirrorViewerFlags(ws())
    }
  })
  for (const p of Object.keys(PRESET_COUNT) as LayoutPreset[])
    registerHandler(`window.layout.${p}`, {
      enabled: has,
      run: () => {
        ws().applyPreset(p)
        ui.viewerPreset = p
        mirrorViewerFlags(ws())
      }
    })
  registerHandler('view.tiled', {
    enabled: has,
    run: () => {
      const v = ws().activeViewer
      v.tiled = v.tiled === 'none' ? 'both' : 'none'
      ws().refreshView()
    },
    checked: () => (docs.rev, has() && ws().activeViewer.tiled !== 'none')
  })
  registerHandler('view.syncViewers', {
    enabled: () => has() && ws().viewers.length > 1,
    run: () => {
      const v = ws().activeViewer
      v.sync = !v.sync
      ws().syncFrom(v)
      ws().refreshView()
    },
    checked: () => (docs.rev, has() && ws().activeViewer.sync)
  })
}
