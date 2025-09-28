/**
 * Game State Snapshot System
 * Provides functionality to create, serialize, and compare game state snapshots
 * for debugging and replay functionality
 */

import { GameState, Card, Position } from '../types/card';
import { GameStateSnapshot, CardSnapshot } from '../types/UIActionLogging';
import { RendererLogger } from './RendererLogger';

/**
 * Utility class for creating and managing game state snapshots
 */
export class GameStateSnapshotManager {
  private static sequenceCounter = 0;


  /**
   * Create a complete game state snapshot from current game state
   */
  static createSnapshot(
    gameState: GameState,
    reason: string,
    triggeredBy: string
  ): GameStateSnapshot {
    try {
      const logger = RendererLogger.getInstance();
      const timestamp = new Date().toISOString();
      
      const snapshot: GameStateSnapshot = {
        timestamp,
        gameType: gameState.gameType,
        tableau: gameState.tableau.map(column => 
          column.map(card => this.createCardSnapshot(card))
        ),
        foundation: gameState.foundation.map(pile => 
          pile.map(card => this.createCardSnapshot(card))
        ),
        stock: gameState.stock?.map(card => this.createCardSnapshot(card)),
        waste: gameState.waste?.map(card => this.createCardSnapshot(card)),
        freeCells: Array.isArray(gameState.freeCells)
          ? gameState.freeCells
              .map(cell => (cell ? this.createCardSnapshot(cell) : null))
              .filter((card): card is CardSnapshot => card !== null)
          : undefined,
        score: gameState.score,
        moveCount: gameState.moves.length,
        gameStartTime: gameState.timeStarted.toISOString(),
        metadata: {
          snapshotReason: reason,
          triggeredBy: triggeredBy,
          sequenceNumber: ++this.sequenceCounter
        }
      };

      logger.info('GAME', `${gameState.gameType}: Game state snapshot created`, {
        reason,
        triggeredBy,
        sequenceNumber: snapshot.metadata.sequenceNumber,
        cardCount: this.countCardsInSnapshot(snapshot)
      });

      return snapshot;
    } catch (error) {
      RendererLogger.getInstance().error('ERROR', 'GameStateSnapshotManager.createSnapshot', {
        error: error instanceof Error ? error.message : error,
        reason,
        triggeredBy,
        gameType: gameState.gameType
      });
      throw error;
    }
  }

  /**
   * Create a card snapshot from a Card object
   */
  static createCardSnapshot(card: Card): CardSnapshot {
    return {
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      faceUp: card.faceUp,
      draggable: card.draggable,
      position: {
        x: card.position?.cardIndex ?? 0,
        y: card.position?.index ?? 0,
        zone: card.position?.zone ?? 'unknown'
      }
    };
  }

