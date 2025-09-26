export interface LogEntry {
  timestamp: string;
  level: number;
  category: string;
  message: string;
  data?: any;
}

export interface ElectronAPI {
  log: (logEntry: LogEntry) => Promise<void>;
  getLogPath: () => Promise<string>;
  setLogLevel: (level: number) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}