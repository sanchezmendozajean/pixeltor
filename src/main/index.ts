import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { IPC, type Settings } from '@shared/ipc'
import { getSettings, loadSettings, updateSettings } from './settings'
import { guardWindowClose, registerFileHandlers } from './files'
import { applyTheme, createMainWindow } from './windows'
import { checkForUpdates } from './updater'

// Instancia única: un segundo arranque enfoca la ventana existente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  registerFileHandlers()

  ipcMain.handle(IPC.appVersion, () => app.getVersion())
  ipcMain.handle(IPC.updatesCheck, (event) =>
    checkForUpdates(BrowserWindow.fromWebContents(event.sender) ?? undefined, true)
  )
  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSet, async (event, patch: Partial<Settings>) => {
    const next = await updateSettings(patch)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) applyTheme(win, next.theme)
    return next
  })

  void app.whenReady().then(async () => {
    // Menú, atajos y tooltips salen del registro de acciones del renderer (CLAUDE.md, regla 8).
    Menu.setApplicationMenu(null)
    const settings = await loadSettings()
    const win = createMainWindow(settings.theme)
    guardWindowClose(win)
    // unos segundos después de arrancar, para no competir con la carga de la ventana
    if (settings.autoUpdate)
      setTimeout(() => void checkForUpdates(win.isDestroyed() ? undefined : win, false), 10_000)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0)
        guardWindowClose(createMainWindow(getSettings().theme))
    })
  })

  app.on('window-all-closed', () => app.quit())
}
