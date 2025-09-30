/**
 * Unit tests for SpiderEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpiderEngine } from '../engines/SpiderEngine';
import { Card } from '../utils/Card';
import { Position } from '../types/card';

describe('SpiderEngine', () => {
    let engine: SpiderEngine;

    beforeEach(() => {
        engine = new SpiderEngine();
    });

    describe('Game Initialization', () => {
        it('should initialize with correct game type', () => {
            expect(engine.getGameType()).toBe('spider');
        });

        it('should initialize game with 10 tableau columns', () => {
            const gameState = engine.initializeGame();
            expect(gameState.tableau).toHaveLength(10);
        });

        it('should deal cards correctly to tableau columns', () => {
            const gameState = engine.initializeGame();

            // First 4 columns should have 6 cards each
            for (let i = 0; i < 4; i++) {
                expect(gameState.tableau[i]).toHaveLength(6);
            }

            // Last 6 columns should have 5 cards each
            for (let i = 4; i < 10; i++) {
                expect(gameState.tableau[i]).toHaveLength(5);
            }
        });

        it('should have only top cards face up initially', () => {
            const gameState = engine.initializeGame();

            gameState.tableau.forEach(column => {
                column.forEach((card, index) => {
                    const isTopCard = index === column.length - 1;
                    expect(card.faceUp).toBe(isTopCard);
                });
            });
        });

        it('should have remaining cards in stock', () => {
            const gameState = engine.initializeGame();
            const totalTableauCards = gameState.tableau.reduce((sum, col) => sum + col.length, 0);
            const stockCards = gameState.stock?.length || 0;

            // Total should be 104 cards (2 decks)
            expect(totalTableauCards + stockCards).toBe(104);
            expect(stockCards).toBe(50); // 104 - 54 dealt cards
        });

        it('should initialize with empty foundation and completed sequences', () => {
            const gameState = engine.initializeGame();
            expect(gameState.foundation).toHaveLength(0);
            expect(engine.getCompletedSequencesCount()).toBe(0);
        });
    });

    describe('Move Validation', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should reject moves of face-down cards', () => {
            const gameState = engine.getGameState();
            const faceDownCard = gameState.tableau[0][0] as Card; // First card should be face down

            const from: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
            const to: Position = { zone: 'tableau', index: 1 };

            expect(engine.validateMove(from, to, faceDownCard)).toBe(false);
        });

        it('should allow moves to empty tableau columns', () => {
            // Create a scenario with an empty column
            const gameState = engine.getGameState();
            gameState.tableau[9] = []; // Empty the last column

            const sourceCard = gameState.tableau[0][gameState.tableau[0].length - 1] as Card;
            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'tableau', index: 9 };

            expect(engine.validateMove(from, to, sourceCard)).toBe(true);
        });

        it('should validate descending rank moves', () => {
            // Set up a specific scenario
            const gameState = engine.getGameState();
            const kingCard = new Card('hearts', 13, true);
            const queenCard = new Card('spades', 12, true);

            // Place king on column 0
            gameState.tableau[0] = [kingCard];
            gameState.tableau[1] = [queenCard];

            const from: Position = { zone: 'tableau', index: 1 };
            const to: Position = { zone: 'tableau', index: 0 };

            expect(engine.validateMove(from, to, queenCard)).toBe(true);
        });

        it('should reject non-descending rank moves', () => {
            const gameState = engine.getGameState();
            const kingCard = new Card('hearts', 13, true);
            const jackCard = new Card('spades', 11, true);

            // Place king on column 0
            gameState.tableau[0] = [kingCard];
            gameState.tableau[1] = [jackCard];

            const from: Position = { zone: 'tableau', index: 1 };
            const to: Position = { zone: 'tableau', index: 0 };

            expect(engine.validateMove(from, to, jackCard)).toBe(false);
        });

        it('should validate stock to tableau moves when all columns have cards', () => {
            const gameState = engine.getGameState();
            const stockCard = gameState.stock?.[0] as Card;

            const from: Position = { zone: 'stock', index: 0 };
            const to: Position = { zone: 'tableau', index: 0 };

            // All columns should have cards initially, stock moves are special case
            expect(engine.validateMove(from, to, stockCard)).toBe(true);
        });

        it('should reject stock to tableau moves when columns are empty', () => {
            const gameState = engine.getGameState();
            gameState.tableau[0] = []; // Empty a column
            const stockCard = gameState.stock?.[0] as Card;

            const from: Position = { zone: 'stock', index: 0 };
            const to: Position = { zone: 'tableau', index: 0 };

            expect(engine.validateMove(from, to, stockCard)).toBe(false);
        });
    });

    describe('Move Execution', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should move single cards between tableau columns', () => {
            const gameState = engine.getGameState();

            // Set up a valid move scenario
            const kingCard = new Card('hearts', 13, true);
            const queenCard = new Card('spades', 12, true);

            gameState.tableau[0] = [kingCard];
            gameState.tableau[1] = [queenCard];

            const from: Position = { zone: 'tableau', index: 1 };
            const to: Position = { zone: 'tableau', index: 0 };

            const newState = engine.executeMove(from, to, queenCard);

            expect(newState.tableau[0]).toHaveLength(2);
            expect(newState.tableau[1]).toHaveLength(0);
            expect(newState.tableau[0][1].rank).toBe(12);
        });

        it('should move same-suit sequences together', () => {
            const gameState = engine.getGameState();

            // Set up a same-suit sequence
            const kingCard = new Card('hearts', 13, true);
            const queenCard = new Card('hearts', 12, true);
            const jackCard = new Card('hearts', 11, true);
            const tenCard = new Card('spades', 10, true);

            gameState.tableau[0] = [kingCard];
            gameState.tableau[1] = [queenCard, jackCard, tenCard];

            const from: Position = { zone: 'tableau', index: 1 };
            const to: Position = { zone: 'tableau', index: 0 };

            // Move the queen (should move queen and jack together as same suit)
            const newState = engine.executeMove(from, to, queenCard);

            expect(newState.tableau[0]).toHaveLength(3); // King + Queen + Jack
            expect(newState.tableau[1]).toHaveLength(1); // Only Ten remains
            expect(newState.tableau[0][1].rank).toBe(12); // Queen
            expect(newState.tableau[0][2].rank).toBe(11); // Jack
        });

        it('should execute stock deals to all columns', () => {
            const initialState = engine.getGameState();
            const initialStockCount = initialState.stock?.length || 0;
            const initialColumnLengths = initialState.tableau.map(col => col.length);

            // Execute stock deal
            const stockCard = initialState.stock?.[0] as Card;
            const from: Position = { zone: 'stock', index: 0 };
            const to: Position = { zone: 'tableau', index: 0 };

            const newState = engine.executeMove(from, to, stockCard);

            // Each column should have one more card
            for (let i = 0; i < 10; i++) {
                expect(newState.tableau[i].length).toBe(initialColumnLengths[i] + 1);
            }

            // Stock should have 10 fewer cards
            expect(newState.stock?.length).toBe(initialStockCount - 10);
        });
    });

    describe('Win Condition', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should return false when no sequences are completed', () => {
            expect(engine.checkWinCondition()).toBe(false);
        });

        it('should return true when 8 sequences are completed', () => {
            // Simulate 8 completed sequences (2 decks × 4 suits)
            for (let i = 0; i < 8; i++) {
                const sequence: Card[] = [];
                for (let rank = 13; rank >= 1; rank--) {
                    sequence.push(new Card('hearts', rank as any, true));
                }
                (engine as any).completedSequences.push(sequence);
            }

            expect(engine.checkWinCondition()).toBe(true);
        });
    });

    describe('Valid Moves', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should return moves between tableau columns', () => {
            const validMoves = engine.getValidMoves();

            // Should have some valid moves initially
            expect(validMoves.length).toBeGreaterThan(0);

            // All moves should be from tableau to tableau or stock to tableau
            validMoves.forEach(move => {
                expect(['tableau', 'stock']).toContain(move.from.zone);
                expect(move.to.zone).toBe('tableau');
            });
        });

        it('should include stock deal when possible', () => {
            const validMoves = engine.getValidMoves();

            // Should include stock deal move
            const stockMoves = validMoves.filter(move => move.from.zone === 'stock');
            expect(stockMoves.length).toBeGreaterThan(0);
        });

        it('should not include stock deal when columns are empty', () => {
            const gameState = engine.getGameState();
            gameState.tableau[0] = []; // Empty a column

            const validMoves = engine.getValidMoves();

            // Should not include stock deal move
            const stockMoves = validMoves.filter(move => move.from.zone === 'stock');
            expect(stockMoves.length).toBe(0);
        });
    });

    describe('Auto Complete', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should return false when auto-complete is disabled', () => {
            const disabledEngine = new SpiderEngine({ enableAutoComplete: false });
            disabledEngine.initializeGame();

            expect(disabledEngine.autoComplete()).toBe(false);
        });

        it('should check and remove completed sequences', () => {
            const gameState = engine.getGameState();

            // Set up a complete sequence
            const completeSequence: Card[] = [];
            for (let rank = 13; rank >= 1; rank--) {
                completeSequence.push(new Card('hearts', rank as any, true));
            }

            gameState.tableau[0] = completeSequence;

            const result = engine.autoComplete();

            expect(result).toBe(true);
            expect(engine.getCompletedSequencesCount()).toBe(1);
        });
    });

    describe('Configuration', () => {
        it('should accept difficulty configuration', () => {
            const easyEngine = new SpiderEngine({ difficulty: 'easy' });
            const hardEngine = new SpiderEngine({ difficulty: 'hard' });

            expect(easyEngine.getGameType()).toBe('spider');
            expect(hardEngine.getGameType()).toBe('spider');
        });

        it('should default to medium difficulty', () => {
            const defaultEngine = new SpiderEngine();
            expect((defaultEngine as any).difficulty).toBe('medium');
        });
    });
});