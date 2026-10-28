// Registro único de acciones (CLAUDE.md, regla 8): de aquí salen menús, tooltips y atajos.
// Los atajos siguen specs/04-herramientas.md. Ctrl es el modificador en Windows y Linux.
// Formato canónico: modificadores en orden Ctrl+Alt+Shift y luego la tecla (p. ej. "Ctrl+Alt+Shift+S").

export interface ActionDef {
  id: string
  /** Atajo principal; se muestra en menús y tooltips. */
  shortcut?: string
  /** Atajos alternativos (no se muestran). */
  alt?: string[]
  /** Nombre de icono de `assets/icons.json`. */
  icon?: string
}

const a = (id: string, shortcut?: string, icon?: string, alt?: string[]): ActionDef => ({
  id,
  shortcut,
  icon,
  alt
})

export const ACTIONS: ActionDef[] = [
  // Archivo
  a('file.new', 'Ctrl+N', 'newDoc'),
  a('file.open', 'Ctrl+O', 'folderOpen'),
  a('file.save', 'Ctrl+S', 'save'),
  a('file.saveAs', 'Ctrl+Shift+S'),
  a('file.export', 'Ctrl+Alt+S', 'exportIc'),
  a('file.exportAgain', 'Ctrl+Alt+Shift+S'),
  a('file.close', 'Ctrl+W'),
  a('file.quit', 'Ctrl+Q'),
  // Editar
  a('edit.undo', 'Ctrl+Z'),
  a('edit.redo', 'Ctrl+Shift+Z', undefined, ['Ctrl+Y']),
  a('edit.cut', 'Ctrl+X'),
  a('edit.copy', 'Ctrl+C'),
  a('edit.paste', 'Ctrl+V'),
  a('edit.delete', 'Delete', 'trash'),
  a('edit.preferences', undefined, 'settings'),
  // Objeto
  a('object.group', 'Ctrl+G', 'folder'),
  a('object.ungroup', 'Ctrl+Shift+G'),
  a('object.bringFront', 'Ctrl+Shift+]', 'bringFront'),
  a('object.bringForward', 'Ctrl+]'),
  a('object.sendBackward', 'Ctrl+['),
  a('object.sendBack', 'Ctrl+Shift+[', 'sendBack'),
  a('object.stamp', 'Ctrl+E', 'stamp'),
  a('object.stampAll', 'Ctrl+Shift+E'),
  a('object.convertToPath'),
  // Capa
  a('layer.new', 'Ctrl+Shift+N', 'newLayer'),
  a('layer.duplicate', 'Ctrl+J', 'duplicate'),
  a('layer.delete', undefined, 'trash'),
  a('layer.mergeDown', 'Ctrl+Alt+ArrowDown'),
  a('layer.mergeVisible', 'Ctrl+Alt+Shift+E'),
  a('layer.flatten'),
  a('layer.rasterizeEffects', 'Ctrl+Alt+E'),
  a('layer.lockAlpha', '/', 'lockAlpha'),
  // Efecto (el catálogo llega en F4)
  a('effect.shadowLight'),
  a('effect.outline'),
  a('effect.blur'),
  a('effect.distort'),
  a('effect.color'),
  // Imagen
  a('image.new', 'Ctrl+Alt+N', 'plus'),
  a('image.prev', ',', 'prevF'),
  a('image.next', '.', 'nextF'),
  a('image.size'),
  a('image.canvasSize', undefined, 'canvasIc'),
  a('image.crop'),
  // Seleccionar
  a('select.all', 'Ctrl+A'),
  a('select.none', 'Ctrl+D'),
  a('select.invert', 'Ctrl+Shift+I'),
  // Ver
  a('view.zoomIn', 'Ctrl++'),
  a('view.zoomOut', 'Ctrl+-'),
  a('view.zoom100', 'Ctrl+1'),
  a('view.zoomFit', 'Ctrl+0'),
  a('view.pixelGrid', "Ctrl+'", 'gridPx'),
  a('view.guides', 'Ctrl+;'),
  a('view.smartGuides', 'Ctrl+U', 'magnet'),
  a('view.snapPixel', "Ctrl+Alt+'"),
  a('view.hidePaths', 'Ctrl+H', 'paths'),
  a('view.preview', 'Ctrl+Shift+Y'),
  a('view.onion', 'O', 'onion'),
  a('view.play', 'Ctrl+Enter', 'play'),
  a('theme.oscuro'),
  a('theme.gris'),
  a('theme.claro'),
  // Ventana
  a('window.splitV', 'Ctrl+Alt+V', 'layoutV'),
  a('window.splitH', 'Ctrl+Alt+H', 'layoutH'),
  a('window.hidePanels', 'Tab'),
  a('window.hidePanelsKeepTools', 'Shift+Tab'),
  // Ayuda
  a('help.commandPalette', 'Ctrl+K', 'search'),
  a('help.about', undefined, 'info'),
  // Herramientas
  a('tool.sel', 'V', 'sel'),
  a('tool.dsel', 'A', 'dsel'),
  a('tool.groupSel', undefined, 'groupSel'),
  a('tool.marquee', 'S', 'marquee'),
  a('tool.marqueeEll', 'Shift+S', 'marqueeEll'),
  a('tool.lasso', 'Q', 'lasso'),
  a('tool.polyLasso', undefined, 'polyLasso'),
  a('tool.wand', 'W', 'wand'),
  a('tool.pen', 'P', 'pen'),
  a('tool.addAnchor', '+', 'addAnchor'),
  a('tool.delAnchor', '-', 'delAnchor'),
  a('tool.convAnchor', 'Shift+C', 'convAnchor'),
  a('tool.vpencil', 'Shift+N', 'vpencil'),
  a('tool.rect', 'M', 'rect'),
  a('tool.ellipse', 'L', 'ellipse'),
  a('tool.polygon', undefined, 'polygon'),
  a('tool.star', undefined, 'star'),
  a('tool.line', '\\', 'line'),
  a('tool.pencil', 'N', 'pencil'),
  a('tool.brush', 'B', 'brush'),
  a('tool.shade', 'Shift+B', 'shade'),
  a('tool.eraser', 'E', 'eraser'),
  a('tool.bucket', 'K', 'bucket'),
  a('tool.replaceColor', 'Shift+K', 'replaceColor'),
  a('tool.gradient', 'G', 'gradient'),
  a('tool.eyedrop', 'I', 'eyedrop'),
  a('tool.hand', 'H', 'hand'),
  a('tool.zoom', 'Z', 'zoom'),
  // Color y pincel
  a('colors.toggleActive', 'X'),
  a('colors.swap', 'Shift+X', 'swap'),
  a('colors.default', 'D'),
  a('brush.sizeDown', '['),
  a('brush.sizeUp', ']')
]

export const ACTION_MAP: ReadonlyMap<string, ActionDef> = new Map(ACTIONS.map((x) => [x.id, x]))
