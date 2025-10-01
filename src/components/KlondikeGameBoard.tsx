import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KlondikeEngine } from '../engines/KlondikeEngine';
import { CardRenderer } from './CardRenderer';
import { DropZone } from './DropZone';
import { WinAnimation } from './WinAnimation';
import { CardCascadeAnimation } from './CardCascadeAnimation';
import { Card } from '../utils/Card';
import { Position, GameState } from '../types/card';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';
import { UIActionEvent } from '../types/UIActionLogging';
import { getAudioManager } from '../utils/AudioManager';
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
  // Win animation props
  enableWinAnimations?: boolean;
  onWinAnimationComplete?: () => void;
}

export const KlondikeGameBoard: React.FC<KlondikeGameBoardProps> = ({
  onGameWin,
  onScoreChange,
  onMoveCount,
  className = '',
  replayMode = false,
  replayEngine,
  replayEvents,
  enableWinAnimations = true,
  onWinAnimationComplete
}) => {
  const [engine] = useState(() => new KlondikeEngine());
  const [gameState, setGameState] = useState<GameState>(() => engine.initializeGame());
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [showCardCascade, setShowCardCascade] = useState(false);
  const [gameStartTime] = useState(() => Date.now());
  const [isGameWon, setIsGameWon] = useState(false);

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

  // Check for win condition and trigger animations
  useEffect(() => {
    const hasWon = engine.checkWinCondition();
    if (hasWon && !isGameWon) {
      setIsGameWon(true);
      
      if (enableWinAnimations) {
        // Start with card cascade animation
        setShowCardCascade(true);
        
        // Follow with win celebration after cascade
        const winAnimationTimer = setTimeout(() => {
          setShowWinAnimation(true);
        }, 1500);
        
        return () => clearTimeout(winAnimationTimer);
      } else if (onGameWin) {
        // If animations are disabled, call win callback immediately
        onGameWin();
      }
    }
  }, [gameState, engine, onGameWin, isGameWon, enableWinAnimations]);

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

  const handleCardMove = useCallback(async (card: Card, from: Position, to: Position): Promise<boolean> => {
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
      console.log('🚀 EXECUTING MOVE...');
      const newGameState = engine.executeMove(from, to, engineCard);
      setGameState({ ...newGameState });
      setSelectedCard(null);
      setValidMoves([]);
      console.log('✅ MOVE COMPLETED SUCCESSFULLY');
      console.log('===== END MOVE =====\n');
      
      // Play successful move sound
      await audioManager.playSound('card-move');
      
      return true;
    } else {
      const details = engine.debugValidateMove(from, to, engineCard);
      console.log('❌ MOVE REJECTED - Invalid according to game rules', {
        reason: details.reason,
        ruleViolations: details.ruleViolations
      });
      console.log('❌ MOVE REJECTED - Invalid according to game rules');
      console.log('===== END MOVE =====\n');
      
      // Play invalid move sound
      await audioManager.playSound('card-invalid');
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

  const isValidDropTarget = useCallback((targetPosition: Position, draggedCard: Card, sourcePosition: Position): boolean => {
    switch (targetPosition.zone) {
      case 'foundation': {
        const pile = gameState.foundation[targetPosition.index] || [];
        if (pile.length === 0) {
          const result = draggedCard.rank === 1;
          console.log('🧪 FOUNDATION CHECK (empty)', {
            card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
            rank: draggedCard.rank,
            result
          });
          return result;
        }
        const topCard = pile[pile.length - 1] as Card;
        const result = draggedCard.suit === topCard.suit && draggedCard.rank === topCard.rank + 1;
        console.log('🧪 FOUNDATION CHECK (stack)', {
          card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
          topCard: `${topCard.getRankName()} of ${topCard.getSuitName()}`,
          suitsMatch: draggedCard.suit === topCard.suit,
          ranksSequential: draggedCard.rank === topCard.rank + 1,
          result
        });
        return result;
      }
      case 'tableau': {
        const column = gameState.tableau[targetPosition.index] || [];
        if (column.length === 0) {
          const result = draggedCard.rank === 13;
          console.log('🧪 TABLEAU CHECK (empty)', {
            card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
            rank: draggedCard.rank,
            result
          });
          return result;
        }
        const topCard = column[column.length - 1] as Card;
        const result = draggedCard.canStackOn(topCard);
        console.log('🧪 TABLEAU CHECK (stack)', {
          card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
          topCard: `${topCard.getRankName()} of ${topCard.getSuitName()}`,
          result
        });
        return result;
      }
      default: {
        const engineCard = engine.findCardById(draggedCard.id) ?? draggedCard;
        const validation = engine.debugValidateMove(sourcePosition, targetPosition, engineCard);
        console.log('🔍 DROP VALIDATION CHECK', {
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
  }, [engine, gameState.foundation, gameState.tableau]);

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
    setShowWinAnimation(false);
    setShowCardCascade(false);
    setIsGameWon(false);
  }, [engine]);

  // Get all cards for cascade animation
  const getAllFoundationCards = useCallback((): Card[] => {
    const allCards: Card[] = [];
    gameState.foundation.forEach(pile => {
      allCards.push(...pile);
    });
    return allCards;
  }, [gameState.foundation]);

  // Handle card cascade animation completion
  const handleCardCascadeComplete = useCallback(() => {
    setShowCardCascade(false);
    // Trigger main win animation after cascade
    if (enableWinAnimations) {
      setShowWinAnimation(true);
    }
  }, [enableWinAnimations]);

  // Handle win animation completion
  const handleWinAnimationComplete = useCallback(() => {
    setShowWinAnimation(false);
    if (onWinAnimationComplete) {
      onWinAnimationComplete();
    }
    if (onGameWin) {
      onGameWin();
    }
  }, [onWinAnimationComplete, onGameWin]);

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
              card={card}
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

  const renderFoundationPile = (pileIndex: number) => {
    const pile = gameState.foundation[pileIndex];
    const position: Position = { zone: 'foundation', index: pileIndex };
    const topCard = pile.length > 0 ? pile[pile.length - 1] : null;

    return (
      <div key={`foundation-${pileIndex}`} className="foundation-pile">
        <DropZone
          position={position}
          onCardDrop={handleCardMove}
          isValidDropTarget={(card, from) => isValidDropTarget(position, card, from)}
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
              isValidDropTarget={(draggedCard, from) => isValidDropTarget(topCard.position, draggedCard, from)}
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
    const stackDepth = stock.length;

    return (
      <div className="stock-pile">
        {topCard ? (
          <div className="stock-stack">
            {/* Render stack indicators for cards underneath */}
            {stackDepth > 1 && (
              <div className="stock-stack-indicators">
                {Array.from({ length: Math.min(stackDepth - 1, 3) }, (_, index) => (
                  <div
                    key={`stock-stack-${index}`}
                    className="stock-stack-card"
                    style={{
                      transform: `translate(${(index + 1) * -2}px, ${(index + 1) * -2}px)`,
                      zIndex: index
                    }}
                  />
                ))}
                {stackDepth > 4 && (
                  <div className="stock-stack-count">
                    {stackDepth}
                  </div>
                )}
              </div>
            )}
            {/* Render the top card */}
            <CardRenderer
              key={topCard.id}
              card={topCard}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
              className="stock-card"
              style={{ zIndex: stackDepth }}
            />
          </div>
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
    const stackDepth = waste.length;

    return (
      <div className="waste-pile">
        {topCard ? (
          <div className="waste-stack">
            {/* Render stack indicators for cards underneath, fanned to the right */}
            {stackDepth > 1 && (
              <div className="waste-stack-indicators">
                {Array.from({ length: Math.min(stackDepth - 1, 3) }, (_, index) => (
                  <div
                    key={`stack-${index}`}
                    className="waste-stack-card"
                    style={{
                      transform: `translateX(${(index + 1) * 18}px) rotate(${(index + 1) * 2}deg)`,
                      zIndex: index,
                      transformOrigin: 'bottom left'
                    }}
                  />
                ))}
                {stackDepth > 4 && (
                  <div className="waste-stack-count">
                    +{stackDepth - 1}
                  </div>
                )}
              </div>
            )}
            {/* Render the top card */}
            <CardRenderer
              key={topCard.id}
              card={topCard}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
              className={`waste-card ${selectedCard?.id === topCard.id ? 'selected' : ''}`}
              style={{ zIndex: stackDepth }}
            />
          </div>
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

      {/* Win Animations */}
      {enableWinAnimations && (
        <>
          <CardCascadeAnimation
            isVisible={showCardCascade}
            cards={getAllFoundationCards()}
            gameType="klondike"
            onAnimationComplete={handleCardCascadeComplete}
          />
          
          <WinAnimation
            isVisible={showWinAnimation}
            gameType="klondike"
            score={gameState.score}
            moves={gameState.moves.length}
            duration={Date.now() - gameStartTime}
            onAnimationComplete={handleWinAnimationComplete}
          />
        </>
      )}
    </div>
  );
};

export default KlondikeGameBoard;
