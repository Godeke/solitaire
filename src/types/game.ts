/**
 * Game engine interfaces and types for the solitaire game collection
 */

import { Card, Position, Move, GameState } from './card';

/**
 * Base interface that all game engines must implement
 */
export interface GameEngine {
  /**
   * Initialize a new game with shuffled cards
   */
  initializeGame(): GameState;

  /**
   * Validate if a move is legal according to the game's rules
   */
  validateMove(from: Position, to: Position, card: Card): boolean;

  /**
   * Execute a move and return the new game state
   */
  executeMove(from: Position, to: Position, card: Card): GameState;

  /**
   * Check if the current game state represents a win condition
   */
  checkWinCondition(): boolean;

  /**
   * Get all valid moves available in the current state
   */
  getValidMoves(): Move[];

  /**
   * Attempt to auto-complete the game if possible
   */
  autoComplete(): boolean;

  /**
   * Get the current game state
   */
  getGameState(): GameState;

  /**
   * Set the game state (for loading saved games)
   */
  setGameState(state: GameState): void;

  /**
   * Undo the last move if possible
   */
  undoMove(): boolean;

  /**
   * Get the game type identifier
   */
  getGameType(): 'klondike' | 'spider' | 'freecell';
}

/**
 * Configuration options for game engines
 */
export interface GameEngineConfig {
  enableAutoComplete: boolean;
  enableUndo: boolean;
  maxUndoSteps: number;
  dealCount?: number; // For games like Klondike (1 or 3 card deal)
  difficulty?: 'easy' | 'medium' | 'hard'; // For games like Spider
}

/**
 * Result of a move validation
 */
export interface MoveValidationResult {
  isValid: boolean;
  reason?: string;
  suggestedMove?: Move;
}

/**
 * Game statistics for tracking performance
 */
export interface GameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  bestTime: number;
  currentStreak: number;
  longestStreak: number;
  totalTime: number;
  averageTime: number;
}