/**
 * Unit tests for BaseGameEngine functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseGameEngine } from '../engines/BaseGameEngine';
import { GameState, Card, Position, Move } from '../types/card';
import { Card as CardClass } from '../utils/Card';

// Mock implementation of BaseGameEngine for testing
class MockGameEngine extends BaseGameEngine {
  initializeGame(): GameState {
    this.gameState = this.createInitialGameState();
    this.gameState.tableau = [[], [], []]; // 3 columns
    this.gameState.foundation = [[], [], [], []]; // 4 foundation piles
    return this.getGameState();
  }

  validateMove(from: Position, to: Position, card: Card): boolean {
    // Simple validation for testing
    return from.zone !== to.zone;
  }

  executeMove(from: Position, to: Position, card: Card): GameState {
    const move: Move = {
      from,
      to,
      cards: [card],
      timestamp: new Date(),
      autoMove: false
    };
    
    this.recordMove(move);
    return this.getGameState();
  }

  checkWinCondition(): boolean {
    return this.gameState.foundation.every(pile => pile.length === 13);
  }

  getValidMoves(): Move[] {
    return [];
  }

  autoComplete(): boolean {
    return false;
  }

  getGameType(): 'klondike' | 'spider' | 'freecell' {
    return 'klondike';
  }
}

describe('BaseGameEngine', () => {
  let engine: MockGameEngine;
  let testCard: Card;

  beforeEach(() => {
    engine = new MockGameEngine();
    testCard = new CardClass('hearts', 5, true);
  });

  describe('initialization', () => {
    it('should create initial game state with correct structure', () => {
      const gameState = engine.initializeGame();
      
      expect(gameState.gameType).toBe('klondike');
      expect(gameState.tableau).toHaveLength(3);
      expect(gameState.foundation).toHaveLength(4);
      expect(gameState.moves).toHaveLength(0);
      expect(gameState.score).toBe(0);
      expect(gameState.timeStarted).toBeInstanceOf(Date);
    });

    it('should apply custom configuration', () => {
      const customEngine = new MockGameEngine({
        enableUndo: false,
        maxUndoSteps: 10
      });
      
      expect(customEngine['config'].enableUndo).toBe(false);
      expect(customEngine['config'].maxUndoSteps).toBe(10);
    });
  });

  describe('game state management', () => {
    it('should get and set game state correctly', () => {
      const initialState = engine.initializeGame();
      const newState = { ...initialState, score: 100 };
      
      engine.setGameState(newState);
      const retrievedState = engine.getGameState();
      
      expect(retrievedState.score).toBe(100);
      expect(retrievedState).not.toBe(newState); // Should be a copy
    });
  });

  describe('position utilities', () => {
    beforeEach(() => {
      engine.initializeGame();
      // Add some test cards to tableau
      engine['gameState'].tableau[0] = [
        new CardClass('hearts', 1, true),
        new CardClass('spades', 2, true)
      ];
    });

    it('should get cards at position correctly', () => {
      const position: Position = { zone: 'tableau', index: 0 };
      const cards = engine['getCardsAtPosition'](position);
      
      expect(cards).toHaveLength(2);
      expect(cards[0].rank).toBe(1);
      expect(cards[1].rank).toBe(2);
    });

    it('should check if position is empty', () => {
      const emptyPosition: Position = { zone: 'tableau', index: 1 };
      const filledPosition: Position = { zone: 'tableau', index: 0 };
      
      expect(engine['isPositionEmpty'](emptyPosition)).toBe(true);
      expect(engine['isPositionEmpty'](filledPosition)).toBe(false);
    });

    it('should get top card correctly', () => {
      const position: Position = { zone: 'tableau', index: 0 };
      const topCard = engine['getTopCard'](position);
      
      expect(topCard).not.toBeNull();
      expect(topCard!.rank).toBe(2);
    });

    it('should return null for top card of empty position', () => {
      const emptyPosition: Position = { zone: 'tableau', index: 1 };
      const topCard = engine['getTopCard'](emptyPosition);
      
      expect(topCard).toBeNull();
    });
  });

  describe('card manipulation', () => {
    beforeEach(() => {
      engine.initializeGame();
    });

    it('should add cards to position correctly', () => {
      const position: Position = { zone: 'tableau', index: 0 };
      const cards = [new CardClass('hearts', 5, true)];
      
      engine['addCardsToPosition'](position, cards);
      const retrievedCards = engine['getCardsAtPosition'](position);
      
      expect(retrievedCards).toHaveLength(1);
      expect(retrievedCards[0].rank).toBe(5);
    });

    it('should remove cards from position correctly', () => {
      const position: Position = { zone: 'tableau', index: 0 };
      const cards = [
        new CardClass('hearts', 1, true),
        new CardClass('spades', 2, true),
        new CardClass('diamonds', 3, true)
      ];
      
      engine['addCardsToPosition'](position, cards);
      const removedCards = engine['removeCardsFromPosition'](position, 2);
      
      expect(removedCards).toHaveLength(2);
      expect(removedCards[0].rank).toBe(2);
      expect(removedCards[1].rank).toBe(3);
      
      const remainingCards = engine['getCardsAtPosition'](position);
      expect(remainingCards).toHaveLength(1);
      expect(remainingCards[0].rank).toBe(1);
    });
  });

  describe('move management', () => {
    beforeEach(() => {
      engine.initializeGame();
    });

    it('should record moves correctly', () => {
      const move: Move = {
        from: { zone: 'tableau', index: 0 },
        to: { zone: 'foundation', index: 0 },
        cards: [testCard],
        timestamp: new Date(),
        autoMove: false
      };
      
      engine['recordMove'](move);
      const gameState = engine.getGameState();
      
      expect(gameState.moves).toHaveLength(1);
      expect(gameState.moves[0]).toEqual(move);
    });

    it('should limit move history size', () => {
      const customEngine = new MockGameEngine({ maxUndoSteps: 2 });
      customEngine.initializeGame();
      
      // Add 3 moves
      for (let i = 0; i < 3; i++) {
        const move: Move = {
          from: { zone: 'tableau', index: 0 },
          to: { zone: 'foundation', index: 0 },
          cards: [testCard],
          timestamp: new Date(),
          autoMove: false
        };
        customEngine['recordMove'](move);
      }
      
      expect(customEngine['moveHistory']).toHaveLength(2);
    });
  });

  describe('undo functionality', () => {
    beforeEach(() => {
      engine.initializeGame();
      // Set up a test scenario
      engine['gameState'].tableau[0] = [new CardClass('hearts', 1, true)];
      engine['gameState'].tableau[1] = [];
    });

    it('should undo move correctly', () => {
      const card = engine['gameState'].tableau[0][0];
      const move: Move = {
        from: { zone: 'tableau', index: 0 },
        to: { zone: 'tableau', index: 1 },
        cards: [card],
        timestamp: new Date(),
        autoMove: false
      };
      
      // Simulate a move
      engine['removeCardsFromPosition'](move.from, 1);
      engine['addCardsToPosition'](move.to, [card]);
      engine['recordMove'](move);
      
      // Verify move was made
      expect(engine['getCardsAtPosition'](move.from)).toHaveLength(0);
      expect(engine['getCardsAtPosition'](move.to)).toHaveLength(1);
      
      // Undo the move
      const undoResult = engine.undoMove();
      
      expect(undoResult).toBe(true);
      expect(engine['getCardsAtPosition'](move.from)).toHaveLength(1);
      expect(engine['getCardsAtPosition'](move.to)).toHaveLength(0);
    });

    it('should return false when no moves to undo', () => {
      const undoResult = engine.undoMove();
      expect(undoResult).toBe(false);
    });

    it('should respect undo disabled configuration', () => {
      const noUndoEngine = new MockGameEngine({ enableUndo: false });
      noUndoEngine.initializeGame();
      
      const undoResult = noUndoEngine.undoMove();
      expect(undoResult).toBe(false);
    });
  });

  describe('sequence validation', () => {
    it('should validate card sequences correctly', () => {
      const validSequence = [
        new CardClass('hearts', 7, true),
        new CardClass('spades', 6, true),
        new CardClass('diamonds', 5, true)
      ];
      
      const invalidSequence = [
        new CardClass('hearts', 7, true),
        new CardClass('hearts', 6, true), // Same color
        new CardClass('diamonds', 5, true)
      ];
      
      expect(engine['canMoveSequence'](validSequence)).toBe(true);
      expect(engine['canMoveSequence'](invalidSequence)).toBe(false);
    });

    it('should handle single card sequences', () => {
      const singleCard = [new CardClass('hearts', 7, true)];
      expect(engine['canMoveSequence'](singleCard)).toBe(true);
    });

    it('should handle empty sequences', () => {
      expect(engine['canMoveSequence']([])).toBe(true);
    });
  });

  describe('deck creation', () => {
    it('should create shuffled deck', () => {
      const deck = engine['createShuffledDeck']();
      
      expect(deck.getCount()).toBe(52);
      expect(deck.shuffled).toBe(true);
    });
  });

  describe('position updates', () => {
    beforeEach(() => {
      engine.initializeGame();
      // Add test cards
      engine['gameState'].tableau[0] = [
        new CardClass('hearts', 1, true),
        new CardClass('spades', 2, true)
      ];
      engine['gameState'].foundation[0] = [new CardClass('diamonds', 1, true)];
    });

    it('should update card positions correctly', () => {
      engine['updateCardPositions']();
      
      const tableauCard = engine['gameState'].tableau[0][1];
      expect(tableauCard.position.zone).toBe('tableau');
      expect(tableauCard.position.index).toBe(0);
      expect(tableauCard.position.cardIndex).toBe(1);
      
      const foundationCard = engine['gameState'].foundation[0][0];
      expect(foundationCard.position.zone).toBe('foundation');
      expect(foundationCard.position.index).toBe(0);
      expect(foundationCard.position.cardIndex).toBe(0);
    });
  });
});