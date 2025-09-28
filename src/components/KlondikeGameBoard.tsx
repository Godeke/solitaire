import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KlondikeEngine } from '../engines/KlondikeEngine';
import { CardRenderer } from './CardRenderer';
import { DropZone } from './DropZone';
import { Card } from '../utils/Card';
import { Position, GameState } from '../types/card';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';
import { UIActionEvent } from '../types/UIActionLogging';
import { logGameAction } from '../utils/RendererLogger';
import './KlondikeGameBoard.css';

export interface KlondikeGameBoardProps {
  onGameWin?: () => void;
  onScoreChange?: (score: number) => void;
  onMoveCount?: (moves: number) => void;
  className?: string;
  // Replay mode props
  replayMode?: boolean;
  replayEngine?: UIActionReplayEngine | null;
  replayEvents?: UIActionEvent[];
}

export const KlondikeGameBoard: React.FC<KlondikeGameBoardProps> = ({
  onGameWin,
  onScoreChange,
  onMoveCount,
  className = '',
  replayMode = false,
  replayEngine,
  replayEvents
}) => {
  const [engine] = useState(() => new KlondikeEngine());
  const [gameState, setGameState] = useState<GameState>(() => engine.initializeGame());
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);

  // Initialize replay mode if enabled
  useEffect(() => {
    if (replayMode && replayEngine) {
      // Inject the game engine instance into the replay engine
      // This allows the replay engine to execute moves through the game engine
      if (typeof replayEngine.attachGameEngine === 'function') {
        replayEngine.attachGameEngine(engine);
      } else {
        (replayEngine as any).gameEngineInstance = engine;
      }
      
      logGameAction('Replay mode initialized in KlondikeGameBoard', 'REPLAY', {
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
    console.log('🎮 CURRENT GAME STATE:');
    gameState.tableau.forEach((column, index) => {
      const columnCards = column.map(card => 
        `${card.faceUp ? '' : '[FACE DOWN] '}${card.getRankName()} of ${card.getSuitName()}${card.draggable ? ' (draggable)' : ''}`
      );
      console.log(`  Column ${index + 1}: [${columnCards.join(', ')}]`);
    });
    
    const wasteCards = gameState.waste?.map(card => 
      `${card.getRankName()} of ${card.getSuitName()}`
    ) || [];
    console.log(`  Waste: [${wasteCards.join(', ')}] (top: ${wasteCards[wasteCards.length - 1] || 'empty'})`);
    
    console.log(`  Stock: ${gameState.stock?.length || 0} cards`);
  }, [gameState]);

  const handleCardMove = useCallback((card: Card, from: Position, to: Position): boolean => {
    console.log('\n🎯 ===== DRAG & DROP ATTEMPT =====');
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

    const success = engine.validateMove(from, to, card);
    
    console.log('✅ MOVE VALIDATION RESULT:', {
      success,
      card: `${card.getRankName()} of ${card.getSuitName()}`,
      from: `${from.zone}[${from.index}]`,
      to: `${to.zone}[${to.index}]`
    });

    if (success) {
      console.log('🚀 EXECUTING MOVE...');
      const newGameState = engine.executeMove(from, to, card);
      setGameState({ ...newGameState });
      setSelectedCard(null);
      setValidMoves([]);
      console.log('✅ MOVE COMPLETED SUCCESSFULLY');
      console.log('===== END MOVE =====\n');
      return true;
    } else {
      console.log('❌ MOVE REJECTED - Invalid according to game rules');
      console.log('===== END MOVE =====\n');
    }
    return false;
  }, [engine, logGameState]);

  const handleCardClick = useCallback((card: Card) => {
    // Handle stock pile clicks (deal cards)
    if (card.position.zone === 'stock') {
      const newGameState = engine.executeStockToWasteMove();
      setGameState({ ...newGameState });
      return;
    }

    // Handle waste pile clicks when stock is empty (reset)
    if (card.position.zone === 'waste' && 
        gameState.stock && gameState.stock.length === 0) {
      const newGameState = engine.resetWasteToStock();
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
  }, [engine, gameState.stock, selectedCard]);

  const isValidDropTarget = useCallback((targetPosition: Position, draggedCard: Card): boolean => {
    return engine.validateMove(draggedCard.position, targetPosition, draggedCard);
  }, [engine]);

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
          isValidDropTarget={(card) => isValidDropTarget(position, card)}
          className={`tableau-drop-zone ${isHighlighted(position) ? 'highlighted' : ''}`}
          placeholder={`Column ${columnIndex + 1}`}
          showPlaceholder={column.length === 0}
        >
          {column.map((card, cardIndex) => (
            <CardRenderer
              key={card.id}
              card={card}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
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

  const renderFoundationPile = (pileIndex: number) => {
    const pile = gameState.foundation[pileIndex];
    const position: Position = { zone: 'foundation', index: pileIndex };
    const topCard = pile.length > 0 ? pile[pile.length - 1] : null;

    return (
      <div key={`foundation-${pileIndex}`} className="foundation-pile">
        <DropZone
          position={position}
          onCardDrop={handleCardMove}
          isValidDropTarget={(card) => isValidDropTarget(position, card)}
          className={`foundation-drop-zone ${isHighlighted(position) ? 'highlighted' : ''}`}
          placeholder={`Foundation ${pileIndex + 1}`}
          showPlaceholder={!topCard}
        >
          {topCard && (
            <CardRenderer
              key={topCard.id}
              card={topCard}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
              className={`foundation-card ${selectedCard?.id === topCard.id ? 'selected' : ''}`}
            />
          )}
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
            card={topCard}
            onCardMove={handleCardMove}
            onCardClick={handleCardClick}
            isValidDropTarget={false}
            className="stock-card"
          />
        ) : (
          <div className="empty-stock" onClick={() => {
            // Reset waste to stock when stock is empty
            if (gameState.waste && gameState.waste.length > 0) {
              const newGameState = engine.resetWasteToStock();
              setGameState({ ...newGameState });
            }
          }}>
            <div className="empty-stock-content">↻</div>
          </div>
        )}
      </div>
    );
  };

  const renderWastePile = () => {
    const waste = gameState.waste || [];
    const topCard = waste.length > 0 ? waste[waste.length - 1] : null;

    return (
      <div className="waste-pile">
        {topCard ? (
          <CardRenderer
            key={topCard.id}
            card={topCard}
            onCardMove={handleCardMove}
            onCardClick={handleCardClick}
            isValidDropTarget={false}
            className={`waste-card ${selectedCard?.id === topCard.id ? 'selected' : ''}`}
          />
        ) : (
          <div className="empty-waste">
            <div className="empty-waste-content">Waste</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`klondike-game-board ${className}`} data-testid="klondike-game-board">
      <div className="game-header">
        <div className="game-info">
          <div className="score">Score: {gameState.score}</div>
          <div className="moves">Moves: {gameState.moves.length}</div>
        </div>
        <div className="game-controls">
          <button onClick={newGame} className="new-game-btn">
            New Game
          </button>
        </div>
      </div>

      <div className="game-area">
        <div className="top-area">
          <div className="stock-waste-area">
            {renderStockPile()}
            {renderWastePile()}
          </div>
          <div className="foundation-area">
            {Array.from({ length: 4 }, (_, i) => renderFoundationPile(i))}
          </div>
        </div>

        <div className="tableau-area">
          {Array.from({ length: 7 }, (_, i) => renderTableauColumn(i))}
        </div>
      </div>

      {selectedCard && (
        <motion.div
          className="move-hint"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          Selected: {selectedCard.getRankName()} of {selectedCard.getSuitName()}
          <br />
          Valid moves highlighted in green
        </motion.div>
      )}
    </div>
  );
};

export default KlondikeGameBoard;
