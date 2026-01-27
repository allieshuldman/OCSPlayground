import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import started from 'electron-squirrel-startup'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (started) {
  app.quit()
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
  const filter = {
    urls: ['https://outlook-sdf.office.com/*', 'https://outlook-sdf.office.com/outlookcopilot/*'],
  }

  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    callback({})
  })

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Origin: 'https://outlook-sdf.office.com',
        Referer: 'https://outlook-sdf.office.com/',
      },
    })
  })

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
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
