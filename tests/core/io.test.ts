import { describe, expect, it } from 'vitest'
import {
  Bitmap,
  DocumentSession,
  FormatError,
  decodePng,
  encodePng,
  loadDocument,
  rgba,
  saveDocument,
  scaleNearest,
  exportImagePng
} from '@core/index'
import { sha256Hex } from '@core/io/sha256'
import { strToU8, unzipSync, zipSync } from 'fflate'

describe('sha256', () => {
  it('coincide con los vectores conocidos', () => {
    expect(sha256Hex(strToU8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
})

describe('PNG', () => {
  it('codifica y decodifica sin pérdidas', () => {
    const b = new Bitmap(5, 3)
    for (let i = 0; i < b.data.length; i++) b.data[i] = (i * 37) & 255
    const back = decodePng(encodePng(b))
    expect(back.width).toBe(5)
    expect(back.data).toEqual(b.data)
  })
  it('escala por vecino más cercano', () => {
    const b = new Bitmap(2, 1)
    b.set(0, 0, rgba(1, 2, 3))
    b.set(1, 0, rgba(9, 9, 9))
    const s = scaleNearest(b, 4)
    expect(s.width).toBe(8)
    expect(s.height).toBe(4)
    expect(s.get(3, 3)).toBe(rgba(1, 2, 3))
    expect(s.get(4, 0)).toBe(rgba(9, 9, 9))
  })
})

describe('.pixeltor', () => {
  function sprite(): DocumentSession {
    const s = DocumentSession.create(32, 32, 'sprite')
    const l1 = s.activeLayer
    s.bitmapOf(l1.id).set(3, 4, rgba(10, 20, 30))
    const l2 = s.addLayer('Sombras')!
    s.bitmapOf(l2.id).set(8, 8, rgba(200, 100, 50, 128))
    s.setLayerProps(l2.id, { opacity: 0.6, blendMode: 'multiply' })
    s.addLayer('Vacía')
    return s
  }

  it('guardar y reabrir deja el documento idéntico', () => {
    const s = sprite()
    const bytes = saveDocument(s.doc, s.rasters)
    const loaded = loadDocument(bytes)
    expect(loaded.warnings).toEqual([])
    expect(loaded.doc.images[0]!.layers.map((l) => [l.name, l.opacity, l.blendMode])).toEqual(
      s.doc.images[0]!.layers.map((l) => [l.name, l.opacity, l.blendMode])
    )
    for (const l of s.image.layers) {
      expect(loaded.rasters.get(l.raster.id)!.data).toEqual(s.rasters.get(l.raster.id)!.data)
    }
  })

  it('omite los rásters vacíos y mimetype va primero y sin comprimir', () => {
    const s = sprite()
    const bytes = saveDocument(s.doc, s.rasters)
    const names = Object.keys(unzipSync(bytes))
    expect(names[0]).toBe('mimetype')
    expect(names.filter((n) => n.startsWith('rasters/'))).toHaveLength(2)
  })

  it('tolera un ráster dañado y avisa con el nombre de la capa', () => {
    const s = sprite()
    const files = unzipSync(saveDocument(s.doc, s.rasters))
    const victim = s.image.layers[1]!
    files[`rasters/${victim.raster.id}.png`] = new Uint8Array([1, 2, 3])
    const loaded = loadDocument(zipSync(files))
    expect(loaded.warnings[0]).toContain('Sombras')
    expect(loaded.rasters.get(victim.raster.id)!.isEmpty()).toBe(true)
  })

  it('rechaza archivos ajenos y versiones mayores', () => {
    expect(() => loadDocument(new Uint8Array([1, 2, 3]))).toThrow(FormatError)
    const s = sprite()
    const files = unzipSync(saveDocument(s.doc, s.rasters))
    const doc = JSON.parse(new TextDecoder().decode(files['document.json']))
    doc.formatVersion = '2.0.0'
    files['document.json'] = strToU8(JSON.stringify(doc))
    expect(() => loadDocument(zipSync(files))).toThrow(/más nuevo/)
  })

  it('exporta ×4 pixel-perfect', () => {
    const s = sprite()
    const png = exportImagePng(s.image, s.rasters, 4)
    const b = decodePng(png)
    expect(b.width).toBe(128)
    expect(b.get(3 * 4 + 3, 4 * 4 + 2)).toBe(rgba(10, 20, 30))
    expect(b.get(3 * 4 + 4, 4 * 4)).toBe(0)
  })
})
