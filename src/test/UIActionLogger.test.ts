/**
 * Unit tests for UIActionLogger class
 * Tests core functionality, event capture, state snapshots, and performance metrics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UIActionLogger } from '../utils/UIActionLogger';
import { Card } from '../utils/Card';
import { GameState, Position } from '../types/card';
import {
  UIActionEventType,
  MoveValidationResult,
  PerformanceMetrics
} from '../types/UIActionLogging';
import { LogLevel } from '../utils/RendererLogger';

// Mock the RendererLogger
vi.mock('../utils/RendererLogger', () => ({
  RendererLogger: class MockRendererLogger {
    debug = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    setLogLevel = vi.fn();
    static getInstance = vi.fn(() => new MockRendererLogger());
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  }
}));

describe('UIActionLogger', () => {
  let logger: UIActionLogger;
  let mockGameState: GameState;
  let mockCard: Card;
  let mockPosition: Position;

  beforeEach(() => {
    // Reset singleton instance
    (UIActionLogger as any).instance = undefined;
    logger = UIActionLogger.getInstance();
    
    // Create mock game state
    mockGameState = {
      gameType: 'klondike',
      tableau: [[], [], [], [], [], [], []],
      foundation: [[], [], [], []],
      stock: [],
      waste: [],
      moves: [],
      score: 0,
      timeStarted: new Date('2023-01-01T00:00:00Z')
    };

    // Create mock card
    mockCard = new Card('hearts', 5, true);
    mockCard.id = 'test-card-1';

    // Create mock position
    mockPosition = {
      zone: 'tableau',
      index: 0,
      cardIndex: 0
    };

    // Set up logger with game state
    logger.setCurrentGameState(mockGameState);
    logger.clearEventBuffer();
  });

  afterEach(() => {
    logger.flushPendingEvents('test-teardown');
    logger.clearEventBuffer();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const logger1 = UIActionLogger.getInstance();
      const logger2 = UIActionLogger.getInstance();
      expect(logger1).toBe(logger2);
    });
  });

  describe('Game State Management', () => {
    it('should set and track current game state', () => {
      const newGameState: GameState = {
        ...mockGameState,
        score: 100,
        moveCount: 5
      } as any;

      logger.setCurrentGameState(newGameState);
      
      // Verify state is set by creating a snapshot
      const snapshot = logger.createGameStateSnapshot('test', 'unit_test');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.score).toBe(100);
      expect(snapshot!.gameType).toBe('klondike');
    });

    it('should create game state snapshots with correct metadata', () => {
      const snapshot = logger.createGameStateSnapshot('test_reason', 'test_component');
      
      expect(snapshot).not.toBeNull();
      expect(snapshot!.gameType).toBe('klondike');
      expect(snapshot!.score).toBe(0);
      expect(snapshot!.moveCount).toBe(0);
      expect(snapshot!.metadata.snapshotReason).toBe('test_reason');
      expect(snapshot!.metadata.triggeredBy).toBe('test_component');
      expect(snapshot!.metadata.sequenceNumber).toBe(1);
    });

    it('should handle missing game state gracefully', () => {
      logger.setCurrentGameState(null as any);
      const snapshot = logger.createGameStateSnapshot('test', 'test');
      expect(snapshot).toBeNull();
    });
  });

  describe('Card Snapshot Creation', () => {
    it('should create accurate card snapshots', () => {
      const cardSnapshot = logger.createCardSnapshot(mockCard);
      
      expect(cardSnapshot.id).toBe('test-card-1');
      expect(cardSnapshot.suit).toBe('hearts');
      expect(cardSnapshot.rank).toBe(5);
      expect(cardSnapshot.faceUp).toBe(true);
      expect(cardSnapshot.draggable).toBe(false);
      expect(cardSnapshot.position.zone).toBe('tableau-0');
    });

    it('should handle different card positions', () => {
      mockCard.setPosition({ zone: 'foundation', index: 2, cardIndex: 3 });
      const cardSnapshot = logger.createCardSnapshot(mockCard);
      
      expect(cardSnapshot.position.zone).toBe('foundation-2');
      expect(cardSnapshot.position.x).toBe(2);
      expect(cardSnapshot.position.y).toBe(3);
    });
  });

  describe('Drag Operation Logging', () => {
    it('should log drag start events', () => {
      const performance: PerformanceMetrics = { operationDuration: 10 };
      
      const event = logger.logDragStart('CardRenderer', mockCard, mockPosition, performance);
      
      expect(event.type).toBe(UIActionEventType.DRAG_START);
      expect(event.component).toBe('CardRenderer');
      expect(event.data.card).toBeDefined();
      expect(event.data.sourcePosition).toBeDefined();
      expect(event.performance).toEqual(performance);
      expect(event.gameStateBefore).toBeDefined();
      expect(event.gameStateAfter).toBeUndefined();
    });

    it('should log drag hover events', () => {
      const validationResult: MoveValidationResult = {
        isValid: true,
        reason: 'Valid move',
        validationTime: 5
      };
      
      const event = logger.logDragHover('DropZone', mockCard, mockPosition, validationResult);
      
      expect(event.type).toBe(UIActionEventType.DRAG_HOVER);
      expect(event.component).toBe('DropZone');
      expect(event.data.validationResult).toEqual(validationResult);
      expect(event.gameStateBefore).toBeUndefined();
      expect(event.gameStateAfter).toBeUndefined();
    });

    it('should log drag drop events with before and after states', () => {
      const sourcePos: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
      const targetPos: Position = { zone: 'foundation', index: 1, cardIndex: 0 };
      const validationResult: MoveValidationResult = {
        isValid: true,
        reason: 'Valid foundation move',
        validationTime: 8
      };
      
      const event = logger.logDragDrop('CardRenderer', mockCard, sourcePos, targetPos, validationResult);
      
      expect(event.type).toBe(UIActionEventType.DRAG_DROP);
      expect(event.data.sourcePosition!.zone).toBe('tableau-0');
      expect(event.data.targetPosition!.zone).toBe('foundation-1');
      expect(event.data.validationResult).toEqual(validationResult);
      expect(event.gameStateBefore).toBeDefined();
      expect(event.gameStateAfter).toBeDefined();
    });

    it('should log drag cancel events', () => {
      const event = logger.logDragCancel('CardRenderer', mockCard, 'Invalid drop target');
      
      expect(event.type).toBe(UIActionEventType.DRAG_CANCEL);
      expect(event.data.moveReason).toBe('Invalid drop target');
      expect(event.gameStateBefore).toBeUndefined();
      expect(event.gameStateAfter).toBeUndefined();
    });
  });

  describe('Click Event Logging', () => {
    it('should log card click events', () => {
      const clickCoords = { x: 100, y: 200 };
      
      const event = logger.logCardClick('CardRenderer', mockCard, clickCoords);
      
      expect(event.type).toBe(UIActionEventType.CARD_CLICK);
      expect(event.data.clickTarget).toBe('card-test-card-1');
      expect(event.data.clickCoordinates).toEqual(clickCoords);
    });
  });

  describe('Move Event Logging', () => {
    it('should log move attempt events', () => {
      const sourcePos: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
      const targetPos: Position = { zone: 'foundation', index: 1, cardIndex: 0 };
      const validationResult: MoveValidationResult = {
        isValid: false,
        reason: 'Wrong suit',
        validationTime: 3
      };
      
      const event = logger.logMoveAttempt('GameEngine', sourcePos, targetPos, [mockCard], validationResult);
      
      expect(event.type).toBe(UIActionEventType.MOVE_ATTEMPT);
      expect(event.data.moveSuccess).toBe(false);
      expect(event.data.validationResult).toEqual(validationResult);
      expect(event.gameStateBefore).toBeDefined();
    });

    it('should log move executed events', () => {
      const sourcePos: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
      const targetPos: Position = { zone: 'foundation', index: 1, cardIndex: 0 };
      
      const event = logger.logMoveExecuted('GameEngine', sourcePos, targetPos, [mockCard], 'auto');
      
      expect(event.type).toBe(UIActionEventType.MOVE_EXECUTED);
      expect(event.data.moveType).toBe('auto');
      expect(event.data.moveSuccess).toBe(true);
      expect(event.gameStateAfter).toBeDefined();
    });
  });

  describe('State Change Logging', () => {
    it('should log state change events', () => {
      const event = logger.logStateChange('GameEngine', 'card_flip', ['card-1', 'card-2']);
      
      expect(event.type).toBe(UIActionEventType.STATE_CHANGE);
      expect(event.data.changeType).toBe('card_flip');
      expect(event.data.changedElements).toEqual(['card-1', 'card-2']);
      expect(event.gameStateAfter).toBeDefined();
    });
  });

  describe('Performance Timing', () => {
    it('should track performance timing correctly', () => {
      const operationId = 'test-operation';
      
      logger.startPerformanceTimer(operationId);
      
      // Simulate some work
      const startTime = performance.now();
      while (performance.now() - startTime < 10) {
        // Wait for at least 10ms
      }
      
      const metrics = logger.endPerformanceTimer(operationId);
      
      expect(metrics).toBeDefined();
      expect(metrics!.operationDuration).toBeGreaterThan(0);
    });

    it('should handle missing performance timers gracefully', () => {
      const metrics = logger.endPerformanceTimer('non-existent-timer');
      expect(metrics).toBeUndefined();
    });

    it('should clean up performance timers after use', () => {
      const operationId = 'cleanup-test';
      
      logger.startPerformanceTimer(operationId);
      logger.endPerformanceTimer(operationId);
      
      // Second call should return undefined
      const metrics = logger.endPerformanceTimer(operationId);
      expect(metrics).toBeUndefined();
    });
  });

  describe('Event Buffer Management', () => {
    it('should store events in buffer', () => {
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      logger.logDragStart('TestComponent', mockCard, mockPosition);
      
      const events = logger.getEventBuffer();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(UIActionEventType.CARD_CLICK);
      expect(events[1].type).toBe(UIActionEventType.DRAG_START);
    });

    it('should clear event buffer', () => {
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      expect(logger.getEventBuffer()).toHaveLength(1);
      
      logger.clearEventBuffer();
      expect(logger.getEventBuffer()).toHaveLength(0);
    });

    it('should filter events by type', () => {
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      logger.logDragStart('TestComponent', mockCard, mockPosition);
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      
      const clickEvents = logger.getEventsByType(UIActionEventType.CARD_CLICK);
      expect(clickEvents).toHaveLength(2);
      
      const dragEvents = logger.getEventsByType(UIActionEventType.DRAG_START);
      expect(dragEvents).toHaveLength(1);
    });

    it('should filter events by component', () => {
      logger.logCardClick('ComponentA', mockCard, { x: 0, y: 0 });
      logger.logCardClick('ComponentB', mockCard, { x: 0, y: 0 });
      logger.logDragStart('ComponentA', mockCard, mockPosition);
      
      const componentAEvents = logger.getEventsByComponent('ComponentA');
      expect(componentAEvents).toHaveLength(2);
      
      const componentBEvents = logger.getEventsByComponent('ComponentB');
      expect(componentBEvents).toHaveLength(1);
    });

    it('should filter events by time range', () => {
      const startTime = new Date().toISOString();
      
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      
      // Wait a bit
      const waitStart = performance.now();
      while (performance.now() - waitStart < 5) {
        // Wait for 5ms
      }
      
      const midTime = new Date().toISOString();
      logger.logDragStart('TestComponent', mockCard, mockPosition);
      
      const endTime = new Date().toISOString();
      
      const allEvents = logger.getEventsInTimeRange(startTime, endTime);
      expect(allEvents).toHaveLength(2);
      
      const laterEvents = logger.getEventsInTimeRange(midTime, endTime);
      expect(laterEvents).toHaveLength(1);
      expect(laterEvents[0].type).toBe(UIActionEventType.DRAG_START);
    });
  });

  describe('Configuration & Performance Monitoring', () => {
    it('allows configuring logging level via configure', () => {
      const rendererLogger = (logger as any).logger;
      const setLevelSpy = vi.spyOn(rendererLogger, 'setLogLevel');

      logger.configure({ loggingLevel: LogLevel.WARN });

      expect(setLevelSpy).toHaveBeenCalledWith(LogLevel.WARN);
      expect(logger.getConfiguration().loggingLevel).toBe(LogLevel.WARN);
    });

    it('batches events and flushes when batch size reached', () => {
      const rendererLogger = (logger as any).logger;
      const infoSpy = vi.spyOn(rendererLogger, 'info');

      logger.configure({
        batching: {
          enabled: true,
          maxBatchSize: 2,
          flushIntervalMs: 500,
          dispatchMode: 'summary'
        }
      });

      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      expect(infoSpy).not.toHaveBeenCalled();

      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toBe('UI_ACTION_BATCH');

      logger.flushPendingEvents();
    });

    it('dispatches individual events when batching mode configured as individual', () => {
      const rendererLogger = (logger as any).logger;
      const infoSpy = vi.spyOn(rendererLogger, 'info');

      logger.configure({
        batching: {
          enabled: true,
          maxBatchSize: 10,
          flushIntervalMs: 1000,
          dispatchMode: 'individual'
        }
      });

      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      logger.flushPendingEvents('test');

      expect(infoSpy).toHaveBeenCalledWith(
        'UI_ACTION',
        expect.stringContaining('TestComponent'),
        expect.objectContaining({ eventId: expect.any(String) })
      );
    });

    it('tracks memory usage and warns when exceeding threshold', () => {
      const rendererLogger = (logger as any).logger;
      const warnSpy = vi.spyOn(rendererLogger, 'warn');

      logger.configure({ memory: { warningThresholdBytes: 1 } });

      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });

      const memoryStats = logger.getMemoryUsageStats();
      expect(memoryStats.thresholdExceeded).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('records logging overhead metrics for operations', () => {
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      const overhead = logger.getLoggingOverheadMetrics();

      expect(overhead.eventCount).toBeGreaterThan(0);
      expect(overhead.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('logs performance summary to renderer logger', () => {
      const rendererLogger = (logger as any).logger;
      const infoSpy = vi.spyOn(rendererLogger, 'info');

      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      logger.logPerformanceSummary();

      expect(infoSpy).toHaveBeenCalledWith(
        'PERF',
        'UIActionLogger performance summary',
        expect.objectContaining({ performanceStats: expect.any(Object) })
      );
    });
  });

  describe('Event Import/Export', () => {
    it('should export events as JSON', () => {
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      logger.logDragStart('TestComponent', mockCard, mockPosition);
      
      const exportedJson = logger.exportEvents();
      const parsed = JSON.parse(exportedJson);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe(UIActionEventType.CARD_CLICK);
    });

    it('should import events from JSON', () => {
      const mockEvents = [
        {
          id: 'test-1',
          timestamp: '2023-01-01T00:00:00Z',
          type: UIActionEventType.CARD_CLICK,
          component: 'TestComponent',
          data: { clickTarget: 'test' }
        }
      ];
      
      const success = logger.importEvents(JSON.stringify(mockEvents));
      expect(success).toBe(true);
      
      const events = logger.getEventBuffer();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('test-1');
    });

    it('should handle invalid JSON during import', () => {
      const success = logger.importEvents('invalid json');
      expect(success).toBe(false);
    });

    it('should validate event structure during import', () => {
      const invalidEvents = [{ invalid: 'event' }];
      const success = logger.importEvents(JSON.stringify(invalidEvents));
      expect(success).toBe(false);
    });
  });

  describe('Performance Statistics', () => {
    it('should calculate performance statistics', () => {
      // Add events with performance data
      const perf1: PerformanceMetrics = { operationDuration: 10 };
      const perf2: PerformanceMetrics = { operationDuration: 20 };
      const perf3: PerformanceMetrics = { operationDuration: 15 };
      
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 }, perf1);
      logger.logDragStart('TestComponent', mockCard, mockPosition, perf2);
      logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 }, perf3);
      
      // Add event without performance data
      logger.logStateChange('TestComponent', 'card_flip', ['card-1']);
      
      const stats = logger.getPerformanceStatistics();
      
      expect(stats.totalEvents).toBe(4);
      expect(stats.averageOperationDuration).toBe(15); // (10 + 20 + 15) / 3
      expect(stats.slowestOperation!.duration).toBe(20);
      expect(stats.fastestOperation!.duration).toBe(10);
      expect(stats.eventsByType[UIActionEventType.CARD_CLICK]).toBe(2);
      expect(stats.eventsByType[UIActionEventType.DRAG_START]).toBe(1);
      expect(stats.eventsByType[UIActionEventType.STATE_CHANGE]).toBe(1);
    });

    it('should handle empty performance data', () => {
      logger.logStateChange('TestComponent', 'card_flip', ['card-1']);
      
      const stats = logger.getPerformanceStatistics();
      
      expect(stats.totalEvents).toBe(1);
      expect(stats.averageOperationDuration).toBe(0);
      expect(stats.slowestOperation).toBeNull();
      expect(stats.fastestOperation).toBeNull();
    });
  });

  describe('Error Handling and Fallback Modes', () => {
    it('enters reduced mode and truncates events when memory threshold is exceeded', () => {
      logger.configure({
        memory: { warningThresholdBytes: 1 }
      });

      const sourcePos: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
      const targetPos: Position = { zone: 'foundation', index: 1, cardIndex: 0 };
      const validationResult: MoveValidationResult = {
        isValid: true,
        reason: 'Valid foundation move',
        validationTime: 3
      };

      logger.logDragDrop('CardRenderer', mockCard, sourcePos, targetPos, validationResult);

      const storedEvent = logger.getEventBuffer()[0];
      const health = logger.getHealthStatus();

      expect(health.mode).toBe('reduced');
      expect(storedEvent.data.summary).toContain('CardRenderer');
      expect(health.recentIssues.some(issue => issue.type === 'mode-changed' && issue.mode === 'reduced')).toBe(true);
    });

    it('enters silent mode after repeated dispatch failures and records dropped events', () => {
      const rendererLogger = (logger as any).logger;
      rendererLogger.info.mockImplementation(() => {
        throw new Error('Dispatch failure');
      });

      logger.logCardClick('CardRenderer', mockCard, { x: 0, y: 0 });
      logger.logCardClick('CardRenderer', mockCard, { x: 1, y: 1 });
      logger.logCardClick('CardRenderer', mockCard, { x: 2, y: 2 });
      logger.logCardClick('CardRenderer', mockCard, { x: 3, y: 3 });

      const health = logger.getHealthStatus();

      expect(health.mode).toBe('silent');
      expect(health.droppedEventCount).toBeGreaterThan(0);
      expect(health.recentIssues.some(issue => issue.type === 'mode-changed' && issue.mode === 'silent')).toBe(true);
      expect(health.recentIssues.some(issue => issue.type === 'dispatch-failure')).toBe(true);

      rendererLogger.info.mockReset();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during snapshot creation gracefully', () => {
      // Create a game state that will cause JSON serialization issues
      const problematicState = {
        ...mockGameState,
        circular: {} as any
      };
      problematicState.circular.self = problematicState.circular;
      
      logger.setCurrentGameState(problematicState as any);
      
      // This should not throw, but return null and log an error
      const snapshot = logger.createGameStateSnapshot('test', 'test');
      expect(snapshot).toBeNull();
    });

    it('should handle export errors gracefully', () => {
      // Add an event with circular reference
      const event = logger.logCardClick('TestComponent', mockCard, { x: 0, y: 0 });
      (event.data as any).circular = {};
      (event.data as any).circular.self = (event.data as any).circular;
      
      const exported = logger.exportEvents();
      expect(exported).toBe('[]'); // Should return empty array on error
    });
  });
});
