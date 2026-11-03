import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { IPC, type PixeltorApi, type Settings } from '@shared/ipc'

const api: PixeltorApi = {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke(IPC.appVersion) as Promise<string>,
  ui: { setScale: (factor) => webFrame.setZoomFactor(factor) },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch) as Promise<Settings>
  },
  files: {
    open: (path) => ipcRenderer.invoke(IPC.fileOpen, path),
    openMany: (name, exts) => ipcRenderer.invoke(IPC.fileOpenMany, name, exts),
    save: (req) => ipcRenderer.invoke(IPC.fileSave, req),
    exportPng: (req) => ipcRenderer.invoke(IPC.fileExport, req),
    exportSet: (req) => ipcRenderer.invoke(IPC.fileExportSet, req)
  },
  palettes: {
    import: () => ipcRenderer.invoke(IPC.paletteImport),
    export: (req) => ipcRenderer.invoke(IPC.paletteExport, req)
  },
  updates: { check: () => ipcRenderer.invoke(IPC.updatesCheck) },
  dialogs: {
    confirmClose: (name) => ipcRenderer.invoke(IPC.confirmClose, name)
  },
  autosave: {
    write: (docId, name, bytes) => ipcRenderer.invoke(IPC.autosaveWrite, docId, name, bytes),
    remove: (docId) => ipcRenderer.invoke(IPC.autosaveRemove, docId),
    list: () => ipcRenderer.invoke(IPC.autosaveList),
    read: (docId) => ipcRenderer.invoke(IPC.autosaveRead, docId)
  },
  onBeforeClose: (handler) => {
    const listener = () => handler()
    ipcRenderer.on(IPC.beforeClose, listener)
    return () => ipcRenderer.removeListener(IPC.beforeClose, listener)
  },
  closeDecision: (close) => ipcRenderer.send(IPC.closeDecision, close)
}

contextBridge.exposeInMainWorld('pixeltor', api)
