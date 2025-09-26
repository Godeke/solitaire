/**
 * Unit tests for GameStateManager functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameStateManager } from '../utils/GameStateManager';
import { GameState, Card, Position, Move } from '../types/card';
import { Card as CardClass } from '../utils/Card';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('GameStateManager', () => {
  let testGameState: GameState;
  let testCard: Card;
  let testMove: Move;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();

    // Create test data
    testCard = new CardClass('hearts', 5, true);
    testCard.id = 'test-card-1';
    testCard.position = { zone: 'tableau', index: 0, cardIndex: 0 };

    testMove = {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'foundation', index: 0 },
      cards: [testCard],
      timestamp: new Date('2023-01-01T12:00:00Z'),
      autoMove: false
    };

    testGameState = {
      gameType: 'klondike',
      tableau: [[testCard], []],
      foundation: [[], [], [], []],
      stock: [new CardClass('spades', 2, false)],
      waste: [],
      freeCells: [],
      moves: [testMove],
      score: 100,
      timeStarted: new Date('2023-01-01T10:00:00Z')
    };
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('serialization', () => {
    it('should serialize game state to JSON string', () => {
      const serialized = GameStateManager.serialize(testGameState);
      const parsed = JSON.parse(serialized);

      expect(parsed.gameType).toBe('klondike');
      expect(parsed.score).toBe(100);
      expect(parsed.timeStarted).toBe('2023-01-01T10:00:00.000Z');
      expect(parsed.tableau).toHaveLength(2);
      expect(parsed.tableau[0]).toHaveLength(1);
      expect(parsed.foundation).toHaveLength(4);
      expect(parsed.moves).toHaveLength(1);
    });

    it('should handle game state with null/undefined optional fields', () => {
      const minimalState: GameState = {
        gameType: 'spider',
        tableau: [[]],
        foundation: [[]],
        moves: [],
        score: 0,
        timeStarted: new Date()
      };

      const serialized = GameStateManager.serialize(minimalState);
      const parsed = JSON.parse(serialized);

      expect(parsed.gameType).toBe('spider');
      expect(parsed.stock).toBeUndefined();
      expect(parsed.waste).toBeUndefined();
      expect(parsed.freeCells).toBeUndefined();
    });
  });

  describe('deserialization', () => {
    it('should deserialize JSON string to game state', () => {
      const serialized = GameStateManager.serialize(testGameState);
      const deserialized = GameStateManager.deserialize(serialized);

      expect(deserialized.gameType).toBe('klondike');
      expect(deserialized.score).toBe(100);
      expect(deserialized.timeStarted).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(deserialized.tableau).toHaveLength(2);
      expect(deserialized.tableau[0]).toHaveLength(1);
      expect(deserialized.foundation).toHaveLength(4);
      expect(deserialized.moves).toHaveLength(1);

      // Check card properties
      const card = deserialized.tableau[0][0];
      expect(card.suit).toBe('hearts');
      expect(card.rank).toBe(5);
      expect(card.faceUp).toBe(true);
      expect(card.id).toBe('test-card-1');

      // Check move properties
      const move = deserialized.moves[0];
      expect(move.from.zone).toBe('tableau');
      expect(move.to.zone).toBe('foundation');
      expect(move.timestamp).toEqual(new Date('2023-01-01T12:00:00Z'));
      expect(move.autoMove).toBe(false);
    });

    it('should preserve card methods after deserialization', () => {
      const serialized = GameStateManager.serialize(testGameState);
      const deserialized = GameStateManager.deserialize(serialized);

      const card = deserialized.tableau[0][0];
      expect(typeof card.flip).toBe('function');
      expect(typeof card.canStackOn).toBe('function');
      expect(typeof card.getImagePath).toBe('function');
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const serialized = GameStateManager.serialize(testGameState);
      const deserialized = GameStateManager.deserialize(serialized);
      const reSerialized = GameStateManager.serialize(deserialized);

      expect(serialized).toBe(reSerialized);
    });
  });

  describe('local storage operations', () => {
    it('should save game state to localStorage', () => {
      const result = GameStateManager.saveGameState(testGameState);

      expect(result).toBe(true);
      expect(localStorageMock.getItem('solitaire_game_klondike')).toBeTruthy();
    });

    it('should load game state from localStorage', () => {
      GameStateManager.saveGameState(testGameState);
      const loaded = GameStateManager.loadGameState('klondike');

      expect(loaded).not.toBeNull();
      expect(loaded!.gameType).toBe('klondike');
      expect(loaded!.score).toBe(100);
      expect(loaded!.tableau[0]).toHaveLength(1);
    });

    it('should return null when no saved state exists', () => {
      const loaded = GameStateManager.loadGameState('spider');
      expect(loaded).toBeNull();
    });

    it('should clear saved game state', () => {
      GameStateManager.saveGameState(testGameState);
      expect(GameStateManager.hasSavedGameState('klondike')).toBe(true);

      GameStateManager.clearGameState('klondike');
      expect(GameStateManager.hasSavedGameState('klondike')).toBe(false);
    });

    it('should check if saved game state exists', () => {
      expect(GameStateManager.hasSavedGameState('klondike')).toBe(false);
      
      GameStateManager.saveGameState(testGameState);
      expect(GameStateManager.hasSavedGameState('klondike')).toBe(true);
    });

    it('should get all saved game types', () => {
      const klondikeState = { ...testGameState, gameType: 'klondike' as const };
      const spiderState = { ...testGameState, gameType: 'spider' as const };

      GameStateManager.saveGameState(klondikeState);
      GameStateManager.saveGameState(spiderState);

      const savedTypes = GameStateManager.getSavedGameTypes();
      expect(savedTypes).toContain('klondike');
      expect(savedTypes).toContain('spider');
      expect(savedTypes).not.toContain('freecell');
    });
  });

  describe('error handling', () => {
    it('should handle localStorage save errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      const result = GameStateManager.saveGameState(testGameState);
      expect(result).toBe(false);

      // Restore original method
      localStorageMock.setItem = originalSetItem;
    });

    it('should handle localStorage load errors gracefully', () => {
      // Save valid data first
      GameStateManager.saveGameState(testGameState);

      // Mock localStorage to throw an error
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = () => {
        throw new Error('Storage access denied');
      };

      const result = GameStateManager.loadGameState('klondike');
      expect(result).toBeNull();

      // Restore original method
      localStorageMock.getItem = originalGetItem;
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.setItem('solitaire_game_klondike', 'invalid json');
      
      const result = GameStateManager.loadGameState('klondike');
      expect(result).toBeNull();
    });
  });

  describe('utility functions', () => {
    it('should clone game state correctly', () => {
      const cloned = GameStateManager.cloneGameState(testGameState);

      expect(cloned).toEqual(testGameState);
      expect(cloned).not.toBe(testGameState);
      expect(cloned.tableau[0][0]).not.toBe(testGameState.tableau[0][0]);
    });

    it('should validate valid game state', () => {
      const isValid = GameStateManager.validateGameState(testGameState);
      expect(isValid).toBe(true);
    });

    it('should reject invalid game state - missing fields', () => {
      const invalidState = {
        gameType: 'klondike',
        tableau: []
        // Missing required fields
      };

      const isValid = GameStateManager.validateGameState(invalidState);
      expect(isValid).toBe(false);
    });

    it('should reject invalid game state - wrong game type', () => {
      const invalidState = {
        ...testGameState,
        gameType: 'invalid'
      };

      const isValid = GameStateManager.validateGameState(invalidState);
      expect(isValid).toBe(false);
    });

    it('should reject invalid game state - wrong data types', () => {
      const invalidState = {
        ...testGameState,
        tableau: 'not an array'
      };

      const isValid = GameStateManager.validateGameState(invalidState);
      expect(isValid).toBe(false);
    });

    it('should reject null or undefined input', () => {
      expect(GameStateManager.validateGameState(null)).toBe(false);
      expect(GameStateManager.validateGameState(undefined)).toBe(false);
      expect(GameStateManager.validateGameState('string')).toBe(false);
    });
  });

  describe('freecells handling', () => {
    it('should handle freecells with null values', () => {
      const freeCellState: GameState = {
        ...testGameState,
        gameType: 'freecell',
        freeCells: [testCard, null, null, null] as Card[]
      };

      const serialized = GameStateManager.serialize(freeCellState);
      const deserialized = GameStateManager.deserialize(serialized);

      expect(deserialized.freeCells).toHaveLength(4);
      expect(deserialized.freeCells![0]).toBeTruthy();
      expect(deserialized.freeCells![1]).toBeNull();
      expect(deserialized.freeCells![2]).toBeNull();
      expect(deserialized.freeCells![3]).toBeNull();
    });
  });
});