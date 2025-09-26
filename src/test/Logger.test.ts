import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
});