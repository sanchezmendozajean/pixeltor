// Estructura de los menús. Cada entrada apunta a una acción del registro (definitions.ts).
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

const act = (id: string): MenuNode => ({ type: 'action', id })
const sep: MenuNode = { type: 'sep' }

export const MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'menus.file',
    items: [
      act('file.new'),
      act('file.open'),
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
      act('object.convertToPath')
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
      act('effect.shadowLight'),
      act('effect.outline'),
      act('effect.blur'),
      act('effect.distort'),
      act('effect.color'),
      sep,
      act('layer.rasterizeEffects')
    ]
  },
  {
    id: 'image',
    label: 'menus.image',
    items: [
      act('image.new'),
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
      sep,
      {
        type: 'submenu',
        label: 'menus.theme',
        items: [act('theme.oscuro'), act('theme.gris'), act('theme.claro')]
      }
    ]
  },
  {
    id: 'window',
    label: 'menus.window',
    items: [
      act('window.splitV'),
      act('window.splitH'),
      sep,
      act('window.hidePanels'),
      act('window.hidePanelsKeepTools')
    ]
  },
  {
    id: 'help',
    label: 'menus.help',
    items: [act('help.commandPalette'), sep, act('help.about')]
  }
]
