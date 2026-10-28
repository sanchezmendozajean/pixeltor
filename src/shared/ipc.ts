// Contrato IPC tipado entre main, preload y renderer.

export type ThemeId = 'oscuro' | 'gris' | 'claro'

export interface Settings {
  theme: ThemeId
}

export const DEFAULT_SETTINGS: Settings = { theme: 'oscuro' }

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  appVersion: 'app:version'
} as const

/** API expuesta en `window.pixeltor` por el preload. */
export interface PixeltorApi {
  platform: string
  getAppVersion(): Promise<string>
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
}

/** Colores de la barra de título nativa (titleBarOverlay) por tema. */
export const TITLEBAR_OVERLAY: Record<ThemeId, { color: string; symbolColor: string }> = {
  oscuro: { color: '#1F1F1F', symbolColor: '#C8C8C8' },
  gris: { color: '#3A3A3A', symbolColor: '#DADADA' },
  claro: { color: '#E4E4E4', symbolColor: '#3A3A3A' }
}

export const TITLEBAR_HEIGHT = 32
