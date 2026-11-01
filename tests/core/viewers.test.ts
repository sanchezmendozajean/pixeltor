import { describe, expect, it } from 'vitest'
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
