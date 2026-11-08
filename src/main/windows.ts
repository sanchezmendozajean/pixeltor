import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { TITLEBAR_HEIGHT, TITLEBAR_OVERLAY, type ThemeId } from '@shared/ipc'

const here = dirname(fileURLToPath(import.meta.url))

// En Windows se pasa el .ico para que el sistema elija el tamaño nítido (barra de tareas, Alt+Tab).
// Empaquetado: extraResources copia los iconos junto a la app; en desarrollo se leen de resources/.
const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
const icon = app.isPackaged
  ? join(process.resourcesPath, iconFile)
  : join(here, '../../resources', iconFile)

const BACKGROUND: Record<ThemeId, string> = {
  oscuro: '#1F1F1F',
  gris: '#3A3A3A',
  claro: '#E4E4E4'
}

export function createMainWindow(theme: ThemeId): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Pixeltor',
    icon,
    backgroundColor: BACKGROUND[theme],
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLEBAR_OVERLAY[theme], height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // La app no navega ni abre ventanas: los enlaces externos van al navegador.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(here, '../renderer/index.html'))

  return win
}

export function applyTheme(win: BrowserWindow, theme: ThemeId): void {
  win.setBackgroundColor(BACKGROUND[theme])
  // setTitleBarOverlay no existe en macOS; Pixeltor solo apunta a Windows y Linux.
  win.setTitleBarOverlay({ ...TITLEBAR_OVERLAY[theme], height: TITLEBAR_HEIGHT })
}
