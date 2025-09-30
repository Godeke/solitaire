import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SpiderEngine } from '../engines/SpiderEngine';
import { CardRenderer } from './CardRenderer';
import { DropZone } from './DropZone';
import { Card } from '../utils/Card';
import { Position, GameState } from '../types/card';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';
import { UIActionEvent } from '../types/UIActionLogging';
import { getAudioManager } from '../utils/AudioManager';
import { logGameAction } from '../utils/RendererLogger';
import './SpiderGameBoard.css';

export interface SpiderGameBoardProps {
  onGameWin?: () => void;
  onScoreChange?: (score: number) => void;
  onMoveCount?: (moves: number) => void;
  className?: string;
  // Replay mode props
  replayMode?: boolean;
  replayEngine?: UIActionReplayEngine | null;
  replayEvents?: UIActionEvent[];
}

export const SpiderGameBoard: React.FC<SpiderGameBoardProps> = ({
  onGameWin,
  onScoreChange,
  onMoveCount,
  className = '',
  replayMode = false,
  replayEngine,
  replayEvents
}) => {
  const [engine] = useState(() => new SpiderEngine());
  const [gameState, setGameState] = useState<GameState>(() => engine.initializeGame());
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);

  // Initialize replay mode if enabled
  useEffect(() => {
    if (replayMode && replayEngine) {
      // Inject the game engine instance into the replay engine
      if (typeof replayEngine.attachGameEngine === 'function') {
        replayEngine.attachGameEngine(engine);
      } else {
        (replayEngine as any).gameEngineInstance = engine;
      }
      
      logGameAction('Replay mode initialized in SpiderGameBoard', 'REPLAY', {
        hasReplayEvents: !!replayEvents,
        eventCount: replayEvents?.length || 0
      });
    }
  }, [replayMode, replayEngine, replayEvents, engine]);

  // Update parent components when game state changes
  useEffect(() => {
    if (onScoreChange) {
      onScoreChange(gameState.score);
    }
    if (onMoveCount) {
      onMoveCount(gameState.moves.length);
    }
  }, [gameState.score, gameState.moves.length, onScoreChange, onMoveCount]);

  // Check for win condition
  useEffect(() => {
    if (engine.checkWinCondition() && onGameWin) {
      onGameWin();
    }
  }, [gameState, engine, onGameWin]);

  // Helper function to log current game state
  const logGameState = useCallback(() => {
    console.log('🕷️ CURRENT SPIDER GAME STATE:');
    gameState.tableau.forEach((column, index) => {
      const columnCards = column.map(card => {
        const cardObj = card as Card;
        return `${card.faceUp ? '' : '[FACE DOWN] '}${cardObj.getRankName()} of ${cardObj.getSuitName()}${card.draggable ? ' (draggable)' : ''}`;
      });
      console.log(`  Column ${index + 1}: [${columnCards.join(', ')}]`);
    });
    
    console.log(`  Stock: ${gameState.stock?.length || 0} cards`);
    console.log(`  Completed Sequences: ${engine.getCompletedSequencesCount()}`);
  }, [gameState, engine]);

  const handleCardMove = useCallback(async (card: Card, from: Position, to: Position): Promise<boolean> => {
    console.log('\n🕷️ ===== SPIDER DRAG & DROP ATTEMPT =====');
    logGameState();

    console.log('🎯 MOVE DETAILS:', {
      card: {
        id: card.id,
        suit: card.suit,
        rank: card.rank,
        faceUp: card.faceUp,
        draggable: card.draggable,
        position: card.position
      },
      from,
      to,
      timestamp: new Date().toISOString()
    });

    const engineCard = engine.findCardById(card.id) ?? card;
    const success = engine.validateMove(from, to, engineCard);

    console.log('✅ MOVE VALIDATION RESULT:', {
      success,
      card: `${card.getRankName()} of ${card.getSuitName()}`,
      from: `${from.zone}[${from.index}]`,
      to: `${to.zone}[${to.index}]`,
      reason: success ? 'Move approved by engine' : 'Move rejected by engine'
    });

    // Get audio manager for sound effects
    const audioManager = getAudioManager();

    if (success) {
      console.log('🚀 EXECUTING SPIDER MOVE...');
      const newGameState = engine.executeMove(from, to, engineCard);
      setGameState({ ...newGameState });
      setSelectedCard(null);
      setValidMoves([]);
      console.log('✅ SPIDER MOVE COMPLETED SUCCESSFULLY');
      console.log('===== END SPIDER MOVE =====\n');
      
      // Play successful move sound
      await audioManager.playSound('card-move');
      
      return true;
    } else {
      const details = engine.debugValidateMove(from, to, engineCard);
      console.log('❌ SPIDER MOVE REJECTED - Invalid according to game rules', {
        reason: details.reason,
        ruleViolations: details.ruleViolations
      });
      console.log('===== END SPIDER MOVE =====\n');
      
      // Play invalid move sound
      await audioManager.playSound('card-invalid');
    }
    return false;
  }, [engine, logGameState]);

  const handleCardClick = useCallback((card: Card) => {
    // Handle stock pile clicks (deal cards to all columns)
    if (card.position.zone === 'stock') {
      const newGameState = engine.executeMove(
        { zone: 'stock', index: 0 },
        { zone: 'tableau', index: 0 }, // Placeholder - deals to all columns
        card
      );
      setGameState({ ...newGameState });
      return;
    }

    // Handle card selection for move hints
    if (card.draggable && card.faceUp) {
      if (selectedCard?.id === card.id) {
        // Deselect if clicking the same card
        setSelectedCard(null);
        setValidMoves([]);
      } else {
        // Select card and show valid moves
        setSelectedCard(card);
        const moves = engine.getValidMoves().filter(move => 
          move.from.zone === card.position.zone && 
          move.from.index === card.position.index
        );
        setValidMoves(moves.map(move => move.to));
      }
    }
  }, [engine, selectedCard]);

  const isValidDropTarget = useCallback((targetPosition: Position, draggedCard: Card, sourcePosition: Position): boolean => {
    switch (targetPosition.zone) {
      case 'tableau': {
        const column = gameState.tableau[targetPosition.index] || [];
        if (column.length === 0) {
          // Empty tableau column - any card or sequence can be placed
          const result = true;
          console.log('🕷️ TABLEAU CHECK (empty)', {
            card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
            result
          });
          return result;
        }
        const topCard = column[column.length - 1] as Card;
        // In Spider, cards can be placed on any card of higher rank (regardless of suit)
        const result = draggedCard.rank === topCard.rank - 1;
        console.log('🕷️ TABLEAU CHECK (stack)', {
          card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
          topCard: `${topCard.getRankName()} of ${topCard.getSuitName()}`,
          draggedRank: draggedCard.rank,
          topRank: topCard.rank,
          result
        });
        return result;
      }
      default: {
        const engineCard = engine.findCardById(draggedCard.id) ?? draggedCard;
        const validation = engine.debugValidateMove(sourcePosition, targetPosition, engineCard);
        console.log('🔍 SPIDER DROP VALIDATION CHECK', {
          card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
          engineCardPosition: engineCard.position,
          from: sourcePosition,
          to: targetPosition,
          allowed: validation.isValid,
          reason: validation.reason,
          ruleViolations: validation.ruleViolations
        });
        return validation.isValid;
      }
    }
  }, [engine, gameState.tableau]);

  const isHighlighted = useCallback((position: Position): boolean => {
    return validMoves.some(move => 
      move.zone === position.zone && move.index === position.index
    );
  }, [validMoves]);

  const newGame = useCallback(() => {
    const newGameState = engine.initializeGame();
    setGameState({ ...newGameState });
    setSelectedCard(null);
    setValidMoves([]);
  }, [engine]);

  const renderTableauColumn = (columnIndex: number) => {
    const column = gameState.tableau[columnIndex];
    const position: Position = { zone: 'tableau', index: columnIndex };

    return (
      <div key={`tableau-${columnIndex}`} className="tableau-column">
        <DropZone
          position={position}
          onCardDrop={handleCardMove}
          isValidDropTarget={(card, from) => isValidDropTarget(position, card, from)}
          className={`tableau-drop-zone ${isHighlighted(position) ? 'highlighted' : ''}`}
          placeholder={`Column ${columnIndex + 1}`}
          showPlaceholder={column.length === 0}
        >
          {column.map((card, cardIndex) => (
            <CardRenderer
              key={card.id}
              card={card as Card}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={cardIndex === column.length - 1 ? ((draggedCard, from) => isValidDropTarget(card.position, draggedCard, from)) : false}
              className={`tableau-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
              style={{
                position: 'absolute',
                top: `${cardIndex * 20}px`,
                zIndex: cardIndex
              }}
            />
          ))}
        </DropZone>
      </div>
    );
  };

  const renderStockPile = () => {
    const stock = gameState.stock || [];
    const topCard = stock.length > 0 ? stock[stock.length - 1] : null;

    return (
      <div className="stock-pile">
        {topCard ? (
          <CardRenderer
            key={topCard.id}
            card={topCard as Card}
            onCardMove={handleCardMove}
            onCardClick={handleCardClick}
            isValidDropTarget={false}
            className="stock-card"
          />
        ) : (
          <div className="empty-stock">
            <div className="empty-stock-content">Empty</div>
          </div>
        )}
      </div>
    );
  };

  const renderCompletedSequences = () => {
    const completedCount = engine.getCompletedSequencesCount();
    
    return (
      <div className="completed-sequences">
        <div className="completed-sequences-label">Completed Sequences:</div>
        <div className="completed-sequences-count">{completedCount} / 8</div>
        <div className="completed-sequences-visual">
          {Array.from({ length: 8 }, (_, i) => (
            <div 
              key={i} 
              className={`sequence-indicator ${i < completedCount ? 'completed' : 'incomplete'}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`spider-game-board ${className}`} data-testid="spider-game-board">
      <div className="game-header">
        <div className="game-info">
          <div className="score">Score: {gameState.score}</div>
          <div className="moves">Moves: {gameState.moves.length}</div>
          {renderCompletedSequences()}
        </div>
        <div className="game-controls">
          <button onClick={newGame} className="new-game-btn">
            New Game
          </button>
        </div>
      </div>

      <div className="game-area">
        <div className="top-area">
          <div className="stock-area">
            {renderStockPile()}
            <div className="stock-info">
              <div className="stock-count">Stock: {gameState.stock?.length || 0}</div>
              <div className="stock-hint">
                {gameState.stock && gameState.stock.length > 0 
                  ? "Click to deal cards" 
                  : "No more cards"}
              </div>
            </div>
          </div>
        </div>

        <div className="tableau-area">
          {Array.from({ length: 10 }, (_, i) => renderTableauColumn(i))}
        </div>
      </div>

      {selectedCard && (
        <motion.div
          className="move-hint"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          Selected: {(selectedCard as Card).getRankName()} of {(selectedCard as Card).getSuitName()}
          <br />
          Valid moves highlighted in green
        </motion.div>
      )}
    </div>
  );
};

export default SpiderGameBoard;