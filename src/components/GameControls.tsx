import React from 'react';
import './GameControls.css';

export interface GameControlsProps {
  onNewGame: () => void;
  onBackToMenu: () => void;
  onUndo?: () => void;
  onHint?: () => void;
  canUndo?: boolean;
  canHint?: boolean;
  gameType?: 'klondike' | 'spider' | 'freecell';
  className?: string;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onBackToMenu,
  onUndo,
  onHint,
  canUndo = false,
  canHint = false,
  gameType,
  className = ''
}) => {
  return (
    <div className={`game-controls ${className}`} data-testid="game-controls">
      <div className="game-controls-left">
        <button 
          className="control-button menu-button"
          onClick={onBackToMenu}
          data-testid="menu-button"
          title="Back to Main Menu"
        >
          ← Menu
        </button>
        {gameType && (
          <span className="game-type-label" data-testid="game-type-label">
            {gameType.charAt(0).toUpperCase() + gameType.slice(1)}
          </span>
        )}
      </div>

      <div className="game-controls-center">
        {onUndo && (
          <button 
            className={`control-button undo-button ${!canUndo ? 'disabled' : ''}`}
            onClick={onUndo}
            disabled={!canUndo}
            data-testid="undo-button"
            title="Undo Last Move"
          >
            ↶ Undo
          </button>
        )}
        {onHint && (
          <button 
            className={`control-button hint-button ${!canHint ? 'disabled' : ''}`}
            onClick={onHint}
            disabled={!canHint}
            data-testid="hint-button"
            title="Show Hint"
          >
            💡 Hint
          </button>
        )}
      </div>

      <div className="game-controls-right">
        <button 
          className="control-button new-game-button"
          onClick={onNewGame}
          data-testid="new-game-button"
          title="Start New Game"
        >
          🔄 New Game
        </button>
      </div>
    </div>
  );
};

export default GameControls;