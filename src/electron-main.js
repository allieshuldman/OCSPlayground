import { app, BrowserWindow, session, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import started from 'electron-squirrel-startup'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (started) {
  app.quit()
}

const PERSISTENT_PARTITION = 'persist:ocsplayground'

const getStorePath = () => path.join(app.getPath('userData'), 'ocsplayground-store.json')

function readStore() {
  try {
    const p = getStorePath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      const data = JSON.parse(raw)
      return typeof data === 'object' && data !== null ? data : {}
    }
  } catch (err) {
    console.error('Error reading store:', err)
  }
  return {}
}

function writeStore(store) {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(store), 'utf8')
  } catch (err) {
    console.error('Error writing store:', err)
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      partition: PERSISTENT_PARTITION,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.on('closed', () => {
    app.quit()
  })
}

app.whenReady().then(() => {
  let inMemoryStore = readStore()

  ipcMain.handle('store-getAll', () => inMemoryStore)
  ipcMain.handle('store-setItem', (_, key, value) => {
    inMemoryStore[key] = value == null ? '' : String(value)
    writeStore(inMemoryStore)
  })
  ipcMain.handle('store-removeItem', (_, key) => {
    delete inMemoryStore[key]
    writeStore(inMemoryStore)
  })

  const filter = {
    urls: ['https://outlook-sdf.office.com/*', 'https://outlook-sdf.office.com/outlookcopilot/*'],
  }

  const appSession = session.fromPartition(PERSISTENT_PARTITION)
  appSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    callback({})
  })

  appSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Origin: 'https://outlook-sdf.office.com',
        Referer: 'https://outlook-sdf.office.com/',
      },
    })
  })

  appSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS, PATCH'],
      'Access-Control-Allow-Headers': ['Content-Type, Authorization, X-Requested-With'],
      'Access-Control-Allow-Credentials': ['true'],
    }
    if (details.responseHeaders['access-control-allow-origin']) {
      responseHeaders['access-control-allow-origin'] = ['*']
    }
    callback({ responseHeaders })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (e) => e.preventDefault())
})
