import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  addToGroup,
  composeImage,
  createGroup,
  loadDocument,
  paintBlockReason,
  removeFromGroup,
  rgba,
  saveDocument,
  toggleClip,
  ungroup
} from '@core/index'

const RED = rgba(255, 0, 0)
const BLUE = rgba(0, 0, 255)

function flat(s: DocumentSession): Bitmap {
  const out = new Bitmap(s.image.width, s.image.height)
  composeImage(s.image, s.rasters, out)
  return out
}

/** Sesión 8×8 con una capa roja de 4×4 en (0,0) y otra azul de 4×4 en (2,2). */
function setup() {
  const s = DocumentSession.create(8, 8)
  const a = s.activeLayer
  const bmpA = s.bitmapOf(a.id)
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) bmpA.set(x, y, RED)
  const b = s.addLayer('B')!
  const bmpB = s.bitmapOf(b.id)
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) bmpB.set(x, y, BLUE)
  return { s, a, b }
}

describe('grupos de capas', () => {
  it('un grupo al 100 % compone igual que las capas sueltas', () => {
    const { s, a } = setup()
    const before = flat(s)
    const g = createGroup(s, a.id)!
    expect(g.isGroup).toBe(true)
    expect(flat(s).data).toEqual(before.data)
  })

  it('la opacidad del grupo se aplica al conjunto, no a cada miembro', () => {
    const { s, a, b } = setup()
    const g = createGroup(s, a.id)!
    addToGroup(s, b.id, g.id)
    s.setLayerProps(g.id, { opacity: 0.5 })
    const out = flat(s)
    // en el solape sólo se ve el miembro de arriba (azul) a media opacidad, sin traslucir el rojo
    const p = out.get(3, 3)
    expect(p >>> 24).toBe(0) // r
    expect(p & 255).toBe(128) // a
    expect(out.get(0, 0) & 255).toBe(128)
  })

  it('ocultar el grupo oculta a sus miembros', () => {
    const { s, a } = setup()
    const g = createGroup(s, a.id)!
    s.setLayerProps(g.id, { visible: false })
    expect(flat(s).get(0, 0) & 255).toBe(0)
  })

  it('sacar del grupo y desagrupar, deshaciendo cada paso', () => {
    const { s, a, b } = setup()
    const g = createGroup(s, a.id)!
    addToGroup(s, b.id, g.id)
    expect(s.image.layers.map((l) => l.groupId)).toEqual([g.id, g.id, undefined])
    expect(removeFromGroup(s, b.id)).toBe(true)
    expect(s.image.layers.find((l) => l.id === b.id)!.groupId).toBeUndefined()
    s.undo()
    expect(s.image.layers.find((l) => l.id === b.id)!.groupId).toBe(g.id)
    expect(ungroup(s, g.id)).toBe(true)
    expect(s.image.layers.some((l) => l.isGroup || l.groupId)).toBe(false)
  })

  it('eliminar un grupo elimina sus miembros; mover un grupo los arrastra', () => {
    const { s, a, b } = setup()
    const c = s.addLayer('C')!
    const g = createGroup(s, a.id)!
    addToGroup(s, b.id, g.id)
    // orden: a, b, G, C → mover G al fondo deja G con sus miembros contiguos debajo de él
    s.moveLayer(g.id, 0)
    const ids = s.image.layers.map((l) => l.id)
    expect(ids.indexOf(g.id)).toBe(ids.length - 2)
    expect(ids.slice(0, 2).sort()).toEqual([a.id, b.id].sort())
    expect(ids[0]).not.toBe(c.id)
    s.deleteLayer(g.id)
    expect(s.image.layers.map((l) => l.id)).toEqual([c.id])
  })

  it('una capa soltada entre los miembros se une al grupo', () => {
    const { s, a, b } = setup()
    const c = s.addLayer('C')!
    const g = createGroup(s, a.id)!
    addToGroup(s, b.id, g.id)
    // orden: a, b, G, C; se mete C entre a y b
    s.moveLayer(c.id, 1)
    expect(s.image.layers.find((l) => l.id === c.id)!.groupId).toBe(g.id)
  })

  it('no se puede pintar en una capa de grupo', () => {
    const { s, a } = setup()
    const g = createGroup(s, a.id)!
    s.setActiveLayer(g.id)
    expect(paintBlockReason(s)).toBe('group')
  })

  it('se guarda y se abre con su estructura', () => {
    const { s, a, b } = setup()
    const g = createGroup(s, a.id)!
    addToGroup(s, b.id, g.id)
    s.setLayerProps(g.id, { opacity: 0.5, collapsed: true })
    const back = loadDocument(saveDocument(s.doc, s.rasters))
    const layers = back.doc.images[0]!.layers
    expect(layers.filter((l) => l.groupId === g.id)).toHaveLength(2)
    expect(layers.find((l) => l.id === g.id)).toMatchObject({
      isGroup: true,
      collapsed: true,
      opacity: 0.5
    })
  })
})

describe('máscara de recorte', () => {
  it('la capa recortada sólo se ve sobre el alfa de su base', () => {
    const { s, b } = setup()
    // base = A (rojo en 0..3); B (azul 2..5) recortada sobre A
    expect(toggleClip(s, b.id)).toBe(true)
    const out = flat(s)
    expect(out.get(3, 3)).toBe(BLUE) // solape: azul sobre rojo
    expect(out.get(5, 5) & 255).toBe(0) // fuera de la base: recortado
    expect(out.get(0, 0)).toBe(RED)
  })

  it('liberar la máscara devuelve la composición normal; la capa inferior no se puede recortar', () => {
    const { s, a, b } = setup()
    const before = flat(s)
    toggleClip(s, b.id)
    toggleClip(s, b.id)
    expect(flat(s).data).toEqual(before.data)
    expect(toggleClip(s, a.id)).toBe(false)
  })

  it('si la base se oculta, se oculta también lo recortado', () => {
    const { s, a, b } = setup()
    toggleClip(s, b.id)
    s.setLayerProps(a.id, { visible: false })
    expect(flat(s).get(3, 3) & 255).toBe(0)
  })

  it('el recorte conserva la opacidad de la base para todo el conjunto', () => {
    const { s, a, b } = setup()
    toggleClip(s, b.id)
    s.setLayerProps(a.id, { opacity: 0.5 })
    expect(flat(s).get(3, 3) & 255).toBe(128)
  })
})
