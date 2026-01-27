// Preload script for Electron
// This script runs in a context that has access to both the DOM and Node.js APIs
// but is isolated from the main renderer process for security

const { contextBridge } = require('electron')

// Expose protected methods that allow the renderer process to use
// certain Node.js APIs without exposing the entire Node.js API
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any Electron-specific APIs here if needed
  // For example:
  // platform: process.platform,
  // versions: process.versions,
})
