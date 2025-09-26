/**
 * Base game engine class with common utilities for move validation and state management
 */

import { GameEngine, GameEngineConfig, MoveValidationResult } from '../types/game';
import { Card, Position, Move, GameState } from '../types/card';
import { Deck } from '../utils/Deck';

/**
 * Abstract base class providing common functionality for all game engines
 */
export abstract class BaseGameEngine implements GameEngine {
  protected gameState: GameState;
  protected config: GameEngineConfig;
  protected moveHistory: Move[];

  constructor(config: Partial<GameEngineConfig> = {}) {
    this.config = {
      enableAutoComplete: true,
      enableUndo: true,
      maxUndoSteps: 50,
      ...config
    };
    this.moveHistory = [];
    this.gameState = this.createInitialGameState();
  }

  // Abstract methods that must be implemented by specific game engines
  abstract initializeGame(): GameState;
  abstract validateMove(from: Position, to: Position, card: Card): boolean;
  abstract executeMove(from: Position, to: Position, card: Card): GameState;
  abstract checkWinCondition(): boolean;
  abstract getValidMoves(): Move[];
  abstract autoComplete(): boolean;
  abstract getGameType(): 'klondike' | 'spider' | 'freecell';

  /**
   * Create initial empty game state
   */
  protected createInitialGameState(): GameState {
    return {
      gameType: this.getGameType(),
      tableau: [],
      foundation: [],
      stock: [],
      waste: [],
      freeCells: [],
      moves: [],
      score: 0,
      timeStarted: new Date()
    };
  }

  /**
   * Get the current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Set the game state (for loading saved games)
   */
  setGameState(state: GameState): void {
    this.gameState = { ...state };
  }

  /**
   * Undo the last move if possible
   */
  undoMove(): boolean {
    if (!this.config.enableUndo || this.moveHistory.length === 0) {
      return false;
    }

    const lastMove = this.moveHistory.pop();
    if (!lastMove) {
      return false;
    }

    // Reverse the move by moving cards back to their original position
    this.reverseMove(lastMove);
    
    // Remove the move from game state moves array
    this.gameState.moves = this.gameState.moves.filter(
      move => move.timestamp !== lastMove.timestamp
    );

    return true;
  }

  /**
   * Reverse a move by moving cards back to their original position
   */
  protected reverseMove(move: Move): void {
    // Move cards from destination back to source
    const sourceCards = this.getCardsAtPosition(move.to);
    const cardsToMove = sourceCards.slice(-move.cards.length);
    
    // Remove cards from destination
    this.removeCardsFromPosition(move.to, move.cards.length);
    
    // Add cards back to source
    this.addCardsToPosition(move.from, cardsToMove);
  }

  /**
   * Get cards at a specific position
   */
  protected getCardsAtPosition(position: Position): Card[] {
    switch (position.zone) {
      case 'tableau':
        return this.gameState.tableau[position.index] || [];
      case 'foundation':
        return this.gameState.foundation[position.index] || [];
      case 'stock':
        return this.gameState.stock || [];
      case 'waste':
        return this.gameState.waste || [];
      case 'freecell':
        return this.gameState.freeCells ? [this.gameState.freeCells[position.index]].filter(Boolean) : [];
      default:
        return [];
    }
  }

  /**
   * Remove cards from a specific position
   */
  protected removeCardsFromPosition(position: Position, count: number): Card[] {
    const cards = this.getCardsAtPosition(position);
    return cards.splice(-count, count);
  }

  /**
   * Add cards to a specific position
   */
  protected addCardsToPosition(position: Position, cards: Card[]): void {
    switch (position.zone) {
      case 'tableau':
        if (!this.gameState.tableau[position.index]) {
          this.gameState.tableau[position.index] = [];
        }
        this.gameState.tableau[position.index].push(...cards);
        break;
      case 'foundation':
        if (!this.gameState.foundation[position.index]) {
          this.gameState.foundation[position.index] = [];
        }
        this.gameState.foundation[position.index].push(...cards);
        break;
      case 'stock':
        if (!this.gameState.stock) {
          this.gameState.stock = [];
        }
        this.gameState.stock.push(...cards);
        break;
      case 'waste':
        if (!this.gameState.waste) {
          this.gameState.waste = [];
        }
        this.gameState.waste.push(...cards);
        break;
      case 'freecell':
        if (!this.gameState.freeCells) {
          this.gameState.freeCells = [];
        }
        if (cards.length === 1) {
          this.gameState.freeCells[position.index] = cards[0];
        }
        break;
    }
  }

  /**
   * Record a move in the move history
   */
  protected recordMove(move: Move): void {
    this.moveHistory.push(move);
    this.gameState.moves.push(move);

    // Limit move history size
    if (this.moveHistory.length > this.config.maxUndoSteps) {
      this.moveHistory.shift();
    }
  }

  /**
   * Check if a position is empty
   */
  protected isPositionEmpty(position: Position): boolean {
    const cards = this.getCardsAtPosition(position);
    return cards.length === 0;
  }

  /**
   * Get the top card at a position
   */
  protected getTopCard(position: Position): Card | null {
    const cards = this.getCardsAtPosition(position);
    return cards.length > 0 ? cards[cards.length - 1] : null;
  }

  /**
   * Check if cards can be moved as a sequence
   */
  protected canMoveSequence(cards: Card[]): boolean {
    if (cards.length <= 1) {
      return true;
    }

    for (let i = 0; i < cards.length - 1; i++) {
      if (!cards[i + 1].canStackOn(cards[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Create a new deck and shuffle it
   */
  protected createShuffledDeck(): Deck {
    const deck = new Deck();
    deck.shuffle();
    return deck;
  }

  /**
   * Update card positions after a move
   */
  protected updateCardPositions(): void {
    // Update tableau positions
    this.gameState.tableau.forEach((column, columnIndex) => {
      column.forEach((card, cardIndex) => {
        card.setPosition({
          zone: 'tableau',
          index: columnIndex,
          cardIndex: cardIndex
        });
      });
    });

    // Update foundation positions
    this.gameState.foundation.forEach((pile, pileIndex) => {
      pile.forEach((card, cardIndex) => {
        card.setPosition({
          zone: 'foundation',
          index: pileIndex,
          cardIndex: cardIndex
        });
      });
    });

    // Update stock positions
    if (this.gameState.stock) {
      this.gameState.stock.forEach((card, cardIndex) => {
        card.setPosition({
          zone: 'stock',
          index: 0,
          cardIndex: cardIndex
        });
      });
    }

    // Update waste positions
    if (this.gameState.waste) {
      this.gameState.waste.forEach((card, cardIndex) => {
        card.setPosition({
          zone: 'waste',
          index: 0,
          cardIndex: cardIndex
        });
      });
    }

    // Update free cell positions
    if (this.gameState.freeCells) {
      this.gameState.freeCells.forEach((card, cellIndex) => {
        if (card) {
          card.setPosition({
            zone: 'freecell',
            index: cellIndex,
            cardIndex: 0
          });
        }
      });
    }
  }
}