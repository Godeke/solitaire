/**
 * Klondike Solitaire Game Engine
 * Implements the classic Klondike solitaire rules with tableau, foundation, stock, and waste piles
 */

import { BaseGameEngine } from './BaseGameEngine';
import { GameState, Position, Move } from '../types/card';
import { Card } from '../utils/Card';
import { GameEngineConfig } from '../types/game';
import { Deck } from '../utils/Deck';
import { logGameAction, logPerformance } from '../utils/RendererLogger';
import { uiActionLogger } from '../utils/UIActionLogger';
import { UIActionEventType, MoveValidationResult, PerformanceMetrics } from '../types/UIActionLogging';

export class KlondikeEngine extends BaseGameEngine {
  private dealCount: number;

  constructor(config: Partial<GameEngineConfig> = {}) {
    super(config);
    this.dealCount = config.dealCount || 3; // Default to 3-card deal
  }

  getGameType(): 'klondike' | 'spider' | 'freecell' {
    return 'klondike';
  }

  /**
   * Initialize a new Klondike game with proper card distribution
   */
  initializeGame(): GameState {
    const startTime = performance.now();
    const deck = this.createShuffledDeck();
    
    logGameAction('Initializing new game', 'klondike', { dealCount: this.dealCount });
    
    // Initialize empty game state
    this.gameState = {
      gameType: 'klondike',
      tableau: Array(7).fill(null).map(() => []),
      foundation: Array(4).fill(null).map(() => []),
      stock: [],
      waste: [],
      moves: [],
      score: 0,
      timeStarted: new Date()
    };

    // Deal cards to tableau (Klondike layout: 1, 2, 3, 4, 5, 6, 7 cards)
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.dealOne();
        if (card) {
          // Only the top card in each column is face up
          card.faceUp = row === col;
          card.draggable = row === col;
          card.setPosition({ zone: 'tableau', index: col, cardIndex: row });
          this.gameState.tableau[col].push(card);
        }
      }
    }

    // Remaining cards go to stock (face down)
    while (!deck.isEmpty()) {
      const card = deck.dealOne();
      if (card) {
        card.faceUp = false;
        card.draggable = false;
        card.setPosition({ zone: 'stock', index: 0, cardIndex: this.gameState.stock!.length });
        this.gameState.stock!.push(card);
      }
    }

    this.updateCardPositions();
    
    const duration = performance.now() - startTime;
    logPerformance('Game initialization', duration, {
      tableauCards: this.gameState.tableau.reduce((sum, col) => sum + col.length, 0),
      stockCards: this.gameState.stock?.length || 0
    });
    
    return this.getGameState();
  }

  /**
   * Validate if a move is legal according to Klondike rules
   */
  validateMove(from: Position, to: Position, card: Card): boolean {
    const startTime = performance.now();
    const operationId = `validate-move-${Date.now()}`;
    
    // Set current game state for logging
    uiActionLogger.setCurrentGameState(this.gameState);
    
    // Start performance timing
    uiActionLogger.startPerformanceTimer(operationId);
    
    const validationResult = this.validateMoveWithLogging(from, to, card);
    
    // End performance timing and log the validation
    const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
    
    // Log the move validation event
    uiActionLogger.logUIAction(
      UIActionEventType.MOVE_VALIDATED,
      'KlondikeEngine',
      {
        sourcePosition: {
          x: from.index,
          y: from.cardIndex || 0,
          zone: `${from.zone}-${from.index}`
        },
        targetPosition: {
          x: to.index,
          y: to.cardIndex || 0,
          zone: `${to.zone}-${to.index}`
        },
        validationResult,
        moveSuccess: validationResult.isValid
      },
      true, // Capture state before
      false,
      performanceMetrics
    );
    
    return validationResult.isValid;
  }

  /**
   * Internal validation method with detailed logging and reasoning
   */
  private validateMoveWithLogging(from: Position, to: Position, card: Card): MoveValidationResult {
    const ruleViolations: string[] = [];
    let reason = '';
    let isValid = true;

    // Special case for stock to waste moves (cards are face down in stock)
    if (from.zone === 'stock' && to.zone === 'waste') {
      reason = 'Stock to waste move is always valid';
      logGameAction('Move validation: Stock to waste', 'klondike', { 
        from, to, cardId: card.id, result: 'valid', reason 
      });
      return {
        isValid: true,
        reason,
        validationTime: 0
      };
    }

    // Rule 1: Cannot move face-down cards (except stock to waste)
    if (!card.faceUp) {
      isValid = false;
      reason = 'Cannot move face-down cards';
      ruleViolations.push('FACE_DOWN_CARD_MOVE');
      logGameAction('Move validation failed: Face-down card', 'klondike', { 
        from, to, cardId: card.id, faceUp: card.faceUp 
      });
    }

    // Rule 2: Validate source position
    if (isValid && !this.isValidSourcePositionWithLogging(from, card)) {
      isValid = false;
      reason = 'Invalid source position for card';
      ruleViolations.push('INVALID_SOURCE_POSITION');
    }

    // Rule 3: Validate destination based on zone
    if (isValid) {
      const destinationValidation = this.validateDestinationWithLogging(card, to);
      if (!destinationValidation.isValid) {
        isValid = false;
        reason = destinationValidation.reason;
        ruleViolations.push(...(destinationValidation.ruleViolations || []));
      } else {
        reason = destinationValidation.reason;
      }
    }

    const validationResult: MoveValidationResult = {
      isValid,
      reason,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      validationTime: performance.now()
    };

    // Log detailed validation result
    logGameAction('Move validation completed', 'klondike', {
      from,
      to,
      cardId: card.id,
      result: isValid ? 'valid' : 'invalid',
      reason,
      ruleViolations,
      validationTime: validationResult.validationTime
    });

    return validationResult;
  }

  /**
   * Validate source position with detailed logging
   */
  private isValidSourcePositionWithLogging(from: Position, card: Card): boolean {
    const sourceCards = this.getCardsAtPosition(from);
    let isValid = true;
    let reason = '';
    
    switch (from.zone) {
      case 'tableau':
        // Can only move face-up cards from tableau
        const cardIndex = sourceCards.findIndex(c => c.id === card.id);
        isValid = cardIndex !== -1 && card.faceUp;
        reason = isValid 
          ? 'Valid tableau source position' 
          : `Card not found in tableau or face-down (index: ${cardIndex}, faceUp: ${card.faceUp})`;
        break;
      
      case 'waste':
        // Can only move the top card from waste
        isValid = sourceCards.length > 0 && sourceCards[sourceCards.length - 1].id === card.id;
        reason = isValid 
          ? 'Valid waste source position (top card)' 
          : `Card is not the top waste card (waste length: ${sourceCards.length})`;
        break;
      
      case 'foundation':
        // Can move from foundation (for undo functionality)
        isValid = sourceCards.length > 0 && sourceCards[sourceCards.length - 1].id === card.id;
        reason = isValid 
          ? 'Valid foundation source position (top card)' 
          : `Card is not the top foundation card (foundation length: ${sourceCards.length})`;
        break;
      
      default:
        isValid = true; // Allow other moves for testing
        reason = 'Source position validation bypassed for testing';
    }

    logGameAction('Source position validation', 'klondike', {
      zone: from.zone,
      index: from.index,
      cardId: card.id,
      result: isValid ? 'valid' : 'invalid',
      reason,
      sourceCardsCount: sourceCards.length
    });

    return isValid;
  }

  /**
   * Validate destination with detailed logging and reasoning
   */
  private validateDestinationWithLogging(card: Card, to: Position): MoveValidationResult {
    let isValid = true;
    let reason = '';
    const ruleViolations: string[] = [];

    switch (to.zone) {
      case 'foundation':
        const foundationResult = this.validateFoundationMoveWithLogging(card, to);
        return foundationResult;
      
      case 'tableau':
        const tableauResult = this.validateTableauMoveWithLogging(card, to);
        return tableauResult;
      
      case 'waste':
        // Only stock to waste moves allowed (handled earlier)
        isValid = false;
        reason = 'Direct moves to waste pile not allowed';
        ruleViolations.push('INVALID_WASTE_MOVE');
        break;
      
      default:
        isValid = false;
        reason = `Unknown destination zone: ${to.zone}`;
        ruleViolations.push('UNKNOWN_DESTINATION_ZONE');
    }

    return {
      isValid,
      reason,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      validationTime: performance.now()
    };
  }

  /**
   * Execute a move and return the updated game state
   */
  executeMove(from: Position, to: Position, card: Card): GameState {
    const operationId = `execute-move-${Date.now()}`;
    
    // Set current game state for logging
    uiActionLogger.setCurrentGameState(this.gameState);
    
    // Start performance timing
    uiActionLogger.startPerformanceTimer(operationId);
    
    // Validate the move first
    if (!this.validateMove(from, to, card)) {
      logGameAction('Invalid move attempted', 'klondike', { from, to, card: card.id });
      
      // Log the failed move attempt
      uiActionLogger.logUIAction(
        UIActionEventType.MOVE_ATTEMPT,
        'KlondikeEngine',
        {
          sourcePosition: {
            x: from.index,
            y: from.cardIndex || 0,
            zone: `${from.zone}-${from.index}`
          },
          targetPosition: {
            x: to.index,
            y: to.cardIndex || 0,
            zone: `${to.zone}-${to.index}`
          },
          moveSuccess: false,
          moveReason: 'Move validation failed'
        },
        true, // Capture state before
        false
      );
      
      return this.getGameState();
    }

    // Capture game state before move execution
    const gameStateBefore = uiActionLogger.createGameStateSnapshot(
      'before_move_execution',
      'KlondikeEngine.executeMove'
    );

    const startTime = performance.now();

    // Handle special stock to waste move
    if (from.zone === 'stock' && to.zone === 'waste') {
      const result = this.executeStockToWasteMoveWithLogging();
      
      // End performance timing
      const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
      
      // Log the executed move
      uiActionLogger.logUIAction(
        UIActionEventType.MOVE_EXECUTED,
        'KlondikeEngine',
        {
          sourcePosition: {
            x: from.index,
            y: from.cardIndex || 0,
            zone: `${from.zone}-${from.index}`
          },
          targetPosition: {
            x: to.index,
            y: to.cardIndex || 0,
            zone: `${to.zone}-${to.index}`
          },
          moveType: 'user',
          moveSuccess: true,
          moveReason: 'Stock to waste move executed'
        },
        false,
        true, // Capture state after
        performanceMetrics
      );
      
      return result;
    }

    // Get cards to move (may be multiple for tableau sequences)
    const cardsToMove = this.getCardsToMove(from, card);
    
    logGameAction('Executing move', 'klondike', {
      from,
      to,
      cardId: card.id,
      cardsToMoveCount: cardsToMove.length,
      cardsToMove: cardsToMove.map(c => ({ id: c.id, suit: c.suit, rank: c.rank }))
    });
    
    // Remove cards from source
    this.removeCardsFromPosition(from, cardsToMove.length);
    
    // Add cards to destination
    this.addCardsToPosition(to, cardsToMove);

    // Update card positions and draggability
    this.updateCardPositions();
    this.updateCardDraggability();

    // Check for and flip face-down cards that are now exposed
    const flippedCards = this.flipExposedCardsWithLogging();

    // Record the move
    const move: Move = {
      from,
      to,
      cards: cardsToMove,
      timestamp: new Date(),
      autoMove: false
    };
    this.recordMove(move);

    // Update score
    const scoreChange = this.updateScoreWithLogging(move);

    // End performance timing
    const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
    
    const duration = performance.now() - startTime;
    logPerformance('Move execution', duration, {
      from: move.from,
      to: move.to,
      cardsMovedCount: move.cards.length,
      newScore: this.gameState.score,
      scoreChange,
      flippedCardsCount: flippedCards.length
    });

    // Log the executed move with before/after state snapshots
    uiActionLogger.logUIAction(
      UIActionEventType.MOVE_EXECUTED,
      'KlondikeEngine',
      {
        sourcePosition: {
          x: from.index,
          y: from.cardIndex || 0,
          zone: `${from.zone}-${from.index}`
        },
        targetPosition: {
          x: to.index,
          y: to.cardIndex || 0,
          zone: `${to.zone}-${to.index}`
        },
        moveType: 'user',
        moveSuccess: true,
        moveReason: `Successfully moved ${cardsToMove.length} card(s) from ${from.zone} to ${to.zone}`,
        changedElements: [
          `${from.zone}-${from.index}`,
          `${to.zone}-${to.index}`,
          ...flippedCards.map(card => `card-${card.id}-flipped`)
        ]
      },
      false,
      true, // Capture state after
      performanceMetrics
    );

    return this.getGameState();
  }

  /**
   * Check if the game is won (all cards in foundation)
   */
  checkWinCondition(): boolean {
    // All foundation piles should have 13 cards (Ace to King)
    return this.gameState.foundation.every(pile => pile.length === 13);
  }

  /**
   * Get all valid moves in the current state
   */
  getValidMoves(): Move[] {
    const validMoves: Move[] = [];

    // Check moves from tableau
    for (let col = 0; col < this.gameState.tableau.length; col++) {
      const column = this.gameState.tableau[col];
      if (column.length > 0) {
        const topCard = column[column.length - 1];
        if (topCard.faceUp) {
          // Check moves to foundation
          for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
            const foundationPos: Position = { zone: 'foundation', index: foundationIndex };
            if (this.validateFoundationMove(topCard, foundationPos)) {
              validMoves.push({
                from: { zone: 'tableau', index: col },
                to: foundationPos,
                cards: [topCard],
                timestamp: new Date(),
                autoMove: false
              });
            }
          }

          // Check moves to other tableau columns
          for (let targetCol = 0; targetCol < this.gameState.tableau.length; targetCol++) {
            if (targetCol !== col) {
              const targetPos: Position = { zone: 'tableau', index: targetCol };
              if (this.validateTableauMove(topCard, targetPos)) {
                const cardsToMove = this.getCardsToMove({ zone: 'tableau', index: col }, topCard);
                validMoves.push({
                  from: { zone: 'tableau', index: col },
                  to: targetPos,
                  cards: cardsToMove,
                  timestamp: new Date(),
                  autoMove: false
                });
              }
            }
          }
        }
      }
    }

    // Check moves from waste
    if (this.gameState.waste && this.gameState.waste.length > 0) {
      const wasteCard = this.gameState.waste[this.gameState.waste.length - 1];
      
      // Check moves to foundation
      for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
        const foundationPos: Position = { zone: 'foundation', index: foundationIndex };
        if (this.validateFoundationMove(wasteCard, foundationPos)) {
          validMoves.push({
            from: { zone: 'waste', index: 0 },
            to: foundationPos,
            cards: [wasteCard],
            timestamp: new Date(),
            autoMove: false
          });
        }
      }

      // Check moves to tableau
      for (let col = 0; col < this.gameState.tableau.length; col++) {
        const targetPos: Position = { zone: 'tableau', index: col };
        if (this.validateTableauMove(wasteCard, targetPos)) {
          validMoves.push({
            from: { zone: 'waste', index: 0 },
            to: targetPos,
            cards: [wasteCard],
            timestamp: new Date(),
            autoMove: false
          });
        }
      }
    }

    // Check stock to waste move
    if (this.gameState.stock && this.gameState.stock.length > 0) {
      validMoves.push({
        from: { zone: 'stock', index: 0 },
        to: { zone: 'waste', index: 0 },
        cards: [],
        timestamp: new Date(),
        autoMove: false
      });
    }

    return validMoves;
  }

  /**
   * Attempt to auto-complete the game
   */
  autoComplete(): boolean {
    if (!this.config.enableAutoComplete) {
      logGameAction('Auto-complete disabled', 'klondike', { 
        enableAutoComplete: this.config.enableAutoComplete 
      });
      return false;
    }

    const operationId = `auto-complete-${Date.now()}`;
    uiActionLogger.startPerformanceTimer(operationId);
    
    logGameAction('Auto-complete started', 'klondike', {
      currentScore: this.gameState.score,
      moveCount: this.gameState.moves.length
    });

    let movesMade = 0;
    let maxMoves = 100; // Prevent infinite loops
    const autoMoves: Move[] = [];

    while (movesMade < maxMoves) {
      const validMoves = this.getValidMoves();
      
      // Find moves to foundation (prioritize auto-completion)
      const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
      
      if (foundationMoves.length === 0) {
        logGameAction('Auto-complete stopped: No foundation moves available', 'klondike', {
          movesMade,
          totalValidMoves: validMoves.length
        });
        break; // No more foundation moves available
      }

      // Execute the first foundation move
      const move = foundationMoves[0];
      const sourceCards = this.getCardsAtPosition(move.from);
      const card = sourceCards[sourceCards.length - 1]; // Get the top card
      
      // Log the auto-move before execution
      logGameAction('Executing auto-move', 'klondike', {
        moveNumber: movesMade + 1,
        from: move.from,
        to: move.to,
        cardId: card.id,
        cardSuit: card.suit,
        cardRank: card.rank
      });

      // Log the auto-move event
      uiActionLogger.logUIAction(
        UIActionEventType.AUTO_MOVE,
        'KlondikeEngine',
        {
          sourcePosition: {
            x: move.from.index,
            y: move.from.cardIndex || 0,
            zone: `${move.from.zone}-${move.from.index}`
          },
          targetPosition: {
            x: move.to.index,
            y: move.to.cardIndex || 0,
            zone: `${move.to.zone}-${move.to.index}`
          },
          moveType: 'auto',
          moveSuccess: true,
          moveReason: `Auto-move ${movesMade + 1}: ${card.suit} ${card.rank} to foundation`
        },
        true, // Capture state before
        false
      );
      
      this.executeAutoMove(move.from, move.to, card);
      autoMoves.push(move);
      movesMade++;

      // Check if game is won
      if (this.checkWinCondition()) {
        const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
        
        logGameAction('Auto-complete successful: Game won!', 'klondike', {
          movesMade,
          finalScore: this.gameState.score,
          autoMoves: autoMoves.map(m => ({
            from: m.from,
            to: m.to,
            cards: m.cards.map(c => ({ id: c.id, suit: c.suit, rank: c.rank }))
          }))
        });

        // Log win condition
        uiActionLogger.logUIAction(
          UIActionEventType.WIN_CONDITION,
          'KlondikeEngine',
          {
            changeType: 'win_condition',
            changedElements: ['game-state'],
            moveReason: `Game won after ${movesMade} auto-moves`
          },
          false,
          true, // Capture final state
          performanceMetrics
        );
        
        return true;
      }
    }

    const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
    
    logGameAction('Auto-complete finished', 'klondike', {
      movesMade,
      maxMovesReached: movesMade >= maxMoves,
      finalScore: this.gameState.score,
      gameWon: this.checkWinCondition()
    });

    // Return true if any moves were made (partial auto-completion)
    return movesMade > 0;
  }

  /**
   * Execute an auto-move with special logging
   */
  private executeAutoMove(from: Position, to: Position, card: Card): GameState {
    // Mark the move as auto-move before execution
    const gameStateBefore = this.getGameState();
    
    // Execute the move normally
    const result = this.executeMove(from, to, card);
    
    // Update the last move to mark it as auto-move
    if (this.gameState.moves.length > 0) {
      const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
      lastMove.autoMove = true;
      
      logGameAction('Auto-move executed', 'klondike', {
        from: lastMove.from,
        to: lastMove.to,
        cardsCount: lastMove.cards.length,
        newScore: this.gameState.score
      });
    }
    
    return result;
  }  
