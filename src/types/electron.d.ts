export interface LogEntry {
  timestamp: string;
  level: number;
  category: string;
  message: string;
  data?: any;
}

export interface ElectronAPI {
  // Logging API
  log: (logEntry: LogEntry) => Promise<void>;
  getLogPath: () => Promise<string>;
  setLogLevel: (level: number) => Promise<void>;
  
  // App info API
  getAppVersion: () => Promise<string>;
  
  // Window control API
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  
  // Game state API
  saveGameState: (gameState: any) => Promise<boolean>;
  
  // Menu event listeners
  onNewGame: (callback: () => void) => () => void;
  onShowStatistics: (callback: () => void) => () => void;
  onShowPreferences: (callback: () => void) => () => void;
  onUndoMove: (callback: () => void) => () => void;
  onRedoMove: (callback: () => void) => () => void;
  onSelectGame: (callback: (gameType: string) => void) => () => void;
  onAutoComplete: (callback: () => void) => () => void;
  onShowHint: (callback: () => void) => () => void;
  onShowHelp: (callback: () => void) => () => void;
  onShowShortcuts: (callback: () => void) => () => void;
  onAppBeforeQuit: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}