// Operaciones de documento que cruzan renderer ↔ main: abrir, guardar, exportar, cerrar,
// autoguardado y recuperación. La lógica de formato vive en el core.

import { FormatError, decodePng, exportImagePng, loadDocument, saveDocument } from '@core/index'
import { createDocument } from '@core/model/document'
import type { Workspace } from '@/session/workspace'
import { useDocumentsStore } from '@/stores/documents'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

function docs() {
  return useDocumentsStore()
}

function toast(msg: string): void {
  useUiStore().toast = msg
}

export function newDocument(width: number, height: number): void {
  docs().newDocument(width, height)
}

/** Abre un `.pixeltor` o importa un PNG como documento nuevo de una capa. */
export async function openFile(path?: string): Promise<void> {
  const file = await window.pixeltor.files.open(path)
  if (!file) return
  try {
    if (file.path.toLowerCase().endsWith('.png')) {
      const bmp = decodePng(file.bytes)
      const name = file.path
        .split(/[\\/]/)
        .pop()!
        .replace(/\.png$/i, '')
      const doc = createDocument(bmp.width, bmp.height, name)
      const rasters = new Map([[doc.images[0]!.layers[0]!.raster.id, bmp]])
      docs().openLoaded(doc, rasters, null)
      return
    }
    const loaded = loadDocument(file.bytes)
    docs().openLoaded(loaded.doc, loaded.rasters, file.path)
    if (loaded.warnings.length) toast(loaded.warnings.join(' '))
  } catch (e) {
    toast(e instanceof FormatError ? e.message : t('errors.openFailed'))
  }
}

/** Devuelve true si el documento quedó guardado. */
export async function saveWorkspace(ws: Workspace, saveAs = false): Promise<boolean> {
  const bytes = saveDocument(ws.session.doc, ws.session.rasters)
  const path = await window.pixeltor.files.save({
    path: saveAs ? null : ws.filePath,
    suggestedName: ws.name,
    bytes
  })
  if (!path) return false
  docs().markSaved(ws.id, path)
  await window.pixeltor.autosave.remove(ws.session.doc.id)
  return true
}

export async function exportPng(ws: Workspace, scale: number, again = false): Promise<void> {
  const bytes = exportImagePng(ws.session.image, ws.session.rasters, scale)
  const path = await window.pixeltor.files.exportPng({
    path: again && ws.lastExport ? ws.lastExport.path : null,
    suggestedName: `${ws.name}`,
    bytes
  })
  if (path) ws.lastExport = { path, scale }
}

/** Cierra una pestaña, preguntando si hay cambios. Devuelve false si se cancela. */
export async function closeWorkspace(id: string): Promise<boolean> {
  const ws = docs().workspace(id)
  if (!ws) return true
  if (ws.session.history.isDirty) {
    const choice = await window.pixeltor.dialogs.confirmClose(ws.name)
    if (choice === 'cancel') return false
    if (choice === 'save' && !(await saveWorkspace(ws))) return false
  }
  await window.pixeltor.autosave.remove(ws.session.doc.id)
  docs().close(id)
  return true
}

/** Cierre de la ventana: recorre los documentos con cambios y pide confirmación a cada uno. */
export async function handleBeforeClose(): Promise<void> {
  for (const tab of [...docs().tabs]) {
    docs().activate(tab.id)
    if (!(await closeWorkspace(tab.id))) {
      window.pixeltor.closeDecision(false)
      return
    }
  }
  window.pixeltor.closeDecision(true)
}

// ---------- Autoguardado y recuperación ----------

const AUTOSAVE_MS = 2 * 60 * 1000
const lastAutosaved = new Map<string, number>()

export function startAutosave(intervalMs = AUTOSAVE_MS): () => void {
  const timer = window.setInterval(() => {
    for (const tab of docs().tabs) {
      const ws = docs().workspace(tab.id)
      if (!ws || !ws.session.history.isDirty) continue
      // Solo si hubo cambios desde el último autoguardado.
      const stamp = ws.session.history.position * 1e6 + ws.session.history.entries.length
      if (lastAutosaved.get(ws.id) === stamp) continue
      lastAutosaved.set(ws.id, stamp)
      const bytes = saveDocument(ws.session.doc, ws.session.rasters)
      void window.pixeltor.autosave.write(ws.session.doc.id, ws.name, bytes)
    }
  }, intervalMs)
  return () => clearInterval(timer)
}

export async function listRecovery() {
  return window.pixeltor.autosave.list()
}

export async function recover(docId: string): Promise<void> {
  const bytes = await window.pixeltor.autosave.read(docId)
  if (!bytes) return
  try {
    const loaded = loadDocument(bytes)
    // Se abre como documento sin ruta y con cambios sin guardar.
    const ws = docs().openLoaded(loaded.doc, loaded.rasters, null)
    ws.session.history.record(markRecovered())
    docs().touch()
    await window.pixeltor.autosave.remove(docId)
  } catch {
    toast(t('errors.openFailed'))
  }
}

export async function discardRecovery(docId: string): Promise<void> {
  await window.pixeltor.autosave.remove(docId)
}

/** Entrada vacía de historial: deja el documento recuperado marcado como modificado. */
function markRecovered() {
  return {
    label: 'Documento recuperado',
    memorySize: 0,
    time: Date.now(),
    redo() {},
    undo() {}
  }
}
