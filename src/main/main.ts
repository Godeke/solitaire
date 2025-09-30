import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron'
import { join } from 'path'
import { logger, LogEntry } from '../utils/Logger'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window with comprehensive configuration
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: process.platform === 'win32' ? join(__dirname, '../../assets/icon.ico') : 
          process.platform === 'darwin' ? join(__dirname, '../../assets/icon.icns') :
          join(__dirname, '../../assets/icon.png'),
  })

  // Load the appropriate content
  if (isDev) {
    mainWindow.loadURL('http://localhost:3002')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()
      
      // Focus the window on creation
      if (process.platform === 'darwin') {
        mainWindow.focus()
      }
    }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle window resize events
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize()
      logger.debug('WINDOW', `Window resized to ${width}x${height}`)
    }
  })

  // Handle window minimize/restore
  mainWindow.on('minimize', () => {
    logger.debug('WINDOW', 'Window minimized')
  })

  mainWindow.on('restore', () => {
    logger.debug('WINDOW', 'Window restored')
  })

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    if (parsedUrl.origin !== 'http://localhost:3002' && !navigationUrl.startsWith('file://')) {
      event.preventDefault()
      logger.warn('SECURITY', `Blocked navigation to external URL: ${navigationUrl}`)
    }
  })

  // Handle external link clicks
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Set up IPC handlers for logging
  setupLoggingIPC()
  
  // Set up application menu
  setupApplicationMenu()
  
  // Create the main window
  createWindow()

  // macOS specific behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })

  logger.info('SYSTEM', 'Application started successfully')
})

// Handle all windows closed
app.on('window-all-closed', () => {
  logger.info('SYSTEM', 'All windows closed')
  logger.cleanup()
  
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app quit
app.on('before-quit', (event) => {
  logger.info('SYSTEM', 'Application quitting')
  
  // Save any pending game state before quitting
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-before-quit')
  }
  
  logger.cleanup()
})

// Handle app activation (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else if (mainWindow) {
    mainWindow.show()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { 
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-preferences')
            }
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Game',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-game')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Statistics',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-statistics')
            }
          }
        },
        { type: 'separator' },
        ...(isMac ? [] : [
          {
            label: 'Preferences...',
            accelerator: 'Ctrl+,',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('show-preferences')
              }
            }
          },
          { type: 'separator' as const }
        ]),
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo Move',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('undo-move')
            }
          }
        },
        {
          label: 'Redo Move',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('redo-move')
            }
          }
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    
    // Game menu
    {
      label: 'Game',
      submenu: [
        {
          label: 'Klondike',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('select-game', 'klondike')
            }
          }
        },
        {
          label: 'Spider',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('select-game', 'spider')
            }
          }
        },
        {
          label: 'FreeCell',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('select-game', 'freecell')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Auto-Complete',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('auto-complete')
            }
          }
        },
        {
          label: 'Hint',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-hint')
            }
          }
        }
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [])
      ]
    },
    
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Game Rules',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-help')
            }
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-shortcuts')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About Solitaire Game Collection',
          click: async () => {
            await dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Solitaire Game Collection',
              message: 'Solitaire Game Collection',
              detail: `Version: ${app.getVersion()}\nA collection of classic solitaire card games.\n\nBuilt with Electron, React, and TypeScript.`,
              buttons: ['OK']
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

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

  // Handle app version request
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Handle window control requests
  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle('close-window', () => {
    if (mainWindow) {
      mainWindow.close()
    }
  })

  // Handle game state persistence
  ipcMain.handle('save-game-state', (event, gameState: any) => {
    logger.debug('STORAGE', 'Saving game state', { gameType: gameState?.gameType })
    // Game state will be handled by the renderer's storage system
    return true
  })
}