import React, { useState, useCallback, useEffect } from 'react';
import { KlondikeGameBoard } from './KlondikeGameBoard';
import { GameControls } from './GameControls';
import { GameStateManager } from '../utils/GameStateManager';
import { GameState } from '../types/card';
import './GameManager.css';

export type GameType = 'klondike' | 'spider' | 'freecell';
export type AppState = 'menu' | 'game';

export interface GameManagerProps {
  initialGameType?: GameType;
  initialState?: AppState;
  onStateChange?: (state: AppState, gameType?: GameType) => void;
  className?: string;
}

export const GameManager: React.FC<GameManagerProps> = ({
  initialGameType = 'klondike',
  initialState = 'menu',
  onStateChange,
  className = ''
}) => {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [currentGameType, setCurrentGameType] = useState<GameType>(initialGameType);
  const [gameKey, setGameKey] = useState<number>(0); // Force re-render of game board
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [score, setScore] = useState<number>(0);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [isGameWon, setIsGameWon] = useState<boolean>(false);

  // Load saved game state on mount
  useEffect(() => {
    if (appState === 'game') {
      const savedState = GameStateManager.loadGameState(currentGameType);
      if (savedState) {
        setGameState(savedState);
        setScore(savedState.score);
        setMoveCount(savedState.moves.length);
      }
    }
  }, [appState, currentGameType]);

  // Save game state when it changes
  useEffect(() => {
    if (gameState && appState === 'game') {
      GameStateManager.saveGameState(gameState);
    }
  }, [gameState, appState]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(appState, appState === 'game' ? currentGameType : undefined);
    }
  }, [appState, currentGameType, onStateChange]);

  const handleStartGame = useCallback((gameType: GameType) => {
    setCurrentGameType(gameType);
    setAppState('game');
    setGameKey(prev => prev + 1); // Force new game
    setIsGameWon(false);
    setScore(0);
    setMoveCount(0);
    
    // Clear any existing saved state for new game
    GameStateManager.clearGameState(gameType);
  }, []);

  const handleBackToMenu = useCallback(() => {
    setAppState('menu');
    setGameState(null);
    setIsGameWon(false);
  }, []);

  const handleNewGame = useCallback(() => {
    setGameKey(prev => prev + 1); // Force re-render with new game
    setIsGameWon(false);
    setScore(0);
    setMoveCount(0);
    
    // Clear saved state
    GameStateManager.clearGameState(currentGameType);
  }, [currentGameType]);

  const handleGameWin = useCallback(() => {
    setIsGameWon(true);
    // TODO: Update statistics when statistics system is implemented
  }, []);

  const handleScoreChange = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleMoveCountChange = useCallback((moves: number) => {
    setMoveCount(moves);
  }, []);

  const renderMainMenu = () => {
    return (
      <div className="main-menu" data-testid="main-menu">
        <div className="menu-header">
          <h1 className="game-title">Solitaire Collection</h1>
          <p className="game-subtitle">Choose your favorite solitaire variant</p>
        </div>

        <div className="game-selection">
          <div className="game-card" data-testid="klondike-card">
            <h3>Klondike</h3>
            <p>The classic solitaire game with 7 tableau columns</p>
            <div className="game-actions">
              <button 
                className="play-button"
                onClick={() => handleStartGame('klondike')}
                data-testid="play-klondike"
              >
                Play Klondike
              </button>
              {GameStateManager.hasSavedGameState('klondike') && (
                <button 
                  className="continue-button"
                  onClick={() => {
                    setCurrentGameType('klondike');
                    setAppState('game');
                  }}
                  data-testid="continue-klondike"
                >
                  Continue Game
                </button>
              )}
            </div>
          </div>

          <div className="game-card disabled" data-testid="spider-card">
            <h3>Spider</h3>
            <p>Build sequences in the same suit (Coming Soon)</p>
            <div className="game-actions">
              <button 
                className="play-button disabled"
                disabled
                data-testid="play-spider"
              >
                Coming Soon
              </button>
            </div>
          </div>

          <div className="game-card disabled" data-testid="freecell-card">
            <h3>FreeCell</h3>
            <p>Strategic solitaire with free cells (Coming Soon)</p>
            <div className="game-actions">
              <button 
                className="play-button disabled"
                disabled
                data-testid="play-freecell"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGameBoard = () => {
    switch (currentGameType) {
      case 'klondike':
        return (
          <KlondikeGameBoard
            key={gameKey}
            onGameWin={handleGameWin}
            onScoreChange={handleScoreChange}
            onMoveCount={handleMoveCountChange}
            className="game-board"
          />
        );
      case 'spider':
      case 'freecell':
        // TODO: Implement Spider and FreeCell game boards
        return (
          <div className="game-placeholder" data-testid="game-placeholder">
            <h2>{currentGameType.charAt(0).toUpperCase() + currentGameType.slice(1)} Solitaire</h2>
            <p>This game variant is not yet implemented.</p>
            <button onClick={handleBackToMenu} className="back-button">
              Back to Menu
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderGameView = () => {
    return (
      <div className="game-view" data-testid="game-view">
        <GameControls
          onNewGame={handleNewGame}
          onBackToMenu={handleBackToMenu}
          gameType={currentGameType}
          className="game-controls"
        />
        
        <div className="game-info-bar">
          <div className="game-stats">
            <span className="stat-item" data-testid="score-display">
              Score: {score}
            </span>
            <span className="stat-item" data-testid="moves-display">
              Moves: {moveCount}
            </span>
          </div>
          {isGameWon && (
            <div className="win-message" data-testid="win-message">
              🎉 Congratulations! You won!
            </div>
          )}
        </div>

        <div className="game-content">
          {renderGameBoard()}
        </div>
      </div>
    );
  };

  return (
    <div className={`game-manager ${className}`} data-testid="game-manager">
      {appState === 'menu' ? renderMainMenu() : renderGameView()}
    </div>
  );
};

export default GameManager;