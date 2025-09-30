/**
 * FreeCell Solitaire Game Engine
 * Implements FreeCell solitaire rules with 8 columns, 4 free cells, and 4 foundations
 */

import { BaseGameEngine } from './BaseGameEngine';
import { GameState, Position, Move } from '../types/card';
import { Card } from '../utils/Card';
import { GameEngineConfig } from '../types/game';
import { logGameAction, logPerformance } from '../utils/RendererLogger';

export class FreeCellEngine extends BaseGameEngine {
    constructor(config: Partial<GameEngineConfig> = {}) {
        super(config);
    }

    getGameType(): 'klondike' | 'spider' | 'freecell' {
        return 'freecell';
    }

    /**
     * Initialize a new FreeCell game with proper card distribution
     * All 52 cards are dealt face-up into 8 columns (7-7-7-7-6-6-6-6)
     */
    initializeGame(): GameState {
        const startTime = performance.now();
        const deck = this.createShuffledDeck();
        
        logGameAction('Initializing new FreeCell game', 'freecell');
        
        // Initialize empty game state
        this.gameState = {
            gameType: 'freecell',
            tableau: Array(8).fill(null).map(() => []),
            foundation: Array(4).fill(null).map(() => []),
            freeCells: [],
            moves: [],
            score: 0,
            timeStarted: new Date()
        };

        // Deal all cards to tableau (FreeCell layout: 7 cards in first 4 columns, 6 cards in last 4 columns)
        let cardIndex = 0;
        for (let col = 0; col < 8; col++) {
            const cardsInColumn = col < 4 ? 7 : 6;
            
            for (let row = 0; row < cardsInColumn; row++) {
                const card = deck.dealOne();
                if (card) {
                    // All cards are face up in FreeCell
                    card.faceUp = true;
                    card.draggable = true;
                    card.setPosition({ zone: 'tableau', index: col, cardIndex: row });
                    this.gameState.tableau[col].push(card);
                }
            }
        }

        this.updateCardPositions();
        this.updateCardDraggability();
        
        const duration = performance.now() - startTime;
        logPerformance('FreeCell game initialization', duration, {
            tableauCards: this.gameState.tableau.reduce((sum, col) => sum + col.length, 0),
            freeCells: 4,
            foundations: 4
        });
        
        return this.getGameState();
    }

    /**
     * Validate if a move is legal according to FreeCell rules
     */
    validateMove(from: Position, to: Position, card: Card): boolean {
        // Cannot move face-down cards (shouldn't happen in FreeCell)
        if (!card.faceUp) {
            logGameAction('Move validation failed: Face-down card', 'freecell', {
                from, to, cardId: card.id, faceUp: card.faceUp
            });
            return false;
        }

        // Validate source position
        if (!this.isValidSourcePosition(from, card)) {
            logGameAction('Move validation failed: Invalid source position', 'freecell', {
                from, to, cardId: card.id
            });
            return false;
        }

        // Validate destination based on zone
        switch (to.zone) {
            case 'foundation':
                return this.validateFoundationMove(card, to);
            case 'tableau':
                return this.validateTableauMove(card, to, from);
            case 'freecell':
                return this.validateFreeCellMove(card, to);
            default:
                logGameAction('Move validation failed: Invalid destination zone', 'freecell', {
                    from, to, zone: to.zone
                });
                return false;
        }
    }    /**

     * Execute a move and return the updated game state
     */
    executeMove(from: Position, to: Position, card: Card): GameState {
        // Validate the move first
        if (!this.validateMove(from, to, card)) {
            logGameAction('Invalid move attempted', 'freecell', { from, to, card: card.id });
            return this.getGameState();
        }

        const startTime = performance.now();

        // Get cards to move (may be multiple for tableau sequences)
        const cardsToMove = this.getCardsToMove(from, card);

        logGameAction('Executing FreeCell move', 'freecell', {
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

        const duration = performance.now() - startTime;
        logPerformance('FreeCell move execution', duration, {
            from: move.from,
            to: move.to,
            cardsMovedCount: move.cards.length,
            newScore: this.gameState.score
        });

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
                const topCard = column[column.length - 1] as Card;
                
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
                        if (this.validateTableauMove(topCard, targetPos, { zone: 'tableau', index: col })) {
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

                // Check moves to free cells
                for (let freeCellIndex = 0; freeCellIndex < 4; freeCellIndex++) {
                    const freeCellPos: Position = { zone: 'freecell', index: freeCellIndex };
                    if (this.validateFreeCellMove(topCard, freeCellPos)) {
                        validMoves.push({
                            from: { zone: 'tableau', index: col },
                            to: freeCellPos,
                            cards: [topCard],
                            timestamp: new Date(),
                            autoMove: false
                        });
                    }
                }
            }
        }

        // Check moves from free cells
        if (this.gameState.freeCells) {
            for (let freeCellIndex = 0; freeCellIndex < this.gameState.freeCells.length; freeCellIndex++) {
                const freeCellCard = this.gameState.freeCells[freeCellIndex] as Card;
                if (freeCellCard) {
                    // Check moves to foundation
                    for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
                        const foundationPos: Position = { zone: 'foundation', index: foundationIndex };
                        if (this.validateFoundationMove(freeCellCard, foundationPos)) {
                            validMoves.push({
                                from: { zone: 'freecell', index: freeCellIndex },
                                to: foundationPos,
                                cards: [freeCellCard],
                                timestamp: new Date(),
                                autoMove: false
                            });
                        }
                    }

                    // Check moves to tableau
                    for (let col = 0; col < this.gameState.tableau.length; col++) {
                        const targetPos: Position = { zone: 'tableau', index: col };
                        if (this.validateTableauMove(freeCellCard, targetPos, { zone: 'freecell', index: freeCellIndex })) {
                            validMoves.push({
                                from: { zone: 'freecell', index: freeCellIndex },
                                to: targetPos,
                                cards: [freeCellCard],
                                timestamp: new Date(),
                                autoMove: false
                            });
                        }
                    }
                }
            }
        }

        return validMoves;
    }

