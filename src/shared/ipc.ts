// Contrato IPC tipado entre main, preload y renderer.

export type ThemeId = 'oscuro' | 'gris' | 'claro'

export interface Settings {
  theme: ThemeId
}

export const DEFAULT_SETTINGS: Settings = { theme: 'oscuro' }

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  appVersion: 'app:version',
  fileOpen: 'file:open',
  fileSave: 'file:save',
  fileExport: 'file:export',
  confirmClose: 'dialog:confirmClose',
  autosaveWrite: 'autosave:write',
  autosaveRemove: 'autosave:remove',
  autosaveList: 'autosave:list',
  autosaveRead: 'autosave:read',
  /** main → renderer: el usuario intenta cerrar la ventana. */
  beforeClose: 'app:beforeClose',
  /** renderer → main: ya se puede cerrar (o se canceló). */
  closeDecision: 'app:closeDecision'
} as const

export interface OpenedFile {
  path: string
  bytes: Uint8Array
}

export interface RecoveryEntry {
  docId: string
  name: string
  /** Epoch ms de la última modificación. */
  mtime: number
  size: number
}

export type CloseChoice = 'save' | 'discard' | 'cancel'

/** API expuesta en `window.pixeltor` por el preload. */
export interface PixeltorApi {
  platform: string
  getAppVersion(): Promise<string>
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  files: {
    /** Abre el diálogo (o lee `path`) y devuelve el contenido; null si se cancela. */
    open(path?: string): Promise<OpenedFile | null>
    /** Guarda de forma atómica (con .bak). Con `path: null` pide la ruta. Devuelve la ruta final o null. */
    save(req: {
      path: string | null
      suggestedName: string
      bytes: Uint8Array
    }): Promise<string | null>
    /** Exporta un PNG pidiendo la ruta (o usando `path`). */
    exportPng(req: {
      path: string | null
      suggestedName: string
      bytes: Uint8Array
    }): Promise<string | null>
  }
  dialogs: {
    confirmClose(name: string): Promise<CloseChoice>
  }
  autosave: {
    write(docId: string, name: string, bytes: Uint8Array): Promise<void>
    remove(docId: string): Promise<void>
    list(): Promise<RecoveryEntry[]>
    read(docId: string): Promise<Uint8Array | null>
  }
  /** Suscripción al intento de cierre de la ventana; devuelve la función para darse de baja. */
  onBeforeClose(handler: () => void): () => void
  closeDecision(close: boolean): void
}

/** Colores de la barra de título nativa (titleBarOverlay) por tema. */
export const TITLEBAR_OVERLAY: Record<ThemeId, { color: string; symbolColor: string }> = {
  oscuro: { color: '#1F1F1F', symbolColor: '#C8C8C8' },
  gris: { color: '#3A3A3A', symbolColor: '#DADADA' },
  claro: { color: '#E4E4E4', symbolColor: '#3A3A3A' }
}

export const TITLEBAR_HEIGHT = 32
