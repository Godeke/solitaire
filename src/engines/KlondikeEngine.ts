/**
 * Klondike Solitaire Game Engine
 * Implements the classic Klondike solitaire rules with tableau, foundation, stock, and waste piles
 */

import { BaseGameEngine } from './BaseGameEngine';
import { GameState, Card, Position, Move } from '../types/card';
import { GameEngineConfig } from '../types/game';
import { Deck } from '../utils/Deck';

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
    const deck = this.createShuffledDeck();
    
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
    return this.getGameState();
  }

  /**
   * Validate if a move is legal according to Klondike rules
   */
  validateMove(from: Position, to: Position, card: Card): boolean {
    // Special case for stock to waste moves (cards are face down in stock)
    if (from.zone === 'stock' && to.zone === 'waste') {
      return true;
    }

    // Cannot move face-down cards (except stock to waste)
    if (!card.faceUp) {
      return false;
    }

    // Validate source position
    if (!this.isValidSourcePosition(from, card)) {
      return false;
    }

    // Validate destination based on zone
    switch (to.zone) {
      case 'foundation':
        return this.validateFoundationMove(card, to);
      case 'tableau':
        return this.validateTableauMove(card, to);
      case 'waste':
        return from.zone === 'stock'; // Only stock to waste moves allowed
      default:
        return false;
    }
  }

  /**
   * Execute a move and return the updated game state
   */
  executeMove(from: Position, to: Position, card: Card): GameState {
    if (!this.validateMove(from, to, card)) {
      return this.getGameState();
    }

    // Handle special stock to waste move
    if (from.zone === 'stock' && to.zone === 'waste') {
      return this.executeStockToWasteMove();
    }

    // Get cards to move (may be multiple for tableau sequences)
    const cardsToMove = this.getCardsToMove(from, card);
    
    // Remove cards from source
    this.removeCardsFromPosition(from, cardsToMove.length);
    
    // Add cards to destination
    this.addCardsToPosition(to, cardsToMove);

    // Update card positions and draggability
    this.updateCardPositions();
    this.updateCardDraggability();

    // Flip face-down cards that are now exposed
    this.flipExposedCards();

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
    this.updateScore(move);

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
      return false;
    }

    let movesMade = 0;
    let maxMoves = 100; // Prevent infinite loops

    while (movesMade < maxMoves) {
      const validMoves = this.getValidMoves();
      
      // Find moves to foundation (prioritize auto-completion)
      const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
      
      if (foundationMoves.length === 0) {
        break; // No more foundation moves available
      }

      // Execute the first foundation move
      const move = foundationMoves[0];
      const sourceCards = this.getCardsAtPosition(move.from);
      const card = sourceCards[sourceCards.length - 1]; // Get the top card
      this.executeMove(move.from, move.to, card);
      movesMade++;

      // Check if game is won
      if (this.checkWinCondition()) {
        return true;
      }
    }

    // Return true if any moves were made (partial auto-completion)
    return movesMade > 0;
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
    const foundationPile = this.gameState.foundation[to.index];
    
    if (!foundationPile || foundationPile.length === 0) {
      // Empty foundation pile - only Aces allowed
      return card.rank === 1;
    }
    
    const topCard = foundationPile[foundationPile.length - 1];
    // Same suit, ascending rank (Ace=1, 2, 3, ..., King=13)
    return card.suit === topCard.suit && card.rank === topCard.rank + 1;
  }

  /**
   * Validate move to tableau column
   */
  private validateTableauMove(card: Card, to: Position): boolean {
    const tableauColumn = this.gameState.tableau[to.index];
    
    if (tableauColumn.length === 0) {
      // Empty tableau column - only Kings allowed
      return card.rank === 13;
    }
    
    const topCard = tableauColumn[tableauColumn.length - 1];
    // Alternating colors, descending rank
    return card.canStackOn(topCard);
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
    if (!this.gameState.stock || this.gameState.stock.length === 0) {
      // If stock is empty, recycle waste back to stock
      if (this.gameState.waste && this.gameState.waste.length > 0) {
        this.gameState.stock = [...this.gameState.waste].reverse();
        this.gameState.waste = [];
        
        // Make all stock cards face down and not draggable
        this.gameState.stock.forEach(card => {
          card.faceUp = false;
          card.draggable = false;
        });
      }
      return this.getGameState();
    }

    // Deal cards from stock to waste
    const cardsToDeal = Math.min(this.dealCount, this.gameState.stock.length);
    const dealtCards = this.gameState.stock.splice(-cardsToDeal, cardsToDeal);
    
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
    this.gameState.tableau.forEach(column => {
      if (column.length > 0) {
        const topCard = column[column.length - 1];
        if (!topCard.faceUp) {
          topCard.flip();
          topCard.draggable = true;
        }
      }
    });
  }

  /**
   * Update game score based on the move
   */
  private updateScore(move: Move): void {
    // Klondike scoring system
    if (move.to.zone === 'foundation') {
      this.gameState.score += 10; // Points for moving to foundation
    } else if (move.from.zone === 'waste' && move.to.zone === 'tableau') {
      this.gameState.score += 5; // Points for waste to tableau
    } else if (move.from.zone === 'tableau' && move.to.zone === 'tableau') {
      this.gameState.score += 3; // Points for tableau to tableau
    }

    // Bonus for flipping cards
    if (move.from.zone === 'tableau') {
      const sourceColumn = this.gameState.tableau[move.from.index];
      if (sourceColumn.length > 0 && sourceColumn[sourceColumn.length - 1].faceUp) {
        this.gameState.score += 5; // Bonus for revealing a card
      }
    }
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