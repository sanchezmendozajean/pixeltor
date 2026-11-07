// Color de trabajo y formas seleccionadas: el selector (panel Color, Muestras, diálogo) pinta las
// formas seleccionadas además de fijar el color de relleno/contorno de las herramientas, y al
// seleccionar una forma el panel muestra sus colores (como en Illustrator).

import {
  getShape,
  setShapesColor,
  setShapesPaint,
  shapePaintsTarget,
  shapesColor,
  updateShape
} from '@core/index'
import { useToolsStore } from '@/stores/tools'
import { useColorsStore } from '@/stores/colors'
import { useDocumentsStore } from '@/stores/documents'
import { hexToRgba, rgbaToHex } from '@/stores/colorUtil'
import { t } from '@/i18n'

export type ColorTarget = 'fill' | 'stroke'

/** Fija el color de trabajo y lo aplica a las formas seleccionadas (un solo paso si es un arrastre). */
export function setWorkingColor(target: ColorTarget, hex: string): void {
  const colors = useColorsStore()
  if (target === 'fill') colors.fill = hex
  else colors.stroke = hex
  const s = useDocumentsStore().session
  if (!s || !s.selectedShapes.length) return
  const v = hexToRgba(hex)
  setShapesColor(s, s.selectedShapes, target, {
    r: (v >>> 24) & 255,
    g: (v >>> 16) & 255,
    b: (v >>> 8) & 255,
    a: v & 255
  })
}

/** Activa o desactiva el relleno/contorno de las formas seleccionadas (indicador «ninguno»). */
export function setSelectionPaint(target: ColorTarget, on: boolean): void {
  const s = useDocumentsStore().session
  if (!s || !s.selectedShapes.length) return
  const colors = useColorsStore()
  const v = hexToRgba(target === 'fill' ? colors.fill : colors.stroke)
  setShapesPaint(s, s.selectedShapes, target, on, {
    r: (v >>> 24) & 255,
    g: (v >>> 16) & 255,
    b: (v >>> 8) & 255,
    a: v & 255
  })
}

/** Muestra en relleno y contorno los colores de la primera forma seleccionada (si son lisos). */
export function syncColorsFromSelection(): void {
  const s = useDocumentsStore().session
  if (!s || !s.selectedShapes.length) return
  const colors = useColorsStore()
  // el indicador «ninguno» refleja si la forma pinta relleno / contorno
  const tools = useToolsStore()
  const id = s.selectedShapes[0]!
  const pf = shapePaintsTarget(s, id, 'fill')
  const pk = shapePaintsTarget(s, id, 'stroke')
  if (pf !== null) tools.useFill = pf
  if (pk !== null) tools.useStroke = pk
  const pack = (c: { r: number; g: number; b: number; a: number }): string =>
    rgbaToHex((((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0) as number)
  const f = shapesColor(s, s.selectedShapes, 'fill')
  const k = shapesColor(s, s.selectedShapes, 'stroke')
  if (f) colors.fill = pack(f)
  if (k) colors.stroke = pack(k)
}

function findAttr(id: string) {
  const s = useDocumentsStore().session
  if (!s || s.selectedShapes.length !== 1) return null
  const sh = getShape(s, s.selectedShapes[0]!)
  if (!sh || sh.kind === 'group') return null
  const a =
    sh.appearance.fills.find((x) => x.id === id) ?? sh.appearance.strokes.find((x) => x.id === id)
  return a ? { s, sh, a } : null
}

/** Color de un relleno/contorno de la forma seleccionada como #RRGGBBAA (null si no es liso). */
export function attrColor(id: string): string | null {
  const f = findAttr(id)
  if (!f || f.a.paint.type !== 'solid') return null
  const c = f.a.paint.color
  return rgbaToHex((((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0) as number)
}

/** Cambia el color de un relleno/contorno liso (un paso de historial). */
export function setAttrColor(id: string, hex: string): void {
  const f = findAttr(id)
  if (!f) return
  const v = hexToRgba(hex)
  updateShape(
    f.s,
    f.sh.id,
    (sh) => {
      if (sh.kind === 'group') return
      const a =
        sh.appearance.fills.find((x) => x.id === id) ??
        sh.appearance.strokes.find((x) => x.id === id)
      if (a && a.paint.type === 'solid')
        a.paint.color = { r: (v >>> 24) & 255, g: (v >>> 16) & 255, b: (v >>> 8) & 255, a: v & 255 }
    },
    t('appearance.edit'),
    `attrcolor:${id}`
  )
}