/**
   * Validate if the source position is valid for the given card
   */
  private isValidSourcePosition(from: Position, card: Card): boolean {
    const sourceCards = this.getCardsAtPosition(from);
    
    switch (from.zone) {
      case 'tableau':
        // Can only move face-up cards from tableau
        const cardIndex = sourceCards.findIndex(c => c.id === card.id);
        return cardIndex !== -1 && card.faceUp;
      
      case 'waste':
        // Can only move the top card from waste
        return sourceCards.length > 0 && sourceCards[sourceCards.length - 1].id === card.id;
      
      case 'foundation':
        // Can move from foundation (for undo functionality)
        return sourceCards.length > 0 && sourceCards[sourceCards.length - 1].id === card.id;
      
      default:
        return true; // Allow other moves for testing
    }
  }

  /**
   * Validate move to foundation pile
   */
  private validateFoundationMove(card: Card, to: Position): boolean {
    const result = this.validateFoundationMoveWithLogging(card, to);
    return result.isValid;
  }

  /**
   * Validate move to foundation pile with detailed logging
   */
  private validateFoundationMoveWithLogging(card: Card, to: Position): MoveValidationResult {
    const foundationPile = this.gameState.foundation[to.index];
    let isValid = true;
    let reason = '';
    const ruleViolations: string[] = [];
    
    if (!foundationPile || foundationPile.length === 0) {
      // Empty foundation pile - only Aces allowed
      isValid = card.rank === 1;
      reason = isValid 
        ? 'Valid: Ace placed on empty foundation pile'
        : `Invalid: Only Aces can be placed on empty foundation (card rank: ${card.rank})`;
      
      if (!isValid) {
        ruleViolations.push('NON_ACE_ON_EMPTY_FOUNDATION');
      }
    } else {
      const topCard = foundationPile[foundationPile.length - 1];
      const suitMatch = card.suit === topCard.suit;
      const rankSequential = card.rank === topCard.rank + 1;
      
      isValid = suitMatch && rankSequential;
      
      if (isValid) {
        reason = `Valid: ${card.suit} ${card.rank} follows ${topCard.suit} ${topCard.rank} in foundation`;
      } else {
        if (!suitMatch) {
          reason = `Invalid: Suit mismatch (${card.suit} vs ${topCard.suit})`;
          ruleViolations.push('FOUNDATION_SUIT_MISMATCH');
        } else if (!rankSequential) {
          reason = `Invalid: Rank not sequential (${card.rank} should be ${topCard.rank + 1})`;
          ruleViolations.push('FOUNDATION_RANK_NOT_SEQUENTIAL');
        }
      }
    }

    logGameAction('Foundation move validation', 'klondike', {
      cardId: card.id,
      cardSuit: card.suit,
      cardRank: card.rank,
      foundationIndex: to.index,
      foundationSize: foundationPile?.length || 0,
      topFoundationCard: foundationPile?.length > 0 ? {
        suit: foundationPile[foundationPile.length - 1].suit,
        rank: foundationPile[foundationPile.length - 1].rank
      } : null,
      result: isValid ? 'valid' : 'invalid',
      reason,
      ruleViolations
    });

    return {
      isValid,
      reason,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      validationTime: performance.now()
    };
  }

  /**
   * Validate move to tableau column
   */
  private validateTableauMove(card: Card, to: Position): boolean {
    const result = this.validateTableauMoveWithLogging(card, to);
    return result.isValid;
  }

  /**
   * Validate move to tableau column with detailed logging
   */
  private validateTableauMoveWithLogging(card: Card, to: Position): MoveValidationResult {
    const tableauColumn = this.gameState.tableau[to.index];
    let isValid = true;
    let reason = '';
    const ruleViolations: string[] = [];
    
    if (tableauColumn.length === 0) {
      // Empty tableau column - only Kings allowed
      isValid = card.rank === 13;
      reason = isValid 
        ? 'Valid: King placed on empty tableau column'
        : `Invalid: Only Kings can be placed on empty tableau (card rank: ${card.rank})`;
      
      if (!isValid) {
        ruleViolations.push('NON_KING_ON_EMPTY_TABLEAU');
      }
    } else {
      const topCard = tableauColumn[tableauColumn.length - 1];
      const canStack = card.canStackOn(topCard);
      
      isValid = canStack;
      
      if (isValid) {
        reason = `Valid: ${card.suit} ${card.rank} can stack on ${topCard.suit} ${topCard.rank}`;
      } else {
        // Determine specific rule violation
        const colorAlternates = card.isRed() !== topCard.isRed();
        const rankDescending = card.rank === topCard.rank - 1;
        
        if (!colorAlternates) {
          reason = `Invalid: Colors don't alternate (${card.suit} vs ${topCard.suit})`;
          ruleViolations.push('TABLEAU_COLOR_NOT_ALTERNATING');
        } else if (!rankDescending) {
          reason = `Invalid: Rank not descending (${card.rank} should be ${topCard.rank - 1})`;
          ruleViolations.push('TABLEAU_RANK_NOT_DESCENDING');
        } else {
          reason = `Invalid: Cannot stack ${card.suit} ${card.rank} on ${topCard.suit} ${topCard.rank}`;
          ruleViolations.push('TABLEAU_STACKING_RULE_VIOLATION');
        }
      }
    }

    logGameAction('Tableau move validation', 'klondike', {
      cardId: card.id,
      cardSuit: card.suit,
      cardRank: card.rank,
      cardColor: card.isRed() ? 'red' : 'black',
      tableauIndex: to.index,
      tableauSize: tableauColumn.length,
      topTableauCard: tableauColumn.length > 0 ? {
        suit: tableauColumn[tableauColumn.length - 1].suit,
        rank: tableauColumn[tableauColumn.length - 1].rank,
        color: tableauColumn[tableauColumn.length - 1].isRed() ? 'red' : 'black'
      } : null,
      result: isValid ? 'valid' : 'invalid',
      reason,
      ruleViolations
    });

    return {
      isValid,
      reason,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      validationTime: performance.now()
    };
  }

  /**
   * Get all cards that should move together (for tableau sequences)
   */
  private getCardsToMove(from: Position, card: Card): Card[] {
    if (from.zone !== 'tableau') {
      return [card];
    }

    const sourceColumn = this.gameState.tableau[from.index];
    const cardIndex = sourceColumn.findIndex(c => c.id === card.id);
    
    if (cardIndex === -1) {
      return [card];
    }

    // Get all cards from the selected card to the end of the column
    const cardsToMove = sourceColumn.slice(cardIndex);
    
    // Verify they form a valid sequence (alternating colors, descending ranks)
    if (!this.canMoveSequence(cardsToMove)) {
      return [card]; // Only move the single card if sequence is invalid
    }

    return cardsToMove;
  }

  /**
   * Execute stock to waste move (deal cards from stock)
   */
  private executeStockToWasteMove(): GameState {
    return this.executeStockToWasteMoveWithLogging();
  }

  /**
   * Execute stock to waste move with detailed logging
   */
  private executeStockToWasteMoveWithLogging(): GameState {
    if (!this.gameState.stock || this.gameState.stock.length === 0) {
      // If stock is empty, recycle waste back to stock
      if (this.gameState.waste && this.gameState.waste.length > 0) {
        const recycledCount = this.gameState.waste.length;
        
        logGameAction('Recycling waste to stock', 'klondike', {
          wasteCardsCount: recycledCount,
          action: 'recycle_waste_to_stock'
        });
        
        this.gameState.stock = [...this.gameState.waste].reverse();
        this.gameState.waste = [];
        
        // Make all stock cards face down and not draggable
        this.gameState.stock.forEach(card => {
          card.faceUp = false;
          card.draggable = false;
        });

        // Log the state change
        uiActionLogger.logStateChange(
          'KlondikeEngine',
          'pile_update',
          ['stock-recycled', 'waste-cleared'],
          undefined
        );
      } else {
        logGameAction('Stock to waste move attempted with empty stock and waste', 'klondike', {
          stockCount: 0,
          wasteCount: 0
        });
      }
      return this.getGameState();
    }

    // Deal cards from stock to waste
    const cardsToDeal = Math.min(this.dealCount, this.gameState.stock.length);
    const dealtCards = this.gameState.stock.splice(-cardsToDeal, cardsToDeal);
    
    logGameAction('Dealing cards from stock to waste', 'klondike', {
      cardsToDeal,
      dealtCards: dealtCards.map(card => ({ id: card.id, suit: card.suit, rank: card.rank })),
      remainingStockCount: this.gameState.stock.length
    });
    
    // Make dealt cards face up
    dealtCards.forEach(card => {
      card.faceUp = true;
      card.draggable = false; // Only top waste card is draggable
    });

    if (!this.gameState.waste) {
      this.gameState.waste = [];
    }
    this.gameState.waste.push(...dealtCards);

    // Update card positions and draggability
    this.updateCardPositions();
    this.updateCardDraggability();

    // Record the move
    const move: Move = {
      from: { zone: 'stock', index: 0 },
      to: { zone: 'waste', index: 0 },
      cards: dealtCards,
      timestamp: new Date(),
      autoMove: false
    };
    this.recordMove(move);

    // Log the state change
    uiActionLogger.logStateChange(
      'KlondikeEngine',
      'pile_update',
      ['stock-dealt', 'waste-updated'],
      undefined
    );

    return this.getGameState();
  }

  /**
   * Update which cards are draggable based on current game state
   */
  private updateCardDraggability(): void {
    // Reset all cards to not draggable
    this.gameState.tableau.forEach(column => {
      column.forEach(card => card.draggable = false);
    });
    this.gameState.foundation.forEach(pile => {
      pile.forEach(card => card.draggable = false);
    });
    if (this.gameState.waste) {
      this.gameState.waste.forEach(card => card.draggable = false);
    }

    // Make top cards of tableau columns draggable (if face up)
    this.gameState.tableau.forEach(column => {
      if (column.length > 0) {
        const topCard = column[column.length - 1];
        if (topCard.faceUp) {
          topCard.draggable = true;
          
          // Make all face-up cards in valid sequences draggable
          for (let i = column.length - 1; i >= 0; i--) {
            const card = column[i];
            if (!card.faceUp) break;
            
            card.draggable = true;
            
            // Check if this card can be moved with the cards below it
            if (i < column.length - 1) {
              const nextCard = column[i + 1];
              if (!card.canStackOn(nextCard)) {
                break; // Sequence broken
              }
            }
          }
        }
      }
    });

    // Make top waste card draggable
    if (this.gameState.waste && this.gameState.waste.length > 0) {
      const topWasteCard = this.gameState.waste[this.gameState.waste.length - 1];
      topWasteCard.draggable = true;
    }
  }

  /**
   * Flip face-down cards that are now exposed
   */
  private flipExposedCards(): void {
    const flippedCards = this.flipExposedCardsWithLogging();
    // Method already handles logging internally
  }

  /**
   * Flip face-down cards that are now exposed with detailed logging
   */
  private flipExposedCardsWithLogging(): Card[] {
    const flippedCards: Card[] = [];
    
    this.gameState.tableau.forEach((column, columnIndex) => {
      if (column.length > 0) {
        const topCard = column[column.length - 1];
        if (!topCard.faceUp) {
          topCard.flip();
          topCard.draggable = true;
          flippedCards.push(topCard);
          
          logGameAction('Card flipped', 'klondike', {
            cardId: topCard.id,
            suit: topCard.suit,
            rank: topCard.rank,
            columnIndex,
            position: 'top_of_column'
          });

          // Log the card flip event
          uiActionLogger.logUIAction(
            UIActionEventType.CARD_FLIP,
            'KlondikeEngine',
            {
              card: uiActionLogger.createCardSnapshot(topCard),
              changeType: 'card_flip',
              changedElements: [`card-${topCard.id}`, `tableau-${columnIndex}`]
            },
            false,
            false
          );
        }
      }
    });

    if (flippedCards.length > 0) {
      logGameAction('Cards flipped after move', 'klondike', {
        flippedCount: flippedCards.length,
        flippedCards: flippedCards.map(card => ({
          id: card.id,
          suit: card.suit,
          rank: card.rank
        }))
      });
    }

    return flippedCards;
  }

  /**
   * Update game score based on the move
   */
  private updateScore(move: Move): void {
    const scoreChange = this.updateScoreWithLogging(move);
    // Method already handles logging internally
  }

  /**
   * Update game score based on the move with detailed logging
   */
  private updateScoreWithLogging(move: Move): number {
    const previousScore = this.gameState.score;
    let scoreChange = 0;
    let scoringReason = '';

    // Klondike scoring system
    if (move.to.zone === 'foundation') {
      scoreChange += 10; // Points for moving to foundation
      scoringReason = 'Move to foundation (+10)';
    } else if (move.from.zone === 'waste' && move.to.zone === 'tableau') {
      scoreChange += 5; // Points for waste to tableau
      scoringReason = 'Waste to tableau (+5)';
    } else if (move.from.zone === 'tableau' && move.to.zone === 'tableau') {
      scoreChange += 3; // Points for tableau to tableau
      scoringReason = 'Tableau to tableau (+3)';
    }

    // Bonus for flipping cards
    if (move.from.zone === 'tableau') {
      const sourceColumn = this.gameState.tableau[move.from.index];
      if (sourceColumn.length > 0 && sourceColumn[sourceColumn.length - 1].faceUp) {
        scoreChange += 5; // Bonus for revealing a card
        scoringReason += ', Card revealed (+5)';
      }
    }

    this.gameState.score += scoreChange;

    if (scoreChange > 0) {
      logGameAction('Score updated', 'klondike', {
        previousScore,
        newScore: this.gameState.score,
        scoreChange,
        reason: scoringReason,
        move: {
          from: move.from,
          to: move.to,
          cardsCount: move.cards.length
        }
      });

      // Log the score change event
      uiActionLogger.logUIAction(
        UIActionEventType.SCORE_UPDATE,
        'KlondikeEngine',
        {
          changeType: 'score_change',
          changedElements: ['game-score'],
          moveReason: scoringReason
        },
        false,
        false
      );
    }

    return scoreChange;
  }

  /**
   * Reset waste pile back to stock (when stock is empty and waste is clicked)
   */
  resetWasteToStock(): GameState {
    if (this.gameState.stock && this.gameState.stock.length === 0 && 
        this.gameState.waste && this.gameState.waste.length > 0) {
      
      // Move all waste cards back to stock in reverse order
      this.gameState.stock = [...this.gameState.waste].reverse();
      this.gameState.waste = [];
      
      // Make all stock cards face down
      this.gameState.stock.forEach(card => {
        card.faceUp = false;
        card.draggable = false;
      });

      this.updateCardPositions();
      return this.getGameState();
    }
    
    return this.getGameState();
  }

  /**
   * Get hint for next possible move
   */
  getHint(): Move | null {
    const validMoves = this.getValidMoves();
    
    // Prioritize foundation moves
    const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
    if (foundationMoves.length > 0) {
      return foundationMoves[0];
    }

    // Then tableau moves that expose new cards
    const tableauMoves = validMoves.filter(move => 
      move.from.zone === 'tableau' && move.to.zone === 'tableau'
    );
    if (tableauMoves.length > 0) {
      return tableauMoves[0];
    }

    // Finally any other valid move
    return validMoves.length > 0 ? validMoves[0] : null;
  }
}