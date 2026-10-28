import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  addShape,
  arrangeShapes,
  color,
  composeImage,
  findShape,
  getShape,
  groupShapes,
  hitShape,
  isolateGroup,
  loadDocument,
  makeAppearance,
  makeRect,
  moveShapes,
  removeShapes,
  resolveShape,
  saveDocument,
  stampShapes,
  ungroupShapes
} from '@core/index'

const RED = color(255, 0, 0)
const BLUE = color(0, 0, 255)
const render = (s: DocumentSession) => {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out)
  return out
}

function setup() {
  const s = DocumentSession.create(32, 32)
  const a = makeRect(2, 2, 10, 10, makeAppearance(RED, null))
  const b = makeRect(8, 8, 10, 10, makeAppearance(BLUE, null))
  addShape(s, a)
  addShape(s, b)
  return { s, a, b }
}

describe('grupos', () => {
  it('agrupar no cambia el render y se deshace', () => {
    const { s, a, b } = setup()
    const before = render(s).data.slice()
    const g = groupShapes(s, [a.id, b.id])!
    expect(s.activeLayer.shapes).toHaveLength(1)
    expect(findShape(s, a.id)!.parent!.id).toBe(g)
    expect(render(s).data).toEqual(before)
    s.undo()
    expect(s.activeLayer.shapes).toHaveLength(2)
    expect(render(s).data).toEqual(before)
  })

  it('la opacidad del grupo se aplica al conjunto, no a cada hijo', () => {
    const { s, a, b } = setup()
    const g = groupShapes(s, [a.id, b.id])!
    s.activeLayer.shapes[0]!.opacity = 0.5
    const overlap = render(s).get(9, 9)
    // en la zona común solo se ve el hijo de arriba (azul), con el 50 % del grupo
    expect(overlap).toBe(render(s).get(9, 9))
    expect(overlap & 255).toBe(128)
    expect(overlap >>> 24).toBe(0) // sin rastro del rojo de debajo
    expect(g).toBeTruthy()
  })

  it('desagrupar restaura las formas con su aspecto', () => {
    const { s, a, b } = setup()
    const before = render(s).data.slice()
    const g = groupShapes(s, [a.id, b.id])!
    moveShapes(s, [g], 3, 0)
    ungroupShapes(s, [g])
    expect(s.activeLayer.shapes).toHaveLength(2)
    expect(s.activeLayer.shapes[0]!.transform[4]).toBe(5)
    s.undo()
    s.undo()
    s.undo()
    expect(render(s).data).toEqual(before)
  })

  it('resolveShape compone la transformación del grupo', () => {
    const { s, a, b } = setup()
    const g = groupShapes(s, [a.id, b.id])!
    moveShapes(s, [g], 4, 6)
    const r = resolveShape(s, a.id)!
    expect(r.transform[4]).toBe(6)
    expect(r.transform[5]).toBe(8)
  })

  it('en aislamiento solo se eligen los hijos; fuera, el grupo', () => {
    const { s, a, b } = setup()
    const g = groupShapes(s, [a.id, b.id])!
    expect(hitShape(s, 4, 4)).toBe(g)
    isolateGroup(s, g)
    expect(hitShape(s, 4, 4)).toBe(a.id)
    expect(hitShape(s, 15, 15)).toBe(b.id)
    isolateGroup(s, null)
    expect(hitShape(s, 4, 4)).toBe(g)
  })

  it('organizar y eliminar funcionan dentro de un grupo', () => {
    const { s, a, b } = setup()
    const g = groupShapes(s, [a.id, b.id])!
    arrangeShapes(s, [a.id], 'front')
    const grp = getShape(s, g)!
    expect(grp.kind === 'group' && grp.children[1]!.id).toBe(a.id)
    removeShapes(s, [b.id])
    expect(findShape(s, b.id)).toBeNull()
  })

  it('estampar un grupo conserva el render', () => {
    const { s, a, b } = setup()
    const g = groupShapes(s, [a.id, b.id])!
    const before = render(s).data.slice()
    stampShapes(s, [g])
    expect(s.activeLayer.shapes).toHaveLength(0)
    expect(render(s).data).toEqual(before)
  })

  it('los grupos sobreviven a guardar y abrir', () => {
    const { s, a, b } = setup()
    groupShapes(s, [a.id, b.id])
    const before = render(s).data.slice()
    const loaded = loadDocument(saveDocument(s.doc, s.rasters))
    const s2 = new DocumentSession(loaded.doc, loaded.rasters)
    expect(render(s2).data).toEqual(before)
  })
})
