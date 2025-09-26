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
})