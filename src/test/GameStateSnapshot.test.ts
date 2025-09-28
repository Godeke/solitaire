/**
 * Unit tests for Game State Snapshot System
 * Tests snapshot creation, serialization, comparison, and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameStateSnapshotManager, SnapshotComparison } from '../utils/GameStateSnapshot';
import { GameState, Card } from '../types/card';
import { GameStateSnapshot, CardSnapshot } from '../types/UIActionLogging';
import { Card as CardImpl } from '../utils/Card';

describe('GameStateSnapshotManager', () => {
  let mockGameState: GameState;
  let mockCard1: Card;
  let mockCard2: Card;

  beforeEach(() => {
    // Reset sequence counter for consistent testing
    GameStateSnapshotManager.resetSequenceCounter();

    // Create mock cards
    mockCard1 = new CardImpl('hearts', 1, true); // Ace of Hearts, face up
    mockCard1.id = 'hearts-1-test';
    mockCard1.setPosition({ zone: 'tableau', index: 0, cardIndex: 0 });
    mockCard1.setDraggable(true);

    mockCard2 = new CardImpl('spades', 13, false); // King of Spades, face down
    mockCard2.id = 'spades-13-test';
    mockCard2.setPosition({ zone: 'tableau', index: 1, cardIndex: 0 });
    mockCard2.setDraggable(false);

    // Create mock game state
    mockGameState = {
      gameType: 'klondike',
      tableau: [
        [mockCard1],
        [mockCard2]
      ],
      foundation: [[], [], [], []],
      stock: [],
      waste: [],
      moves: [],
      score: 100,
      timeStarted: new Date('2023-01-01T00:00:00.000Z')
    };
  });

  afterEach(() => {
    GameStateSnapshotManager.resetSequenceCounter();
  });

  describe('createSnapshot', () => {
    it('should create a complete game state snapshot', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'test snapshot',
        'unit test'
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.gameType).toBe('klondike');
      expect(snapshot.score).toBe(100);
      expect(snapshot.moveCount).toBe(0);
      expect(snapshot.gameStartTime).toBe('2023-01-01T00:00:00.000Z');
      expect(snapshot.metadata.snapshotReason).toBe('test snapshot');
      expect(snapshot.metadata.triggeredBy).toBe('unit test');
      expect(snapshot.metadata.sequenceNumber).toBe(1);
    });

    it('should create card snapshots for tableau cards', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'test tableau',
        'unit test'
      );

      expect(snapshot.tableau).toHaveLength(2);
      expect(snapshot.tableau[0]).toHaveLength(1);
      expect(snapshot.tableau[1]).toHaveLength(1);

      const cardSnapshot1 = snapshot.tableau[0][0];
      expect(cardSnapshot1.id).toBe('hearts-1-test');
      expect(cardSnapshot1.suit).toBe('hearts');
      expect(cardSnapshot1.rank).toBe(1);
      expect(cardSnapshot1.faceUp).toBe(true);
      expect(cardSnapshot1.draggable).toBe(true);
      expect(cardSnapshot1.position.zone).toBe('tableau');

      const cardSnapshot2 = snapshot.tableau[1][0];
      expect(cardSnapshot2.id).toBe('spades-13-test');
      expect(cardSnapshot2.suit).toBe('spades');
      expect(cardSnapshot2.rank).toBe(13);
      expect(cardSnapshot2.faceUp).toBe(false);
      expect(cardSnapshot2.draggable).toBe(false);
    });

    it('should handle optional game state properties', () => {
      const gameStateWithStock: GameState = {
        ...mockGameState,
        stock: [mockCard1],
        waste: [mockCard2],
        freeCells: [mockCard1]
      };

      const snapshot = GameStateSnapshotManager.createSnapshot(
        gameStateWithStock,
        'test optional props',
        'unit test'
      );

      expect(snapshot.stock).toHaveLength(1);
      expect(snapshot.waste).toHaveLength(1);
      expect(snapshot.freeCells).toHaveLength(1);
      expect(snapshot.stock![0].id).toBe('hearts-1-test');
      expect(snapshot.waste![0].id).toBe('spades-13-test');
      expect(snapshot.freeCells![0].id).toBe('hearts-1-test');
    });

    it('should increment sequence counter for each snapshot', () => {
      const snapshot1 = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'first',
        'test'
      );
      const snapshot2 = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'second',
        'test'
      );

      expect(snapshot1.metadata.sequenceNumber).toBe(1);
      expect(snapshot2.metadata.sequenceNumber).toBe(2);
    });

    it('should include timestamp in ISO format', () => {
      const beforeTime = new Date().toISOString();
      const snapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'timestamp test',
        'unit test'
      );
      const afterTime = new Date().toISOString();

      expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(snapshot.timestamp >= beforeTime).toBe(true);
      expect(snapshot.timestamp <= afterTime).toBe(true);
    });
  });

  describe('createCardSnapshot', () => {
    it('should create accurate card snapshot', () => {
      const cardSnapshot = GameStateSnapshotManager.createCardSnapshot(mockCard1);

      expect(cardSnapshot.id).toBe('hearts-1-test');
      expect(cardSnapshot.suit).toBe('hearts');
      expect(cardSnapshot.rank).toBe(1);
      expect(cardSnapshot.faceUp).toBe(true);
      expect(cardSnapshot.draggable).toBe(true);
      expect(cardSnapshot.position.x).toBe(0); // cardIndex
      expect(cardSnapshot.position.y).toBe(0); // index
      expect(cardSnapshot.position.zone).toBe('tableau');
    });

    it('should handle cards with different positions', () => {
      mockCard1.setPosition({ zone: 'foundation', index: 2, cardIndex: 5 });
      const cardSnapshot = GameStateSnapshotManager.createCardSnapshot(mockCard1);

      expect(cardSnapshot.position.x).toBe(5);
      expect(cardSnapshot.position.y).toBe(2);
      expect(cardSnapshot.position.zone).toBe('foundation');
    });
  });

  describe('serializeSnapshot and deserializeSnapshot', () => {
    let testSnapshot: GameStateSnapshot;

    beforeEach(() => {
      testSnapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'serialization test',
        'unit test'
      );
    });

    it('should serialize snapshot to JSON string', () => {
      const serialized = GameStateSnapshotManager.serializeSnapshot(testSnapshot);

      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      const parsed = JSON.parse(serialized);
      expect(parsed.gameType).toBe('klondike');
      expect(parsed.score).toBe(100);
      expect(parsed.metadata.snapshotReason).toBe('serialization test');
    });

    it('should deserialize JSON string back to snapshot', () => {
      const serialized = GameStateSnapshotManager.serializeSnapshot(testSnapshot);
      const deserialized = GameStateSnapshotManager.deserializeSnapshot(serialized);

      expect(deserialized.gameType).toBe(testSnapshot.gameType);
      expect(deserialized.score).toBe(testSnapshot.score);
      expect(deserialized.moveCount).toBe(testSnapshot.moveCount);
      expect(deserialized.metadata.sequenceNumber).toBe(testSnapshot.metadata.sequenceNumber);
      expect(deserialized.tableau).toHaveLength(testSnapshot.tableau.length);
    });

    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const serialized = GameStateSnapshotManager.serializeSnapshot(testSnapshot);
      const deserialized = GameStateSnapshotManager.deserializeSnapshot(serialized);

      // Compare card data
      expect(deserialized.tableau[0][0].id).toBe(testSnapshot.tableau[0][0].id);
      expect(deserialized.tableau[0][0].suit).toBe(testSnapshot.tableau[0][0].suit);
      expect(deserialized.tableau[0][0].rank).toBe(testSnapshot.tableau[0][0].rank);
      expect(deserialized.tableau[0][0].faceUp).toBe(testSnapshot.tableau[0][0].faceUp);
    });

    it('should throw error for invalid JSON during deserialization', () => {
      expect(() => {
        GameStateSnapshotManager.deserializeSnapshot('invalid json');
      }).toThrow('Failed to deserialize snapshot');
    });

    it('should throw error for invalid snapshot structure during deserialization', () => {
      const invalidSnapshot = JSON.stringify({ invalid: 'structure' });
      
      expect(() => {
        GameStateSnapshotManager.deserializeSnapshot(invalidSnapshot);
      }).toThrow('Failed to deserialize snapshot');
    });
  });

  describe('compareSnapshots', () => {
    let snapshot1: GameStateSnapshot;
    let snapshot2: GameStateSnapshot;

    beforeEach(() => {
      snapshot1 = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'comparison test 1',
        'unit test'
      );
      
      snapshot2 = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'comparison test 2',
        'unit test'
      );
    });

    it('should detect identical snapshots', () => {
      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot1);

      expect(comparison.areEqual).toBe(true);
      expect(comparison.differences).toHaveLength(0);
      expect(comparison.summary.totalDifferences).toBe(0);
    });

    it('should detect score differences', () => {
      snapshot2.score = 200;
      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.areEqual).toBe(false);
      expect(comparison.differences).toHaveLength(1);
      expect(comparison.differences[0].type).toBe('score');
      expect(comparison.differences[0].value1).toBe(100);
      expect(comparison.differences[0].value2).toBe(200);
    });

    it('should detect move count differences', () => {
      snapshot2.moveCount = 5;
      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.areEqual).toBe(false);
      expect(comparison.differences.some(d => d.type === 'moveCount')).toBe(true);
    });

    it('should detect game type differences', () => {
      snapshot2.gameType = 'spider';
      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.areEqual).toBe(false);
      expect(comparison.differences.some(d => d.type === 'gameType')).toBe(true);
    });

    it('should detect card differences in tableau', () => {
      // Modify a card in snapshot2
      snapshot2.tableau[0][0].faceUp = false;
      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.areEqual).toBe(false);
      expect(comparison.differences.some(d => d.type === 'cardFaceUp')).toBe(true);
    });

    it('should detect array length differences', () => {
      // Add a card to snapshot2
      const extraCard: CardSnapshot = {
        id: 'extra-card',
        suit: 'clubs',
        rank: 5,
        faceUp: true,
        draggable: true,
        position: { x: 1, y: 0, zone: 'tableau' }
      };
      snapshot2.tableau[0].push(extraCard);

      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.areEqual).toBe(false);
      expect(comparison.differences.some(d => d.type === 'arrayLength')).toBe(true);
      expect(comparison.differences.some(d => d.type === 'cardMissing')).toBe(true);
    });

    it('should provide comparison summary', () => {
      snapshot2.score = 200;
      snapshot2.moveCount = 5;
      snapshot2.tableau[0][0].faceUp = false;

      const comparison = GameStateSnapshotManager.compareSnapshots(snapshot1, snapshot2);

      expect(comparison.summary.totalDifferences).toBe(3);
      expect(comparison.summary.differencesByType['score']).toBe(1);
      expect(comparison.summary.differencesByType['moveCount']).toBe(1);
      expect(comparison.summary.differencesByType['cardFaceUp']).toBe(1);
      expect(comparison.summary.affectedAreas.has('score')).toBe(true);
      expect(comparison.summary.affectedAreas.has('tableau')).toBe(true);
    });
  });

  describe('validateSnapshot', () => {
    let validSnapshot: GameStateSnapshot;

    beforeEach(() => {
      validSnapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'validation test',
        'unit test'
      );
    });

    it('should validate correct snapshot structure', () => {
      const isValid = GameStateSnapshotManager.validateSnapshot(validSnapshot);
      expect(isValid).toBe(true);
    });

    it('should reject null or undefined snapshots', () => {
      expect(GameStateSnapshotManager.validateSnapshot(null)).toBe(false);
      expect(GameStateSnapshotManager.validateSnapshot(undefined)).toBe(false);
      expect(GameStateSnapshotManager.validateSnapshot('string')).toBe(false);
    });

    it('should reject snapshots missing required properties', () => {
      const invalidSnapshot = { ...validSnapshot };
      delete (invalidSnapshot as any).timestamp;
      
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject snapshots with invalid game type', () => {
      const invalidSnapshot = { ...validSnapshot, gameType: 'invalid' };
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject snapshots with invalid tableau structure', () => {
      const invalidSnapshot = { ...validSnapshot, tableau: 'not an array' };
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject snapshots with invalid card snapshots', () => {
      const invalidSnapshot = { ...validSnapshot };
      invalidSnapshot.tableau[0][0] = { invalid: 'card' } as any;
      
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject snapshots with invalid metadata', () => {
      const invalidSnapshot = { ...validSnapshot, metadata: null };
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject card snapshots with invalid suit', () => {
      const invalidSnapshot = { ...validSnapshot };
      invalidSnapshot.tableau[0][0].suit = 'invalid' as any;
      
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });

    it('should reject card snapshots with invalid rank', () => {
      const invalidSnapshot = { ...validSnapshot };
      invalidSnapshot.tableau[0][0].rank = 0 as any; // Invalid rank
      
      expect(GameStateSnapshotManager.validateSnapshot(invalidSnapshot)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should reset sequence counter', () => {
      GameStateSnapshotManager.createSnapshot(mockGameState, 'test', 'test');
      expect(GameStateSnapshotManager.getSequenceCounter()).toBe(1);
      
      GameStateSnapshotManager.resetSequenceCounter();
      expect(GameStateSnapshotManager.getSequenceCounter()).toBe(0);
    });

    it('should get current sequence counter value', () => {
      expect(GameStateSnapshotManager.getSequenceCounter()).toBe(0);
      
      GameStateSnapshotManager.createSnapshot(mockGameState, 'test', 'test');
      expect(GameStateSnapshotManager.getSequenceCounter()).toBe(1);
      
      GameStateSnapshotManager.createSnapshot(mockGameState, 'test', 'test');
      expect(GameStateSnapshotManager.getSequenceCounter()).toBe(2);
    });
  });

  describe('utility methods', () => {
    it('should create quick snapshot with default metadata', () => {
      const snapshot = GameStateSnapshotManager.createQuickSnapshot(mockGameState);

      expect(snapshot.metadata.snapshotReason).toBe('quick_snapshot');
      expect(snapshot.metadata.triggeredBy).toBe('GameStateSnapshotManager.createQuickSnapshot');
      expect(snapshot.gameType).toBe('klondike');
    });

    it('should create quick snapshot with custom reason', () => {
      const snapshot = GameStateSnapshotManager.createQuickSnapshot(mockGameState, 'custom_reason');

      expect(snapshot.metadata.snapshotReason).toBe('custom_reason');
    });

    it('should get significant differences ignoring timestamps', () => {
      const snapshot1 = GameStateSnapshotManager.createSnapshot(mockGameState, 'test1', 'test');
      const snapshot2 = GameStateSnapshotManager.createSnapshot(mockGameState, 'test2', 'test');
      
      // Modify score to create a significant difference
      snapshot2.score = 200;

      const significantDiffs = GameStateSnapshotManager.getSignificantDifferences(snapshot1, snapshot2);

      // Should have score difference but not timestamp or sequence number differences
      expect(significantDiffs.some(d => d.type === 'score')).toBe(true);
      expect(significantDiffs.some(d => d.path.includes('timestamp'))).toBe(false);
      expect(significantDiffs.some(d => d.path.includes('sequenceNumber'))).toBe(false);
    });

    it('should create minimal snapshot with card counts', () => {
      const minimalSnapshot = GameStateSnapshotManager.createMinimalSnapshot(mockGameState, 'minimal_test');

      expect(minimalSnapshot.gameType).toBe('klondike');
      expect(minimalSnapshot.score).toBe(100);
      expect(minimalSnapshot.moveCount).toBe(0);
      expect(minimalSnapshot.cardCounts.tableau).toBe(2); // 2 cards in tableau
      expect(minimalSnapshot.cardCounts.foundation).toBe(0);
      expect(minimalSnapshot.cardCounts.stock).toBe(0);
      expect(minimalSnapshot.cardCounts.waste).toBe(0);
      expect(minimalSnapshot.cardCounts.freeCells).toBe(0);
    });

    it('should validate game state integrity', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(mockGameState, 'validation_test', 'test');
      const validation = GameStateSnapshotManager.validateGameStateIntegrity(snapshot);

      // The validation should fail because we have wrong number of tableau columns for Klondike
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Klondike should have 7 tableau columns'))).toBe(true);
      expect(validation.cardCount).toBe(2);
      expect(validation.uniqueCardIds).toBe(2);
      expect(validation.warnings).toContain('Unexpected card count: 2 (expected 52)');
    });

    it('should detect duplicate card IDs in validation', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(mockGameState, 'duplicate_test', 'test');
      
      // Create duplicate card ID
      snapshot.tableau[1][0].id = snapshot.tableau[0][0].id;

      const validation = GameStateSnapshotManager.validateGameStateIntegrity(snapshot);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Duplicate card IDs'))).toBe(true);
      expect(validation.uniqueCardIds).toBe(1);
    });

    it('should validate Klondike-specific rules', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(mockGameState, 'klondike_test', 'test');
      
      // Modify to have wrong number of tableau columns
      snapshot.tableau = [[]]; // Only 1 column instead of 7

      const validation = GameStateSnapshotManager.validateGameStateIntegrity(snapshot);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Klondike should have 7 tableau columns'))).toBe(true);
    });

    it('should create diff summary between snapshots', () => {
      const snapshot1 = GameStateSnapshotManager.createSnapshot(mockGameState, 'diff_test1', 'test');
      const snapshot2 = GameStateSnapshotManager.createSnapshot(mockGameState, 'diff_test2', 'test');
      
      // Make some changes
      snapshot2.score = 200;
      snapshot2.moveCount = 5;
      snapshot2.tableau[0][0].faceUp = false;

      const diffSummary = GameStateSnapshotManager.createDiffSummary(snapshot1, snapshot2);

      expect(diffSummary.totalDifferences).toBe(3);
      expect(diffSummary.gameStateChanges.scoreChanged).toBe(true);
      expect(diffSummary.gameStateChanges.moveCountChanged).toBe(true);
      expect(diffSummary.cardChanges.flipped).toBe(1);
      expect(diffSummary.affectedAreas).toContain('score');
      expect(diffSummary.affectedAreas).toContain('tableau');
      expect(diffSummary.timeDifference).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors during snapshot creation gracefully', () => {
      // Create a game state that might cause serialization issues
      const problematicGameState = {
        ...mockGameState,
        tableau: null as any // This should cause an error
      };

      expect(() => {
        GameStateSnapshotManager.createSnapshot(
          problematicGameState,
          'error test',
          'unit test'
        );
      }).toThrow();
    });

    it('should handle circular references in serialization', () => {
      const snapshot = GameStateSnapshotManager.createSnapshot(
        mockGameState,
        'circular test',
        'unit test'
      );

      // Create circular reference
      (snapshot as any).circular = snapshot;

      expect(() => {
        GameStateSnapshotManager.serializeSnapshot(snapshot);
      }).toThrow('Failed to serialize snapshot');
    });
  });
});