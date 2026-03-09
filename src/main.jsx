import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './App.css'

async function init() {
  if (window.electronAPI?.getStore && window.electronAPI?.setStoreItem) {
    try {
      const data = await window.electronAPI.getStore()
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (v !== null && v !== undefined) {
            localStorage.setItem(k, String(v))
          }
        }
      }
      const origSetItem = Storage.prototype.setItem
      const origRemoveItem = Storage.prototype.removeItem
      Storage.prototype.setItem = function (key, value) {
        origSetItem.call(this, key, value)
        window.electronAPI.setStoreItem(key, value).catch(() => {})
      }
      Storage.prototype.removeItem = function (key) {
        origRemoveItem.call(this, key)
        window.electronAPI.removeStoreItem(key).catch(() => {})
      }
    } catch (err) {
      console.error('Failed to load persisted store:', err)
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

init()
