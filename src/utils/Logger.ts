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

type LoggerOperationMode = 'normal' | 'memory-constrained' | 'console-only';

interface LoggerIssue {
  type: 'file-write-failure' | 'recovery-success' | 'recovery-failed' | 'memory-fallback' | 'console-fallback';
  timestamp: string;
  context?: 'direct' | 'flush';
  entryCount?: number;
  reason?: string;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface LoggerHealthStatus {
  mode: LoggerOperationMode;
  writeFailureCount: number;
  memoryWarningCount: number;
  recentIssues: LoggerIssue[];
  logFilePath: string;
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
  private memoryWarningCount = 0;
  private operationMode: LoggerOperationMode = 'normal';
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
  private writeFailureCount = 0;
  private recoveryAttempt = 0;
  private issues: LoggerIssue[] = [];
  private readonly maxIssues = 20;
  private logsDir: string;
  private readonly maxWriteFailuresBeforeFallback = 5;

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

    this.logsDir = logsDir;
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

  public getHealthStatus(): LoggerHealthStatus {
    return {
      mode: this.operationMode,
      writeFailureCount: this.writeFailureCount,
      memoryWarningCount: this.memoryWarningCount,
      recentIssues: [...this.issues],
      logFilePath: this.logFilePath
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

    if (this.operationMode === 'memory-constrained' && entry.data) {
      entry.data = this.createMemorySafeData(entry.data);
    }

    if (this.operationMode === 'console-only') {
      this.consoleFallback(entry);
      const duration = this.getTimestamp() - start;
      this.recordPerformance('log', duration);
      return;
    }

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

    if (this.operationMode === 'memory-constrained') {
      this.flush();
    } else if (!flushedDueToMemory && (level === LogLevel.ERROR || this.logBuffer.length >= this.config.batching.maxBatchSize)) {
      this.flush();
    }

    const duration = this.getTimestamp() - start;
    this.recordPerformance('log', duration);
  }

  private writeToFile(entry: LogEntry): void {
    if (this.operationMode === 'console-only') {
      this.consoleFallback(entry);
      return;
    }

    const success = this.writeEntries([entry], 'direct');
    if (!success) {
      const bufferedEntry: BufferedLogEntry = {
        entry,
        size: this.estimateEntrySize(entry)
      };
      this.logBuffer.unshift(bufferedEntry);
      this.bufferSizeBytes += bufferedEntry.size;
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

    if (this.operationMode === 'console-only') {
      entries.forEach(({ entry }) => this.consoleFallback(entry));
      return;
    }

    const success = this.writeEntries(entries.map(({ entry }) => entry), 'flush');
    if (!success) {
      this.logBuffer.unshift(...entries);
      this.bufferSizeBytes += totalSize;
      return;
    }

    if (this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
      this.memoryWarningIssued = false;
      this.memoryWarningCount = 0;
      this.exitMemoryConstrainedMode();
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
      this.memoryWarningCount += 1;
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

      if (this.memoryWarningCount >= 2 && this.operationMode === 'normal') {
        this.enterMemoryConstrainedMode('memory-threshold-exceeded');
      } else if (this.operationMode === 'memory-constrained' && this.memoryWarningCount >= 5) {
        this.enterConsoleOnlyMode('memory-threshold-critical');
      }

      this.flush();
      return true;
    }

    if (this.memoryWarningIssued && this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
      this.memoryWarningIssued = false;
      this.memoryWarningCount = 0;
      this.exitMemoryConstrainedMode();
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

  private writeEntries(entries: LogEntry[], context: 'direct' | 'flush'): boolean {
    if (entries.length === 0) {
      return true;
    }

    if (this.operationMode === 'console-only') {
      entries.forEach(entry => this.consoleFallback(entry));
      return true;
    }

    try {
      const logLines = entries.map(entry => this.formatLogEntry(entry)).join('\n') + '\n';
      fs.appendFileSync(this.logFilePath, logLines, 'utf8');
      this.writeFailureCount = 0;
      return true;
    } catch (error) {
      return this.handleFileWriteError(error, context, entries);
    }
  }

  private handleFileWriteError(error: unknown, context: 'direct' | 'flush', entries: LogEntry[]): boolean {
    const serialized = this.serializeError(error);
    const timestamp = new Date().toISOString();

    this.writeFailureCount += 1;
    this.recordIssue({
      type: 'file-write-failure',
      timestamp,
      context,
      entryCount: entries.length,
      error: serialized
    });

    const recovered = this.tryRecoverLogFile();
    if (recovered) {
      return this.writeEntries(entries, context);
    }

    if (this.writeFailureCount >= this.maxWriteFailuresBeforeFallback) {
      this.enterConsoleOnlyMode('persistent-file-write-failure');
    }

    return false;
  }

  private tryRecoverLogFile(): boolean {
    this.recoveryAttempt += 1;

    const recoveryTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const recoveryPath = path.join(
      this.logsDir,
      `solitaire-recovery-${recoveryTimestamp}-${this.recoveryAttempt}.log`
    );

    try {
      const timestamp = new Date().toISOString();
      const headerLine = this.formatLogEntry({
        timestamp,
        level: LogLevel.WARN,
        category: 'LOGGER',
        message: 'Log file recovered after write failure',
        data: {
          attempt: this.recoveryAttempt
        }
      });

      fs.writeFileSync(recoveryPath, headerLine + '\n', 'utf8');
      this.logFilePath = recoveryPath;

      this.recordIssue({
        type: 'recovery-success',
        timestamp,
        reason: 'Created new log file after failure'
      });

      return true;
    } catch (recoveryError) {
      this.recordIssue({
        type: 'recovery-failed',
        timestamp: new Date().toISOString(),
        error: this.serializeError(recoveryError)
      });
      return false;
    }
  }

  private enterConsoleOnlyMode(reason: string): void {
    if (this.operationMode === 'console-only') {
      return;
    }

    this.operationMode = 'console-only';
    this.recordIssue({
      type: 'console-fallback',
      timestamp: new Date().toISOString(),
      reason
    });
  }

  private enterMemoryConstrainedMode(reason: string): void {
    if (this.operationMode !== 'normal') {
      return;
    }

    this.operationMode = 'memory-constrained';
    this.recordIssue({
      type: 'memory-fallback',
      timestamp: new Date().toISOString(),
      reason
    });
  }

  private exitMemoryConstrainedMode(): void {
    if (this.operationMode === 'memory-constrained' && this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
      this.operationMode = 'normal';
    }
  }

  private createMemorySafeData(data: any): any {
    if (data === undefined || data === null) {
      return data;
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      return {
        note: 'data omitted due to memory-constrained logging mode',
        keys: keys.slice(0, 5)
      };
    }

    if (typeof data === 'string' && data.length > 200) {
      return `${data.slice(0, 200)}...`;
    }

    return data;
  }

  private consoleFallback(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level];
    const logMessage = `[${entry.timestamp}] ${levelStr} ${entry.category}: ${entry.message}`;
    const payload = entry.data ?? '';

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, payload);
        break;
      case LogLevel.INFO:
        console.info(logMessage, payload);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, payload);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, payload);
        break;
    }
  }

  private recordIssue(issue: LoggerIssue): void {
    this.issues.push(issue);
    if (this.issues.length > this.maxIssues) {
      this.issues = this.issues.slice(-this.maxIssues);
    }
  }

  private serializeError(error: unknown): { message: string; code?: string; stack?: string } {
    if (error instanceof Error) {
      const serialized: { message: string; code?: string; stack?: string } = {
        message: error.message,
        stack: error.stack
      };

      const code = (error as any)?.code;
      if (typeof code === 'string') {
        serialized.code = code;
      }

      return serialized;
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return {
          message: JSON.stringify(error)
        };
      } catch {
        return {
          message: 'Unknown error object'
        };
      }
    }

    return {
      message: String(error)
    };
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
