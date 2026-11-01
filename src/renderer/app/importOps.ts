// Importar animaciones: GIF, secuencia de PNG y hoja de sprites (specs/07).

import {
  Bitmap,
  type ImportedFrame,
  decodeGif,
  decodePng,
  documentFromFrames,
  naturalCompare,
  sliceSheet
} from '@core/index'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

const baseName = (path: string): string =>
  (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]+$/, '')

function fail(msg: string): void {
  useUiStore().toast = msg
}

/** Abre un GIF animado: una imagen por fotograma con su duración. */
export function openGif(path: string, bytes: Uint8Array): void {
  try {
    const gif = decodeGif(bytes)
    const { doc, rasters } = documentFromFrames(baseName(path), gif.frames)
    useDocumentsStore().openLoaded(doc, rasters, null)
  } catch (e) {
    fail(e instanceof Error ? e.message : t('errors.openFailed'))
  }
}

/** Varios PNG (orden alfabético natural) → un documento con una imagen por archivo. */
export async function importSequence(): Promise<void> {
  const files = await window.pixeltor.files.openMany('PNG', ['png'])
  if (!files.length) return
  try {
    const sorted = [...files].sort((a, b) => naturalCompare(baseName(a.path), baseName(b.path)))
    const frames: ImportedFrame[] = sorted.map((f) => ({
      bitmap: decodePng(f.bytes),
      name: baseName(f.path),
      delayMs: 100
    }))
    const name = baseName(sorted[0]!.path).replace(/[_\-\s]*\d+$/, '') || baseName(sorted[0]!.path)
    const { doc, rasters } = documentFromFrames(name, frames)
    useDocumentsStore().openLoaded(doc, rasters, null)
  } catch (e) {
    fail(e instanceof Error ? e.message : t('errors.openFailed'))
  }
}

// ---- hoja de sprites: el PNG decodificado espera a que el diálogo confirme las celdas ----
let pendingSheet: { name: string; bitmap: Bitmap } | null = null

export interface SheetImportState {
  name: string
  width: number
  height: number
  cellW: number
  cellH: number
  margin: number
  spacing: number
  order: 'rows' | 'columns'
  skipEmpty: boolean
}

export async function startSheetImport(): Promise<void> {
  const files = await window.pixeltor.files.openMany('PNG', ['png'])
  const f = files[0]
  if (!f) return
  try {
    const bitmap = decodePng(f.bytes)
    pendingSheet = { name: baseName(f.path), bitmap }
    const ui = useUiStore()
    ui.sheetImport = {
      name: pendingSheet.name,
      width: bitmap.width,
      height: bitmap.height,
      cellW: Math.min(bitmap.width, 16),
      cellH: Math.min(bitmap.height, 16),
      margin: 0,
      spacing: 0,
      order: 'rows',
      skipEmpty: true
    }
    ui.dialog = 'sheet'
  } catch (e) {
    fail(e instanceof Error ? e.message : t('errors.openFailed'))
  }
}

/** Número de celdas que produciría la configuración actual (para la vista previa del diálogo). */
export function sheetCellCount(o: SheetImportState): number {
  if (o.cellW < 1 || o.cellH < 1) return 0
  const cols = Math.floor((o.width - 2 * o.margin + o.spacing) / (o.cellW + o.spacing))
  const rows = Math.floor((o.height - 2 * o.margin + o.spacing) / (o.cellH + o.spacing))
  return Math.max(0, cols) * Math.max(0, rows)
}

export function confirmSheetImport(o: SheetImportState): void {
  const sheet = pendingSheet
  if (!sheet) return
  try {
    const cells = sliceSheet(sheet.bitmap, o)
    const frames: ImportedFrame[] = cells.map((bitmap, i) => ({
      bitmap,
      name: `${sheet.name} ${i + 1}`,
      delayMs: 100
    }))
    const { doc, rasters } = documentFromFrames(sheet.name, frames)
    useDocumentsStore().openLoaded(doc, rasters, null)
    pendingSheet = null
  } catch (e) {
    fail(e instanceof Error ? e.message : t('errors.openFailed'))
  }
}
