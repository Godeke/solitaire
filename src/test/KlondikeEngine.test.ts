/**
 * Unit tests for KlondikeEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KlondikeEngine } from '../engines/KlondikeEngine';
import { Card } from '../utils/Card';
import { Position, GameState } from '../types/card';

describe('KlondikeEngine', () => {
  let engine: KlondikeEngine;

  beforeEach(() => {
    engine = new KlondikeEngine();
  });

  describe('Game Initialization', () => {
    it('should initialize a new Klondike game with correct layout', () => {
      const gameState = engine.initializeGame();

      expect(gameState.gameType).toBe('klondike');
      expect(gameState.tableau).toHaveLength(7);
      expect(gameState.foundation).toHaveLength(4);
      expect(gameState.stock).toBeDefined();
      expect(gameState.waste).toBeDefined();

      // Check tableau layout (1, 2, 3, 4, 5, 6, 7 cards)
      for (let i = 0; i < 7; i++) {
        expect(gameState.tableau[i]).toHaveLength(i + 1);
        
        // Only top card should be face up
        for (let j = 0; j < gameState.tableau[i].length; j++) {
          const card = gameState.tableau[i][j];
          expect(card.faceUp).toBe(j === i);
        }
      }

      // Check that stock has remaining cards (52 - 28 = 24 cards)
      expect(gameState.stock!.length).toBe(24);
      
      // All stock cards should be face down
      gameState.stock!.forEach(card => {
        expect(card.faceUp).toBe(false);
      });

      // Foundation piles should be empty
      gameState.foundation.forEach(pile => {
        expect(pile).toHaveLength(0);
      });

      // Waste should be empty initially
      expect(gameState.waste).toHaveLength(0);
    });

    it('should set correct card positions during initialization', () => {
      const gameState = engine.initializeGame();

      // Check tableau positions
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row < gameState.tableau[col].length; row++) {
          const card = gameState.tableau[col][row];
          expect(card.position.zone).toBe('tableau');
          expect(card.position.index).toBe(col);
          expect(card.position.cardIndex).toBe(row);
        }
      }

      // Check stock positions
      gameState.stock!.forEach((card, index) => {
        expect(card.position.zone).toBe('stock');
        expect(card.position.index).toBe(0);
        expect(card.position.cardIndex).toBe(index);
      });
    });
  });

  describe('Move Validation', () => {
    beforeEach(() => {
      engine.initializeGame();
    });

    it('should validate foundation moves correctly', () => {
      // Create a test scenario with an Ace
      const aceOfHearts = new Card('hearts', 1, true);
      const twoOfHearts = new Card('hearts', 2, true);
      const aceOfSpades = new Card('spades', 1, true);

      // Set up game state with cards in tableau
      const gameState = engine.getGameState();
      gameState.tableau[0] = [aceOfHearts];
      gameState.tableau[1] = [twoOfHearts];
      gameState.tableau[2] = [aceOfSpades];
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const foundationPos: Position = { zone: 'foundation', index: 0 };

      // Ace should be valid on empty foundation
      expect(engine.validateMove(fromPos, foundationPos, aceOfHearts)).toBe(true);

      // Non-Ace should not be valid on empty foundation
      const fromPos2: Position = { zone: 'tableau', index: 1 };
      expect(engine.validateMove(fromPos2, foundationPos, twoOfHearts)).toBe(false);

      // Add Ace to foundation manually for next test
      const newGameState = engine.getGameState();
      newGameState.foundation[0].push(aceOfHearts);
      engine.setGameState(newGameState);

      // Two of Hearts should be valid on Ace of Hearts
      expect(engine.validateMove(fromPos2, foundationPos, twoOfHearts)).toBe(true);

      // Ace of Spades should not be valid on Ace of Hearts (wrong suit)
      const fromPos3: Position = { zone: 'tableau', index: 2 };
      expect(engine.validateMove(fromPos3, foundationPos, aceOfSpades)).toBe(false);
    });

    it('should validate tableau moves correctly', () => {
      const redSeven = new Card('hearts', 7, true);
      const blackSix = new Card('spades', 6, true);
      const redSix = new Card('diamonds', 6, true);
      const king = new Card('clubs', 13, true);

      // Set up game state with cards in waste
      const gameState = engine.getGameState();
      gameState.waste = [redSix, blackSix, king]; // King is on top (last in array)
      gameState.tableau[0] = []; // Empty tableau column
      gameState.tableau[1] = [redSeven]; // Red seven in tableau
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'waste', index: 0 };
      const emptyTableauPos: Position = { zone: 'tableau', index: 0 };
      const tableauPos: Position = { zone: 'tableau', index: 1 };

      // King should be valid on empty tableau
      expect(engine.validateMove(fromPos, emptyTableauPos, king)).toBe(true);

      // Non-King should not be valid on empty tableau
      expect(engine.validateMove(fromPos, emptyTableauPos, redSeven)).toBe(false);

      // Black six should be valid on red seven (alternating color, descending rank)
      // But first we need to set up the waste so blackSix is on top
      const newGameState = engine.getGameState();
      newGameState.waste = [redSix, king, blackSix]; // BlackSix is now on top
      engine.setGameState(newGameState);
      
      expect(engine.validateMove(fromPos, tableauPos, blackSix)).toBe(true);

      // Red six should not be valid on red seven (same color)
      // Set up waste so redSix is on top
      const gameState2 = engine.getGameState();
      gameState2.waste = [king, blackSix, redSix]; // RedSix is now on top
      engine.setGameState(gameState2);
      
      expect(engine.validateMove(fromPos, tableauPos, redSix)).toBe(false);
    });

    it('should not allow moves of face-down cards', () => {
      const faceDownCard = new Card('hearts', 5, false);
      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'tableau', index: 1 };

      expect(engine.validateMove(fromPos, toPos, faceDownCard)).toBe(false);
    });
  });

  describe('Move Execution', () => {
    beforeEach(() => {
      engine.initializeGame();
    });

    it('should execute valid tableau to foundation move', () => {
      // Set up a scenario with an Ace on tableau
      const gameState = engine.getGameState();
      const aceOfHearts = new Card('hearts', 1, true);
      aceOfHearts.draggable = true;
      gameState.tableau[0] = [aceOfHearts];
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'foundation', index: 0 };

      const newState = engine.executeMove(fromPos, toPos, aceOfHearts);

      expect(newState.tableau[0]).toHaveLength(0);
      expect(newState.foundation[0]).toHaveLength(1);
      expect(newState.foundation[0][0].suit).toBe('hearts');
      expect(newState.foundation[0][0].rank).toBe(1);
      expect(newState.moves).toHaveLength(1);
    });

    it('should execute stock to waste move', () => {
      const gameState = engine.getGameState();
      const initialStockLength = gameState.stock!.length;
      const initialWasteLength = gameState.waste!.length;

      // Execute stock to waste move
      const stockCard = gameState.stock![gameState.stock!.length - 1];
      const fromPos: Position = { zone: 'stock', index: 0 };
      const toPos: Position = { zone: 'waste', index: 0 };

      const newState = engine.executeMove(fromPos, toPos, stockCard);

      // Should deal 3 cards by default (or remaining if less than 3)
      const expectedDeal = Math.min(3, initialStockLength);
      expect(newState.stock!.length).toBe(initialStockLength - expectedDeal);
      expect(newState.waste!.length).toBe(initialWasteLength + expectedDeal);

      // Dealt cards should be face up
      for (let i = newState.waste!.length - expectedDeal; i < newState.waste!.length; i++) {
        expect(newState.waste![i].faceUp).toBe(true);
      }
    });

    it('should flip exposed cards after move', () => {
      // Set up tableau with face-down card that will be exposed
      const gameState = engine.getGameState();
      const faceDownCard = new Card('clubs', 8, false);
      const faceUpCard = new Card('hearts', 7, true);
      faceUpCard.draggable = true;
      
      gameState.tableau[0] = [faceDownCard, faceUpCard];
      
      // Set up target column with black 8 to accept red 7
      const blackEight = new Card('spades', 8, true);
      gameState.tableau[1] = [blackEight];
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'tableau', index: 1 };

      const newState = engine.executeMove(fromPos, toPos, faceUpCard);

      // The previously face-down card should now be face up
      expect(newState.tableau[0]).toHaveLength(1);
      expect(newState.tableau[0][0].faceUp).toBe(true);
      expect(newState.tableau[0][0].draggable).toBe(true);
    });

    it('should not execute invalid moves', () => {
      const gameState = engine.getGameState();
      const initialState = JSON.stringify(gameState);

      // Try to move a non-Ace to empty foundation
      const twoOfHearts = new Card('hearts', 2, true);
      gameState.tableau[0] = [twoOfHearts];
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'foundation', index: 0 };

      const newState = engine.executeMove(fromPos, toPos, twoOfHearts);

      // State should remain unchanged
      expect(newState.tableau[0]).toHaveLength(1);
      expect(newState.foundation[0]).toHaveLength(0);
    });
  });

  describe('Win Condition', () => {
    it('should detect win condition when all cards are in foundation', () => {
      const gameState = engine.getGameState();
      
      // Fill all foundation piles with 13 cards each
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
      suits.forEach((suit, suitIndex) => {
        gameState.foundation[suitIndex] = [];
        for (let rank = 1; rank <= 13; rank++) {
          gameState.foundation[suitIndex].push(new Card(suit, rank as any, true));
        }
      });

      engine.setGameState(gameState);
      expect(engine.checkWinCondition()).toBe(true);
    });

    it('should not detect win condition when foundation is incomplete', () => {
      const gameState = engine.getGameState();
      
      // Fill foundation piles with only 12 cards each
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
      suits.forEach((suit, suitIndex) => {
        gameState.foundation[suitIndex] = [];
        for (let rank = 1; rank <= 12; rank++) {
          gameState.foundation[suitIndex].push(new Card(suit, rank as any, true));
        }
      });

      engine.setGameState(gameState);
      expect(engine.checkWinCondition()).toBe(false);
    });
  });

  describe('Valid Moves Detection', () => {
    beforeEach(() => {
      engine.initializeGame();
    });

    it('should find valid moves from tableau to foundation', () => {
      // Set up scenario with Ace on tableau
      const gameState = engine.getGameState();
      const aceOfHearts = new Card('hearts', 1, true);
      aceOfHearts.draggable = true;
      gameState.tableau[0] = [aceOfHearts];
      engine.setGameState(gameState);

      const validMoves = engine.getValidMoves();
      const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
      
      expect(foundationMoves.length).toBeGreaterThan(0);
      expect(foundationMoves[0].cards[0].rank).toBe(1);
    });

    it('should find valid moves from waste to tableau', () => {
      // Set up scenario with compatible cards
      const gameState = engine.getGameState();
      const redSeven = new Card('hearts', 7, true);
      const blackSix = new Card('spades', 6, true);
      
      gameState.tableau[0] = [redSeven];
      gameState.waste = [blackSix];
      engine.setGameState(gameState);

      const validMoves = engine.getValidMoves();
      const wasteToTableauMoves = validMoves.filter(
        move => move.from.zone === 'waste' && move.to.zone === 'tableau'
      );
      
      expect(wasteToTableauMoves.length).toBeGreaterThan(0);
    });

    it('should find stock to waste move when stock has cards', () => {
      const validMoves = engine.getValidMoves();
      const stockMoves = validMoves.filter(move => move.from.zone === 'stock');
      
      expect(stockMoves.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-completion', () => {
    it('should auto-complete when only foundation moves remain', () => {
      // Set up a simple scenario where auto-complete should work
      const gameState = engine.getGameState();
      
      // Clear everything and set up a simple foundation move scenario
      gameState.tableau = Array(7).fill(null).map(() => []);
      gameState.foundation = Array(4).fill(null).map(() => []);
      gameState.stock = [];
      gameState.waste = [];
      
      // Put an Ace in tableau that can go to foundation
      const aceOfHearts = new Card('hearts', 1, true);
      aceOfHearts.draggable = true;
      gameState.tableau[0] = [aceOfHearts];
      
      engine.setGameState(gameState);

      // Check if valid moves are found first
      const validMoves = engine.getValidMoves();
      const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
      expect(foundationMoves.length).toBeGreaterThan(0);
      
      // Auto-complete should move the ace to foundation
      const result = engine.autoComplete();
      expect(result).toBe(true);
      
      const finalState = engine.getGameState();
      expect(finalState.foundation[0].length).toBe(1);
      expect(finalState.tableau[0].length).toBe(0);
    });
  });

  describe('Sequence Moves', () => {
    it('should move valid card sequences in tableau', () => {
      // Set up a valid sequence: Red 7, Black 6, Red 5
      const gameState = engine.getGameState();
      const redSeven = new Card('hearts', 7, true);
      const blackSix = new Card('spades', 6, true);
      const redFive = new Card('diamonds', 5, true);
      
      redSeven.draggable = true;
      blackSix.draggable = true;
      redFive.draggable = true;
      
      gameState.tableau[0] = [redSeven, blackSix, redFive];
      
      // Set up target with Black 8
      const blackEight = new Card('clubs', 8, true);
      gameState.tableau[1] = [blackEight];
      
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'tableau', index: 1 };

      // Move the red seven (should move the entire sequence)
      const newState = engine.executeMove(fromPos, toPos, redSeven);

      expect(newState.tableau[0]).toHaveLength(0);
      expect(newState.tableau[1]).toHaveLength(4); // Black 8 + sequence of 3
      expect(newState.tableau[1][1].rank).toBe(7); // Red 7
      expect(newState.tableau[1][2].rank).toBe(6); // Black 6
      expect(newState.tableau[1][3].rank).toBe(5); // Red 5
    });

    it('should NOT move invalid sequences - same color cards', () => {
      // Set up an INVALID sequence: Red 7, Red 6 (same color)
      const gameState = engine.getGameState();
      const redSeven = new Card('hearts', 7, true);
      const redSix = new Card('diamonds', 6, true); // Same color as red seven
      
      redSeven.draggable = true;
      redSix.draggable = true;
      
      gameState.tableau[0] = [redSeven, redSix]; // Invalid sequence: red 7 at bottom, red 6 on top
      
      // Set up target with Black 7 (can accept red 6, not red 7)
      const blackSeven = new Card('clubs', 7, true);
      gameState.tableau[1] = [blackSeven];
      
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      const toPos: Position = { zone: 'tableau', index: 1 };

      // Try to move the red six (top card) - should move only the single card
      const newState = engine.executeMove(fromPos, toPos, redSix);

      // Red six should move to column 1 (valid move: red 6 on black 7)
      expect(newState.tableau[1]).toHaveLength(2); // Black 7 + Red 6
      expect(newState.tableau[1][1].rank).toBe(6);
      expect(newState.tableau[1][1].suit).toBe('diamonds');
      
      // Red seven should stay in column 0 and be flipped face up
      expect(newState.tableau[0]).toHaveLength(1);
      expect(newState.tableau[0][0].rank).toBe(7);
      expect(newState.tableau[0][0].suit).toBe('hearts');
      expect(newState.tableau[0][0].faceUp).toBe(true); // Should be face up now
    });

    it('should only move the top card when trying to move from invalid sequence', () => {
      // Test the exact scenario from the user's game
      const gameState = engine.getGameState();
      const redSeven = new Card('hearts', 7, true);
      const redSix = new Card('diamonds', 6, true);
      
      redSeven.draggable = true;
      redSix.draggable = true;
      
      // Column 2: Red 7 at bottom, Red 6 on top (invalid sequence)
      gameState.tableau[1] = [redSeven, redSix];
      
      // Column 1: Black 7 (can accept red 6)
      const blackSeven = new Card('clubs', 7, true);
      gameState.tableau[0] = [blackSeven];
      
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 1 };
      const toPos: Position = { zone: 'tableau', index: 0 };

      // Try to move the red six (top card) to black seven
      const newState = engine.executeMove(fromPos, toPos, redSix);

      // Red six should move successfully
      expect(newState.tableau[0]).toHaveLength(2); // Black 7 + Red 6
      expect(newState.tableau[0][1].rank).toBe(6);
      expect(newState.tableau[0][1].suit).toBe('diamonds');
      
      // Red seven should remain in original column
      expect(newState.tableau[1]).toHaveLength(1);
      expect(newState.tableau[1][0].rank).toBe(7);
      expect(newState.tableau[1][0].suit).toBe('hearts');
      expect(newState.tableau[1][0].faceUp).toBe(true); // Should be flipped face up
    });

    it('should validate sequence moves correctly - alternating colors required', () => {
      const gameState = engine.getGameState();
      
      // Test various invalid sequences
      const testCases = [
        {
          name: 'Two red cards - invalid sequence',
          cards: [new Card('hearts', 8, true), new Card('diamonds', 7, true)],
          shouldMoveSequence: false,
          shouldMoveAtAll: true // The move itself is valid (red 8 on black 9)
        },
        {
          name: 'Two black cards - invalid sequence', 
          cards: [new Card('clubs', 9, true), new Card('spades', 8, true)],
          shouldMoveSequence: false,
          shouldMoveAtAll: false // Can't move black 9 onto black 10
        },
        {
          name: 'Wrong rank order - invalid sequence',
          cards: [new Card('hearts', 6, true), new Card('spades', 8, true)],
          shouldMoveSequence: false,
          shouldMoveAtAll: false // Can't move hearts 6 onto clubs 7
        },
        {
          name: 'Valid alternating sequence',
          cards: [new Card('hearts', 8, true), new Card('spades', 7, true), new Card('diamonds', 6, true)],
          shouldMoveSequence: true,
          shouldMoveAtAll: true
        }
      ];

      testCases.forEach((testCase, index) => {
        // Set up tableau with test sequence
        testCase.cards.forEach(card => card.draggable = true);
        gameState.tableau[0] = [...testCase.cards];
        
        // Set up target column with appropriate card
        let targetCard: Card;
        if (testCase.shouldMoveAtAll) {
          // Create a card that can accept the bottom card
          const bottomCard = testCase.cards[0];
          const targetRank = bottomCard.rank + 1;
          const targetSuit = bottomCard.isRed() ? 'clubs' : 'hearts'; // Opposite color
          targetCard = new Card(targetSuit, targetRank as any, true);
        } else {
          // Create a card that cannot accept the bottom card
          targetCard = new Card('clubs', 10, true); // Black 10 - won't accept most test cards
        }
        
        gameState.tableau[1] = [targetCard];
        engine.setGameState(gameState);

        const fromPos: Position = { zone: 'tableau', index: 0 };
        const toPos: Position = { zone: 'tableau', index: 1 };

        // Try to move the bottom card (should move sequence if valid)
        const newState = engine.executeMove(fromPos, toPos, testCase.cards[0]);

        if (!testCase.shouldMoveAtAll) {
          // Invalid move - nothing should change
          expect(newState.tableau[0]).toHaveLength(testCase.cards.length);
          expect(newState.tableau[1]).toHaveLength(1);
        } else if (testCase.shouldMoveSequence) {
          // Valid sequence should move entirely
          expect(newState.tableau[0]).toHaveLength(0);
          expect(newState.tableau[1]).toHaveLength(1 + testCase.cards.length);
        } else {
          // Invalid sequence should only move the single card
          expect(newState.tableau[0]).toHaveLength(testCase.cards.length - 1);
          expect(newState.tableau[1]).toHaveLength(2); // Target + moved card
        }
      });
    });

    it('should validate individual card moves correctly', () => {
      const gameState = engine.getGameState();
      
      // Set up test scenarios
      const redSix = new Card('diamonds', 6, true);
      const blackSeven = new Card('clubs', 7, true);
      const redSeven = new Card('hearts', 7, true);
      const blackEight = new Card('spades', 8, true);
      
      redSix.draggable = true;
      
      gameState.tableau[0] = [redSix]; // Source
      gameState.tableau[1] = [blackSeven]; // Valid target (red 6 on black 7)
      gameState.tableau[2] = [redSeven]; // Invalid target (red 6 on red 7)
      gameState.tableau[3] = [blackEight]; // Invalid target (red 6 on black 8, wrong rank)
      
      engine.setGameState(gameState);

      const fromPos: Position = { zone: 'tableau', index: 0 };
      
      // Valid move: red 6 on black 7
      const validToPos: Position = { zone: 'tableau', index: 1 };
      expect(engine.validateMove(fromPos, validToPos, redSix)).toBe(true);
      
      // Invalid move: red 6 on red 7 (same color)
      const invalidColorPos: Position = { zone: 'tableau', index: 2 };
      expect(engine.validateMove(fromPos, invalidColorPos, redSix)).toBe(false);
      
      // Invalid move: red 6 on black 8 (wrong rank)
      const invalidRankPos: Position = { zone: 'tableau', index: 3 };
      expect(engine.validateMove(fromPos, invalidRankPos, redSix)).toBe(false);
    });
  });
});