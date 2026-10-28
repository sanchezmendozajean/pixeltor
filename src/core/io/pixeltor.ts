// Lectura y escritura del contenedor `.pixeltor` (specs/10).

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { APP_NAME, clampSize } from '../model/document'
import { FORMAT_VERSION } from '../model/version'
import type { ID, Layer, PixeltorDocument } from '../model/types'
import { BLEND_MODES } from '../model/types'
import { Bitmap } from '../raster/bitmap'
import { composeImage } from '../render/compose'
import { decodePng, encodePng, scaleNearest } from './png'
import { migrate } from './migrations'
import { sha256Hex } from './sha256'

const MIME = 'application/x-pixeltor'

export interface LoadedDocument {
  doc: PixeltorDocument
  rasters: Map<ID, Bitmap>
  /** Avisos no fatales (rásters ausentes o corruptos, con el nombre de las capas afectadas). */
  warnings: string[]
}

export class FormatError extends Error {}

/** Miniatura de ≤ maxSide px por vecino más cercano. */
function thumbnail(src: Bitmap, maxSide: number): Bitmap {
  const f = Math.max(src.width, src.height) / maxSide
  if (f <= 1) return src
  const w = Math.max(1, Math.floor(src.width / f))
  const h = Math.max(1, Math.floor(src.height / f))
  const out = new Bitmap(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y * f) * src.width + Math.floor(x * f)) * 4
      out.data.set(src.data.subarray(s, s + 4), (y * w + x) * 4)
    }
  return out
}

export function saveDocument(doc: PixeltorDocument, rasters: ReadonlyMap<ID, Bitmap>): Uint8Array {
  const files: Zippable = { mimetype: [strToU8(MIME), { level: 0 }] }
  const hashes: Record<string, { sha256: string }> = {}

  const json = JSON.parse(JSON.stringify(doc)) as PixeltorDocument
  json.formatVersion = FORMAT_VERSION
  json.metadata.app = APP_NAME
  for (const img of json.images) {
    for (const layer of img.layers) {
      const bmp = rasters.get(layer.raster.id)
      if (!bmp || bmp.isEmpty()) {
        ;(layer.raster as { empty?: boolean }).empty = true
        continue
      }
      const png = encodePng(bmp)
      const path = `rasters/${layer.raster.id}.png`
      files[path] = png
      hashes[path] = { sha256: sha256Hex(png) }
    }
  }
  const docBytes = strToU8(JSON.stringify(json, null, 2))
  files['document.json'] = docBytes
  hashes['document.json'] = { sha256: sha256Hex(docBytes) }

  const first = doc.images[0]
  if (first) {
    const comp = new Bitmap(first.width, first.height)
    composeImage(first, rasters, comp)
    files['thumbnails/document.png'] = encodePng(thumbnail(comp, 256))
  }
  files['manifest.json'] = strToU8(
    JSON.stringify(
      {
        formatVersion: FORMAT_VERSION,
        app: APP_NAME,
        createdAt: doc.metadata.createdAt,
        files: hashes
      },
      null,
      2
    )
  )
  return zipSync(files, { level: 6 })
}

export function loadDocument(bytes: Uint8Array): LoadedDocument {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new FormatError('El archivo no es un documento de Pixeltor válido.')
  }
  if (!entries.mimetype || strFromU8(entries.mimetype) !== MIME || !entries['document.json'])
    throw new FormatError('El archivo no es un documento de Pixeltor válido.')

  const manifest = entries['manifest.json']
    ? (JSON.parse(strFromU8(entries['manifest.json'])) as {
        formatVersion: string
        files?: Record<string, { sha256: string }>
      })
    : null
  const raw = JSON.parse(strFromU8(entries['document.json'])) as PixeltorDocument
  const major = (v: string | undefined) => Number.parseInt((v ?? '0').split('.')[0]!, 10)
  if (major(raw.formatVersion) > major(FORMAT_VERSION))
    throw new FormatError(
      `El archivo usa el formato ${raw.formatVersion}, más nuevo que el soportado (${FORMAT_VERSION}). Actualiza Pixeltor.`
    )
  const doc = migrate(raw)

  const warnings: string[] = []
  const rasters = new Map<ID, Bitmap>()
  for (const img of doc.images) {
    img.width = clampSize(img.width)
    img.height = clampSize(img.height)
    img.layers.forEach((layer: Layer) => sanitizeLayer(layer))
    for (const layer of img.layers) {
      const empty = (layer.raster as { empty?: boolean }).empty
      delete (layer.raster as { empty?: boolean }).empty
      layer.raster.width = img.width
      layer.raster.height = img.height
      const path = `rasters/${layer.raster.id}.png`
      const data = entries[path]
      let bmp: Bitmap | null = null
      if (!empty) {
        if (!data) warnings.push(`Falta el ráster de la capa «${layer.name}» (${img.name}).`)
        else if (manifest?.files?.[path] && manifest.files[path].sha256 !== sha256Hex(data))
          warnings.push(`El ráster de la capa «${layer.name}» (${img.name}) está dañado.`)
        else {
          try {
            bmp = decodePng(data)
          } catch {
            warnings.push(`No se pudo leer el ráster de la capa «${layer.name}» (${img.name}).`)
          }
        }
      }
      if (bmp && (bmp.width !== img.width || bmp.height !== img.height)) {
        const fit = new Bitmap(img.width, img.height)
        for (let y = 0; y < Math.min(bmp.height, img.height); y++)
          fit.data.set(
            bmp.data.subarray(
              y * bmp.width * 4,
              (y * bmp.width + Math.min(bmp.width, img.width)) * 4
            ),
            y * img.width * 4
          )
        bmp = fit
      }
      rasters.set(layer.raster.id, bmp ?? new Bitmap(img.width, img.height))
    }
  }
  return { doc, rasters, warnings }
}

function sanitizeLayer(l: Layer): void {
  l.opacity = Math.min(1, Math.max(0, Number.isFinite(l.opacity) ? l.opacity : 1))
  if (!BLEND_MODES.includes(l.blendMode)) l.blendMode = 'normal'
  l.shapes ??= []
  l.effects ??= []
  l.visible = l.visible !== false
  l.locked = !!l.locked
  l.lockAlpha = !!l.lockAlpha
}

/** Exporta la composición de una imagen como PNG, con escala entera (vecino más cercano). */
export function exportImagePng(
  img: PixeltorDocument['images'][number],
  rasters: ReadonlyMap<ID, Bitmap>,
  scale = 1
): Uint8Array {
  const comp = new Bitmap(img.width, img.height)
  composeImage(img, rasters, comp)
  return encodePng(scaleNearest(comp, scale))
}
