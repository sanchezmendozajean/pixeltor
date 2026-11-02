// Estructura de los menús. Cada entrada apunta a una acción del registro (definitions.ts).
import { EFFECT_LIST as EFFECT_DEFS } from '@core/effects/registry'
import type { I18nKey } from '@/i18n'

export type MenuNode =
  | { type: 'action'; id: string }
  | { type: 'sep' }
  | { type: 'submenu'; label: I18nKey; items: MenuNode[] }

export interface MenuDef {
  id: string
  label: I18nKey
  items: MenuNode[]
}

const EFFECT_CATEGORIES = ['shadow', 'outline', 'blur', 'distort', 'color'] as const

const act = (id: string): MenuNode => ({ type: 'action', id })
const sep: MenuNode = { type: 'sep' }

export const MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'menus.file',
    items: [
      act('file.new'),
      act('file.open'),
      act('file.importSequence'),
      act('file.importSheet'),
      sep,
      act('file.save'),
      act('file.saveAs'),
      sep,
      act('file.export'),
      act('file.exportAgain'),
      sep,
      act('file.close'),
      act('file.quit')
    ]
  },
  {
    id: 'edit',
    label: 'menus.edit',
    items: [
      act('edit.undo'),
      act('edit.redo'),
      sep,
      act('edit.cut'),
      act('edit.copy'),
      act('edit.paste'),
      act('edit.delete'),
      sep,
      act('edit.preferences')
    ]
  },
  {
    id: 'object',
    label: 'menus.object',
    items: [
      act('object.group'),
      act('object.ungroup'),
      sep,
      act('object.bringFront'),
      act('object.bringForward'),
      act('object.sendBackward'),
      act('object.sendBack'),
      sep,
      act('object.stamp'),
      act('object.stampAll'),
      act('object.convertToPath'),
      sep,
      act('object.addAnchors'),
      act('object.centerAnchors'),
      act('anchor.delete'),
      act('anchor.cut'),
      act('anchor.join'),
      act('anchor.toCorner'),
      act('anchor.toSmooth'),
      sep,
      act('object.compound'),
      act('object.releaseCompound'),
      {
        type: 'submenu',
        label: 'menus.pathfinder',
        items: [
          act('object.pf.unite'),
          act('object.pf.minusFront'),
          act('object.pf.intersect'),
          act('object.pf.exclude')
        ]
      },
      act('object.outlineStroke'),
      act('object.offsetOut'),
      act('object.offsetIn'),
      act('object.simplify')
    ]
  },
  {
    id: 'layer',
    label: 'menus.layer',
    items: [
      act('layer.new'),
      act('layer.duplicate'),
      act('layer.delete'),
      sep,
      act('layer.group'),
      act('layer.ungroup'),
      act('layer.clip'),
      sep,
      act('layer.mergeDown'),
      act('layer.mergeVisible'),
      act('layer.flatten'),
      sep,
      act('layer.rasterizeEffects'),
      act('layer.lockAlpha')
    ]
  },
  {
    id: 'effect',
    label: 'menus.effect',
    items: [
      ...EFFECT_CATEGORIES.map((c): MenuNode => ({
        type: 'submenu',
        label: `effects.categories.${c}` as I18nKey,
        items: EFFECT_DEFS.filter((d) => d.category === c).map((d) => act(`effect.add.${d.type}`))
      })),
      sep,
      act('layer.rasterizeEffects')
    ]
  },
  {
    id: 'image',
    label: 'menus.image',
    items: [
      act('image.new'),
      act('image.newEmpty'),
      act('image.duplicate'),
      act('image.delete'),
      sep,
      act('image.prev'),
      act('image.next'),
      sep,
      act('image.size'),
      act('image.canvasSize'),
      act('image.crop')
    ]
  },
  {
    id: 'select',
    label: 'menus.select',
    items: [act('select.all'), act('select.none'), act('select.invert')]
  },
  {
    id: 'view',
    label: 'menus.view',
    items: [
      act('view.zoomIn'),
      act('view.zoomOut'),
      act('view.zoom100'),
      act('view.zoomFit'),
      sep,
      act('view.pixelGrid'),
      act('view.guides'),
      act('view.smartGuides'),
      act('view.snapPixel'),
      act('view.hidePaths'),
      act('view.preview'),
      sep,
      act('view.onion'),
      act('view.play'),
      act('view.tiled'),
      act('view.syncViewers'),
      sep,
      {
        type: 'submenu',
        label: 'menus.theme',
        items: [act('theme.oscuro'), act('theme.gris'), act('theme.claro')]
      },
      {
        type: 'submenu',
        label: 'menus.uiScale',
        items: [
          act('view.uiScale.90'),
          act('view.uiScale.100'),
          act('view.uiScale.110'),
          act('view.uiScale.125'),
          act('view.uiScale.150')
        ]
      }
    ]
  },
  {
    id: 'window',
    label: 'menus.window',
    items: [
      act('window.splitV'),
      act('window.splitH'),
      act('window.closeViewer'),
      {
        type: 'submenu',
        label: 'menus.panels',
        items: [
          act('window.panel.properties'),
          act('window.panel.navigator'),
          act('window.panel.history'),
          act('window.panel.layers'),
          act('window.panel.appearance'),
          act('window.panel.align'),
          act('window.panel.effects'),
          act('window.panel.color'),
          act('window.panel.swatches'),
          act('window.panel.gradient')
        ]
      },
      {
        type: 'submenu',
        label: 'menus.workspace',
        items: [
          act('window.workspace.new'),
          act('window.workspace.save'),
          act('window.workspace.rename'),
          act('window.workspace.delete'),
          act('window.workspace.reset')
        ]
      },
      {
        type: 'submenu',
        label: 'menus.viewerLayout',
        items: [
          act('window.layout.single'),
          act('window.layout.2v'),
          act('window.layout.2h'),
          act('window.layout.1+2'),
          act('window.layout.2x2')
        ]
      },
      sep,
      act('window.hidePanels'),
      act('window.hidePanelsKeepTools')
    ]
  },
  {
    id: 'help',
    label: 'menus.help',
    items: [act('help.commandPalette'), act('help.shortcuts'), sep, act('help.about')]
  }
]
