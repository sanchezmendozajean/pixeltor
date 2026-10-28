import { describe, expect, it } from 'vitest'
import {
  DocumentSession,
  GuideDrag,
  addGuide,
  addShape,
  color,
  computeSnap,
  makeAppearance,
  makeRect,
  removeGuide
} from '@core/index'

const RED = color(255, 0, 0)
const ALL = { canvas: true, objects: true, guides: true }

function setup() {
  const s = DocumentSession.create(64, 64)
  const a = makeRect(10, 10, 8, 8, makeAppearance(RED, null))
  const b = makeRect(40, 30, 6, 6, makeAppearance(RED, null))
  addShape(s, a)
  addShape(s, b)
  return { s, a, b }
}

describe('ajuste (snapping)', () => {
  it('engancha el borde izquierdo al borde de otra forma dentro del radio', () => {
    const { s, a, b } = setup()
    // b arrastrada a x=20 (a ocupa 10..18): su borde izquierdo (20) va al borde derecho de a (18)
    const r = computeSnap(s, { x: 20, y: 30, w: 6, h: 6 }, [b.id], ALL, 3)
    expect(r.dx).toBe(-2)
    expect(r.lines.some((l) => l.axis === 'v' && l.pos === 18 && l.kind === 'object')).toBe(true)
    expect(a.id).toBeTruthy()
  })

  it('no engancha fuera del radio y no cuenta la forma que se mueve', () => {
    const { s, b } = setup()
    const r = computeSnap(
      s,
      { x: 25, y: 50, w: 6, h: 6 },
      [b.id],
      { canvas: false, objects: true, guides: false },
      3
    )
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
    expect(r.lines).toHaveLength(0)
  })

  it('engancha al borde y al centro del lienzo', () => {
    const { s, a } = setup()
    const r = computeSnap(
      s,
      { x: 2, y: 10, w: 8, h: 8 },
      [a.id],
      { canvas: true, objects: false, guides: false },
      3
    )
    expect(r.dx).toBe(-2)
    expect(r.lines[0]!.kind).toBe('canvas')
    const c = computeSnap(
      s,
      { x: 30, y: 10, w: 4, h: 4 },
      [a.id],
      { canvas: true, objects: false, guides: false },
      3
    )
    expect(c.dx).toBe(0) // centro del objeto en 32 = centro del lienzo
    expect(c.lines.some((l) => l.axis === 'v' && l.pos === 32)).toBe(true)
  })

  it('las opciones desactivadas no enganchan', () => {
    const { s, b } = setup()
    const r = computeSnap(
      s,
      { x: 12, y: 30, w: 6, h: 6 },
      [b.id],
      { canvas: false, objects: false, guides: false },
      5
    )
    expect(r.dx).toBe(0)
  })

  it('las guías enganchan y tienen prioridad sobre los objetos a igual distancia', () => {
    const { s, b } = setup()
    addGuide(s, 'v', 19)
    const r = computeSnap(s, { x: 20, y: 30, w: 6, h: 6 }, [b.id], ALL, 3)
    expect(r.dx).toBe(-1) // guía en 19 (más cerca que el borde del objeto en 18)
    expect(r.lines.some((l) => l.kind === 'guide')).toBe(true)
  })
})

describe('guías', () => {
  it('crear, mover en vivo (un paso al soltar) y eliminar; deshacer', () => {
    const { s } = setup()
    const n = s.history.entries.length
    const id = addGuide(s, 'h', 20)
    expect(s.image.guides).toHaveLength(1)
    const d = new GuideDrag(s, id)
    for (const p of [21, 25, 30]) d.moveTo(p)
    expect(s.history.entries.length).toBe(n + 1)
    d.end()
    expect(s.history.entries.length).toBe(n + 2)
    expect(s.image.guides![0]!.pos).toBe(30)
    s.undo()
    expect(s.image.guides![0]!.pos).toBe(20)
    s.undo()
    expect(s.image.guides).toHaveLength(0)
    s.redo()
    expect(removeGuide(s, id)).toBe(true)
    expect(s.image.guides).toHaveLength(0)
  })
})
