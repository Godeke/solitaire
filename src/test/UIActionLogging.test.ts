import { describe, it, expect } from 'vitest';
import {
  UIActionEvent,
  UIActionEventType,
  UIActionEventData,
  GameStateSnapshot,
  CardSnapshot,
  PerformanceMetrics,
  MoveValidationResult,
  Position,
  DragOperation,
  DragEvent,
  ReplayOptions,
  ReplayResult,
  SerializableUIActionEvent,
  isValidUIActionEvent,
  isValidGameStateSnapshot,
  isValidCardSnapshot,
  generateEventId,
  createTimestamp
} from '@types/UIActionLogging';

describe('UIActionLogging Interfaces', () => {
  describe('Position Interface', () => {
    it('should create valid position objects', () => {
      const position: Position = {
        x: 100,
        y: 200,
        zone: 'tableau-0'
      };

      expect(position.x).toBe(100);
      expect(position.y).toBe(200);
      expect(position.zone).toBe('tableau-0');
    });

    it('should allow position without zone', () => {
      const position: Position = {
        x: 50,
        y: 75
      };

      expect(position.x).toBe(50);
      expect(position.y).toBe(75);
      expect(position.zone).toBeUndefined();
    });
  });

  describe('PerformanceMetrics Interface', () => {
    it('should create valid performance metrics', () => {
      const metrics: PerformanceMetrics = {
        operationDuration: 150,
        renderTime: 50,
        validationTime: 25,
        stateUpdateTime: 30,
        animationDuration: 200,
        memoryUsage: 1024000
      };

      expect(metrics.operationDuration).toBe(150);
      expect(metrics.renderTime).toBe(50);
      expect(metrics.validationTime).toBe(25);
      expect(metrics.stateUpdateTime).toBe(30);
      expect(metrics.animationDuration).toBe(200);
      expect(metrics.memoryUsage).toBe(1024000);
    });

    it('should allow minimal performance metrics', () => {
      const metrics: PerformanceMetrics = {
        operationDuration: 100
      };

      expect(metrics.operationDuration).toBe(100);
      expect(metrics.renderTime).toBeUndefined();
    });
  });

  describe('MoveValidationResult Interface', () => {
    it('should create valid move validation result', () => {
      const validationResult: MoveValidationResult = {
        isValid: true,
        reason: 'Valid move: King on empty tableau column',
        validationTime: 5
      };

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.reason).toBe('Valid move: King on empty tableau column');
      expect(validationResult.validationTime).toBe(5);
    });

    it('should create invalid move validation with violations', () => {
      const validationResult: MoveValidationResult = {
        isValid: false,
        reason: 'Invalid move: Cannot place red on red',
        ruleViolations: ['color_alternation', 'rank_sequence'],
        suggestedMoves: [{ x: 100, y: 200, zone: 'foundation-hearts' }],
        validationTime: 8
      };

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.ruleViolations).toHaveLength(2);
      expect(validationResult.suggestedMoves).toHaveLength(1);
    });
  });

  describe('CardSnapshot Interface', () => {
    it('should create valid card snapshot', () => {
      const cardSnapshot: CardSnapshot = {
        id: 'card-ace-hearts',
        suit: 'hearts',
        rank: 1,
        faceUp: true,
        draggable: true,
        position: { x: 50, y: 100, zone: 'tableau-0' }
      };

      expect(cardSnapshot.id).toBe('card-ace-hearts');
      expect(cardSnapshot.suit).toBe('hearts');
      expect(cardSnapshot.rank).toBe(1);
      expect(cardSnapshot.faceUp).toBe(true);
      expect(cardSnapshot.draggable).toBe(true);
      expect(cardSnapshot.position.zone).toBe('tableau-0');
    });
  });

  describe('GameStateSnapshot Interface', () => {
    it('should create valid game state snapshot', () => {
      const gameStateSnapshot: GameStateSnapshot = {
        timestamp: '2024-01-15T10:30:00.000Z',
        gameType: 'klondike',
        tableau: [
          [
            {
              id: 'card-king-spades',
              suit: 'spades',
              rank: 13,
              faceUp: true,
              draggable: true,
              position: { x: 0, y: 0, zone: 'tableau-0' }
            }
          ]
        ],
        foundation: [[], [], [], []],
        stock: [],
        waste: [],
        score: 100,
        moveCount: 15,
        gameStartTime: '2024-01-15T10:00:00.000Z',
        metadata: {
          snapshotReason: 'move_executed',
          triggeredBy: 'CardRenderer',
          sequenceNumber: 1
        }
      };

      expect(gameStateSnapshot.gameType).toBe('klondike');
      expect(gameStateSnapshot.tableau).toHaveLength(1);
      expect(gameStateSnapshot.foundation).toHaveLength(4);
      expect(gameStateSnapshot.score).toBe(100);
      expect(gameStateSnapshot.moveCount).toBe(15);
      expect(gameStateSnapshot.metadata.sequenceNumber).toBe(1);
    });

    it('should support different game types', () => {
      const spiderSnapshot: GameStateSnapshot = {
        timestamp: '2024-01-15T10:30:00.000Z',
        gameType: 'spider',
        tableau: [[], [], [], [], [], [], [], [], [], []],
        foundation: [[], [], [], [], [], [], [], []],
        score: 0,
        moveCount: 0,
        gameStartTime: '2024-01-15T10:00:00.000Z',
        metadata: {
          snapshotReason: 'game_start',
          triggeredBy: 'GameManager',
          sequenceNumber: 0
        }
      };

      expect(spiderSnapshot.gameType).toBe('spider');
      expect(spiderSnapshot.tableau).toHaveLength(10);
      expect(spiderSnapshot.foundation).toHaveLength(8);
    });
  });

  describe('UIActionEventData Interface', () => {
    it('should create drag event data', () => {
      const eventData: UIActionEventData = {
        card: {
          id: 'card-queen-hearts',
          suit: 'hearts',
          rank: 12,
          faceUp: true,
          draggable: true,
          position: { x: 100, y: 200 }
        },
        sourcePosition: { x: 100, y: 200, zone: 'tableau-1' },
        targetPosition: { x: 300, y: 400, zone: 'foundation-hearts' },
        validationResult: {
          isValid: true,
          reason: 'Valid foundation move',
          validationTime: 3
        }
      };

      expect(eventData.card?.suit).toBe('hearts');
      expect(eventData.sourcePosition?.zone).toBe('tableau-1');
      expect(eventData.targetPosition?.zone).toBe('foundation-hearts');
      expect(eventData.validationResult?.isValid).toBe(true);
    });

    it('should create click event data', () => {
      const eventData: UIActionEventData = {
        clickTarget: 'new-game-button',
        clickCoordinates: { x: 150, y: 50 }
      };

      expect(eventData.clickTarget).toBe('new-game-button');
      expect(eventData.clickCoordinates?.x).toBe(150);
      expect(eventData.clickCoordinates?.y).toBe(50);
    });

    it('should create move event data', () => {
      const eventData: UIActionEventData = {
        moveType: 'auto',
        moveSuccess: true,
        moveReason: 'Auto-move to foundation'
      };

      expect(eventData.moveType).toBe('auto');
      expect(eventData.moveSuccess).toBe(true);
      expect(eventData.moveReason).toBe('Auto-move to foundation');
    });
  });

  describe('UIActionEvent Interface', () => {
    it('should create complete UI action event', () => {
      const event: UIActionEvent = {
        id: 'event-123',
        timestamp: '2024-01-15T10:30:15.123Z',
        type: UIActionEventType.DRAG_DROP,
        component: 'CardRenderer',
        data: {
          card: {
            id: 'card-ace-spades',
            suit: 'spades',
            rank: 1,
            faceUp: true,
            draggable: true,
            position: { x: 0, y: 0 }
          },
          sourcePosition: { x: 100, y: 200 },
          targetPosition: { x: 300, y: 400 }
        },
        performance: {
          operationDuration: 150,
          validationTime: 5
        }
      };

      expect(event.id).toBe('event-123');
      expect(event.type).toBe(UIActionEventType.DRAG_DROP);
      expect(event.component).toBe('CardRenderer');
      expect(event.data.card?.suit).toBe('spades');
      expect(event.performance?.operationDuration).toBe(150);
    });
  });  
