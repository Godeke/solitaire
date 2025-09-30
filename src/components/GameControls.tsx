import React, { useState, useEffect } from 'react';
import { getAudioManager } from '../utils/AudioManager';
import { UserPreferencesManager } from '../utils/UserPreferences';
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
  showAudioControls?: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onBackToMenu,
  onUndo,
  onHint,
  canUndo = false,
  canHint = false,
  gameType,
  className = '',
  showAudioControls = true
}) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [audioVolume, setAudioVolume] = useState<number>(0.7);

  // Initialize audio state from preferences
  useEffect(() => {
    try {
      const preferencesManager = UserPreferencesManager.getInstance();
      const audioPrefs = preferencesManager.getAudioPreferences();
      setIsAudioEnabled(audioPrefs.enabled);
      setAudioVolume(audioPrefs.volume);
    } catch (error) {
      // Fall back to default values if preferences loading fails
      console.warn('Failed to load audio preferences, using defaults:', error);
      setIsAudioEnabled(true);
      setAudioVolume(0.7);
    }
  }, []);

  const handleToggleAudio = () => {
    const audioManager = getAudioManager();
    const preferencesManager = UserPreferencesManager.getInstance();
    
    const newEnabled = !isAudioEnabled;
    setIsAudioEnabled(newEnabled);
    
    audioManager.setEnabled(newEnabled);
    preferencesManager.setAudioEnabled(newEnabled);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setAudioVolume(newVolume);
    
    const audioManager = getAudioManager();
    const preferencesManager = UserPreferencesManager.getInstance();
    
    audioManager.setVolume(newVolume);
    preferencesManager.setAudioVolume(newVolume);
  };
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
        {showAudioControls && (
          <div className="audio-controls" data-testid="audio-controls">
            <button 
              className={`control-button audio-toggle-button ${!isAudioEnabled ? 'disabled' : ''}`}
              onClick={handleToggleAudio}
              data-testid="audio-toggle-button"
              title={isAudioEnabled ? 'Mute Audio' : 'Enable Audio'}
            >
              {isAudioEnabled ? '🔊' : '🔇'}
            </button>
            {isAudioEnabled && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audioVolume}
                onChange={handleVolumeChange}
                className="volume-slider"
                data-testid="volume-slider"
                title={`Volume: ${Math.round(audioVolume * 100)}%`}
              />
            )}
          </div>
        )}
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