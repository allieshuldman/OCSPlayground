const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Disable web security to bypass CORS
    },
  })

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:62522')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    app.quit()
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Configure session to bypass CORS, specifically for the Experiment API
  const filter = {
    urls: ['https://outlook-sdf.office.com/*', 'https://outlook-sdf.office.com/outlookcopilot/*']
  }

  // Handle CORS preflight (OPTIONS) requests
  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    // Allow all requests to proceed
    callback({})
  })

  // Modify request headers to bypass CORS
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'Origin': 'https://outlook-sdf.office.com',
        'Referer': 'https://outlook-sdf.office.com/',
      },
    })
  })

  // Modify response headers to allow CORS
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS, PATCH'],
      'Access-Control-Allow-Headers': ['Content-Type, Authorization, X-Requested-With'],
      'Access-Control-Allow-Credentials': ['true'],
    }

    // Remove any existing CORS restrictions
    if (details.responseHeaders['access-control-allow-origin']) {
      responseHeaders['access-control-allow-origin'] = ['*']
    }

    callback({
      responseHeaders: responseHeaders,
    })
  })

  createWindow()

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
  })
})
