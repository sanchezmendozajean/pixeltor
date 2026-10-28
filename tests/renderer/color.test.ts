import { describe, expect, it } from 'vitest'
import { hexToHsv, hexToRgba, hsvToHex, rgbaToHex } from '@/stores/colorUtil'

describe('colorUtil', () => {
  it('ida y vuelta hex ↔ rgba', () => {
    expect(hexToRgba('#FF8000')).toBe(0xff8000ff)
    expect(rgbaToHex(0xff8000ff)).toBe('#FF8000')
    expect(rgbaToHex(0xff800080)).toBe('#FF800080')
    expect(hexToRgba('#f80')).toBe(0xff8800ff)
  })
  it('hsv ↔ hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#FF0000')
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00')
    const { h, s, v } = hexToHsv('#3D8BFF')
    expect(hsvToHex(h, s, v)).toBe('#3D8BFF')
  })
})
