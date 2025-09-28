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

interface BufferedLogEntry {
  entry: LogEntry;
  size: number;
}

interface LoggerConfig {
  logLevel: LogLevel;
  batching: {
    flushIntervalMs: number;
    maxBatchSize: number;
  };
  memory: {
    warningThresholdBytes: number;
  };
}

interface LoggerPerformanceMetrics {
  logOperations: {
    count: number;
    totalDuration: number;
    maxDuration: number;
  };
  flushOperations: {
    count: number;
    totalDuration: number;
    maxDuration: number;
  };
}

/**
 * Centralized logging utility for the Solitaire Game Collection
 * Logs to timestamped files for debugging purposes
 */
export class Logger {
  private static instance: Logger | undefined;
  private logFilePath: string;
  private logLevel: LogLevel;
  private logBuffer: BufferedLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private config: LoggerConfig;
  private bufferSizeBytes = 0;
  private memoryWarningIssued = false;
  private performanceStats: LoggerPerformanceMetrics = {
    logOperations: {
      count: 0,
      totalDuration: 0,
      maxDuration: 0
    },
    flushOperations: {
      count: 0,
      totalDuration: 0,
      maxDuration: 0
    }
  };

  private constructor() {
    this.config = this.createDefaultConfig();
    this.logLevel = this.config.logLevel;

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

    this.scheduleFlush();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Test-only helper to dispose and reset the singleton instance
   */
  public static resetForTesting(): void {
    if (Logger.instance) {
      Logger.instance.cleanup();
      Logger.instance = undefined;
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.config.logLevel = level;
    this.info('SYSTEM', 'Log level changed', { newLevel: LogLevel[level] });
  }

  public configure(options: {
    logLevel?: LogLevel;
    batching?: Partial<LoggerConfig['batching']>;
    memory?: Partial<LoggerConfig['memory']>;
  }): void {
    if (options.logLevel !== undefined) {
      this.setLogLevel(options.logLevel);
    }

    if (options.batching) {
      const { flushIntervalMs } = options.batching;
      this.config.batching = {
        ...this.config.batching,
        ...options.batching
      };

      if (flushIntervalMs !== undefined) {
        this.scheduleFlush();
      }
    }

    if (options.memory) {
      this.config.memory = {
        ...this.config.memory,
        ...options.memory
      };

      if (this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
        this.memoryWarningIssued = false;
      }
    }
  }

  public getConfiguration(): LoggerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public getPerformanceMetrics(): {
    logOperations: {
      count: number;
      totalDuration: number;
      averageDuration: number;
      maxDuration: number;
    };
    flushOperations: {
      count: number;
      totalDuration: number;
      averageDuration: number;
      maxDuration: number;
    };
  } {
    const logOps = this.performanceStats.logOperations;
    const flushOps = this.performanceStats.flushOperations;

    return {
      logOperations: {
        count: logOps.count,
        totalDuration: logOps.totalDuration,
        averageDuration: logOps.count > 0 ? logOps.totalDuration / logOps.count : 0,
        maxDuration: logOps.maxDuration
      },
      flushOperations: {
        count: flushOps.count,
        totalDuration: flushOps.totalDuration,
        averageDuration: flushOps.count > 0 ? flushOps.totalDuration / flushOps.count : 0,
        maxDuration: flushOps.maxDuration
      }
    };
  }

  public getBufferStats(): {
    entryCount: number;
    approximateBytes: number;
    thresholdBytes: number;
    thresholdExceeded: boolean;
  } {
    const thresholdBytes = this.config.memory.warningThresholdBytes;
    return {
      entryCount: this.logBuffer.length,
      approximateBytes: this.bufferSizeBytes,
      thresholdBytes,
      thresholdExceeded: this.bufferSizeBytes > thresholdBytes
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

    const bufferedEntry: BufferedLogEntry = {
      entry,
      size: this.estimateEntrySize(entry)
    };

    this.logBuffer.push(bufferedEntry);
    this.bufferSizeBytes += bufferedEntry.size;

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

    const flushedDueToMemory = this.monitorMemoryUsage();

    if (!flushedDueToMemory && (level === LogLevel.ERROR || this.logBuffer.length >= this.config.batching.maxBatchSize)) {
      this.flush();
    }

    const duration = this.getTimestamp() - start;
    this.recordPerformance('log', duration);
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
        logLine += ' | Data: [Circular or non-serializable object]';
      }
    }

    return logLine;
  }

  public flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    const start = this.getTimestamp();
    const entries = [...this.logBuffer];
    this.logBuffer = [];

    const totalSize = entries.reduce((sum, item) => sum + item.size, 0);
    this.bufferSizeBytes = Math.max(0, this.bufferSizeBytes - totalSize);

    try {
      const logLines = entries.map(({ entry }) => this.formatLogEntry(entry)).join('\n') + '\n';
      fs.appendFileSync(this.logFilePath, logLines, 'utf8');
    } catch (error) {
      console.error('Failed to flush log buffer:', error);
      this.logBuffer.unshift(...entries);
      this.bufferSizeBytes += totalSize;
      return;
    }

    if (this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
      this.memoryWarningIssued = false;
    }

    const duration = this.getTimestamp() - start;
    this.recordPerformance('flush', duration);
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public cleanup(): void {
    this.clearFlushTimer();
    this.flush();
    this.info('SYSTEM', 'Logging session ended');
    this.flush();
  }

  private monitorMemoryUsage(): boolean {
    if (this.bufferSizeBytes > this.config.memory.warningThresholdBytes) {
      if (!this.memoryWarningIssued) {
        this.memoryWarningIssued = true;
        this.writeToFile({
          timestamp: new Date().toISOString(),
          level: LogLevel.WARN,
          category: 'LOGGER',
          message: 'Log buffer memory usage exceeded threshold',
          data: {
            approximateBytes: this.bufferSizeBytes,
            thresholdBytes: this.config.memory.warningThresholdBytes
          }
        });
      }

      this.flush();
      return true;
    }

    if (this.memoryWarningIssued && this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
      this.memoryWarningIssued = false;
    }

    return false;
  }

  private estimateEntrySize(entry: LogEntry): number {
    try {
      const serialized = JSON.stringify(entry);
      return typeof Buffer !== 'undefined'
        ? Buffer.byteLength(serialized, 'utf8')
        : serialized.length;
    } catch {
      return 0;
    }
  }

  private recordPerformance(type: 'log' | 'flush', duration: number): void {
    const stats = type === 'log' ? this.performanceStats.logOperations : this.performanceStats.flushOperations;
    stats.count += 1;
    stats.totalDuration += duration;
    if (duration > stats.maxDuration) {
      stats.maxDuration = duration;
    }
  }

  private scheduleFlush(): void {
    this.clearFlushTimer();
    if (this.config.batching.flushIntervalMs > 0) {
      this.flushInterval = setInterval(() => this.flush(), this.config.batching.flushIntervalMs);
    }
  }

  private clearFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private createDefaultConfig(): LoggerConfig {
    return {
      logLevel: this.determineDefaultLogLevel(),
      batching: {
        flushIntervalMs: 5000,
        maxBatchSize: 50
      },
      memory: {
        warningThresholdBytes: 5 * 1024 * 1024
      }
    };
  }

  private determineDefaultLogLevel(): LogLevel {
    const explicitLevel = process.env.SOLITAIRE_LOG_LEVEL;
    if (explicitLevel) {
      const normalized = explicitLevel.toUpperCase();
      if (normalized in LogLevel) {
        return LogLevel[normalized as keyof typeof LogLevel];
      }
    }

    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production' || app?.isPackaged) {
      return LogLevel.INFO;
    }

    return LogLevel.DEBUG;
  }

  private getTimestamp(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    const hrTime = process?.hrtime?.bigint?.();
    if (hrTime !== undefined) {
      return Number(hrTime / BigInt(1_000_000));
    }

    return Date.now();
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
