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

interface RendererLoggerPerformanceStats {
  count: number;
  totalDuration: number;
  maxDuration: number;
}

/**
 * Renderer process logger that sends logs to main process via IPC
 * Falls back to console logging if IPC is not available
 */
export class RendererLogger {
  private static instance: RendererLogger;
  private logLevel: LogLevel;
  private sessionId: string;
  private performanceStats: RendererLoggerPerformanceStats = {
    count: 0,
    totalDuration: 0,
    maxDuration: 0
  };

  private constructor() {
    this.logLevel = this.determineDefaultLogLevel();
    this.sessionId = new Date().toISOString();
    this.info('RENDERER', 'Renderer logger initialized');
  }

  public static getInstance(): RendererLogger {
    if (!RendererLogger.instance) {
      RendererLogger.instance = new RendererLogger();
    }
    return RendererLogger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    try {
      const result = window.electronAPI?.setLogLevel?.(level);
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch(() => {
          /* swallow errors - console logging will provide visibility */
        });
      }
    } catch {
      // Ignore IPC errors - renderer logging still functions locally
    }
    this.info('RENDERER', 'Log level changed', { newLevel: LogLevel[level] });
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  public getPerformanceMetrics(): {
    count: number;
    totalDuration: number;
    averageDuration: number;
    maxDuration: number;
  } {
    const { count, totalDuration, maxDuration } = this.performanceStats;
    return {
      count,
      totalDuration,
      averageDuration: count > 0 ? totalDuration / count : 0,
      maxDuration
    };
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

    const start = this.getTimestamp();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: category.toUpperCase(),
      message,
      data
    };

    // Try to send to main process via IPC
    try {
      if (window.electronAPI?.log) {
        const result = window.electronAPI.log(entry);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(() => this.logToConsole(entry));
        }
      } else {
        // Fallback to console logging
        this.logToConsole(entry);
      }
    } catch (error) {
      // Fallback to console logging
      this.logToConsole(entry);
    }

    const duration = this.getTimestamp() - start;
    this.recordPerformance(duration);
  }

  private logToConsole(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level];
    const logMessage = `[${entry.timestamp}] ${levelStr} ${entry.category}: ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, entry.data || '');
        break;
    }
  }

  private recordPerformance(duration: number): void {
    this.performanceStats.count += 1;
    this.performanceStats.totalDuration += duration;
    if (duration > this.performanceStats.maxDuration) {
      this.performanceStats.maxDuration = duration;
    }
  }

  private determineDefaultLogLevel(): LogLevel {
    const explicit = (window as any)?.SOLITAIRE_LOG_LEVEL as string | undefined;
    if (explicit) {
      const normalized = explicit.toUpperCase();
      if (normalized in LogLevel) {
        return LogLevel[normalized as keyof typeof LogLevel];
      }
    }

    const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
    return nodeEnv === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private getTimestamp(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }
}

// Export singleton instance
export const logger = RendererLogger.getInstance();

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

export const logComponentMount = (componentName: string, props?: any) => {
  logger.debug('COMPONENT', `${componentName} mounted`, props);
};

export const logComponentUnmount = (componentName: string) => {
  logger.debug('COMPONENT', `${componentName} unmounted`);
};

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('GLOBAL', 'Unhandled error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('GLOBAL', 'Unhandled promise rejection', {
    reason: event.reason,
    stack: event.reason?.stack
  });
});
