// Exportar como… (specs/07): PNG, secuencia de PNG, hoja de sprites + JSON, GIF, APNG e ICO.
// Los fotogramas se componen con el mismo render que el lienzo (incluidos los efectos).

import {
  Bitmap,
  type Frame,
  type PxImage,
  buildSpriteSheet,
  composeImage,
  encodeApng,
  encodeGif,
  encodeIco,
  encodePng,
  scaleFrames,
  type SheetLayout
} from '@core/index'
import type { Workspace } from '@/session/workspace'

export type ExportFormat = 'png' | 'sequence' | 'sheet' | 'gif' | 'apng' | 'ico'
export type ExportScope = 'current' | 'animation' | 'all'

export interface ExportOptions {
  format: ExportFormat
  scope: ExportScope
  scale: number
  layout: SheetLayout
  columns: number
  padding: number
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'png',
  scope: 'current',
  scale: 1,
  layout: 'horizontal',
  columns: 4,
  padding: 0
}

/** Formatos que necesitan varias imágenes por naturaleza. */
export const MULTI_FORMATS: ExportFormat[] = ['sequence', 'sheet', 'gif', 'apng', 'ico']

function pickImages(ws: Workspace, scope: ExportScope): PxImage[] {
  const s = ws.session
  if (scope === 'current') return [s.image]
  if (scope === 'animation') {
    const list = s.doc.images.filter((i) => i.includeInAnimation)
    return list.length ? list : [s.image]
  }
  return s.doc.images
}

function render(ws: Workspace, img: PxImage): Bitmap {
  const s = ws.session
  const bmp = new Bitmap(img.width, img.height)
  composeImage(img, s.rasters, bmp, undefined, { palettes: s.doc.palettes })
  return bmp
}

const pad = (n: number, total: number): string => String(n).padStart(String(total).length, '0')

/** Genera los archivos del conjunto: sufijo (tras el nombre elegido) y contenido. */
export function buildExport(
  ws: Workspace,
  o: ExportOptions
): { ext: string; filterName: string; files: { suffix: string; bytes: Uint8Array }[] } {
  const images = pickImages(ws, o.scope)
  const frames: (Frame & { name: string })[] = images.map((img) => ({
    bitmap: render(ws, img),
    delayMs: img.durationMs,
    name: img.name
  }))
  const scaled = scaleFrames(frames, o.scale) as (Frame & { name: string })[]
  const named = scaled.map((f, i) => ({ ...f, name: frames[i]!.name }))
  switch (o.format) {
    case 'png':
      return {
        ext: 'png',
        filterName: 'PNG',
        files: [{ suffix: '.png', bytes: encodePng(named[0]!.bitmap) }]
      }
    case 'sequence':
      return {
        ext: 'png',
        filterName: 'PNG',
        files: named.map((f, i) => ({
          suffix: named.length === 1 ? '.png' : `_${pad(i + 1, named.length)}.png`,
          bytes: encodePng(f.bitmap)
        }))
      }
    case 'sheet': {
      const sheet = buildSpriteSheet(named, {
        layout: o.layout,
        columns: o.columns,
        padding: o.padding
      })
      return {
        ext: 'png',
        filterName: 'PNG',
        files: [
          { suffix: '.png', bytes: encodePng(sheet.sheet) },
          { suffix: '.json', bytes: new TextEncoder().encode(sheet.json) }
        ]
      }
    }
    case 'gif':
      return { ext: 'gif', filterName: 'GIF', files: [{ suffix: '.gif', bytes: encodeGif(named) }] }
    case 'apng':
      return {
        ext: 'png',
        filterName: 'APNG',
        files: [{ suffix: '.png', bytes: encodeApng(named) }]
      }
    case 'ico':
      return {
        ext: 'ico',
        filterName: 'ICO',
        files: [{ suffix: '.ico', bytes: encodeIco(images.map((img) => render(ws, img))) }]
      }
  }
}

/** Exporta y devuelve la ruta elegida (null si se cancela). Recuerda la configuración. */
export async function exportAs(
  ws: Workspace,
  o: ExportOptions,
  again = false
): Promise<string | null> {
  const set = buildExport(ws, o)
  const path = await window.pixeltor.files.exportSet({
    path: again && ws.lastExport ? ws.lastExport.path : null,
    suggestedName: ws.name,
    ext: set.ext,
    filterName: set.filterName,
    files: set.files
  })
  if (path) ws.lastExport = { path, options: o }
  return path
}
