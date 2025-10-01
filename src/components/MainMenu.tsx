import React, { useEffect, useState } from 'react';
import { GameStateManager } from '../utils/GameStateManager';
import { StatisticsDisplay } from './StatisticsDisplay';
import { logUserInteraction, logComponentMount, logComponentUnmount } from '../utils/RendererLogger';
import './MainMenu.css';

export type GameType = 'klondike' | 'spider' | 'freecell';

export interface GameVariant {
  id: GameType;
  name: string;
  description: string;
  isAvailable: boolean;
  features: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface MainMenuProps {
  onStartGame: (gameType: GameType) => void;
  onContinueGame: (gameType: GameType) => void;
  className?: string;
}

const GAME_VARIANTS: GameVariant[] = [
  {
    id: 'klondike',
    name: 'Klondike',
    description: 'The classic solitaire game with 7 tableau columns and foundation piles.',
    isAvailable: true,
    features: ['Classic gameplay', 'Auto-complete', 'Undo moves', 'Score tracking'],
    difficulty: 'Easy'
  },
  {
    id: 'spider',
    name: 'Spider',
    description: 'Build sequences in the same suit across 10 tableau columns.',
    isAvailable: true,
    features: ['10 tableau columns', 'Same suit sequences', 'Multiple difficulty levels'],
    difficulty: 'Hard'
  },
  {
    id: 'freecell',
    name: 'FreeCell',
    description: 'Strategic solitaire with 4 free cells and open tableau.',
    isAvailable: true,
    features: ['4 free cells', 'All cards visible', 'Strategic gameplay'],
    difficulty: 'Medium'
  }
];

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onContinueGame,
  className = ''
}) => {
  const [showStatistics, setShowStatistics] = useState(false);

  // Component lifecycle logging
  useEffect(() => {
    logComponentMount('MainMenu', {});
    return () => logComponentUnmount('MainMenu');
  }, []);

  const handleStartGame = (gameType: GameType) => {
    logUserInteraction('Start new game from menu', 'MainMenu', { gameType });
    onStartGame(gameType);
  };

  const handleContinueGame = (gameType: GameType) => {
    logUserInteraction('Continue game from menu', 'MainMenu', { gameType });
    onContinueGame(gameType);
  };

  const handleToggleStatistics = () => {
    logUserInteraction('Toggle statistics display', 'MainMenu', { showStatistics: !showStatistics });
    setShowStatistics(!showStatistics);
  };

  const handleStatisticsReset = () => {
    // Force re-render by toggling statistics view
    setShowStatistics(false);
    setTimeout(() => setShowStatistics(true), 100);
  };

  const renderGameCard = (variant: GameVariant) => {
    const hasSavedGame = GameStateManager.hasSavedGameState(variant.id);
    
    return (
      <div 
        key={variant.id}
        className={`game-card ${!variant.isAvailable ? 'disabled' : ''}`}
        data-testid={`${variant.id}-card`}
      >
        <div className="game-card-header">
          <h3 className="game-name">{variant.name}</h3>
          <span className={`difficulty-badge difficulty-${variant.difficulty.toLowerCase()}`}>
            {variant.difficulty}
          </span>
        </div>
        
        <p className="game-description">{variant.description}</p>
        
        <div className="game-features">
          <h4>Features:</h4>
          <ul>
            {variant.features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
        
        <div className="game-actions">
          {variant.isAvailable ? (
            <>
              <button 
                className="play-button"
                onClick={() => handleStartGame(variant.id)}
                data-testid={`play-${variant.id}`}
              >
                New Game
              </button>
              {hasSavedGame && (
                <button 
                  className="continue-button"
                  onClick={() => handleContinueGame(variant.id)}
                  data-testid={`continue-${variant.id}`}
                >
                  Continue Game
                </button>
              )}
            </>
          ) : (
            <button 
              className="play-button disabled"
              disabled
              data-testid={`play-${variant.id}`}
            >
              Coming Soon
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`main-menu ${className}`} data-testid="main-menu">
      <div className="menu-header">
        <h1 className="game-title">Solitaire Collection</h1>
        <p className="game-subtitle">Choose your favorite solitaire variant</p>
      </div>

      <div className="game-selection" data-testid="game-selection">
        {GAME_VARIANTS.map(renderGameCard)}
      </div>

      <div className="menu-actions">
        <button
          className="statistics-toggle"
          onClick={handleToggleStatistics}
          data-testid="statistics-toggle"
        >
          {showStatistics ? 'Hide Statistics' : 'Show Statistics'}
        </button>
      </div>

      {showStatistics && (
        <StatisticsDisplay 
          onResetStatistics={handleStatisticsReset}
          data-testid="statistics-section"
        />
      )}

      <div className="menu-footer">
        <p className="version-info">Version 1.0.0</p>
        <p className="copyright">© 2024 Solitaire Collection</p>
      </div>
    </div>
  );
};

export default MainMenu;