  /**
   * Serialize a game state snapshot to JSON string
   */
  static serializeSnapshot(snapshot: GameStateSnapshot): string {
    try {
      return JSON.stringify(snapshot, null, 2);
    } catch (error) {
      RendererLogger.getInstance().error('ERROR', 'GameStateSnapshotManager.serializeSnapshot', {
        error: error instanceof Error ? error.message : error,
        snapshotId: snapshot.metadata.sequenceNumber
      });
      throw new Error(`Failed to serialize snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Deserialize a JSON string to game state snapshot
   */
  static deserializeSnapshot(serializedSnapshot: string): GameStateSnapshot {
    try {
      const snapshot = JSON.parse(serializedSnapshot) as GameStateSnapshot;
      
      // Validate the deserialized snapshot
      if (!this.validateSnapshot(snapshot)) {
        throw new Error('Invalid snapshot structure after deserialization');
      }

      return snapshot;
    } catch (error) {
      RendererLogger.getInstance().error('ERROR', 'GameStateSnapshotManager.deserializeSnapshot', {
        error: error instanceof Error ? error.message : error
      });
      throw new Error(`Failed to deserialize snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Compare two game state snapshots for differences
   */
  static compareSnapshots(
    snapshot1: GameStateSnapshot,
    snapshot2: GameStateSnapshot
  ): SnapshotComparison {
    const differences: SnapshotDifference[] = [];

    // Compare basic properties
    if (snapshot1.gameType !== snapshot2.gameType) {
      differences.push({
        type: 'gameType',
        path: 'gameType',
        value1: snapshot1.gameType,
        value2: snapshot2.gameType
      });
    }

    if (snapshot1.score !== snapshot2.score) {
      differences.push({
        type: 'score',
        path: 'score',
        value1: snapshot1.score,
        value2: snapshot2.score
      });
    }

    if (snapshot1.moveCount !== snapshot2.moveCount) {
      differences.push({
        type: 'moveCount',
        path: 'moveCount',
        value1: snapshot1.moveCount,
        value2: snapshot2.moveCount
      });
    }

    // Compare tableau
    differences.push(...this.compareCardArrays(
      snapshot1.tableau,
      snapshot2.tableau,
      'tableau'
    ));

    // Compare foundation
    differences.push(...this.compareCardArrays(
      snapshot1.foundation,
      snapshot2.foundation,
      'foundation'
    ));

    // Compare stock
    if (snapshot1.stock || snapshot2.stock) {
      differences.push(...this.compareCardArrays(
        [snapshot1.stock || []],
        [snapshot2.stock || []],
        'stock'
      ));
    }

    // Compare waste
    if (snapshot1.waste || snapshot2.waste) {
      differences.push(...this.compareCardArrays(
        [snapshot1.waste || []],
        [snapshot2.waste || []],
        'waste'
      ));
    }

    // Compare freeCells
    if (snapshot1.freeCells || snapshot2.freeCells) {
      differences.push(...this.compareCardArrays(
        [snapshot1.freeCells || []],
        [snapshot2.freeCells || []],
        'freeCells'
      ));
    }

    return {
      areEqual: differences.length === 0,
      differences,
      summary: this.createComparisonSummary(differences)
    };
  }

  /**
   * Validate snapshot structure and data integrity
   */
  static validateSnapshot(snapshot: any): snapshot is GameStateSnapshot {
    if (!snapshot || typeof snapshot !== 'object') {
      return false;
    }

    // Check required properties
    const requiredProps = [
      'timestamp', 'gameType', 'tableau', 'foundation', 
      'score', 'moveCount', 'gameStartTime', 'metadata'
    ];

    for (const prop of requiredProps) {
      if (!(prop in snapshot)) {
        return false;
      }
    }

    // Validate game type
    if (!['klondike', 'spider', 'freecell'].includes(snapshot.gameType)) {
      return false;
    }

    // Validate arrays
    if (!Array.isArray(snapshot.tableau) || !Array.isArray(snapshot.foundation)) {
      return false;
    }

    // Validate metadata
    if (!snapshot.metadata || typeof snapshot.metadata !== 'object') {
      return false;
    }

    const metadataProps = ['snapshotReason', 'triggeredBy', 'sequenceNumber'];
    for (const prop of metadataProps) {
      if (!(prop in snapshot.metadata)) {
        return false;
      }
    }

    // Validate card snapshots in tableau and foundation
    for (const column of snapshot.tableau) {
      if (!Array.isArray(column)) return false;
      for (const card of column) {
        if (!this.validateCardSnapshot(card)) return false;
      }
    }

    for (const pile of snapshot.foundation) {
      if (!Array.isArray(pile)) return false;
      for (const card of pile) {
        if (!this.validateCardSnapshot(card)) return false;
      }
    }

    return true;
  }

  /**
   * Validate card snapshot structure
   */
  private static validateCardSnapshot(card: any): card is CardSnapshot {
    if (!card || typeof card !== 'object') {
      return false;
    }

    const requiredProps = ['id', 'suit', 'rank', 'faceUp', 'draggable', 'position'];
    for (const prop of requiredProps) {
      if (!(prop in card)) {
        return false;
      }
    }

    // Validate suit
    if (!['hearts', 'diamonds', 'clubs', 'spades'].includes(card.suit)) {
      return false;
    }

    // Validate rank
    if (typeof card.rank !== 'number' || card.rank < 1 || card.rank > 13) {
      return false;
    }

    // Validate position
    if (!card.position || typeof card.position !== 'object') {
      return false;
    }

    if (typeof card.position.x !== 'number' || typeof card.position.y !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Compare arrays of card snapshots
   */
  private static compareCardArrays(
    array1: CardSnapshot[][],
    array2: CardSnapshot[][],
    path: string
  ): SnapshotDifference[] {
    const differences: SnapshotDifference[] = [];

    const maxLength = Math.max(array1.length, array2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const column1 = array1[i] || [];
      const column2 = array2[i] || [];
      
      if (column1.length !== column2.length) {
        differences.push({
          type: 'arrayLength',
          path: `${path}[${i}].length`,
          value1: column1.length,
          value2: column2.length
        });
      }

      const maxCardLength = Math.max(column1.length, column2.length);
      for (let j = 0; j < maxCardLength; j++) {
        const card1 = column1[j];
        const card2 = column2[j];

        if (!card1 && card2) {
          differences.push({
            type: 'cardMissing',
            path: `${path}[${i}][${j}]`,
            value1: null,
            value2: card2.id
          });
        } else if (card1 && !card2) {
          differences.push({
            type: 'cardExtra',
            path: `${path}[${i}][${j}]`,
            value1: card1.id,
            value2: null
          });
        } else if (card1 && card2) {
          const cardDiffs = this.compareCardSnapshots(card1, card2, `${path}[${i}][${j}]`);
          differences.push(...cardDiffs);
        }
      }
    }

    return differences;
  }

  /**
   * Compare two card snapshots
   */
  private static compareCardSnapshots(
    card1: CardSnapshot,
    card2: CardSnapshot,
    path: string
  ): SnapshotDifference[] {
    const differences: SnapshotDifference[] = [];

    if (card1.id !== card2.id) {
      differences.push({
        type: 'cardId',
        path: `${path}.id`,
        value1: card1.id,
        value2: card2.id
      });
    }

    if (card1.suit !== card2.suit) {
      differences.push({
        type: 'cardSuit',
        path: `${path}.suit`,
        value1: card1.suit,
        value2: card2.suit
      });
    }

    if (card1.rank !== card2.rank) {
      differences.push({
        type: 'cardRank',
        path: `${path}.rank`,
        value1: card1.rank,
        value2: card2.rank
      });
    }

    if (card1.faceUp !== card2.faceUp) {
      differences.push({
        type: 'cardFaceUp',
        path: `${path}.faceUp`,
        value1: card1.faceUp,
        value2: card2.faceUp
      });
    }

    if (card1.draggable !== card2.draggable) {
      differences.push({
        type: 'cardDraggable',
        path: `${path}.draggable`,
        value1: card1.draggable,
        value2: card2.draggable
      });
    }

    // Compare positions
    if (card1.position.x !== card2.position.x) {
      differences.push({
        type: 'cardPosition',
        path: `${path}.position.x`,
        value1: card1.position.x,
        value2: card2.position.x
      });
    }

    if (card1.position.y !== card2.position.y) {
      differences.push({
        type: 'cardPosition',
        path: `${path}.position.y`,
        value1: card1.position.y,
        value2: card2.position.y
      });
    }

    if (card1.position.zone !== card2.position.zone) {
      differences.push({
        type: 'cardPosition',
        path: `${path}.position.zone`,
        value1: card1.position.zone,
        value2: card2.position.zone
      });
    }

    return differences;
  }

  /**
   * Count total cards in a snapshot
   */
  private static countCardsInSnapshot(snapshot: GameStateSnapshot): number {
    let count = 0;
    
    // Count tableau cards
    snapshot.tableau.forEach(column => count += column.length);
    
    // Count foundation cards
    snapshot.foundation.forEach(pile => count += pile.length);
    
    // Count stock cards
    if (snapshot.stock) count += snapshot.stock.length;
    
    // Count waste cards
    if (snapshot.waste) count += snapshot.waste.length;
    
    // Count free cell cards
    if (snapshot.freeCells) count += snapshot.freeCells.length;
    
    return count;
  }

  /**
   * Create a summary of comparison differences
   */
  private static createComparisonSummary(differences: SnapshotDifference[]): ComparisonSummary {
    const summary: ComparisonSummary = {
      totalDifferences: differences.length,
      differencesByType: {},
      affectedAreas: new Set()
    };

    differences.forEach(diff => {
      // Count by type
      if (!summary.differencesByType[diff.type]) {
        summary.differencesByType[diff.type] = 0;
      }
      summary.differencesByType[diff.type]++;

      // Track affected areas
      const area = diff.path.split('[')[0];
      summary.affectedAreas.add(area);
    });

    return summary;
  }

  /**
   * Reset the sequence counter (useful for testing)
   */
  static resetSequenceCounter(): void {
    this.sequenceCounter = 0;
  }

  /**
   * Get the current sequence counter value
   */
  static getSequenceCounter(): number {
    return this.sequenceCounter;
  }

  /**
   * Create a snapshot from a game state with automatic metadata
   */
  static createQuickSnapshot(gameState: GameState, reason?: string): GameStateSnapshot {
    return this.createSnapshot(
      gameState,
      reason || 'quick_snapshot',
      'GameStateSnapshotManager.createQuickSnapshot'
    );
  }

  /**
   * Compare two snapshots and return only significant differences
   */
  static getSignificantDifferences(
    snapshot1: GameStateSnapshot,
    snapshot2: GameStateSnapshot,
    ignoreTimestamps: boolean = true
  ): SnapshotDifference[] {
    const comparison = this.compareSnapshots(snapshot1, snapshot2);
    
    return comparison.differences.filter(diff => {
      // Filter out timestamp differences if requested
      if (ignoreTimestamps && diff.path.includes('timestamp')) {
        return false;
      }
      
      // Filter out sequence number differences (these are expected to be different)
      if (diff.path.includes('sequenceNumber')) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Create a minimal snapshot containing only essential game state data
   */
  static createMinimalSnapshot(gameState: GameState, reason: string): MinimalGameStateSnapshot {
    return {
      timestamp: new Date().toISOString(),
      gameType: gameState.gameType,
      score: gameState.score,
      moveCount: gameState.moves.length,
      cardCounts: {
        tableau: gameState.tableau.reduce((sum, column) => sum + column.length, 0),
        foundation: gameState.foundation.reduce((sum, pile) => sum + pile.length, 0),
        stock: gameState.stock?.length || 0,
        waste: gameState.waste?.length || 0,
        freeCells: gameState.freeCells?.filter(Boolean).length || 0
      },
      metadata: {
        snapshotReason: reason,
        triggeredBy: 'GameStateSnapshotManager.createMinimalSnapshot',
        sequenceNumber: ++this.sequenceCounter
      }
    };
  }

  /**
   * Validate that a snapshot represents a valid game state
   */
  static validateGameStateIntegrity(snapshot: GameStateSnapshot): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check total card count (should be 52 for most solitaire games)
    const totalCards = this.countCardsInSnapshot(snapshot);
    if (totalCards !== 52) {
      warnings.push(`Unexpected card count: ${totalCards} (expected 52)`);
    }

    // Check for duplicate card IDs
    const cardIds = new Set<string>();
    const duplicateIds: string[] = [];

    const checkCardsForDuplicates = (cards: CardSnapshot[], location: string) => {
      cards.forEach(card => {
        if (cardIds.has(card.id)) {
          duplicateIds.push(`${card.id} (found in ${location})`);
        } else {
          cardIds.add(card.id);
        }
      });
    };

    // Check all card locations for duplicates
    snapshot.tableau.forEach((column, index) => 
      checkCardsForDuplicates(column, `tableau[${index}]`)
    );
    snapshot.foundation.forEach((pile, index) => 
      checkCardsForDuplicates(pile, `foundation[${index}]`)
    );
    if (snapshot.stock) checkCardsForDuplicates(snapshot.stock, 'stock');
    if (snapshot.waste) checkCardsForDuplicates(snapshot.waste, 'waste');
    if (snapshot.freeCells) checkCardsForDuplicates(snapshot.freeCells, 'freeCells');

    if (duplicateIds.length > 0) {
      errors.push(`Duplicate card IDs found: ${duplicateIds.join(', ')}`);
    }

    // Check for invalid card properties
    const validateCard = (card: CardSnapshot, location: string) => {
      if (!['hearts', 'diamonds', 'clubs', 'spades'].includes(card.suit)) {
        errors.push(`Invalid suit '${card.suit}' for card ${card.id} in ${location}`);
      }
      if (card.rank < 1 || card.rank > 13) {
        errors.push(`Invalid rank ${card.rank} for card ${card.id} in ${location}`);
      }
    };

    // Validate all cards
    snapshot.tableau.forEach((column, index) => 
      column.forEach(card => validateCard(card, `tableau[${index}]`))
    );
    snapshot.foundation.forEach((pile, index) => 
      pile.forEach(card => validateCard(card, `foundation[${index}]`))
    );
    if (snapshot.stock) snapshot.stock.forEach(card => validateCard(card, 'stock'));
    if (snapshot.waste) snapshot.waste.forEach(card => validateCard(card, 'waste'));
    if (snapshot.freeCells) snapshot.freeCells.forEach(card => validateCard(card, 'freeCells'));

    // Game-specific validations
    if (snapshot.gameType === 'klondike') {
      // Klondike should have 7 tableau columns and 4 foundation piles
      if (snapshot.tableau.length !== 7) {
        errors.push(`Klondike should have 7 tableau columns, found ${snapshot.tableau.length}`);
      }
      if (snapshot.foundation.length !== 4) {
        errors.push(`Klondike should have 4 foundation piles, found ${snapshot.foundation.length}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cardCount: totalCards,
      uniqueCardIds: cardIds.size
    };
  }

  /**
   * Create a diff summary between two snapshots
   */
  static createDiffSummary(
    snapshot1: GameStateSnapshot,
    snapshot2: GameStateSnapshot
  ): DiffSummary {
    const comparison = this.compareSnapshots(snapshot1, snapshot2);
    
    const cardChanges = {
      moved: 0,
      flipped: 0,
      draggabilityChanged: 0
    };

    const gameStateChanges = {
      scoreChanged: false,
      moveCountChanged: false,
      gameTypeChanged: false
    };

    comparison.differences.forEach(diff => {
      switch (diff.type) {
        case 'cardPosition':
          cardChanges.moved++;
          break;
        case 'cardFaceUp':
          cardChanges.flipped++;
          break;
        case 'cardDraggable':
          cardChanges.draggabilityChanged++;
          break;
        case 'score':
          gameStateChanges.scoreChanged = true;
          break;
        case 'moveCount':
          gameStateChanges.moveCountChanged = true;
          break;
        case 'gameType':
          gameStateChanges.gameTypeChanged = true;
          break;
      }
    });

    return {
      totalDifferences: comparison.differences.length,
      cardChanges,
      gameStateChanges,
      affectedAreas: Array.from(comparison.summary.affectedAreas),
      timeDifference: new Date(snapshot2.timestamp).getTime() - new Date(snapshot1.timestamp).getTime()
    };
  }
}

/**
 * Interface for snapshot comparison results
 */
export interface SnapshotComparison {
  areEqual: boolean;
  differences: SnapshotDifference[];
  summary: ComparisonSummary;
}

/**
 * Interface for individual snapshot differences
 */
export interface SnapshotDifference {
  type: string;
  path: string;
  value1: any;
  value2: any;
}

/**
 * Interface for comparison summary
 */
export interface ComparisonSummary {
  totalDifferences: number;
  differencesByType: Record<string, number>;
  affectedAreas: Set<string>;
}

/**
 * Interface for minimal game state snapshot (for performance-critical scenarios)
 */
export interface MinimalGameStateSnapshot {
  timestamp: string;
  gameType: 'klondike' | 'spider' | 'freecell';
  score: number;
  moveCount: number;
  cardCounts: {
    tableau: number;
    foundation: number;
    stock: number;
    waste: number;
    freeCells: number;
  };
  metadata: {
    snapshotReason: string;
    triggeredBy: string;
    sequenceNumber: number;
  };
}

/**
 * Interface for game state validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cardCount: number;
  uniqueCardIds: number;
}

/**
 * Interface for diff summary between snapshots
 */
export interface DiffSummary {
  totalDifferences: number;
  cardChanges: {
    moved: number;
    flipped: number;
    draggabilityChanged: number;
  };
  gameStateChanges: {
    scoreChanged: boolean;
    moveCountChanged: boolean;
    gameTypeChanged: boolean;
  };
  affectedAreas: string[];
  timeDifference: number; // milliseconds
}
