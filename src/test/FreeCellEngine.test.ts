/**
 * Unit tests for FreeCellEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FreeCellEngine } from '../engines/FreeCellEngine';
import { Card } from '../utils/Card';
import { Position } from '../types/card';

describe('FreeCellEngine', () => {
    let engine: FreeCellEngine;

    beforeEach(() => {
        engine = new FreeCellEngine();
    });

    describe('Game Initialization', () => {
        it('should initialize a new FreeCell game correctly', () => {
            const gameState = engine.initializeGame();

            expect(gameState.gameType).toBe('freecell');
            expect(gameState.tableau).toHaveLength(8);
            expect(gameState.foundation).toHaveLength(4);
            expect(gameState.freeCells).toBeDefined();
            expect(gameState.moves).toHaveLength(0);
            expect(gameState.score).toBe(0);

            // Check card distribution: first 4 columns have 7 cards, last 4 have 6 cards
            for (let i = 0; i < 4; i++) {
                expect(gameState.tableau[i]).toHaveLength(7);
            }
            for (let i = 4; i < 8; i++) {
                expect(gameState.tableau[i]).toHaveLength(6);
            }

            // All cards should be face up
            gameState.tableau.forEach(column => {
                column.forEach(card => {
                    expect(card.faceUp).toBe(true);
                });
            });

            // All foundation piles should be empty
            gameState.foundation.forEach(pile => {
                expect(pile).toHaveLength(0);
            });

            // All free cells should be empty
            expect(gameState.freeCells).toHaveLength(0);

            // Total cards should be 52
            const totalCards = gameState.tableau.reduce((sum, column) => sum + column.length, 0);
            expect(totalCards).toBe(52);
        });

        it('should return correct game type', () => {
            expect(engine.getGameType()).toBe('freecell');
        });
    });

    describe('Move Validation', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        describe('Foundation Moves', () => {
            it('should allow Ace to be placed on empty foundation', () => {
                // Set up tableau with Ace
                const gameState = engine.getGameState();
                const ace = new Card('hearts', 1, true);
                gameState.tableau[0] = [ace];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'foundation', index: 0 };

                const isValid = engine.validateMove(from, to, ace);
                expect(isValid).toBe(true);
            });

            it('should not allow non-Ace to be placed on empty foundation', () => {
                // Set up tableau with King
                const gameState = engine.getGameState();
                const king = new Card('hearts', 13, true);
                gameState.tableau[0] = [king];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'foundation', index: 0 };

                const isValid = engine.validateMove(from, to, king);
                expect(isValid).toBe(false);
            });

            it('should allow sequential same-suit card on foundation', () => {
                // Set up foundation with Ace of hearts and tableau with Two of hearts
                const gameState = engine.getGameState();
                const ace = new Card('hearts', 1, true);
                const two = new Card('hearts', 2, true);
                gameState.foundation[0].push(ace);
                gameState.tableau[0] = [two];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'foundation', index: 0 };

                const isValid = engine.validateMove(from, to, two);
                expect(isValid).toBe(true);
            });

            it('should not allow wrong suit on foundation', () => {
                // Set up foundation with Ace of hearts and tableau with Two of spades
                const gameState = engine.getGameState();
                const ace = new Card('hearts', 1, true);
                const twoOfSpades = new Card('spades', 2, true);
                gameState.foundation[0].push(ace);
                gameState.tableau[0] = [twoOfSpades];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'foundation', index: 0 };

                const isValid = engine.validateMove(from, to, twoOfSpades);
                expect(isValid).toBe(false);
            });

            it('should not allow non-sequential rank on foundation', () => {
                // Set up foundation with Ace of hearts and tableau with Three of hearts
                const gameState = engine.getGameState();
                const ace = new Card('hearts', 1, true);
                const three = new Card('hearts', 3, true);
                gameState.foundation[0].push(ace);
                gameState.tableau[0] = [three];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'foundation', index: 0 };

                const isValid = engine.validateMove(from, to, three);
                expect(isValid).toBe(false);
            });
        });

        describe('Tableau Moves', () => {
            it('should allow any card on empty tableau column', () => {
                // Set up tableau with King in column 1 and empty column 0
                const gameState = engine.getGameState();
                const king = new Card('hearts', 13, true);
                gameState.tableau[0] = [];
                gameState.tableau[1] = [king];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 1 };
                const to: Position = { zone: 'tableau', index: 0 };

                const isValid = engine.validateMove(from, to, king);
                expect(isValid).toBe(true);
            });

            it('should allow alternating color descending rank on tableau', () => {
                // Set up tableau with red King in column 0 and black Queen in column 1
                const gameState = engine.getGameState();
                const redKing = new Card('hearts', 13, true);
                const blackQueen = new Card('spades', 12, true);
                gameState.tableau[0] = [redKing];
                gameState.tableau[1] = [blackQueen];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 1 };
                const to: Position = { zone: 'tableau', index: 0 };

                const isValid = engine.validateMove(from, to, blackQueen);
                expect(isValid).toBe(true);
            });

            it('should not allow same color on tableau', () => {
                // Set up tableau with red King in column 0 and red Queen in column 1
                const gameState = engine.getGameState();
                const redKing = new Card('hearts', 13, true);
                const redQueen = new Card('diamonds', 12, true);
                gameState.tableau[0] = [redKing];
                gameState.tableau[1] = [redQueen];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 1 };
                const to: Position = { zone: 'tableau', index: 0 };

                const isValid = engine.validateMove(from, to, redQueen);
                expect(isValid).toBe(false);
            });

            it('should not allow non-descending rank on tableau', () => {
                // Set up tableau with red King in column 0 and black Jack in column 1
                const gameState = engine.getGameState();
                const redKing = new Card('hearts', 13, true);
                const blackJack = new Card('spades', 11, true);
                gameState.tableau[0] = [redKing];
                gameState.tableau[1] = [blackJack];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 1 };
                const to: Position = { zone: 'tableau', index: 0 };

                const isValid = engine.validateMove(from, to, blackJack);
                expect(isValid).toBe(false);
            });
        });

        describe('Free Cell Moves', () => {
            it('should allow card to be placed in empty free cell', () => {
                // Set up tableau with card
                const gameState = engine.getGameState();
                const card = new Card('hearts', 5, true);
                gameState.tableau[0] = [card];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'freecell', index: 0 };

                const isValid = engine.validateMove(from, to, card);
                expect(isValid).toBe(true);
            });

            it('should not allow card to be placed in occupied free cell', () => {
                // Set up occupied free cell and tableau with card
                const gameState = engine.getGameState();
                const existingCard = new Card('spades', 7, true);
                const card = new Card('hearts', 5, true);
                if (!gameState.freeCells) gameState.freeCells = [];
                gameState.freeCells[0] = existingCard;
                gameState.tableau[0] = [card];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'freecell', index: 0 };

                const isValid = engine.validateMove(from, to, card);
                expect(isValid).toBe(false);
            });
        });

        describe('Source Position Validation', () => {
            it('should not allow moving face-down cards', () => {
                // Set up tableau with face-down card
                const gameState = engine.getGameState();
                const faceDownCard = new Card('hearts', 5, false);
                gameState.tableau[0] = [faceDownCard];
                engine.setGameState(gameState);

                const from: Position = { zone: 'tableau', index: 0 };
                const to: Position = { zone: 'freecell', index: 0 };

                const isValid = engine.validateMove(from, to, faceDownCard);
                expect(isValid).toBe(false);
            });

            it('should allow moving from free cell', () => {
                // Set up card in free cell and empty tableau column
                const gameState = engine.getGameState();
                const card = new Card('hearts', 5, true);
                if (!gameState.freeCells) gameState.freeCells = [];
                gameState.freeCells[0] = card;
                gameState.tableau[1] = []; // Empty column to move to
                engine.setGameState(gameState);

                const from: Position = { zone: 'freecell', index: 0 };
                const to: Position = { zone: 'tableau', index: 1 };

                const isValid = engine.validateMove(from, to, card);
                expect(isValid).toBe(true);
            });
        });
    });

    describe('Move Execution', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should execute valid move and update game state', () => {
            // Set up a simple valid move scenario
            const gameState = engine.getGameState();
            const ace = new Card('hearts', 1, true);
            gameState.tableau[0] = [ace];
            engine.setGameState(gameState);

            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'foundation', index: 0 };

            const newGameState = engine.executeMove(from, to, ace);

            expect(newGameState.tableau[0]).toHaveLength(0);
            expect(newGameState.foundation[0]).toHaveLength(1);
            expect(newGameState.foundation[0][0].id).toBe(ace.id);
            expect(newGameState.moves).toHaveLength(1);
            expect(newGameState.score).toBeGreaterThan(0);
        });

        it('should not execute invalid move', () => {
            const gameState = engine.getGameState();
            const king = new Card('hearts', 13, true);
            gameState.tableau[0] = [king];
            engine.setGameState(gameState);

            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'foundation', index: 0 };

            const newGameState = engine.executeMove(from, to, king);

            // State should remain unchanged
            expect(newGameState.tableau[0]).toHaveLength(1);
            expect(newGameState.foundation[0]).toHaveLength(0);
            expect(newGameState.moves).toHaveLength(0);
        });

        it('should move card to free cell', () => {
            const gameState = engine.getGameState();
            const card = new Card('hearts', 5, true);
            gameState.tableau[0] = [card];
            engine.setGameState(gameState);

            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'freecell', index: 0 };

            const newGameState = engine.executeMove(from, to, card);

            expect(newGameState.tableau[0]).toHaveLength(0);
            expect(newGameState.freeCells?.[0]?.id).toBe(card.id);
            expect(newGameState.moves).toHaveLength(1);
        });
    });

    describe('Win Condition', () => {
        it('should return false for incomplete game', () => {
            engine.initializeGame();
            expect(engine.checkWinCondition()).toBe(false);
        });

        it('should return true when all cards are in foundation', () => {
            engine.initializeGame();
            const gameState = engine.getGameState();

            // Fill all foundation piles with 13 cards each
            for (let suit = 0; suit < 4; suit++) {
                for (let rank = 1; rank <= 13; rank++) {
                    const suitName = ['hearts', 'diamonds', 'clubs', 'spades'][suit] as 'hearts' | 'diamonds' | 'clubs' | 'spades';
                    const card = new Card(suitName, rank as any, true);
                    gameState.foundation[suit].push(card);
                }
            }

            // Clear tableau
            gameState.tableau = Array(8).fill(null).map(() => []);
            engine.setGameState(gameState);

            expect(engine.checkWinCondition()).toBe(true);
        });
    });

    describe('Valid Moves', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should find valid moves from tableau to foundation', () => {
            // Set up tableau with Ace
            const gameState = engine.getGameState();
            const ace = new Card('hearts', 1, true);
            gameState.tableau[0] = [ace];
            engine.setGameState(gameState);

            const validMoves = engine.getValidMoves();
            const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');

            expect(foundationMoves.length).toBeGreaterThan(0);
        });

        it('should find valid moves from tableau to free cells', () => {
            const validMoves = engine.getValidMoves();
            const freeCellMoves = validMoves.filter(move => move.to.zone === 'freecell');

            // Should be able to move top cards to free cells
            expect(freeCellMoves.length).toBeGreaterThan(0);
        });

        it('should find valid moves between tableau columns', () => {
            // Set up a scenario where tableau moves are possible
            const gameState = engine.getGameState();
            const redKing = new Card('hearts', 13, true);
            const blackQueen = new Card('spades', 12, true);
            gameState.tableau[0] = [redKing];
            gameState.tableau[1] = [blackQueen];
            engine.setGameState(gameState);

            const validMoves = engine.getValidMoves();
            const tableauMoves = validMoves.filter(move => 
                move.from.zone === 'tableau' && move.to.zone === 'tableau'
            );

            // Should find the valid tableau move (Queen on King)
            expect(tableauMoves.length).toBeGreaterThan(0);
        });
    });

    describe('Auto Complete', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should attempt auto-complete when enabled', () => {
            const result = engine.autoComplete();
            // Result depends on the random deal, but should not throw
            expect(typeof result).toBe('boolean');
        });

        it('should not auto-complete when disabled', () => {
            const disabledEngine = new FreeCellEngine({ enableAutoComplete: false });
            disabledEngine.initializeGame();
            
            const result = disabledEngine.autoComplete();
            expect(result).toBe(false);
        });
    });

    describe('Sequence Movement', () => {
        it('should calculate max movable cards correctly', () => {
            const gameState = engine.getGameState();
            
            // Clear some tableau columns for testing
            gameState.tableau[0] = [];
            gameState.tableau[1] = [];
            
            // Set up some occupied free cells to test the calculation
            if (!gameState.freeCells) gameState.freeCells = [];
            gameState.freeCells[0] = new Card('hearts', 5, true);
            gameState.freeCells[1] = new Card('spades', 7, true);
            // Leave free cells 2 and 3 empty
            
            engine.setGameState(gameState);

            // With 2 empty free cells and 2 empty tableau columns:
            // Max movable = (1 + 2) * 2^2 = 3 * 4 = 12
            const maxMovable = engine['calculateMaxMovableCards']();
            expect(maxMovable).toBe(12);
        });

        it('should move valid sequences when possible', () => {
            const gameState = engine.getGameState();
            
            // Set up a valid sequence: Black King, Red Queen, Black Jack
            const blackKing = new Card('spades', 13, true);
            const redQueen = new Card('hearts', 12, true);
            const blackJack = new Card('clubs', 11, true);
            
            gameState.tableau[0] = [blackKing, redQueen, blackJack];
            gameState.tableau[1] = []; // Empty column for moving to
            engine.setGameState(gameState);

            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'tableau', index: 1 };

            // Should be able to move just the King (since the sequence validation might be strict)
            const isValid = engine.validateMove(from, to, blackKing);
            expect(isValid).toBe(true);

            const newGameState = engine.executeMove(from, to, blackKing);
            expect(newGameState.tableau[0]).toHaveLength(0); // All cards moved
            expect(newGameState.tableau[1]).toHaveLength(3); // All 3 cards moved
        });
    });

    describe('Debug Methods', () => {
        beforeEach(() => {
            engine.initializeGame();
        });

        it('should provide detailed validation information', () => {
            const card = new Card('hearts', 13, true);
            const from: Position = { zone: 'tableau', index: 0 };
            const to: Position = { zone: 'foundation', index: 0 };

            const debugInfo = engine.debugValidateMove(from, to, card);
            
            expect(debugInfo).toHaveProperty('isValid');
            expect(debugInfo).toHaveProperty('reason');
            expect(typeof debugInfo.isValid).toBe('boolean');
            expect(typeof debugInfo.reason).toBe('string');
        });

        it('should count empty free cells correctly', () => {
            const count = engine.getEmptyFreeCellsCount();
            expect(count).toBe(4); // All free cells should be empty initially
        });

        it('should count empty tableau columns correctly', () => {
            const count = engine.getEmptyTableauColumnsCount();
            expect(count).toBe(0); // No empty columns initially
        });
    });
});