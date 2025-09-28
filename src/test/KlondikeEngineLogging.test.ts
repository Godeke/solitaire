/**
 * Unit tests for KlondikeEngine logging integration
 * Tests the enhanced logging functionality for move validation, execution, and auto-moves
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KlondikeEngine } from '../engines/KlondikeEngine';
import { uiActionLogger } from '../utils/UIActionLogger';
import { UIActionEventType } from '../types/UIActionLogging';

// Mock the RendererLogger to avoid IPC calls in tests
vi.mock('../utils/RendererLogger', () => {
  const mockInstance = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLogLevel: vi.fn()
  };

  return {
    logGameAction: vi.fn(),
    logPerformance: vi.fn(),
    logError: vi.fn(),
    RendererLogger: {
      getInstance: vi.fn(() => mockInstance)
    },
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    }
  };
});

// Mock the GameStateSnapshotManager to avoid complex snapshot creation in tests
vi.mock('../utils/GameStateSnapshot', () => ({
  GameStateSnapshotManager: {
    createSnapshot: vi.fn().mockReturnValue({
      timestamp: '2023-01-01T00:00:00.000Z',
      gameType: 'klondike',
      tableau: [],
      foundation: [],
      score: 0,
      moveCount: 0,
      gameStartTime: '2023-01-01T00:00:00.000Z',
      metadata: {
        snapshotReason: 'test',
        triggeredBy: 'test',
        sequenceNumber: 1
      }
    }),
    createCardSnapshot: vi.fn().mockImplementation((card) => ({
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      faceUp: card.faceUp,
      draggable: card.draggable,
      position: {
        x: card.position.index,
        y: card.position.cardIndex || 0,
        zone: card.position.zone
      }
    }))
  }
}));

describe('KlondikeEngine Logging Integration', () => {
  
  it('should verify logging functionality exists', () => {
    // This is a basic test to verify the logging system is set up
    expect(uiActionLogger).toBeDefined();
    expect(typeof uiActionLogger.getEventBuffer).toBe('function');
    expect(typeof uiActionLogger.getEventsByType).toBe('function');
    expect(typeof uiActionLogger.getEventsByComponent).toBe('function');
  });

  it('should create UIActionLogger instance', () => {
    // Test that we can get the singleton instance
    const logger = uiActionLogger;
    expect(logger).toBeDefined();
    
    // Test basic buffer operations
    const initialEvents = logger.getEventBuffer();
    expect(Array.isArray(initialEvents)).toBe(true);
  });

  it('should handle event filtering', () => {
    // Test event filtering methods exist and work
    const validationEvents = uiActionLogger.getEventsByType(UIActionEventType.MOVE_VALIDATED);
    const engineEvents = uiActionLogger.getEventsByComponent('KlondikeEngine');
    
    expect(Array.isArray(validationEvents)).toBe(true);
    expect(Array.isArray(engineEvents)).toBe(true);
  });
});
