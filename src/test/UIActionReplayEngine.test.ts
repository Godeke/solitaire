/**
 * Unit tests for UIActionReplayEngine
 * Tests event deserialization, validation, and replay functionality
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';
import { 
  UIActionEvent, 
  UIActionEventType, 
  GameStateSnapshot,
  ReplayOptions,
  CardSnapshot,
  Position
} from '../types/UIActionLogging';
import { GameState } from '../types/card';

// Mock the logger
vi.mock('../utils/RendererLogger', () => ({
  logGameAction: vi.fn(),
  logError: vi.fn(),
  logPerformance: vi.fn()
}));

describe('UIActionReplayEngine', () => {
  let replayEngine: UIActionReplayEngine;
  let mockGameEngine: any;
  let sampleEvents: UIActionEvent[];
  let sampleGameState: GameState;
  let sampleGameStateSnapshot: GameStateSnapshot;

  beforeEach(() => {
    replayEngine = new UIActionReplayEngine();
    
    // Mock game engine
    mockGameEngine = {
      setGameState: vi.fn(),
      executeMove: vi.fn(),
      getGameState: vi.fn()
    };

    // Sample card snapshot
    const sampleCard: CardSnapshot = {
      id: 'card-1',
      suit: 'hearts',
      rank: 1,
      faceUp: true,
      draggable: true,
      position: { x: 100, y: 200, zone: 'tableau-0' }
    };

    // Sample game state snapshot
    sampleGameStateSnapshot = {
      timestamp: '2023-01-01T00:00:00.000Z',
      gameType: 'klondike',
      tableau: [[sampleCard], [], [], [], [], [], []],
      foundation: [[], [], [], []],
      stock: [],
      waste: [],
      score: 0,
      moveCount: 0,
      gameStartTime: '2023-01-01T00:00:00.000Z',
      metadata: {
        snapshotReason: 'test',
        triggeredBy: 'test',
        sequenceNumber: 1
      }
    };

    // Sample game state - make it match the snapshot structure
    sampleGameState = {
      gameType: 'klondike',
      tableau: [[sampleCard], [], [], [], [], [], []], // Match the snapshot
      foundation: [[], [], [], []],
      stock: [],
      waste: [],
      moves: [],
      score: 0,
      timeStarted: new Date('2023-01-01T00:00:00.000Z')
    };

    // Sample events
    sampleEvents = [
      {
        id: 'event-1',
        timestamp: '2023-01-01T00:00:01.000Z',
        type: UIActionEventType.DRAG_START,
        component: 'CardRenderer',
        data: {
          card: sampleCard,
          sourcePosition: { x: 100, y: 200, zone: 'tableau-0' }
        },
        gameStateBefore: sampleGameStateSnapshot
      },
      {
        id: 'event-2',
        timestamp: '2023-01-01T00:00:02.000Z',
        type: UIActionEventType.MOVE_EXECUTED,
        component: 'GameEngine',
        data: {
          card: sampleCard,
          sourcePosition: { x: 100, y: 200, zone: 'tableau-0' },
          targetPosition: { x: 300, y: 400, zone: 'foundation-0' },
          moveType: 'user',
          moveSuccess: true
        },
        gameStateBefore: sampleGameStateSnapshot,
        gameStateAfter: { 
          ...sampleGameStateSnapshot, 
          score: 10,
          metadata: {
            ...sampleGameStateSnapshot.metadata,
            sequenceNumber: 2
          }
        }
      }
    ];
  });

  describe('Initialization', () => {
    it('should create a new replay engine with default state', () => {
      const engine = new UIActionReplayEngine();
      const state = engine.getReplayState();
      
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(0);
      expect(state.isReplaying).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentGameState).toBeNull();
      expect(state.errors).toEqual([]);
    });

    it('should initialize replay with valid events', () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: true
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(true);
      expect(replayEngine.getTotalSteps()).toBe(2);
      expect(replayEngine.getCurrentStep()).toBe(0);
    });

    it('should fail to initialize with invalid events', () => {
      const invalidEvents = [
        {
          id: 'invalid',
          // Missing required fields
        }
      ] as UIActionEvent[];

      const options: ReplayOptions = {
        events: invalidEvents,
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(false);
    });

    it('should fail to initialize with empty events array', () => {
      const options: ReplayOptions = {
        events: [],
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(false);
    });

    it('should fail to initialize with events not in chronological order', () => {
      const unorderedEvents = [
        {
          ...sampleEvents[1],
          timestamp: '2023-01-01T00:00:02.000Z'
        },
        {
          ...sampleEvents[0],
          timestamp: '2023-01-01T00:00:01.000Z'
        }
      ];

      const options: ReplayOptions = {
        events: unorderedEvents,
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(false);
    });
  });

  describe('Event Validation', () => {
    it('should validate correct event structure', () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(true);
    });

    it('should reject events with missing required fields', () => {
      const invalidEvent = {
        id: 'test',
        // Missing timestamp, type, component, data
      } as UIActionEvent;

      const options: ReplayOptions = {
        events: [invalidEvent],
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(false);
    });

    it('should reject events with invalid event types', () => {
      const invalidEvent = {
        ...sampleEvents[0],
        type: 'invalid_type' as UIActionEventType
      };

      const options: ReplayOptions = {
        events: [invalidEvent],
        stepByStep: false
      };

      const result = replayEngine.initializeReplay(options);
      
      expect(result).toBe(false);
    });
  });

  describe('Full Replay Execution', () => {
    beforeEach(() => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: true
      };
      replayEngine.initializeReplay(options);
    });

    it('should execute full replay successfully', async () => {
      // Mock game engine to return state that matches the expected gameStateAfter
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 10 // Match the expected score in gameStateAfter
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(2);
      expect(result.errors).toEqual([]);
      expect(mockGameEngine.executeMove).toHaveBeenCalled();
    });

    it('should handle game engine errors gracefully', async () => {
      mockGameEngine.executeMove.mockImplementation(() => {
        throw new Error('Game engine error');
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Game engine error');
    });

    it('should stop at specified step', async () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stopAtStep: 1,
        stepByStep: false
      };
      replayEngine.initializeReplay(options);
      
      mockGameEngine.executeMove.mockReturnValue(sampleGameState);
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.stepsExecuted).toBe(1);
    });

    it('should track performance metrics', async () => {
      mockGameEngine.executeMove.mockReturnValue(sampleGameState);
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.performance).toBeDefined();
      expect(result.performance.totalReplayTime).toBeGreaterThan(0);
      expect(result.performance.averageEventProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Step-by-Step Replay', () => {
    beforeEach(() => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: true,
        validateStates: true
      };
      replayEngine.initializeReplay(options);
    });

    it('should initialize step-by-step replay', async () => {
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(0); // No steps executed automatically
      expect(replayEngine.isActive()).toBe(true);
    });

    it('should execute next step correctly', async () => {
      await replayEngine.startReplay(mockGameEngine);
      mockGameEngine.executeMove.mockReturnValue(sampleGameState);
      
      const stepResult = await replayEngine.nextStep();
      
      expect(stepResult.success).toBe(true);
      expect(replayEngine.getCurrentStep()).toBe(1);
    });

    it('should handle end of events in step-by-step mode', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      // Execute all steps
      await replayEngine.nextStep();
      await replayEngine.nextStep();
      
      // Try to execute beyond available events
      const stepResult = await replayEngine.nextStep();
      
      expect(stepResult.success).toBe(false);
      expect(stepResult.error).toContain('No more steps');
    });
  });

  describe('Pause and Resume', () => {
    beforeEach(() => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: true
      };
      replayEngine.initializeReplay(options);
    });

    it('should pause replay', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      replayEngine.pauseReplay();
      
      expect(replayEngine.isPaused()).toBe(true);
    });

    it('should resume replay', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      replayEngine.pauseReplay();
      replayEngine.resumeReplay();
      
      expect(replayEngine.isPaused()).toBe(false);
    });

    it('should stop replay', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      replayEngine.stopReplay();
      
      expect(replayEngine.isActive()).toBe(false);
      expect(replayEngine.isPaused()).toBe(false);
    });
  });

  describe('Game State Reconstruction', () => {
    it('should reconstruct game state from valid snapshot', async () => {
      const options: ReplayOptions = {
        events: [sampleEvents[0]], // Event with gameStateBefore
        stepByStep: false
      };
      replayEngine.initializeReplay(options);
      
      mockGameEngine.setGameState = vi.fn();
      
      await replayEngine.startReplay(mockGameEngine);
      
      expect(mockGameEngine.setGameState).toHaveBeenCalled();
    });

    it('should handle invalid game state snapshots', async () => {
      const invalidSnapshot = {
        ...sampleGameStateSnapshot,
        gameType: 'invalid' as any
      };
      
      const eventWithInvalidSnapshot = {
        ...sampleEvents[0],
        gameStateBefore: invalidSnapshot
      };
      
      const options: ReplayOptions = {
        events: [eventWithInvalidSnapshot],
        stepByStep: false
      };
      replayEngine.initializeReplay(options);
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      // Should continue despite invalid snapshot
      expect(result.success).toBe(true);
    });
  });

  describe('State Validation', () => {
    it('should validate state consistency when enabled', async () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: true
      };
      replayEngine.initializeReplay(options);
      
      // Mock game engine to return consistent state
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 10 // Matches the gameStateAfter in sampleEvents[1]
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(true);
    });

    it('should detect state inconsistencies when validation enabled', async () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: true
      };
      replayEngine.initializeReplay(options);
      
      // Mock game engine to return inconsistent state
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 999 // Does not match gameStateAfter
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes('inconsistency'))).toBe(true);
    });

    it('should skip validation when disabled', async () => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: false
      };
      replayEngine.initializeReplay(options);
      
      // Mock game engine to return inconsistent state
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 999 // Does not match gameStateAfter
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(true); // Should succeed despite inconsistency
    });
  });

  describe('Error Handling', () => {
    it('should handle recoverable errors', async () => {
      const eventWithMissingData = {
        ...sampleEvents[1], // Use MOVE_EXECUTED event which requires data
        data: {}, // Missing required data
        gameStateAfter: undefined // Remove fallback
      };
      
      const options: ReplayOptions = {
        events: [sampleEvents[0], eventWithMissingData],
        stepByStep: false
      };
      replayEngine.initializeReplay(options);
      
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 10
      });
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(true); // Should continue despite recoverable error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].recoverable).toBe(true);
    });

    it('should stop on non-recoverable errors', async () => {
      mockGameEngine.executeMove.mockImplementation(() => {
        throw new Error('Fatal game engine error');
      });
      
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false
      };
      replayEngine.initializeReplay(options);
      
      const result = await replayEngine.startReplay(mockGameEngine);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].recoverable).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: true
      };
      replayEngine.initializeReplay(options);
    });

    it('should track progress correctly', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      expect(replayEngine.getProgress()).toBe(0);
      
      await replayEngine.nextStep();
      expect(replayEngine.getProgress()).toBe(50);
      
      await replayEngine.nextStep();
      expect(replayEngine.getProgress()).toBe(100);
    });

    it('should return correct state information', async () => {
      await replayEngine.startReplay(mockGameEngine);
      
      const state = replayEngine.getReplayState();
      
      expect(state.totalSteps).toBe(2);
      expect(state.currentStep).toBe(0);
      expect(state.isReplaying).toBe(true);
      expect(state.isPaused).toBe(false);
    });
  });

  describe('Event Type Processing', () => {
    it('should process MOVE_EXECUTED events', async () => {
      const moveEvent: UIActionEvent = {
        id: 'move-event',
        timestamp: '2023-01-01T00:00:01.000Z',
        type: UIActionEventType.MOVE_EXECUTED,
        component: 'GameEngine',
        data: {
          card: sampleEvents[0].data.card,
          sourcePosition: { x: 100, y: 200, zone: 'tableau-0' },
          targetPosition: { x: 300, y: 400, zone: 'foundation-0' }
        }
      };
      
      const options: ReplayOptions = {
        events: [moveEvent],
        stepByStep: true
      };
      replayEngine.initializeReplay(options);
      
      mockGameEngine.executeMove.mockReturnValue(sampleGameState);
      
      await replayEngine.startReplay(mockGameEngine);
      const result = await replayEngine.nextStep();
      
      expect(result.success).toBe(true);
      expect(mockGameEngine.executeMove).toHaveBeenCalledWith(
        moveEvent.data.sourcePosition,
        moveEvent.data.targetPosition,
        moveEvent.data.card
      );
    });

    it('should process DRAG_DROP events', async () => {
      const dragDropEvent: UIActionEvent = {
        id: 'drag-drop-event',
        timestamp: '2023-01-01T00:00:01.000Z',
        type: UIActionEventType.DRAG_DROP,
        component: 'CardRenderer',
        data: {
          card: sampleEvents[0].data.card,
          sourcePosition: { x: 100, y: 200, zone: 'tableau-0' },
          targetPosition: { x: 300, y: 400, zone: 'foundation-0' }
        }
      };
      
      const options: ReplayOptions = {
        events: [dragDropEvent],
        stepByStep: true
      };
      replayEngine.initializeReplay(options);
      
      mockGameEngine.executeMove.mockReturnValue(sampleGameState);
      
      await replayEngine.startReplay(mockGameEngine);
      const result = await replayEngine.nextStep();
      
      expect(result.success).toBe(true);
      expect(mockGameEngine.executeMove).toHaveBeenCalled();
    });

    it('should skip non-state-modifying events', async () => {
      const clickEvent: UIActionEvent = {
        id: 'click-event',
        timestamp: '2023-01-01T00:00:01.000Z',
        type: UIActionEventType.CARD_CLICK,
        component: 'CardRenderer',
        data: {
          clickTarget: 'card-1',
          clickCoordinates: { x: 100, y: 200 }
        }
      };
      
      const options: ReplayOptions = {
        events: [clickEvent],
        stepByStep: true
      };
      replayEngine.initializeReplay(options);
      
      await replayEngine.startReplay(mockGameEngine);
      const result = await replayEngine.nextStep();
      
      expect(result.success).toBe(true);
      expect(mockGameEngine.executeMove).not.toHaveBeenCalled();
    });
  });

  describe('Game State Reconstruction from Event Sequences', () => {
    let multiStepEvents: UIActionEvent[];
    let progressiveGameStates: GameStateSnapshot[];

    beforeEach(() => {
      // Create progressive game states for multi-step reconstruction
      progressiveGameStates = [
        sampleGameStateSnapshot,
        {
          ...sampleGameStateSnapshot,
          score: 10,
          moveCount: 1,
          metadata: { ...sampleGameStateSnapshot.metadata, sequenceNumber: 2 }
        },
        {
          ...sampleGameStateSnapshot,
          score: 25,
          moveCount: 2,
          tableau: [[], [sampleGameStateSnapshot.tableau[0][0]], [], [], [], [], []],
          foundation: [[sampleGameStateSnapshot.tableau[0][0]], [], [], []],
          metadata: { ...sampleGameStateSnapshot.metadata, sequenceNumber: 3 }
        }
      ];

      multiStepEvents = [
        {
          id: 'event-1',
          timestamp: '2023-01-01T00:00:01.000Z',
          type: UIActionEventType.DRAG_START,
          component: 'CardRenderer',
          data: { card: sampleGameStateSnapshot.tableau[0][0] },
          gameStateBefore: progressiveGameStates[0]
        },
        {
          id: 'event-2',
          timestamp: '2023-01-01T00:00:02.000Z',
          type: UIActionEventType.MOVE_EXECUTED,
          component: 'GameEngine',
          data: {
            card: sampleGameStateSnapshot.tableau[0][0],
            sourcePosition: { x: 100, y: 200, zone: 'tableau-0' },
            targetPosition: { x: 300, y: 400, zone: 'foundation-0' },
            moveSuccess: true
          },
          gameStateBefore: progressiveGameStates[0],
          gameStateAfter: progressiveGameStates[1]
        },
        {
          id: 'event-3',
          timestamp: '2023-01-01T00:00:03.000Z',
          type: UIActionEventType.STATE_CHANGE,
          component: 'GameEngine',
          data: { changeType: 'score_change' },
          gameStateBefore: progressiveGameStates[1],
          gameStateAfter: progressiveGameStates[2]
        }
      ];
    });

    it('should recreate game state from complete event sequence', async () => {
      mockGameEngine.executeMove.mockImplementation(() => ({
        ...sampleGameState,
        score: 10
      }));

      const result = await replayEngine.recreateGameStateFromEvents(multiStepEvents);

      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    it('should recreate game state up to specific step (partial replay)', async () => {
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 10
      });

      const result = await replayEngine.recreateGameStateFromEvents(multiStepEvents, 2);

      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      // Should only process first 2 events
    });

    it('should handle corrupted events during reconstruction', async () => {
      // Create events that will fail validation at the event level
      const corruptedEvents = [
        {
          id: 'corrupted-event',
          timestamp: '2023-01-01T00:00:01.000Z',
          type: 'invalid_type' as UIActionEventType, // Invalid event type
          component: 'Test',
          data: {}
        }
      ];

      const result = await replayEngine.recreateGameStateFromEvents(corruptedEvents as UIActionEvent[]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use initial state when provided', async () => {
      const initialState: GameState = {
        ...sampleGameState,
        score: 5
      };

      mockGameEngine.setGameState = vi.fn();
      mockGameEngine.executeMove.mockReturnValue({
        ...sampleGameState,
        score: 15
      });

      // Initialize the replay engine with a game engine instance
      replayEngine.initializeReplay({ events: multiStepEvents, stepByStep: false });
      await replayEngine.startReplay(mockGameEngine);

      const result = await replayEngine.recreateGameStateFromEvents(
        multiStepEvents.slice(1), // Skip first event since we have initial state
        undefined,
        initialState
      );

      expect(result.success).toBe(true);
      expect(mockGameEngine.setGameState).toHaveBeenCalledWith(initialState);
    });

    it('should recover from errors using fallback strategies', async () => {
      // Mock the game engine to throw a recoverable error
      mockGameEngine.executeMove.mockImplementation(() => {
        throw new Error('Missing event data'); // This should be classified as recoverable
      });

      const eventsWithFallback = [
        {
          ...multiStepEvents[1],
          gameStateAfter: progressiveGameStates[1] // Fallback state available
        }
      ];

      // Initialize the replay engine
      replayEngine.initializeReplay({ events: eventsWithFallback, stepByStep: false });
      await replayEngine.startReplay(mockGameEngine);

      const result = await replayEngine.recreateGameStateFromEvents(eventsWithFallback);

      expect(result.success).toBe(true);
      expect(result.gameState).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0); // Error occurred but recovered
      expect(result.errors[0].recoverable).toBe(true);
    });
  });

  describe('Event Log Validation and Sanitization', () => {
    it('should validate and sanitize corrupted event logs', () => {
      const mixedEvents = [
        sampleEvents[0], // Valid event
        null, // Corrupted event
        {
          id: 'incomplete-event',
          timestamp: '2023-01-01T00:00:03.000Z',
          // Missing type, component, data
        },
        {
          ...sampleEvents[1],
          type: 'invalid_type' // Invalid event type
        },
        sampleEvents[1] // Valid event
      ];

      const result = replayEngine.validateAndSanitizeEventLog(mixedEvents as any);

      expect(result.sanitizationReport.totalEvents).toBe(5);
      expect(result.sanitizationReport.validEvents).toBeGreaterThan(0);
      expect(result.sanitizationReport.corruptedEvents).toBeGreaterThan(0);
      expect(result.validEvents.length).toBeGreaterThan(0);
      expect(result.corruptedEvents.length).toBeGreaterThan(0);
    });

    it('should sanitize events with missing fields', () => {
      const incompleteEvent = {
        timestamp: '2023-01-01T00:00:01.000Z',
        type: UIActionEventType.CARD_CLICK,
        data: { clickTarget: 'card-1' }
        // Missing id and component
      };

      const result = replayEngine.validateAndSanitizeEventLog([incompleteEvent] as any);

      expect(result.sanitizationReport.sanitizedEvents).toBe(1);
      expect(result.validEvents.length).toBe(1);
      expect(result.validEvents[0].id).toBeDefined();
      expect(result.validEvents[0].component).toBeDefined();
    });

    it('should remove invalid game state snapshots', () => {
      const eventWithInvalidSnapshot = {
        ...sampleEvents[0],
        gameStateBefore: {
          ...sampleGameStateSnapshot,
          gameType: 'invalid' // Invalid game type
        }
      };

      const result = replayEngine.validateAndSanitizeEventLog([eventWithInvalidSnapshot] as any);

      expect(result.sanitizationReport.sanitizedEvents).toBe(1);
      expect(result.validEvents[0].gameStateBefore).toBeUndefined();
    });

    it('should handle completely corrupted event logs', () => {
      const corruptedEvents = [
        'not an object',
        123,
        { completely: 'wrong structure' },
        null,
        undefined
      ];

      const result = replayEngine.validateAndSanitizeEventLog(corruptedEvents as any);

      expect(result.sanitizationReport.validEvents).toBe(0);
      expect(result.sanitizationReport.corruptedEvents).toBeGreaterThan(0);
      expect(result.validEvents).toEqual([]);
    });
  });

  describe('Enhanced State Consistency Validation', () => {
    it('should perform comprehensive state validation', () => {
      const replayedState: GameState = {
        ...sampleGameState,
        score: 10,
        tableau: [[], [], [], [], [], [], []]
      };

      const result = replayEngine.performComprehensiveStateValidation(
        replayedState,
        sampleGameStateSnapshot
      );

      expect(result.isValid).toBe(false); // Score mismatch
      expect(result.inconsistencies.length).toBeGreaterThan(0);
      expect(result.validationReport.basicPropertiesValid).toBe(false);
    });

    it('should validate tableau structure differences', () => {
      const replayedState: GameState = {
        ...sampleGameState,
        tableau: [[], [], [], [], [], []] // Wrong number of piles (6 instead of 7)
      };

      const result = replayEngine.performComprehensiveStateValidation(
        replayedState,
        sampleGameStateSnapshot
      );

      expect(result.isValid).toBe(false);
      expect(result.validationReport.tableauValid).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('tableau pile count mismatch'))).toBe(true);
    });

    it('should validate individual card differences', () => {
      const modifiedCard = {
        ...sampleGameStateSnapshot.tableau[0][0],
        rank: 13 // Different rank
      };

      const replayedState: GameState = {
        ...sampleGameState,
        tableau: [[modifiedCard], [], [], [], [], [], []]
      };

      const result = replayEngine.performComprehensiveStateValidation(
        replayedState,
        sampleGameStateSnapshot
      );

      expect(result.isValid).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('Card rank mismatch'))).toBe(true);
    });

    it('should validate optional pile structures', () => {
      const snapshotWithStock = {
        ...sampleGameStateSnapshot,
        stock: [sampleGameStateSnapshot.tableau[0][0]]
      };

      const replayedState: GameState = {
        ...sampleGameState,
        stock: undefined // Missing stock
      };

      const result = replayEngine.performComprehensiveStateValidation(
        replayedState,
        snapshotWithStock
      );

      expect(result.isValid).toBe(false);
      expect(result.validationReport.stockValid).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('Stock pile missing'))).toBe(true);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    beforeEach(() => {
      const options: ReplayOptions = {
        events: sampleEvents,
        stepByStep: false,
        validateStates: true
      };
      replayEngine.initializeReplay(options);
    });

    it('should recover using gameStateAfter when move execution fails', async () => {
      // Use events that have gameStateAfter for recovery
      const eventsWithRecovery = [
        sampleEvents[0], // DRAG_START - should not cause issues
        {
          ...sampleEvents[1], // MOVE_EXECUTED with recovery data
          gameStateAfter: {
            ...sampleGameStateSnapshot,
            score: 10,
            metadata: { ...sampleGameStateSnapshot.metadata, sequenceNumber: 2 }
          }
        }
      ];

      const options: ReplayOptions = {
        events: eventsWithRecovery,
        stepByStep: false,
        validateStates: false // Disable validation to focus on recovery
      };
      replayEngine.initializeReplay(options);

      mockGameEngine.executeMove.mockImplementation(() => {
        throw new Error('Missing event data'); // Recoverable error
      });

      const result = await replayEngine.startReplay(mockGameEngine);

      // Should recover using gameStateAfter from the event
      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].recoverable).toBe(true);
    });

    it('should identify non-recoverable errors correctly', async () => {
      mockGameEngine.executeMove.mockImplementation(() => {
        throw new Error('Fatal game engine error');
      });

      const result = await replayEngine.startReplay(mockGameEngine);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].recoverable).toBe(false);
    });

    it('should continue processing after recoverable errors', async () => {
      // First event fails, second succeeds
      mockGameEngine.executeMove
        .mockImplementationOnce(() => {
          throw new Error('Missing event data'); // Recoverable
        })
        .mockReturnValue({
          ...sampleGameState,
          score: 10
        });

      const result = await replayEngine.startReplay(mockGameEngine);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(2); // Both events processed
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].recoverable).toBe(true);
    });
  });
});