import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../utils/Logger';

const { mockApp } = vi.hoisted(() => ({
  mockApp: {
    getPath: vi.fn(() => os.tmpdir())
  }
}));

const fsMocks = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  actual: null as null | typeof import('fs')
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  fsMocks.actual = actual;
  return {
    ...actual,
    appendFileSync: fsMocks.appendFileSync,
    writeFileSync: fsMocks.writeFileSync
  };
});

import * as fs from 'fs';

vi.mock('electron', () => ({
  app: mockApp
}));

describe('Logger (main process)', () => {
  let tempDir: string;

  beforeEach(() => {
    if (fsMocks.actual) {
      fsMocks.appendFileSync.mockImplementation((...args) => (fsMocks.actual as any).appendFileSync(...args));
      fsMocks.writeFileSync.mockImplementation((...args) => (fsMocks.actual as any).writeFileSync(...args));
    }

    Logger.resetForTesting();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solitaire-logger-tests-'));
    mockApp.getPath.mockReturnValue(tempDir);
  });

  afterEach(() => {
    Logger.resetForTesting();
    vi.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('recovers from file write failures by creating a recovery log file', () => {
    const logger = Logger.getInstance();

    const appendMock = fs.appendFileSync as unknown as Mock;
    appendMock.mockImplementationOnce(() => {
      const error: NodeJS.ErrnoException = new Error('Disk failure');
      error.code = 'EIO';
      throw error;
    });

    logger.error('TEST', 'Trigger write failure');

    const health = logger.getHealthStatus();
    expect(health.mode).toBe('normal');
    expect(health.recentIssues.some(issue => issue.type === 'recovery-success')).toBe(true);
    expect(health.logFilePath).toContain('recovery');
  });

  it('enters console-only mode after persistent write failures', () => {
    const logger = Logger.getInstance();

    const appendMock = fs.appendFileSync as unknown as Mock;
    appendMock.mockImplementation(() => {
      throw new Error('Disk full');
    });

    const writeMock = fs.writeFileSync as unknown as Mock;
    writeMock.mockImplementation(() => {
      throw new Error('Cannot create recovery file');
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (let i = 0; i < 6; i += 1) {
      logger.error('TEST', `Persistent failure ${i}`);
    }

    const health = logger.getHealthStatus();
    expect(health.mode).toBe('console-only');
    expect(health.recentIssues.some(issue => issue.type === 'console-fallback')).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
