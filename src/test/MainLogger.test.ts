import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const appendFileSyncMock = vi.fn();
const existsSyncMock = vi.fn(() => true);
const mkdirSyncMock = vi.fn();

const mockApp = {
  getPath: vi.fn(() => '/tmp/solitaire'),
  isPackaged: false,
};

vi.mock('fs', () => ({
  appendFileSync: appendFileSyncMock,
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
}));

vi.mock('electron', () => ({
  app: mockApp,
}));

describe('Logger (main process)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockApp.isPackaged = false;
  });

  afterEach(async () => {
    const mod = await import('../utils/Logger');
    mod.Logger.resetForTesting();
    vi.useRealTimers();
  });

  it('flushes buffered entries when batch size threshold is reached', async () => {
    const mod = await import('../utils/Logger');
    const { Logger, logger: singletonLogger } = mod;
    singletonLogger.cleanup();
    Logger.resetForTesting();

    const logger = Logger.getInstance();
    logger.configure({
      batching: { maxBatchSize: 2, flushIntervalMs: 1000 },
      memory: { warningThresholdBytes: 1024 },
    });

    appendFileSyncMock.mockClear();

    logger.info('TEST', 'first entry');
    expect(appendFileSyncMock).not.toHaveBeenCalled();

    logger.info('TEST', 'second entry');
    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('collects performance metrics for log and flush operations', async () => {
    const mod = await import('../utils/Logger');
    const { Logger, logger: singletonLogger } = mod;
    singletonLogger.cleanup();
    Logger.resetForTesting();

    const logger = Logger.getInstance();
    logger.configure({
      batching: { maxBatchSize: 1, flushIntervalMs: 1000 },
    });

    appendFileSyncMock.mockClear();

    logger.info('TEST', 'performance entry');

    const metrics = logger.getPerformanceMetrics();
    expect(metrics.logOperations.count).toBeGreaterThan(0);
    expect(metrics.flushOperations.count).toBeGreaterThan(0);
  });

  it('emits warning and flushes when memory threshold exceeded', async () => {
    const mod = await import('../utils/Logger');
    const { Logger, logger: singletonLogger } = mod;
    singletonLogger.cleanup();
    Logger.resetForTesting();

    const logger = Logger.getInstance();
    logger.configure({
      memory: { warningThresholdBytes: 1 },
      batching: { maxBatchSize: 10, flushIntervalMs: 1000 },
    });

    appendFileSyncMock.mockClear();

    logger.info('TEST', 'memory heavy entry');

    expect(appendFileSyncMock).toHaveBeenCalledTimes(2);

    const bufferStats = logger.getBufferStats();
    expect(bufferStats.thresholdExceeded).toBe(false);
  });

  it('defaults to INFO log level when packaged/production', async () => {
    mockApp.isPackaged = true;
    process.env.NODE_ENV = 'production';

    const { Logger, LogLevel, logger: singletonLogger } = await import('../utils/Logger');
    singletonLogger.cleanup();
    Logger.resetForTesting();

    const logger = Logger.getInstance();
    const config = logger.getConfiguration();
    expect(config.logLevel).toBe(LogLevel.INFO);
  });
});
