import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FreeCellEngine } from '../engines/FreeCellEngine';
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
import './FreeCellGameBoard.css';

export interface FreeCellGameBoardProps {
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

export const FreeCellGameBoard: React.FC<FreeCellGameBoardProps> = ({
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
  const [engine] = useState(() => new FreeCellEngine());
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
      if (typeof replayEngine.attachGameEngine === 'function') {
        replayEngine.attachGameEngine(engine);
      } else {
        (replayEngine as any).gameEngineInstance = engine;
      }
      
      logGameAction('Replay mode initialized in FreeCellGameBoard', 'REPLAY', {
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
    console.log('🏰 CURRENT FREECELL GAME STATE:');
    gameState.tableau.forEach((column, index) => {
      const columnCards = column.map(card => {
        const cardObj = card as Card;
        return `${cardObj.getRankName()} of ${cardObj.getSuitName()}${card.draggable ? ' (draggable)' : ''}`;
      });
      console.log(`  Column ${index + 1}: [${columnCards.join(', ')}]`);
    });
    
    console.log(`  Free Cells: ${gameState.freeCells?.filter(cell => cell).length || 0}/4 occupied`);
    console.log(`  Foundation: ${gameState.foundation.map(pile => pile.length).join(', ')} cards`);
    console.log(`  Empty Free Cells: ${engine.getEmptyFreeCellsCount()}`);
    console.log(`  Empty Tableau Columns: ${engine.getEmptyTableauColumnsCount()}`);
  }, [gameState, engine]);

  const handleCardMove = useCallback(async (card: Card, from: Position, to: Position): Promise<boolean> => {
    console.log('\n🏰 ===== FREECELL DRAG & DROP ATTEMPT =====');
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
      console.log('🚀 EXECUTING FREECELL MOVE...');
      const newGameState = engine.executeMove(from, to, engineCard);
      setGameState({ ...newGameState });
      setSelectedCard(null);
      setValidMoves([]);
      console.log('✅ FREECELL MOVE COMPLETED SUCCESSFULLY');
      console.log('===== END FREECELL MOVE =====\n');
      
      // Play successful move sound
      await audioManager.playSound('card-move');
      
      return true;
    } else {
      const details = engine.debugValidateMove(from, to, engineCard);
      console.log('❌ FREECELL MOVE REJECTED - Invalid according to game rules', {
        reason: details.reason,
        ruleViolations: details.ruleViolations
      });
      console.log('===== END FREECELL MOVE =====\n');
      
      // Play invalid move sound
      await audioManager.playSound('card-invalid');
    }
    return false;
  }, [engine, logGameState]);

  const handleCardClick = useCallback((card: Card) => {
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
    const engineCard = engine.findCardById(draggedCard.id) ?? draggedCard;
    const validation = engine.debugValidateMove(sourcePosition, targetPosition, engineCard);
    
    console.log('🔍 FREECELL DROP VALIDATION CHECK', {
      card: `${draggedCard.getRankName()} of ${draggedCard.getSuitName()}`,
      engineCardPosition: engineCard.position,
      from: sourcePosition,
      to: targetPosition,
      allowed: validation.isValid,
      reason: validation.reason,
      ruleViolations: validation.ruleViolations
    });
    
    return validation.isValid;
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
    setShowWinAnimation(false);
    setShowCardCascade(false);
    setIsGameWon(false);
  }, [engine]);

  // Get all foundation cards for cascade animation
  const getAllFoundationCards = useCallback((): Card[] => {
    const allCards: Card[] = [];
    gameState.foundation.forEach(pile => {
      allCards.push(...pile as Card[]);
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
              card={card as Card}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={cardIndex === column.length - 1 ? ((draggedCard, from) => isValidDropTarget(card.position, draggedCard, from)) : false}
              className={`tableau-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
              style={{
                position: 'absolute',
                top: `${cardIndex * 25}px`,
                zIndex: cardIndex
              }}
            />
          ))}
        </DropZone>
      </div>
    );
  };

  const renderFreeCell = (freeCellIndex: number) => {
    const freeCellCard = gameState.freeCells?.[freeCellIndex];
    const position: Position = { zone: 'freecell', index: freeCellIndex };
    const isEmpty = !freeCellCard;

    return (
      <div key={`freecell-${freeCellIndex}`} className="freecell-slot">
        <DropZone
          position={position}
          onCardDrop={handleCardMove}
          isValidDropTarget={(card, from) => isValidDropTarget(position, card, from)}
          className={`freecell-drop-zone ${isEmpty ? 'empty' : 'occupied'} ${isHighlighted(position) ? 'highlighted' : ''}`}
          placeholder="Free"
          showPlaceholder={isEmpty}
        >
          {freeCellCard && (
            <CardRenderer
              key={freeCellCard.id}
              card={freeCellCard as Card}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
              className={`freecell-card ${selectedCard?.id === freeCellCard.id ? 'selected' : ''}`}
            />
          )}
        </DropZone>
      </div>
    );
  };

  const renderFoundationPile = (foundationIndex: number) => {
    const foundationPile = gameState.foundation[foundationIndex];
    const topCard = foundationPile.length > 0 ? foundationPile[foundationPile.length - 1] : null;
    const position: Position = { zone: 'foundation', index: foundationIndex };
    const isEmpty = foundationPile.length === 0;

    // Determine expected suit for this foundation pile
    const expectedSuit = (['hearts', 'diamonds', 'clubs', 'spades'] as const)[foundationIndex];

    return (
      <div key={`foundation-${foundationIndex}`} className="foundation-pile">
        <DropZone
          position={position}
          onCardDrop={handleCardMove}
          isValidDropTarget={(card, from) => isValidDropTarget(position, card, from)}
          className={`foundation-drop-zone ${isEmpty ? 'empty' : 'occupied'} ${isHighlighted(position) ? 'highlighted' : ''}`}
          placeholder={expectedSuit.charAt(0).toUpperCase()}
          showPlaceholder={isEmpty}
        >
          {topCard && (
            <CardRenderer
              key={topCard.id}
              card={topCard as Card}
              onCardMove={handleCardMove}
              onCardClick={handleCardClick}
              isValidDropTarget={false}
              className={`foundation-card ${selectedCard?.id === topCard.id ? 'selected' : ''}`}
            />
          )}
        </DropZone>
        <div className="foundation-info">
          <div className="foundation-suit">{['♥', '♦', '♣', '♠'][foundationIndex]}</div>
          <div className="foundation-count">{foundationPile.length}/13</div>
        </div>
      </div>
    );
  };

  const renderGameStats = () => {
    const emptyFreeCells = engine.getEmptyFreeCellsCount();
    const emptyTableauColumns = engine.getEmptyTableauColumnsCount();
    const maxMovableCards = (1 + emptyFreeCells) * Math.pow(2, emptyTableauColumns);

    return (
      <div className="game-stats">
        <div className="stat-item">
          <div className="stat-label">Free Cells</div>
          <div className="stat-value">{emptyFreeCells}/4</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Empty Columns</div>
          <div className="stat-value">{emptyTableauColumns}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Max Movable</div>
          <div className="stat-value">{maxMovableCards}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`freecell-game-board ${className}`} data-testid="freecell-game-board">
      <div className="game-header">
        <div className="game-info">
          <div className="score">Score: {gameState.score}</div>
          <div className="moves">Moves: {gameState.moves.length}</div>
          {renderGameStats()}
        </div>
        <div className="game-controls">
          <button onClick={newGame} className="new-game-btn">
            New Game
          </button>
        </div>
      </div>

      <div className="game-area">
        <div className="top-area">
          <div className="freecells-area">
            <div className="freecells-label">Free Cells</div>
            <div className="freecells-container">
              {Array.from({ length: 4 }, (_, i) => renderFreeCell(i))}
            </div>
          </div>
          
          <div className="foundations-area">
            <div className="foundations-label">Foundations</div>
            <div className="foundations-container">
              {Array.from({ length: 4 }, (_, i) => renderFoundationPile(i))}
            </div>
          </div>
        </div>

        <div className="tableau-area">
          {Array.from({ length: 8 }, (_, i) => renderTableauColumn(i))}
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
            gameType="freecell"
            onAnimationComplete={handleCardCascadeComplete}
          />
          
          <WinAnimation
            isVisible={showWinAnimation}
            gameType="freecell"
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

export default FreeCellGameBoard;