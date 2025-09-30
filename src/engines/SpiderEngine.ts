/**
 * Spider Solitaire Game Engine
 * Implements Spider solitaire rules with 10 columns, same suit sequences, and completed suit removal
 */

import { BaseGameEngine } from './BaseGameEngine';
import { GameState, Position, Move } from '../types/card';
import { Card } from '../utils/Card';
import { GameEngineConfig } from '../types/game';
import { logGameAction, logPerformance } from '../utils/RendererLogger';

export class SpiderEngine extends BaseGameEngine {
    private difficulty: 'easy' | 'medium' | 'hard';
    private completedSequences: Card[][];

    constructor(config: Partial<GameEngineConfig> = {}) {
        super(config);
        this.difficulty = config.difficulty || 'medium';
        this.completedSequences = [];
    }

    getGameType(): 'klondike' | 'spider' | 'freecell' {
        return 'spider';
    }

    /**
     * Initialize a new Spider game with proper card distribution
     * Uses 2 decks (104 cards) dealt into 10 columns
     */
    initializeGame(): GameState {
        const startTime = performance.now();

        logGameAction('Initializing new Spider game', 'spider', {
            difficulty: this.difficulty
        });

        // Create two decks for Spider solitaire
        const deck1 = this.createShuffledDeck();
        const deck2 = this.createShuffledDeck();
        const allCards: Card[] = [];

        // Get all cards from both decks
        while (!deck1.isEmpty()) {
            const card = deck1.dealOne();
            if (card) allCards.push(card);
        }
        while (!deck2.isEmpty()) {
            const card = deck2.dealOne();
            if (card) allCards.push(card);
        }

        // Shuffle the combined deck
        for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }

        // Initialize empty game state
        this.gameState = {
            gameType: 'spider',
            tableau: Array(10).fill(null).map(() => []),
            foundation: [], // Spider doesn't use foundation piles initially
            stock: [],
            moves: [],
            score: 0,
            timeStarted: new Date()
        };

        this.completedSequences = [];

        // Deal cards to tableau (Spider layout: 6 cards in first 4 columns, 5 cards in last 6 columns)
        let cardIndex = 0;

        // Deal face-down cards first
        for (let col = 0; col < 10; col++) {
            const cardsInColumn = col < 4 ? 6 : 5;

            for (let row = 0; row < cardsInColumn - 1; row++) {
                if (cardIndex < allCards.length) {
                    const card = allCards[cardIndex++];
                    card.faceUp = false;
                    card.draggable = false;
                    card.setPosition({ zone: 'tableau', index: col, cardIndex: row });
                    this.gameState.tableau[col].push(card);
                }
            }
        }

        // Deal face-up top cards
        for (let col = 0; col < 10; col++) {
            if (cardIndex < allCards.length) {
                const card = allCards[cardIndex++];
                card.faceUp = true;
                card.draggable = true;
                const cardPosition = this.gameState.tableau[col].length;
                card.setPosition({ zone: 'tableau', index: col, cardIndex: cardPosition });
                this.gameState.tableau[col].push(card);
            }
        }

        // Remaining cards go to stock (50 cards, dealt 10 at a time)
        while (cardIndex < allCards.length) {
            const card = allCards[cardIndex++];
            card.faceUp = false;
            card.draggable = false;
            card.setPosition({ zone: 'stock', index: 0, cardIndex: this.gameState.stock!.length });
            this.gameState.stock!.push(card);
        }

        this.updateCardPositions();

        const duration = performance.now() - startTime;
        logPerformance('Spider game initialization', duration, {
            tableauCards: this.gameState.tableau.reduce((sum, col) => sum + col.length, 0),
            stockCards: this.gameState.stock?.length || 0,
            difficulty: this.difficulty
        });

