import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getStore: () => ipcRenderer.invoke('store-getAll'),
  setStoreItem: (key, value) => ipcRenderer.invoke('store-setItem', key, value),
  removeStoreItem: (key) => ipcRenderer.invoke('store-removeItem', key),
})
