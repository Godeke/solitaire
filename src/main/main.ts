import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { logger, LogEntry } from '../utils/Logger'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3002')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(() => {
  // Set up IPC handlers for logging
  setupLoggingIPC()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  logger.cleanup()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  logger.cleanup()
})

function setupLoggingIPC(): void {
  // Handle log messages from renderer process
  ipcMain.handle('log', (event, logEntry: LogEntry) => {
    const { level, category, message, data } = logEntry
    
    switch (level) {
      case 0: // DEBUG
        logger.debug(category, message, data)
        break
      case 1: // INFO
        logger.info(category, message, data)
        break
      case 2: // WARN
        logger.warn(category, message, data)
        break
      case 3: // ERROR
        logger.error(category, message, data)
        break
    }
  })

  // Handle request for log file path
  ipcMain.handle('get-log-path', () => {
    return logger.getLogFilePath()
  })

  // Handle log level changes
  ipcMain.handle('set-log-level', (event, level: number) => {
    logger.setLogLevel(level)
  })
}