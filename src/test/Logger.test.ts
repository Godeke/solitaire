import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Unmock RendererLogger for this test file
vi.unmock('../utils/RendererLogger');

import { RendererLogger, LogLevel } from '../utils/RendererLogger';

// Mock the window.electronAPI
const mockElectronAPI = {
  log: vi.fn(),
  getLogPath: vi.fn(),
  setLogLevel: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('RendererLogger', () => {
  let logger: RendererLogger;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset the singleton instance for testing
    (RendererLogger as any).instance = undefined;
    logger = RendererLogger.getInstance();
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    mockElectronAPI.log.mockResolvedValue(undefined);
    mockElectronAPI.setLogLevel.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  it('should be a singleton', () => {
    const logger1 = RendererLogger.getInstance();
    const logger2 = RendererLogger.getInstance();
    expect(logger1).toBe(logger2);
  });

  it('should log debug messages', () => {
    logger.debug('TEST', 'Debug message', { data: 'test' });
    
    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.DEBUG,
        category: 'TEST',
        message: 'Debug message',
        data: { data: 'test' }
      })
    );
  });

  it('should log info messages', () => {
    logger.info('TEST', 'Info message');
    
    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.INFO,
        category: 'TEST',
        message: 'Info message'
      })
    );
  });

  it('should log warning messages', () => {
    logger.warn('TEST', 'Warning message');
    
    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.WARN,
        category: 'TEST',
        message: 'Warning message'
      })
    );
  });

  it('should log error messages', () => {
    logger.error('TEST', 'Error message');
    
    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.ERROR,
        category: 'TEST',
        message: 'Error message'
      })
    );
  });

  it('should respect log level filtering', () => {
    logger.setLogLevel(LogLevel.WARN);

    logger.debug('TEST', 'Debug message');
    logger.info('TEST', 'Info message');
    logger.warn('TEST', 'Warning message');
    logger.error('TEST', 'Error message');

    expect(mockElectronAPI.log).toHaveBeenCalledTimes(2); // Only WARN and ERROR
  });

  it('propagates log level changes to the main process', () => {
    logger.setLogLevel(LogLevel.ERROR);
    expect(mockElectronAPI.setLogLevel).toHaveBeenCalledWith(LogLevel.ERROR);
  });

  it('should handle logging when electronAPI throws errors', () => {
    mockElectronAPI.log.mockImplementation(() => {
      throw new Error('IPC Error');
    });
    
    // Should not throw an error
    expect(() => {
      logger.info('TEST', 'Message with IPC error');
    }).not.toThrow();
  });

  it('should format log entries with timestamps', () => {
    logger.info('TEST', 'Timestamped message');
    
    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    );
  });

  it('should uppercase category names', () => {
    logger.info('test', 'Message with lowercase category');

    expect(mockElectronAPI.log).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'TEST'
      })
    );
  });

  it('tracks renderer logging performance metrics', () => {
    logger.info('TEST', 'Performance check');
    const metrics = logger.getPerformanceMetrics();

    expect(metrics.count).toBeGreaterThan(0);
    expect(metrics.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('enters IPC fallback mode after repeated logging failures', () => {
    mockElectronAPI.log.mockImplementation(() => {
      throw new Error('IPC failure');
    });

    logger.info('TEST', 'Failure 1');
    logger.info('TEST', 'Failure 2');
    logger.info('TEST', 'Failure 3');

    const health = logger.getHealthStatus();
    expect(health.mode).toBe('ipc-fallback');
    expect(health.recentIssues.some(issue => issue.type === 'ipc-fallback-activated')).toBe(true);
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('falls back to console logging when ipc API is unavailable', () => {
    const originalLog = mockElectronAPI.log;
    // @ts-expect-error - simulate missing API
    mockElectronAPI.log = undefined;

    logger.info('TEST', 'No IPC available');

    const health = logger.getHealthStatus();
    expect(health.mode).toBe('ipc-fallback');
    expect(health.recentIssues.some(issue => issue.reason.includes('ipc'))).toBe(true);
    expect(consoleSpy.info).toHaveBeenCalled();

    mockElectronAPI.log = originalLog;
  });
});
