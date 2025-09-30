import { contextBridge, ipcRenderer } from 'electron'

export interface LogEntry {
  timestamp: string;
  level: number;
  category: string;
  message: string;
  data?: any;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Logging API
  log: (logEntry: LogEntry) => ipcRenderer.invoke('log', logEntry),
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  setLogLevel: (level: number) => ipcRenderer.invoke('set-log-level', level),
  
  // App info API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Window control API
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Game state API
  saveGameState: (gameState: any) => ipcRenderer.invoke('save-game-state', gameState),
  
  // Menu event listeners
  onNewGame: (callback: () => void) => {
    ipcRenderer.on('new-game', callback)
    return () => ipcRenderer.removeListener('new-game', callback)
  },
  
  onShowStatistics: (callback: () => void) => {
    ipcRenderer.on('show-statistics', callback)
    return () => ipcRenderer.removeListener('show-statistics', callback)
  },
  
  onShowPreferences: (callback: () => void) => {
    ipcRenderer.on('show-preferences', callback)
    return () => ipcRenderer.removeListener('show-preferences', callback)
  },
  
  onUndoMove: (callback: () => void) => {
    ipcRenderer.on('undo-move', callback)
    return () => ipcRenderer.removeListener('undo-move', callback)
  },
  
  onRedoMove: (callback: () => void) => {
    ipcRenderer.on('redo-move', callback)
    return () => ipcRenderer.removeListener('redo-move', callback)
  },
  
  onSelectGame: (callback: (gameType: string) => void) => {
    const handler = (event: any, gameType: string) => callback(gameType)
    ipcRenderer.on('select-game', handler)
    return () => ipcRenderer.removeListener('select-game', handler)
  },
  
  onAutoComplete: (callback: () => void) => {
    ipcRenderer.on('auto-complete', callback)
    return () => ipcRenderer.removeListener('auto-complete', callback)
  },
  
  onShowHint: (callback: () => void) => {
    ipcRenderer.on('show-hint', callback)
    return () => ipcRenderer.removeListener('show-hint', callback)
  },
  
  onShowHelp: (callback: () => void) => {
    ipcRenderer.on('show-help', callback)
    return () => ipcRenderer.removeListener('show-help', callback)
  },
  
  onShowShortcuts: (callback: () => void) => {
    ipcRenderer.on('show-shortcuts', callback)
    return () => ipcRenderer.removeListener('show-shortcuts', callback)
  },
  
  onAppBeforeQuit: (callback: () => void) => {
    ipcRenderer.on('app-before-quit', callback)
    return () => ipcRenderer.removeListener('app-before-quit', callback)
  }
})