        return this.getGameState();
    }

    /**
     * Validate if a move is legal according to Spider rules
     */
    validateMove(from: Position, to: Position, card: Card): boolean {
        // Handle stock to tableau moves (dealing new cards) - special case
        if (from.zone === 'stock' && to.zone === 'tableau') {
            return this.validateStockDeal();
        }

        // Cannot move face-down cards (except stock to tableau)
        if (!card.faceUp) {
            logGameAction('Move validation failed: Face-down card', 'spider', {
                from, to, cardId: card.id, faceUp: card.faceUp
            });
            return false;
        }

        // Validate source position
        if (!this.isValidSourcePosition(from, card)) {
            logGameAction('Move validation failed: Invalid source position', 'spider', {
                from, to, cardId: card.id
            });
            return false;
        }

        // Only tableau to tableau moves are allowed for regular play
        if (from.zone !== 'tableau' || to.zone !== 'tableau') {
            logGameAction('Move validation failed: Only tableau moves allowed', 'spider', {
                from, to, cardId: card.id
            });
            return false;
        }

        return this.validateTableauMove(card, to, from);
    }

    /**
     * Execute a move and return the updated game state
     */
    executeMove(from: Position, to: Position, card: Card): GameState {
        // Validate the move first
        if (!this.validateMove(from, to, card)) {
            logGameAction('Invalid move attempted', 'spider', { from, to, card: card.id });
            return this.getGameState();
        }

        const startTime = performance.now();

        // Handle stock to tableau moves (dealing new cards)
        if (from.zone === 'stock' && to.zone === 'tableau') {
            return this.executeStockDeal();
        }

        // Get cards to move (may be multiple for same-suit sequences)
        const cardsToMove = this.getCardsToMove(from, card);

        logGameAction('Executing Spider move', 'spider', {
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
        this.flipExposedCards();

        // Check for completed sequences and remove them
        const completedSequencesRemoved = this.checkAndRemoveCompletedSequences();

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
        this.updateScore(move, completedSequencesRemoved);

        const duration = performance.now() - startTime;
        logPerformance('Spider move execution', duration, {
            from: move.from,
            to: move.to,
            cardsMovedCount: move.cards.length,
            completedSequencesRemoved,
            newScore: this.gameState.score
        });

        return this.getGameState();
    }

    /**
     * Check if the game is won (all cards removed in completed sequences)
     */
    checkWinCondition(): boolean {
        // Game is won when all 8 complete sequences have been removed
        // (2 decks × 4 suits = 8 complete sequences)
        return this.completedSequences.length >= 8;
    }

    /**
     * Get all valid moves in the current state
     */
    getValidMoves(): Move[] {
        const validMoves: Move[] = [];

        // Check moves from tableau to tableau
        for (let fromCol = 0; fromCol < this.gameState.tableau.length; fromCol++) {
            const column = this.gameState.tableau[fromCol];
            if (column.length > 0) {
                // Find all face-up cards that can be moved
                for (let cardIndex = 0; cardIndex < column.length; cardIndex++) {
                    const card = column[cardIndex] as Card;
                    if (card.faceUp) {
                        // Check if this card can start a valid sequence
                        const cardsToMove = this.getCardsToMove({ zone: 'tableau', index: fromCol }, card);
                        if (cardsToMove.length > 0 && cardsToMove[0].id === card.id) {
                            // Check moves to other tableau columns
                            for (let toCol = 0; toCol < this.gameState.tableau.length; toCol++) {
                                if (toCol !== fromCol) {
                                    const targetPos: Position = { zone: 'tableau', index: toCol };
                                    if (this.validateTableauMove(card, targetPos, { zone: 'tableau', index: fromCol })) {
                                        validMoves.push({
                                            from: { zone: 'tableau', index: fromCol },
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
            }
        }

        // Check stock deal if possible
        if (this.canDealFromStock()) {
            validMoves.push({
                from: { zone: 'stock', index: 0 },
                to: { zone: 'tableau', index: 0 }, // Placeholder - deals to all columns
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
            logGameAction('Auto-complete disabled', 'spider', {
                enableAutoComplete: this.config.enableAutoComplete
            });
            return false;
        }

        // Spider solitaire auto-complete is complex due to the strategic nature
        // For now, just check and remove any completed sequences
        const completedSequencesRemoved = this.checkAndRemoveCompletedSequences();

        logGameAction('Spider auto-complete attempted', 'spider', {
            completedSequencesRemoved,
            totalCompletedSequences: this.completedSequences.length,
            gameWon: this.checkWinCondition()
        });

        return completedSequencesRemoved > 0;
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

            case 'stock':
                // Stock moves are for dealing cards
                return true;

            default:
                return false;
        }
    }

    /**
     * Validate move to tableau column
     */
    private validateTableauMove(card: Card, to: Position, _from: Position): boolean {
        const tableauColumn = this.gameState.tableau[to.index];

        if (tableauColumn.length === 0) {
            // Empty tableau column - any card or sequence can be placed
            return true;
        }

        const topCard = tableauColumn[tableauColumn.length - 1] as Card;

        // In Spider, cards can be placed on any card of higher rank (regardless of suit)
        // But only same-suit sequences can be moved together
        const canPlace = card.rank === topCard.rank - 1;

        if (canPlace) {
            logGameAction('Valid Spider tableau move', 'spider', {
                cardId: card.id,
                cardSuit: card.suit,
                cardRank: card.rank,
                targetCardSuit: topCard.suit,
                targetCardRank: topCard.rank,
                tableauIndex: to.index
            });
        } else {
            logGameAction('Invalid Spider tableau move', 'spider', {
                cardId: card.id,
                cardSuit: card.suit,
                cardRank: card.rank,
                targetCardSuit: topCard.suit,
                targetCardRank: topCard.rank,
                tableauIndex: to.index,
                reason: `Card rank ${card.rank} cannot be placed on rank ${topCard.rank}`
            });
        }

        return canPlace;
    }

    /**
     * Get all cards that should move together (same-suit descending sequences)
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
        const potentialCards = sourceColumn.slice(cardIndex) as Card[];

        // Only move cards that form a same-suit descending sequence
        const cardsToMove: Card[] = [potentialCards[0]];

        for (let i = 1; i < potentialCards.length; i++) {
            const currentCard = potentialCards[i] as Card;
            const previousCard = potentialCards[i - 1] as Card;

            // Check if cards form a same-suit descending sequence
            if (currentCard.suit === previousCard.suit &&
                currentCard.rank === previousCard.rank - 1) {
                cardsToMove.push(currentCard);
            } else {
                // Sequence broken, stop here
                break;
            }
        }

        return cardsToMove;
    }

    /**
     * Update card draggability based on Spider rules
     */
    private updateCardDraggability(): void {
        // Only face-up cards in tableau are draggable
        for (let col = 0; col < this.gameState.tableau.length; col++) {
            const column = this.gameState.tableau[col];
            for (let i = 0; i < column.length; i++) {
                const card = column[i];
                card.draggable = card.faceUp;
            }
        }
    }

    /**
     * Flip face-down cards that are now exposed
     */
    private flipExposedCards(): Card[] {
        const flippedCards: Card[] = [];

        for (let col = 0; col < this.gameState.tableau.length; col++) {
            const column = this.gameState.tableau[col];
            if (column.length > 0) {
                const topCard = column[column.length - 1] as Card;
                if (!topCard.faceUp) {
                    topCard.flip();
                    topCard.draggable = true;
                    flippedCards.push(topCard);

                    logGameAction('Card flipped in Spider', 'spider', {
                        cardId: topCard.id,
                        suit: topCard.suit,
                        rank: topCard.rank,
                        column: col
                    });
                }
            }
        }

        return flippedCards;
    }

    /**
     * Check for completed sequences (King to Ace of same suit) and remove them
     */
    private checkAndRemoveCompletedSequences(): number {
        let sequencesRemoved = 0;

        for (let col = 0; col < this.gameState.tableau.length; col++) {
            const column = this.gameState.tableau[col];

            // Look for complete sequences starting from the bottom of the column
            for (let startIndex = 0; startIndex <= column.length - 13; startIndex++) {
                const potentialSequence = column.slice(startIndex, startIndex + 13) as Card[];

                if (this.isCompleteSequence(potentialSequence)) {
                    // Remove the complete sequence
                    const removedCards = column.splice(startIndex, 13) as Card[];
                    this.completedSequences.push(removedCards);
                    sequencesRemoved++;

                    logGameAction('Complete sequence removed in Spider', 'spider', {
                        column: col,
                        suit: removedCards[0].suit,
                        sequenceNumber: this.completedSequences.length,
                        cardsRemoved: removedCards.map(c => ({ suit: c.suit, rank: c.rank }))
                    });

                    // Update positions for remaining cards
                    this.updateCardPositions();

                    // Check if we exposed a new face-down card
                    this.flipExposedCards();

                    // Only remove one sequence per column per check to avoid index issues
                    break;
                }
            }
        }

        return sequencesRemoved;
    }

    /**
     * Check if a sequence of cards is a complete King-to-Ace sequence of the same suit
     */
    private isCompleteSequence(cards: Card[]): boolean {
        if (cards.length !== 13) {
            return false;
        }

        // All cards must be face up and of the same suit
        const suit = cards[0].suit;
        if (!cards.every(card => card.faceUp && card.suit === suit)) {
            return false;
        }

        // Cards must be in descending order from King (13) to Ace (1)
        for (let i = 0; i < 13; i++) {
            if (cards[i].rank !== 13 - i) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate if cards can be dealt from stock
     */
    private validateStockDeal(): boolean {
        // Can only deal from stock if all tableau columns have at least one card
        const allColumnsHaveCards = this.gameState.tableau.every(column => column.length > 0);
        const hasStockCards = this.gameState.stock && this.gameState.stock.length > 0;

        if (!allColumnsHaveCards) {
            logGameAction('Stock deal validation failed: Empty columns exist', 'spider', {
                emptyColumns: this.gameState.tableau.map((col, index) => ({ index, isEmpty: col.length === 0 }))
                    .filter(col => col.isEmpty)
            });
        }

        return allColumnsHaveCards && !!hasStockCards;
    }

    /**
     * Check if cards can be dealt from stock
     */
    private canDealFromStock(): boolean {
        return this.validateStockDeal();
    }

    /**
     * Execute dealing cards from stock to all tableau columns
     */
    private executeStockDeal(): GameState {
        if (!this.validateStockDeal()) {
            logGameAction('Cannot deal from stock', 'spider');
            return this.getGameState();
        }

        const startTime = performance.now();

        // Deal one card to each tableau column (10 cards total)
        const dealtCards: Card[] = [];

        for (let col = 0; col < 10; col++) {
            if (this.gameState.stock && this.gameState.stock.length > 0) {
                const card = this.gameState.stock.shift()! as Card;
                card.faceUp = true;
                card.draggable = true;

                const cardPosition = this.gameState.tableau[col].length;
                card.setPosition({ zone: 'tableau', index: col, cardIndex: cardPosition });

                this.gameState.tableau[col].push(card);
                dealtCards.push(card);
            }
        }

        // Update card positions
        this.updateCardPositions();

        // Check for completed sequences after dealing
        const completedSequencesRemoved = this.checkAndRemoveCompletedSequences();

        // Record the deal as a move
        const move: Move = {
            from: { zone: 'stock', index: 0 },
            to: { zone: 'tableau', index: 0 }, // Placeholder
            cards: dealtCards,
            timestamp: new Date(),
            autoMove: false
        };
        this.recordMove(move);

        const duration = performance.now() - startTime;
        logPerformance('Spider stock deal', duration, {
            cardsDealt: dealtCards.length,
            remainingStockCards: this.gameState.stock?.length || 0,
            completedSequencesRemoved
        });

        logGameAction('Stock dealt in Spider', 'spider', {
            cardsDealt: dealtCards.length,
            remainingStockCards: this.gameState.stock?.length || 0,
            completedSequencesRemoved,
            dealtCards: dealtCards.map(c => ({ id: c.id, suit: c.suit, rank: c.rank, column: c.position.index }))
        });

        return this.getGameState();
    }

    /**
     * Update score based on moves and completed sequences
     */
    private updateScore(_move: Move, completedSequencesRemoved: number): void {
        // Spider scoring: points for completed sequences, penalties for moves
        const sequencePoints = completedSequencesRemoved * 100;
        const movesPenalty = -1; // Small penalty for each move to encourage efficiency

        this.gameState.score += sequencePoints + movesPenalty;

        logGameAction('Spider score updated', 'spider', {
            sequencePoints,
            movesPenalty,
            totalScore: this.gameState.score,
            completedSequencesRemoved
        });
    }

    /**
     * Get the number of completed sequences
     */
    getCompletedSequencesCount(): number {
        return this.completedSequences.length;
    }

    /**
     * Get all completed sequences
     */
    getCompletedSequences(): Card[][] {
        return [...this.completedSequences];
    }

    /**
     * Debug method to get detailed validation information
     */
    debugValidateMove(from: Position, to: Position, card: Card): { isValid: boolean; reason: string; ruleViolations?: string[] } {
        const ruleViolations: string[] = [];
        let reason = '';
        let isValid = true;

        // Handle stock to tableau moves (dealing new cards) - special case
        if (from.zone === 'stock' && to.zone === 'tableau') {
            const canDeal = this.validateStockDeal();
            return {
                isValid: canDeal,
                reason: canDeal ? 'Stock deal is valid' : 'Cannot deal from stock - empty columns exist',
                ruleViolations: canDeal ? undefined : ['EMPTY_COLUMNS_EXIST']
            };
        }

        // Cannot move face-down cards (except stock to tableau)
        if (!card.faceUp) {
            isValid = false;
            reason = 'Cannot move face-down cards';
            ruleViolations.push('FACE_DOWN_CARD_MOVE');
        }

        // Validate source position
        if (isValid && !this.isValidSourcePosition(from, card)) {
            isValid = false;
            reason = 'Invalid source position for card';
            ruleViolations.push('INVALID_SOURCE_POSITION');
        }

        // Only tableau to tableau moves are allowed for regular play
        if (isValid && (from.zone !== 'tableau' || to.zone !== 'tableau')) {
            isValid = false;
            reason = 'Only tableau to tableau moves allowed in Spider';
            ruleViolations.push('INVALID_ZONE_MOVE');
        }

        // Validate tableau move
        if (isValid && !this.validateTableauMove(card, to, from)) {
            isValid = false;
            reason = 'Invalid tableau move - card cannot be placed on target';
            ruleViolations.push('INVALID_TABLEAU_PLACEMENT');
        }

        if (isValid && reason === '') {
            reason = 'Move is valid according to Spider rules';
        }

        return {
            isValid,
            reason,
            ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined
        };
    }
}