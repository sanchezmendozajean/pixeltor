import { describe, expect, it } from 'vitest'
import { DocumentSession, loadDocument, saveDocument } from '../../src/core'
import { sanitizeViewers, type SavedViewers } from '../../src/core/viewers/layout'
import {
  MAX_VIEWERS,
  PRESET_COUNT,
  equalize,
  leaf,
  leaves,
  presetLayout,
  removeLeaf,
  splitLeaf,
  type LayoutNode
} from '../../src/core/viewers/layout'

describe('disposición de visores', () => {
  it('divide hasta 4 visores y rechaza el quinto', () => {
    let t: LayoutNode = leaf('a')
    t = splitLeaf(t, 'a', 'v', 'b')!
    t = splitLeaf(t, 'b', 'h', 'c')!
    t = splitLeaf(t, 'a', 'h', 'd')!
    expect(leaves(t)).toEqual(['a', 'd', 'b', 'c'])
    expect(leaves(t)).toHaveLength(MAX_VIEWERS)
    expect(splitLeaf(t, 'a', 'v', 'e')).toBeNull()
  })

  it('al quitar un visor el hermano ocupa su sitio', () => {
    let t: LayoutNode = leaf('a')
    t = splitLeaf(t, 'a', 'v', 'b')!
    t = splitLeaf(t, 'b', 'h', 'c')!
    const r = removeLeaf(t, 'b')!
    expect(leaves(r)).toEqual(['a', 'c'])
    expect(removeLeaf(leaf('a'), 'a')).toBeNull()
  })

  it('los presets tienen el número de visores previsto', () => {
    const ids = ['a', 'b', 'c', 'd']
    for (const p of Object.keys(PRESET_COUNT) as (keyof typeof PRESET_COUNT)[])
      expect(leaves(presetLayout(p, ids))).toHaveLength(PRESET_COUNT[p])
    expect(() => presetLayout('2x2', ['a'])).toThrow()
  })

  it('equalize deja todos los divisores al 50 %', () => {
    const t = equalize(presetLayout('1+2', ['a', 'b', 'c']))
    expect(t.kind === 'split' && t.ratio).toBe(0.5)
  })
})

describe('persistencia de la disposición', () => {
  const saved = {
    layout: presetLayout('1+2', ['v1', 'v2', 'v3']),
    viewers: [
      { id: 'v1', tiled: 'both', pixelGrid: false },
      { id: 'v2', imageId: 'img-x', onion: true, sync: true }
    ],
    active: 'v2'
  }

  it('ida y vuelta por el archivo .pixeltor', () => {
    const s = DocumentSession.create(8, 8)
    s.doc.viewers = saved as SavedViewers
    const back = loadDocument(saveDocument(s.doc, s.rasters)).doc.viewers!
    expect(leaves(back.layout)).toEqual(['v1', 'v2', 'v3'])
    expect(back.active).toBe('v2')
    expect(back.viewers.find((v) => v.id === 'v1')).toMatchObject({
      tiled: 'both',
      pixelGrid: false
    })
    // el tercer visor no tenía ajustes: se completa con los de por defecto
    expect(back.viewers.find((v) => v.id === 'v3')).toEqual({ id: 'v3' })
  })

  it('descarta disposiciones no válidas', () => {
    expect(sanitizeViewers(null)).toBeUndefined()
    expect(sanitizeViewers({ layout: { kind: 'leaf' } })).toBeUndefined()
    // visores repetidos
    const dup = { layout: { kind: 'split', dir: 'v', ratio: 0.5, a: leaf('x'), b: leaf('x') } }
    expect(sanitizeViewers(dup)).toBeUndefined()
    // más de 4 visores
    const five = ['a', 'b', 'c', 'd', 'e'].reduce<LayoutNode>(
      (acc, id, i) =>
        i === 0 ? leaf(id) : { kind: 'split', dir: 'v', ratio: 0.5, a: acc, b: leaf(id) },
      leaf('a')
    )
    expect(sanitizeViewers({ layout: five })).toBeUndefined()
  })

  it('sanea la proporción y el modo de mosaico', () => {
    const r = sanitizeViewers({
      layout: { kind: 'split', dir: 'h', ratio: 7, a: leaf('a'), b: leaf('b') },
      viewers: [{ id: 'a', tiled: 'raro' }],
      active: 'zzz'
    })!
    expect(r.layout.kind === 'split' && r.layout.ratio).toBeLessThan(1)
    expect(r.viewers[0]!.tiled).toBeUndefined()
    expect(r.active).toBeUndefined()
  })
})
