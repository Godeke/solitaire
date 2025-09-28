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

type RendererLoggerMode = 'normal' | 'ipc-fallback';

interface RendererLoggerIssue {
  type: 'ipc-failure' | 'ipc-fallback-activated';
  timestamp: string;
  reason: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface RendererLoggerHealthStatus {
  mode: RendererLoggerMode;
  ipcFailureCount: number;
  consecutiveIpcFailures: number;
  recentIssues: RendererLoggerIssue[];
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
  private operationMode: RendererLoggerMode = 'normal';
  private ipcFailureCount = 0;
  private consecutiveIpcFailures = 0;
  private issues: RendererLoggerIssue[] = [];
  private readonly maxIssues = 20;
  private readonly maxConsecutiveIpcFailuresBeforeFallback = 3;

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
    const setLogLevelFn = window.electronAPI?.setLogLevel;

    if (this.operationMode !== 'ipc-fallback') {
      if (typeof setLogLevelFn === 'function') {
        try {
          const result = setLogLevelFn(level);
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>)
              .then(() => this.resetIpcFailures())
              .catch(error => {
                this.recordIpcFailure('set-log-level-rejection', error);
              });
          } else {
            this.resetIpcFailures();
          }
        } catch (error) {
          this.recordIpcFailure('set-log-level-throw', error);
        }
      } else {
        this.recordIpcFailure('set-log-level-missing');
      }
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

  public getHealthStatus(): RendererLoggerHealthStatus {
    return {
      mode: this.operationMode,
      ipcFailureCount: this.ipcFailureCount,
      consecutiveIpcFailures: this.consecutiveIpcFailures,
      recentIssues: [...this.issues]
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

    if (this.operationMode === 'ipc-fallback') {
      this.logToConsole(entry);
      const durationFallback = this.getTimestamp() - start;
      this.recordPerformance(durationFallback);
      return;
    }

    // Try to send to main process via IPC
    try {
      if (window.electronAPI?.log) {
        const result = window.electronAPI.log(entry);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>)
            .then(() => this.resetIpcFailures())
            .catch(error => {
              this.recordIpcFailure('log-rejection', error);
              this.logToConsole(entry);
            });
        } else {
          this.resetIpcFailures();
        }
      } else {
        // Fallback to console logging
        this.recordIpcFailure('ipc-api-missing');
        this.logToConsole(entry);
      }
    } catch (error) {
      // Fallback to console logging
      this.recordIpcFailure('log-throw', error);
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

  private recordIpcFailure(reason: string, error?: unknown): void {
    this.ipcFailureCount += 1;
    this.consecutiveIpcFailures += 1;

    const issue: RendererLoggerIssue = {
      type: 'ipc-failure',
      timestamp: new Date().toISOString(),
      reason
    };

    const serializedError = this.serializeError(error);
    if (serializedError) {
      issue.error = serializedError;
    }

    this.pushIssue(issue);

    if (reason === 'ipc-api-missing' || this.consecutiveIpcFailures >= this.maxConsecutiveIpcFailuresBeforeFallback) {
      this.enterIpcFallback(reason, error);
    }
  }

  private resetIpcFailures(): void {
    this.consecutiveIpcFailures = 0;
  }

  private enterIpcFallback(reason: string, error?: unknown): void {
    if (this.operationMode === 'ipc-fallback') {
      return;
    }

    this.operationMode = 'ipc-fallback';
    const fallbackIssue: RendererLoggerIssue = {
      type: 'ipc-fallback-activated',
      timestamp: new Date().toISOString(),
      reason
    };

    const serializedError = this.serializeError(error);
    if (serializedError) {
      fallbackIssue.error = serializedError;
    }

    this.pushIssue(fallbackIssue);
  }

  private pushIssue(issue: RendererLoggerIssue): void {
    this.issues.push(issue);
    if (this.issues.length > this.maxIssues) {
      this.issues = this.issues.slice(-this.maxIssues);
    }
  }

  private serializeError(error?: unknown): { message: string; stack?: string } | undefined {
    if (!error) {
      return undefined;
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack
      };
    }

    if (typeof error === 'string') {
      return {
        message: error
      };
    }

    try {
      return {
        message: JSON.stringify(error)
      };
    } catch {
      return {
        message: 'Unknown error'
      };
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
