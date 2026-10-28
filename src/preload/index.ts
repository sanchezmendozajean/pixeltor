import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PixeltorApi, type Settings } from '@shared/ipc'

const api: PixeltorApi = {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke(IPC.appVersion) as Promise<string>,
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch) as Promise<Settings>
  },
  files: {
    open: (path) => ipcRenderer.invoke(IPC.fileOpen, path),
    save: (req) => ipcRenderer.invoke(IPC.fileSave, req),
    exportPng: (req) => ipcRenderer.invoke(IPC.fileExport, req)
  },
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