    /**
     * Attempt to auto-complete the game
     */
    autoComplete(): boolean {
        if (!this.config.enableAutoComplete) {
            logGameAction('Auto-complete disabled', 'freecell', {
                enableAutoComplete: this.config.enableAutoComplete
            });
            return false;
        }

        logGameAction('FreeCell auto-complete started', 'freecell', {
            currentScore: this.gameState.score,
            moveCount: this.gameState.moves.length
        });

        let movesMade = 0;
        let maxMoves = 100; // Prevent infinite loops

        while (movesMade < maxMoves) {
            const validMoves = this.getValidMoves();
            
            // Find moves to foundation (prioritize auto-completion)
            const foundationMoves = validMoves.filter(move => move.to.zone === 'foundation');
            
            if (foundationMoves.length === 0) {
                logGameAction('Auto-complete stopped: No foundation moves available', 'freecell', {
                    movesMade,
                    totalValidMoves: validMoves.length
                });
                break; // No more foundation moves available
            }

            // Execute the first foundation move
            const move = foundationMoves[0];
            const sourceCards = this.getCardsAtPosition(move.from);
            const card = sourceCards.length > 0 ? sourceCards[sourceCards.length - 1] as Card : 
                         this.gameState.freeCells?.[move.from.index] as Card;
            
            if (!card) {
                break;
            }

            logGameAction('Executing auto-move', 'freecell', {
                moveNumber: movesMade + 1,
                from: move.from,
                to: move.to,
                cardId: card.id,
                cardSuit: card.suit,
                cardRank: card.rank
            });
            
            this.executeAutoMove(move.from, move.to, card);
            movesMade++;

            // Check if game is won
            if (this.checkWinCondition()) {
                logGameAction('Auto-complete successful: Game won!', 'freecell', {
                    movesMade,
                    finalScore: this.gameState.score
                });
                return true;
            }
        }

        logGameAction('Auto-complete finished', 'freecell', {
            movesMade,
            maxMovesReached: movesMade >= maxMoves,
            finalScore: this.gameState.score,
            gameWon: this.checkWinCondition()
        });

        // Return true if any moves were made (partial auto-completion)
        return movesMade > 0;
    }    /**

     * Execute an auto-move with special logging
     */
    private executeAutoMove(from: Position, to: Position, card: Card): GameState {
        // Execute the move normally
        const result = this.executeMove(from, to, card);
        
        // Update the last move to mark it as auto-move
        if (this.gameState.moves.length > 0) {
            const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
            lastMove.autoMove = true;
            
            logGameAction('Auto-move executed', 'freecell', {
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
        switch (from.zone) {
            case 'tableau':
                const sourceColumn = this.gameState.tableau[from.index];
                // Can only move the top card or a valid sequence from tableau
                const cardIndex = sourceColumn.findIndex(c => c.id === card.id);
                return cardIndex !== -1 && this.canMoveSequenceFromTableau(from, card);
            
            case 'freecell':
                // Can only move the card that's in the free cell
                if (!this.gameState.freeCells || from.index >= this.gameState.freeCells.length) {
                    return false;
                }
                const freeCellCard = this.gameState.freeCells[from.index] as Card;
                return freeCellCard?.id === card.id;
            
            case 'foundation':
                // Can move from foundation (for undo functionality)
                const foundationPile = this.gameState.foundation[from.index];
                return foundationPile.length > 0 && foundationPile[foundationPile.length - 1].id === card.id;
            
            default:
                return false;
        }
    }

    /**
     * Validate move to foundation pile
     */
    private validateFoundationMove(card: Card, to: Position): boolean {
        const foundationPile = this.gameState.foundation[to.index];
        
        if (!foundationPile || foundationPile.length === 0) {
            // Empty foundation pile - only Aces allowed
            const isValid = card.rank === 1;
            logGameAction('Foundation move validation', 'freecell', {
                cardId: card.id,
                cardSuit: card.suit,
                cardRank: card.rank,
                foundationIndex: to.index,
                foundationSize: 0,
                result: isValid ? 'valid' : 'invalid',
                reason: isValid ? 'Ace on empty foundation' : 'Only Aces allowed on empty foundation'
            });
            return isValid;
        }

        const topCard = foundationPile[foundationPile.length - 1] as Card;
        const suitMatch = card.suit === topCard.suit;
        const rankSequential = card.rank === topCard.rank + 1;
        const isValid = suitMatch && rankSequential;
        
        logGameAction('Foundation move validation', 'freecell', {
            cardId: card.id,
            cardSuit: card.suit,
            cardRank: card.rank,
            foundationIndex: to.index,
            foundationSize: foundationPile.length,
            topFoundationCard: { suit: topCard.suit, rank: topCard.rank },
            result: isValid ? 'valid' : 'invalid',
            reason: isValid ? 'Valid foundation sequence' : 
                   !suitMatch ? 'Suit mismatch' : 'Rank not sequential'
        });

        return isValid;
    }

    /**
     * Validate move to tableau column
     */
    private validateTableauMove(card: Card, to: Position, from: Position): boolean {
        const tableauColumn = this.gameState.tableau[to.index];
        
        if (tableauColumn.length === 0) {
            // Empty tableau column - any card can be placed
            logGameAction('Tableau move validation', 'freecell', {
                cardId: card.id,
                cardSuit: card.suit,
                cardRank: card.rank,
                tableauIndex: to.index,
                tableauSize: 0,
                result: 'valid',
                reason: 'Any card can be placed on empty tableau'
            });
            return true;
        }

        const topCard = tableauColumn[tableauColumn.length - 1] as Card;
        
        // Check if we're moving a sequence and if we have enough free spaces
        const cardsToMove = this.getCardsToMove(from, card);
        if (cardsToMove.length > 1) {
            const maxMovableCards = this.calculateMaxMovableCards();
            if (cardsToMove.length > maxMovableCards) {
                logGameAction('Tableau move validation failed', 'freecell', {
                    cardId: card.id,
                    cardsToMoveCount: cardsToMove.length,
                    maxMovableCards,
                    reason: 'Not enough free spaces to move sequence'
                });
                return false;
            }
        }

        // FreeCell tableau rule: alternating colors and descending rank
        const canStack = card.canStackOn(topCard);
        
        logGameAction('Tableau move validation', 'freecell', {
            cardId: card.id,
            cardSuit: card.suit,
            cardRank: card.rank,
            cardColor: card.isRed() ? 'red' : 'black',
            tableauIndex: to.index,
            tableauSize: tableauColumn.length,
            topTableauCard: {
                suit: topCard.suit,
                rank: topCard.rank,
                color: topCard.isRed() ? 'red' : 'black'
            },
            result: canStack ? 'valid' : 'invalid',
            reason: canStack ? 'Valid tableau stacking' : 'Invalid stacking (color/rank rules)'
        });

        return canStack;
    }

    /**
     * Validate move to free cell
     */
    private validateFreeCellMove(card: Card, to: Position): boolean {
        if (!this.gameState.freeCells) {
            this.gameState.freeCells = [];
        }

        const freeCellCard = this.gameState.freeCells[to.index];
        const isEmpty = !freeCellCard;
        
        logGameAction('Free cell move validation', 'freecell', {
            cardId: card.id,
            freeCellIndex: to.index,
            isEmpty,
            result: isEmpty ? 'valid' : 'invalid',
            reason: isEmpty ? 'Free cell is empty' : 'Free cell is occupied'
        });

        return isEmpty;
    }

    /**
     * Get all cards that should move together (valid sequences only)
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
        
        // Check if they form a valid sequence (alternating colors, descending ranks)
        if (!this.canMoveSequence(potentialCards)) {
            return [card]; // Only move the single card if sequence is invalid
        }

        // Check if we have enough free spaces to move this sequence
        const maxMovableCards = this.calculateMaxMovableCards();
        if (potentialCards.length > maxMovableCards) {
            return [card]; // Only move single card if not enough free spaces
        }

        return potentialCards;
    }

    /**
     * Check if we can move a sequence from tableau starting with the given card
     */
    private canMoveSequenceFromTableau(from: Position, card: Card): boolean {
        const sourceColumn = this.gameState.tableau[from.index];
        const cardIndex = sourceColumn.findIndex(c => c.id === card.id);
        
        if (cardIndex === -1) {
            return false;
        }

        // Get all cards from the selected card to the end of the column
        const cardsToCheck = sourceColumn.slice(cardIndex) as Card[];
        
        // Check if they form a valid sequence
        return this.canMoveSequence(cardsToCheck);
    }

    /**
     * Calculate the maximum number of cards that can be moved as a sequence
     * Based on the number of empty free cells and empty tableau columns
     */
    private calculateMaxMovableCards(): number {
        const emptyFreeCells = this.getEmptyFreeCellsCount();
        const emptyTableauColumns = this.getEmptyTableauColumnsCount();

        // Formula: (1 + number of empty free cells) * 2^(number of empty tableau columns)
        return (1 + emptyFreeCells) * Math.pow(2, emptyTableauColumns);
    }

    /**
     * Update card draggability based on FreeCell rules
     */
    private updateCardDraggability(): void {
        // All face-up cards are potentially draggable, but we need to check sequences
        for (let col = 0; col < this.gameState.tableau.length; col++) {
            const column = this.gameState.tableau[col];
            for (let i = 0; i < column.length; i++) {
                const card = column[i] as Card;
                // A card is draggable if it can form a valid sequence from its position
                card.draggable = this.canMoveSequenceFromTableau({ zone: 'tableau', index: col }, card);
            }
        }

        // Free cell cards are always draggable
        if (this.gameState.freeCells) {
            this.gameState.freeCells.forEach(card => {
                if (card) {
                    (card as Card).draggable = true;
                }
            });
        }
    }

    /**
     * Update score based on moves
     */
    private updateScore(move: Move): void {
        // FreeCell scoring: points for foundation moves, small penalty for other moves
        let scoreChange = 0;

        if (move.to.zone === 'foundation') {
            scoreChange = 10; // Points for moving to foundation
        } else {
            scoreChange = -1; // Small penalty for other moves to encourage efficiency
        }

        this.gameState.score += scoreChange;

        logGameAction('FreeCell score updated', 'freecell', {
            moveType: move.to.zone,
            scoreChange,
            totalScore: this.gameState.score
        });
    }

    /**
     * Debug method to get detailed validation information
     */
    debugValidateMove(from: Position, to: Position, card: Card): { isValid: boolean; reason: string; ruleViolations?: string[] } {
        const ruleViolations: string[] = [];
        let reason = '';
        let isValid = true;

        // Cannot move face-down cards
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

        // Validate destination based on zone
        if (isValid) {
            switch (to.zone) {
                case 'foundation':
                    if (!this.validateFoundationMove(card, to)) {
                        isValid = false;
                        reason = 'Invalid foundation move';
                        ruleViolations.push('INVALID_FOUNDATION_MOVE');
                    }
                    break;
                case 'tableau':
                    if (!this.validateTableauMove(card, to, from)) {
                        isValid = false;
                        reason = 'Invalid tableau move';
                        ruleViolations.push('INVALID_TABLEAU_MOVE');
                    }
                    break;
                case 'freecell':
                    if (!this.validateFreeCellMove(card, to)) {
                        isValid = false;
                        reason = 'Invalid free cell move';
                        ruleViolations.push('INVALID_FREECELL_MOVE');
                    }
                    break;
                default:
                    isValid = false;
                    reason = `Invalid destination zone: ${to.zone}`;
                    ruleViolations.push('INVALID_DESTINATION_ZONE');
            }
        }

        if (isValid && reason === '') {
            reason = 'Move is valid according to FreeCell rules';
        }

        return {
            isValid,
            reason,
            ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined
        };
    }

    /**
     * Get the number of empty free cells
     */
    getEmptyFreeCellsCount(): number {
        if (!this.gameState.freeCells) {
            return 4; // All 4 free cells are empty if array doesn't exist
        }
        // Count undefined/null slots and slots beyond array length
        let emptyCount = 0;
        for (let i = 0; i < 4; i++) {
            if (!this.gameState.freeCells[i]) {
                emptyCount++;
            }
        }
        return emptyCount;
    }

    /**
     * Get the number of empty tableau columns
     */
    getEmptyTableauColumnsCount(): number {
        return this.gameState.tableau.filter(column => column.length === 0).length;
    }
}