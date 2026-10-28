// Distribución de la barra de herramientas (design/pantallas/03): grupos con flyout.

export type ToolbarItem = { kind: 'sep' } | { kind: 'group'; id: string; tools: string[] }

const group = (id: string, ...tools: string[]): ToolbarItem => ({ kind: 'group', id, tools })
const sep: ToolbarItem = { kind: 'sep' }

/** El primer id de cada grupo es la herramienta visible por defecto. */
export const TOOLBAR: ToolbarItem[] = [
  group('sel', 'sel'),
  group('dsel', 'dsel', 'groupSel'),
  sep,
  group('marquee', 'marquee', 'marqueeEll'),
  group('lasso', 'lasso', 'polyLasso'),
  group('wand', 'wand'),
  sep,
  group('pen', 'pen', 'addAnchor', 'delAnchor', 'convAnchor'),
  group('vpencil', 'vpencil'),
  group('shapes', 'rect', 'ellipse', 'polygon', 'star', 'line'),
  sep,
  group('pencil', 'pencil'),
  group('brush', 'brush', 'shade'),
  group('eraser', 'eraser'),
  group('bucket', 'bucket', 'replaceColor'),
  group('gradient', 'gradient'),
  group('eyedrop', 'eyedrop'),
  sep,
  group('hand', 'hand'),
  group('zoom', 'zoom')
]

export const DEFAULT_TOOL = 'sel'
