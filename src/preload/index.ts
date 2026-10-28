import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PixeltorApi, type Settings } from '@shared/ipc'

const api: PixeltorApi = {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke(IPC.appVersion) as Promise<string>,
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch) as Promise<Settings>
  }
}

contextBridge.exposeInMainWorld('pixeltor', api)
