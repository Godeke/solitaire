import React, { useState } from 'react';
import { GameManager, GameType, AppState } from './GameManager';
import './GameManagerDemo.css';

export const GameManagerDemo: React.FC = () => {
  const [currentState, setCurrentState] = useState<AppState>('menu');
  const [currentGame, setCurrentGame] = useState<GameType | undefined>();

  const handleStateChange = (state: AppState, gameType?: GameType) => {
    setCurrentState(state);
    setCurrentGame(gameType);
  };

  return (
    <div className="game-manager-demo">
      <div className="demo-header">
        <h2>Game Manager Demo</h2>
        <div className="demo-status">
          <span className="status-item">
            State: <strong>{currentState}</strong>
          </span>
          {currentGame && (
            <span className="status-item">
              Game: <strong>{currentGame}</strong>
            </span>
          )}
        </div>
      </div>
      
      <div className="demo-content">
        <GameManager
          onStateChange={handleStateChange}
          className="demo-game-manager"
        />
      </div>
    </div>
  );
};

export default GameManagerDemo;