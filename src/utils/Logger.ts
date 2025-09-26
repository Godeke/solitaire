import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

/**
 * Centralized logging utility for the Solitaire Game Collection
 * Logs to timestamped files for debugging purposes
 */
export class Logger {
  private static instance: Logger;
  private logFilePath: string;
  private logLevel: LogLevel = LogLevel.DEBUG;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    const startTime = new Date();
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Create logs directory in user data folder
    const userDataPath = app?.getPath('userData') || './logs';
    const logsDir = path.join(userDataPath, 'logs');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    this.logFilePath = path.join(logsDir, `solitaire-${timestamp}.log`);
    
    // Initialize log file with session start
    this.writeToFile({
      timestamp: startTime.toISOString(),
      level: LogLevel.INFO,
      category: 'SYSTEM',
      message: 'Logging session started',
      data: { 
        version: process.env.npm_package_version || '1.0.0',
        platform: process.platform,
        arch: process.arch
      }
    });

    // Set up periodic flush
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('SYSTEM', 'Log level changed', { newLevel: LogLevel[level] });
  }

  public debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  public info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  public warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  public error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: category.toUpperCase(),
      message,
      data
    };

    // Add to buffer
    this.logBuffer.push(entry);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const levelStr = LogLevel[level];
      const logMessage = `[${entry.timestamp}] ${levelStr} ${entry.category}: ${entry.message}`;
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(logMessage, data || '');
          break;
        case LogLevel.INFO:
          console.info(logMessage, data || '');
          break;
        case LogLevel.WARN:
          console.warn(logMessage, data || '');
          break;
        case LogLevel.ERROR:
          console.error(logMessage, data || '');
          break;
      }
    }

    // Flush immediately for errors
    if (level === LogLevel.ERROR) {
      this.flush();
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFilePath, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level].padEnd(5);
    let logLine = `[${entry.timestamp}] ${levelStr} ${entry.category}: ${entry.message}`;
    
    if (entry.data) {
      try {
        logLine += ` | Data: ${JSON.stringify(entry.data)}`;
      } catch (error) {
        logLine += ` | Data: [Circular or non-serializable object]`;
      }
    }
    
    return logLine;
  }

  public flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      const entries = [...this.logBuffer];
      this.logBuffer = [];
      
      const logLines = entries.map(entry => this.formatLogEntry(entry)).join('\n') + '\n';
      fs.appendFileSync(this.logFilePath, logLines, 'utf8');
    } catch (error) {
      console.error('Failed to flush log buffer:', error);
      // Restore entries to buffer if write failed
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.flush();
    this.info('SYSTEM', 'Logging session ended');
    this.flush(); // Final flush
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for common logging patterns
export const logGameAction = (action: string, gameType: string, data?: any) => {
  logger.info('GAME', `${gameType}: ${action}`, data);
};

export const logUserInteraction = (interaction: string, component: string, data?: any) => {
  logger.info('UI', `${component}: ${interaction}`, data);
};

export const logError = (error: Error, context: string, data?: any) => {
  logger.error('ERROR', `${context}: ${error.message}`, {
    stack: error.stack,
    ...data
  });
};

export const logPerformance = (operation: string, duration: number, data?: any) => {
  logger.info('PERF', `${operation} completed in ${duration}ms`, data);
};