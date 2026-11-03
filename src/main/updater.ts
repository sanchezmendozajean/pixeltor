// Actualización automática (specs/30 · opcional). Las versiones se publican como «releases» de
// GitHub; electron-updater las descarga y verifica con el archivo latest*.yml. Sólo se actualizan
// solas las instalaciones de Windows (instalador NSIS) y los AppImage de Linux; la versión portable
// y el .deb se avisan y se descargan a mano.
import { app, BrowserWindow, dialog, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const RELEASES_URL = 'https://github.com/sanchezmendozajean/pixeltor/releases'

export function canSelfUpdate(): boolean {
  if (!app.isPackaged) return false
  if (process.platform === 'win32') return !process.env['PORTABLE_EXECUTABLE_DIR']
  if (process.platform === 'linux') return !!process.env['APPIMAGE']
  return false
}

let busy = false

/**
 * Busca una versión nueva. `manual` = lo pidió el usuario: entonces también se le dice cuando ya
 * está al día o cuando algo falla; en el arranque sólo se le molesta si hay una versión nueva.
 */
export async function checkForUpdates(
  win: BrowserWindow | undefined,
  manual: boolean
): Promise<void> {
  if (busy) return
  const box = (opts: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)

  if (!canSelfUpdate()) {
    if (!manual) return
    const r = await box({
      type: 'info',
      buttons: ['Abrir página de versiones', 'Cerrar'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Pixeltor',
      message: 'Esta instalación no se actualiza sola',
      detail:
        'La versión portable y el paquete .deb se actualizan descargando la nueva versión. ' +
        `Estás usando la ${app.getVersion()}.`
    })
    if (r.response === 0) void shell.openExternal(RELEASES_URL)
    return
  }

  busy = true
  try {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    const res = await autoUpdater.checkForUpdates()
    const info = res?.updateInfo
    if (!res || !info || !res.isUpdateAvailable) {
      if (manual)
        await box({
          type: 'info',
          buttons: ['Aceptar'],
          noLink: true,
          title: 'Pixeltor',
          message: 'Pixeltor está actualizado',
          detail: `Versión ${app.getVersion()}.`
        })
      return
    }
    const ask = await box({
      type: 'info',
      buttons: ['Descargar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Pixeltor',
      message: `Hay una versión nueva: Pixeltor ${info.version}`,
      detail: `Estás usando la ${app.getVersion()}. Se descargará en segundo plano y puedes seguir trabajando.`
    })
    if (ask.response !== 0) return
    await autoUpdater.downloadUpdate()
    const done = await box({
      type: 'info',
      buttons: ['Cerrar y actualizar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Pixeltor',
      message: 'La actualización está lista',
      detail: 'Se instalará al cerrar Pixeltor (te preguntará si hay cambios sin guardar).'
    })
    if (done.response === 0 && win && !win.isDestroyed()) win.close()
  } catch (e) {
    if (manual)
      await box({
        type: 'error',
        buttons: ['Aceptar'],
        noLink: true,
        title: 'Pixeltor',
        message: 'No se pudo buscar actualizaciones',
        detail: e instanceof Error ? e.message : String(e)
      })
  } finally {
    busy = false
  }
}