describe('DragOperation Interface', () => {
    it('should create valid drag operation', () => {
      const dragOperation: DragOperation = {
        operationId: 'drag-op-456',
        startTime: Date.now(),
        card: {
          id: 'card-jack-clubs',
          suit: 'clubs',
          rank: 11,
          faceUp: true,
          draggable: true,
          position: { x: 200, y: 300 }
        },
        sourcePosition: { x: 200, y: 300, zone: 'tableau-2' },
        events: [
          {
            timestamp: Date.now(),
            type: 'start',
            position: { x: 200, y: 300 }
          },
          {
            timestamp: Date.now() + 100,
            type: 'hover',
            position: { x: 250, y: 350 },
            validationResult: true
          }
        ],
        endTime: Date.now() + 200,
        result: 'success'
      };

      expect(dragOperation.operationId).toBe('drag-op-456');
      expect(dragOperation.card.suit).toBe('clubs');
      expect(dragOperation.events).toHaveLength(2);
      expect(dragOperation.result).toBe('success');
    });
  });

  describe('Serialization Tests', () => {
    it('should serialize and deserialize UIActionEvent', () => {
      const originalEvent: UIActionEvent = {
        id: 'test-event',
        timestamp: '2024-01-15T10:30:00.000Z',
        type: UIActionEventType.CARD_CLICK,
        component: 'CardRenderer',
        data: {
          clickTarget: 'card-king-hearts',
          clickCoordinates: { x: 100, y: 200 }
        }
      };

      const serialized = JSON.stringify(originalEvent);
      const deserialized: UIActionEvent = JSON.parse(serialized);

      expect(deserialized.id).toBe(originalEvent.id);
      expect(deserialized.type).toBe(originalEvent.type);
      expect(deserialized.component).toBe(originalEvent.component);
      expect(deserialized.data.clickTarget).toBe(originalEvent.data.clickTarget);
    });

    it('should serialize GameStateSnapshot', () => {
      const gameState: GameStateSnapshot = {
        timestamp: '2024-01-15T10:30:00.000Z',
        gameType: 'klondike',
        tableau: [[]],
        foundation: [[], [], [], []],
        stock: [],
        waste: [],
        score: 50,
        moveCount: 5,
        gameStartTime: '2024-01-15T10:00:00.000Z',
        metadata: {
          snapshotReason: 'test',
          triggeredBy: 'test',
          sequenceNumber: 1
        }
      };

      const serialized = JSON.stringify(gameState);
      const deserialized: GameStateSnapshot = JSON.parse(serialized);

      expect(deserialized.gameType).toBe('klondike');
      expect(deserialized.score).toBe(50);
      expect(deserialized.moveCount).toBe(5);
      expect(deserialized.metadata.sequenceNumber).toBe(1);
    });

    it('should handle SerializableUIActionEvent type', () => {
      const gameState: GameStateSnapshot = {
        timestamp: '2024-01-15T10:30:00.000Z',
        gameType: 'klondike',
        tableau: [[]],
        foundation: [[], [], [], []],
        score: 0,
        moveCount: 0,
        gameStartTime: '2024-01-15T10:00:00.000Z',
        metadata: {
          snapshotReason: 'test',
          triggeredBy: 'test',
          sequenceNumber: 1
        }
      };

      const serializableEvent: SerializableUIActionEvent = {
        id: 'serializable-test',
        timestamp: '2024-01-15T10:30:00.000Z',
        type: UIActionEventType.STATE_CHANGE,
        component: 'GameManager',
        data: {
          changeType: 'score_change'
        },
        gameStateBefore: JSON.stringify(gameState),
        gameStateAfter: JSON.stringify({ ...gameState, score: 100 })
      };

      expect(serializableEvent.gameStateBefore).toBeTypeOf('string');
      expect(serializableEvent.gameStateAfter).toBeTypeOf('string');
      
      const deserializedBefore: GameStateSnapshot = JSON.parse(serializableEvent.gameStateBefore!);
      const deserializedAfter: GameStateSnapshot = JSON.parse(serializableEvent.gameStateAfter!);
      
      expect(deserializedBefore.score).toBe(0);
      expect(deserializedAfter.score).toBe(100);
    });
  });

  describe('UIActionEventType Enum', () => {
    it('should contain all expected event types', () => {
      const expectedTypes = [
        'drag_start', 'drag_hover', 'drag_drop', 'drag_cancel',
        'card_click', 'button_click', 'zone_click',
        'move_attempt', 'move_executed', 'move_validated', 'auto_move',
        'state_change', 'card_flip', 'score_update', 'win_condition'
      ];

      const actualTypes = Object.values(UIActionEventType);
      
      expectedTypes.forEach(type => {
        expect(actualTypes).toContain(type);
      });
    });
  });
});

  describe('Utility Functions', () => {
    describe('isValidUIActionEvent', () => {
      it('should validate correct UIActionEvent', () => {
        const validEvent: UIActionEvent = {
          id: 'test-event',
          timestamp: '2024-01-15T10:30:00.000Z',
          type: UIActionEventType.CARD_CLICK,
          component: 'CardRenderer',
          data: {
            clickTarget: 'card-ace-hearts'
          }
        };

        expect(isValidUIActionEvent(validEvent)).toBe(true);
      });

      it('should reject invalid UIActionEvent', () => {
        const invalidEvent = {
          id: 'test-event',
          // missing timestamp
          type: UIActionEventType.CARD_CLICK,
          component: 'CardRenderer',
          data: {}
        };

        expect(isValidUIActionEvent(invalidEvent)).toBe(false);
      });

      it('should reject null or undefined', () => {
        expect(isValidUIActionEvent(null)).toBe(false);
        expect(isValidUIActionEvent(undefined)).toBe(false);
      });
    });

    describe('isValidGameStateSnapshot', () => {
      it('should validate correct GameStateSnapshot', () => {
        const validSnapshot: GameStateSnapshot = {
          timestamp: '2024-01-15T10:30:00.000Z',
          gameType: 'klondike',
          tableau: [[]],
          foundation: [[], [], [], []],
          score: 0,
          moveCount: 0,
          gameStartTime: '2024-01-15T10:00:00.000Z',
          metadata: {
            snapshotReason: 'test',
            triggeredBy: 'test',
            sequenceNumber: 1
          }
        };

        expect(isValidGameStateSnapshot(validSnapshot)).toBe(true);
      });

      it('should reject invalid game type', () => {
        const invalidSnapshot = {
          timestamp: '2024-01-15T10:30:00.000Z',
          gameType: 'invalid-game',
          tableau: [[]],
          foundation: [[], [], [], []],
          score: 0,
          moveCount: 0,
          gameStartTime: '2024-01-15T10:00:00.000Z',
          metadata: {
            snapshotReason: 'test',
            triggeredBy: 'test',
            sequenceNumber: 1
          }
        };

        expect(isValidGameStateSnapshot(invalidSnapshot)).toBe(false);
      });
    });

    describe('isValidCardSnapshot', () => {
      it('should validate correct CardSnapshot', () => {
        const validCard: CardSnapshot = {
          id: 'card-ace-hearts',
          suit: 'hearts',
          rank: 1,
          faceUp: true,
          draggable: true,
          position: { x: 100, y: 200 }
        };

        expect(isValidCardSnapshot(validCard)).toBe(true);
      });

      it('should reject invalid CardSnapshot', () => {
        const invalidCard = {
          id: 'card-ace-hearts',
          suit: 'hearts',
          rank: 'invalid-rank', // should be number
          faceUp: true,
          draggable: true,
          position: { x: 100, y: 200 }
        };

        expect(isValidCardSnapshot(invalidCard)).toBe(false);
      });
    });

    describe('generateEventId', () => {
      it('should generate unique event IDs', () => {
        const id1 = generateEventId();
        const id2 = generateEventId();

        expect(id1).toMatch(/^event-\d+-[a-z0-9]+$/);
        expect(id2).toMatch(/^event-\d+-[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('createTimestamp', () => {
      it('should create valid ISO timestamp', () => {
        const timestamp = createTimestamp();
        
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(new Date(timestamp).toISOString()).toBe(timestamp);
      });
    });
  });