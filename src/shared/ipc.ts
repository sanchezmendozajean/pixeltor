// Contrato IPC tipado entre main, preload y renderer.

import type { SavedWorkspace } from './workspaces'

export type ThemeId = 'oscuro' | 'gris' | 'claro'

export interface Settings {
  theme: ThemeId
  /** Columnas de la barra de herramientas. */
  toolbarColumns: 1 | 2
  /** Atajos personalizados: id de acción → atajo canónico ('' = sin atajo). */
  shortcuts: Record<string, string>
  /** Escala de la interfaz (1 = 100 %). */
  uiScale: number
  /** Espacios de trabajo creados por el usuario (los integrados no se guardan). */
  workspaces: SavedWorkspace[]
  /** Espacio de trabajo con el que arranca la ventana. */
  activeWorkspace: string
}

export const UI_SCALES = [0.9, 1, 1.1, 1.25, 1.5] as const

export const DEFAULT_SETTINGS: Settings = {
  theme: 'oscuro',
  toolbarColumns: 1,
  shortcuts: {},
  uiScale: 1,
  workspaces: [],
  activeWorkspace: 'essentials'
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  appVersion: 'app:version',
  fileOpen: 'file:open',
  fileSave: 'file:save',
  fileExport: 'file:export',
  fileExportSet: 'file:exportSet',
  fileOpenMany: 'file:openMany',
  paletteImport: 'palette:import',
  paletteExport: 'palette:export',
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
  /** Escala de la interfaz (zoom de la ventana, no del lienzo). */
  ui: { setScale(factor: number): void }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  files: {
    /** Pide varios archivos (con las extensiones indicadas) y devuelve su contenido. */
    openMany(filterName: string, extensions: string[]): Promise<OpenedFile[]>
    /** Abre el diálogo (o lee `path`) y devuelve el contenido; null si se cancela. */
    open(path?: string): Promise<OpenedFile | null>
    /** Guarda de forma atómica (con .bak). Con `path: null` pide la ruta. Devuelve la ruta final o null. */
    save(req: {
      path: string | null
      suggestedName: string
      bytes: Uint8Array
    }): Promise<string | null>
    /** Exporta un PNG pidiendo la ruta (o usando `path`). */
    /**
     * Pide un nombre (con la extensión `ext`) y escribe cada archivo como «base + sufijo».
     * Devuelve la ruta elegida o null si se cancela. `path` reutiliza una ruta anterior.
     */
    exportSet(req: {
      path: string | null
      suggestedName: string
      ext: string
      filterName: string
      files: { suffix: string; bytes: Uint8Array }[]
    }): Promise<string | null>
    exportPng(req: {
      path: string | null
      suggestedName: string
      bytes: Uint8Array
    }): Promise<string | null>
  }
  palettes: {
    /** Pide un archivo de paleta (.gpl, .pal, .hex, .png); null si se cancela. */
    import(): Promise<OpenedFile | null>
    /** Guarda la paleta en el formato que dé la extensión elegida (se envían todos). Devuelve la ruta o null. */
    export(req: {
      suggestedName: string
      bytes: Record<'gpl' | 'pal' | 'hex' | 'png', Uint8Array>
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
