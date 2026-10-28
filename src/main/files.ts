// Archivos del documento: abrir, guardar de forma atómica, exportar y autoguardado/recuperación.
// Todo el acceso al disco ocurre aquí; el renderer solo ve la API tipada del preload (regla 7).

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { IPC, type CloseChoice, type OpenedFile, type RecoveryEntry } from '@shared/ipc'

const PIXELTOR_FILTER = { name: 'Documento de Pixeltor', extensions: ['pixeltor'] }
const PNG_FILTER = { name: 'Imagen PNG', extensions: ['png'] }

function recoveryDir(): string {
  return join(app.getPath('userData'), 'recovery')
}

/** Los ids de documento solo pueden ser alfanuméricos: se usan como nombre de archivo. */
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '')
}

function ensureExt(path: string, ext: string): string {
  return extname(path).toLowerCase() === ext ? path : `${path}${ext}`
}

/** Guardado atómico: .tmp + rename, conservando el guardado anterior como .bak. */
export async function writeAtomic(
  path: string,
  bytes: Uint8Array,
  keepBackup: boolean
): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, bytes)
  if (keepBackup) {
    try {
      await stat(path)
      await copyFile(path, `${path}.bak`)
    } catch {
      // no existía: nada que respaldar
    }
  }
  await rename(tmp, path)
}

function parentOf(e: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(e.sender) ?? undefined
}

export function registerFileHandlers(): void {
  ipcMain.handle(IPC.fileOpen, async (e, path?: string): Promise<OpenedFile | null> => {
    let target = path
    if (!target) {
      const win = parentOf(e)
      const opts: Electron.OpenDialogOptions = {
        filters: [PIXELTOR_FILTER, PNG_FILTER],
        properties: ['openFile']
      }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (r.canceled || !r.filePaths[0]) return null
      target = r.filePaths[0]
    }
    const buf = await readFile(target)
    return { path: target, bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) }
  })

  ipcMain.handle(
    IPC.fileSave,
    async (e, req: { path: string | null; suggestedName: string; bytes: Uint8Array }) => {
      let target = req.path
      if (!target) {
        const win = parentOf(e)
        const opts: Electron.SaveDialogOptions = {
          defaultPath: `${req.suggestedName}.pixeltor`,
          filters: [PIXELTOR_FILTER]
        }
        const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
        if (r.canceled || !r.filePath) return null
        target = ensureExt(r.filePath, '.pixeltor')
      }
      await writeAtomic(target, req.bytes, true)
      return target
    }
  )

  ipcMain.handle(
    IPC.fileExport,
    async (e, req: { path: string | null; suggestedName: string; bytes: Uint8Array }) => {
      let target = req.path
      if (!target) {
        const win = parentOf(e)
        const opts: Electron.SaveDialogOptions = {
          defaultPath: `${req.suggestedName}.png`,
          filters: [PNG_FILTER]
        }
        const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
        if (r.canceled || !r.filePath) return null
        target = ensureExt(r.filePath, '.png')
      }
      await writeAtomic(target, req.bytes, false)
      return target
    }
  )

  ipcMain.handle(IPC.confirmClose, async (e, name: string): Promise<CloseChoice> => {
    const win = parentOf(e)
    // Orden de botones propio de cada plataforma: en Windows «Guardar» va primero.
    const labels = ['Guardar', 'No guardar', 'Cancelar']
    const opts: Electron.MessageBoxOptions = {
      type: 'question',
      buttons: labels,
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Pixeltor',
      message: `¿Guardar los cambios de «${name}»?`,
      detail: 'Si no los guardas, se perderán.'
    }
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts)
    return (['save', 'discard', 'cancel'] as const)[r.response] ?? 'cancel'
  })

  // ----- Autoguardado y recuperación (specs/11) -----
  ipcMain.handle(
    IPC.autosaveWrite,
    async (_e, docId: string, name: string, bytes: Uint8Array): Promise<void> => {
      const id = safeId(docId)
      if (!id) return
      await mkdir(recoveryDir(), { recursive: true })
      await writeFile(join(recoveryDir(), `${id}.json`), JSON.stringify({ name }), 'utf8')
      await writeAtomic(join(recoveryDir(), `${id}.pixeltor`), bytes, false)
    }
  )
  ipcMain.handle(IPC.autosaveRemove, async (_e, docId: string): Promise<void> => {
    const id = safeId(docId)
    if (!id) return
    await rm(join(recoveryDir(), `${id}.pixeltor`), { force: true })
    await rm(join(recoveryDir(), `${id}.json`), { force: true })
  })
  ipcMain.handle(IPC.autosaveList, async (): Promise<RecoveryEntry[]> => {
    let names: string[]
    try {
      names = await readdir(recoveryDir())
    } catch {
      return []
    }
    const out: RecoveryEntry[] = []
    for (const f of names.filter((n) => n.endsWith('.pixeltor'))) {
      const docId = basename(f, '.pixeltor')
      try {
        const st = await stat(join(recoveryDir(), f))
        let name = docId
        try {
          name = (
            JSON.parse(await readFile(join(recoveryDir(), `${docId}.json`), 'utf8')) as {
              name: string
            }
          ).name
        } catch {
          // sin metadatos: se usa el id
        }
        out.push({ docId, name, mtime: st.mtimeMs, size: st.size })
      } catch {
        // archivo desaparecido entre listar y leer
      }
    }
    return out.sort((a, b) => b.mtime - a.mtime)
  })
  ipcMain.handle(IPC.autosaveRead, async (_e, docId: string): Promise<Uint8Array | null> => {
    try {
      const buf = await readFile(join(recoveryDir(), `${safeId(docId)}.pixeltor`))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    } catch {
      return null
    }
  })
}

/**
 * Cierre con confirmación: la ventana no se cierra hasta que el renderer, que conoce los
 * documentos con cambios, responda con `closeDecision(true)`.
 */
export function guardWindowClose(win: BrowserWindow): void {
  let confirmed = false
  win.on('close', (e) => {
    if (confirmed) return
    e.preventDefault()
    win.webContents.send(IPC.beforeClose)
  })
  ipcMain.on(IPC.closeDecision, (event, close: boolean) => {
    if (BrowserWindow.fromWebContents(event.sender) !== win || !close) return
    confirmed = true
    win.close()
  })
}
