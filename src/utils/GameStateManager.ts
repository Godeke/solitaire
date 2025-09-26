/**
 * Game state serialization and deserialization utilities
 */

import { GameState, Card, Position, Move } from '../types/card';
import { Card as CardClass } from './Card';

/**
 * Serializable version of GameState for storage
 */
interface SerializableGameState {
  gameType: 'klondike' | 'spider' | 'freecell';
  tableau: SerializableCard[][];
  foundation: SerializableCard[][];
  stock?: SerializableCard[];
  waste?: SerializableCard[];
  freeCells?: (SerializableCard | null)[];
  moves: SerializableMove[];
  score: number;
  timeStarted: string; // ISO string
}

/**
 * Serializable version of Card for storage
 */
interface SerializableCard {
  suit: string;
  rank: number;
  faceUp: boolean;
  id: string;
  position: Position;
  draggable: boolean;
}

/**
 * Serializable version of Move for storage
 */
interface SerializableMove {
  from: Position;
  to: Position;
  cards: SerializableCard[];
  timestamp: string; // ISO string
  autoMove: boolean;
}

/**
 * Manager class for game state persistence
 */
export class GameStateManager {
  private static readonly STORAGE_KEY_PREFIX = 'solitaire_game_';
  private static readonly STATISTICS_KEY = 'solitaire_statistics';

  /**
   * Serialize a GameState to a JSON string
   */
  static serialize(gameState: GameState): string {
    const serializable: SerializableGameState = {
      gameType: gameState.gameType,
      tableau: gameState.tableau.map(column => 
        column.map(card => this.serializeCard(card))
      ),
      foundation: gameState.foundation.map(pile => 
        pile.map(card => this.serializeCard(card))
      ),
      stock: gameState.stock?.map(card => this.serializeCard(card)),
      waste: gameState.waste?.map(card => this.serializeCard(card)),
      freeCells: gameState.freeCells?.map(card => 
        card ? this.serializeCard(card) : null
      ),
      moves: gameState.moves.map(move => this.serializeMove(move)),
      score: gameState.score,
      timeStarted: gameState.timeStarted.toISOString()
    };

    return JSON.stringify(serializable);
  }

  /**
   * Deserialize a JSON string to a GameState
   */
  static deserialize(jsonString: string): GameState {
    const serializable: SerializableGameState = JSON.parse(jsonString);

    return {
      gameType: serializable.gameType,
      tableau: serializable.tableau.map(column => 
        column.map(card => this.deserializeCard(card))
      ),
      foundation: serializable.foundation.map(pile => 
        pile.map(card => this.deserializeCard(card))
      ),
      stock: serializable.stock?.map(card => this.deserializeCard(card)),
      waste: serializable.waste?.map(card => this.deserializeCard(card)),
      freeCells: serializable.freeCells?.map(card => 
        card ? this.deserializeCard(card) : null
      ) as Card[],
      moves: serializable.moves.map(move => this.deserializeMove(move)),
      score: serializable.score,
      timeStarted: new Date(serializable.timeStarted)
    };
  }

  /**
   * Save game state to local storage
   */
  static saveGameState(gameState: GameState): boolean {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${gameState.gameType}`;
      const serialized = this.serialize(gameState);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Failed to save game state:', error);
      return false;
    }
  }

  /**
   * Load game state from local storage
   */
  static loadGameState(gameType: 'klondike' | 'spider' | 'freecell'): GameState | null {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${gameType}`;
      const serialized = localStorage.getItem(key);
      
      if (!serialized) {
        return null;
      }

      return this.deserialize(serialized);
    } catch (error) {
      console.error('Failed to load game state:', error);
      return null;
    }
  }

  /**
   * Clear saved game state for a specific game type
   */
  static clearGameState(gameType: 'klondike' | 'spider' | 'freecell'): void {
    const key = `${this.STORAGE_KEY_PREFIX}${gameType}`;
    localStorage.removeItem(key);
  }

  /**
   * Check if a saved game state exists for a game type
   */
  static hasSavedGameState(gameType: 'klondike' | 'spider' | 'freecell'): boolean {
    const key = `${this.STORAGE_KEY_PREFIX}${gameType}`;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get all saved game types
   */
  static getSavedGameTypes(): ('klondike' | 'spider' | 'freecell')[] {
    const gameTypes: ('klondike' | 'spider' | 'freecell')[] = ['klondike', 'spider', 'freecell'];
    return gameTypes.filter(type => this.hasSavedGameState(type));
  }

  /**
   * Serialize a Card to a plain object
   */
  private static serializeCard(card: Card): SerializableCard {
    return {
      suit: card.suit,
      rank: card.rank,
      faceUp: card.faceUp,
      id: card.id,
      position: { ...card.position },
      draggable: card.draggable
    };
  }

  /**
   * Deserialize a plain object to a Card
   */
  private static deserializeCard(serializable: SerializableCard): Card {
    const card = new CardClass(
      serializable.suit as any,
      serializable.rank as any,
      serializable.faceUp
    );
    
    card.id = serializable.id;
    card.position = { ...serializable.position };
    card.draggable = serializable.draggable;
    
    return card;
  }

  /**
   * Serialize a Move to a plain object
   */
  private static serializeMove(move: Move): SerializableMove {
    return {
      from: { ...move.from },
      to: { ...move.to },
      cards: move.cards.map(card => this.serializeCard(card)),
      timestamp: move.timestamp.toISOString(),
      autoMove: move.autoMove
    };
  }

  /**
   * Deserialize a plain object to a Move
   */
  private static deserializeMove(serializable: SerializableMove): Move {
    return {
      from: { ...serializable.from },
      to: { ...serializable.to },
      cards: serializable.cards.map(card => this.deserializeCard(card)),
      timestamp: new Date(serializable.timestamp),
      autoMove: serializable.autoMove
    };
  }

  /**
   * Create a deep copy of a game state
   */
  static cloneGameState(gameState: GameState): GameState {
    return this.deserialize(this.serialize(gameState));
  }

  /**
   * Validate that a game state has the required structure
   */
  static validateGameState(gameState: any): gameState is GameState {
    if (!gameState || typeof gameState !== 'object') {
      return false;
    }

    const required = ['gameType', 'tableau', 'foundation', 'moves', 'score', 'timeStarted'];
    
    for (const field of required) {
      if (!(field in gameState)) {
        return false;
      }
    }

    // Validate game type
    if (!['klondike', 'spider', 'freecell'].includes(gameState.gameType)) {
      return false;
    }

    // Validate arrays
    if (!Array.isArray(gameState.tableau) || !Array.isArray(gameState.foundation) || !Array.isArray(gameState.moves)) {
      return false;
    }

    // Validate date
    if (!(gameState.timeStarted instanceof Date) && typeof gameState.timeStarted !== 'string') {
      return false;
    }

    return true;
  }
}