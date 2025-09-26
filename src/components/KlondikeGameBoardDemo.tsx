import React, { useState } from 'react';
import { KlondikeGameBoard } from './KlondikeGameBoard';
import { DragDropProvider } from './DragDropProvider';
import './KlondikeGameBoardDemo.css';

export const KlondikeGameBoardDemo: React.FC = () => {
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [gameStats, setGameStats] = useState({
    gamesPlayed: 0,
    gamesWon: 0,
    bestScore: 0
  });

  const handleGameWin = () => {
    setGameWon(true);
    setGameStats(prev => ({
      ...prev,
      gamesPlayed: prev.gamesPlayed + 1,
      gamesWon: prev.gamesWon + 1,
      bestScore: Math.max(prev.bestScore, score)
    }));
    
    // Show celebration message
    setTimeout(() => {
      alert(`Congratulations! You won with a score of ${score} in ${moves} moves!`);
    }, 500);
  };

  const handleScoreChange = (newScore: number) => {
    setScore(newScore);
  };

  const handleMoveCount = (newMoves: number) => {
    setMoves(newMoves);
  };

  const resetGame = () => {
    setGameWon(false);
    setScore(0);
    setMoves(0);
  };

  const winPercentage = gameStats.gamesPlayed > 0 
    ? Math.round((gameStats.gamesWon / gameStats.gamesPlayed) * 100) 
    : 0;

  return (
    <DragDropProvider>
      <div className="klondike-demo">
        <div className="demo-header">
          <h1>Klondike Solitaire Game Board Demo</h1>
          <div className="demo-stats">
            <div className="stat-item">
              <span className="stat-label">Games Played:</span>
              <span className="stat-value">{gameStats.gamesPlayed}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Games Won:</span>
              <span className="stat-value">{gameStats.gamesWon}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Win Rate:</span>
              <span className="stat-value">{winPercentage}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Best Score:</span>
              <span className="stat-value">{gameStats.bestScore}</span>
            </div>
          </div>
        </div>

        <div className="demo-instructions">
          <h3>How to Play Klondike Solitaire:</h3>
          <ul>
            <li><strong>Goal:</strong> Move all cards to the foundation piles (Ace to King, same suit)</li>
            <li><strong>Tableau:</strong> Build down in alternating colors (Red on Black, Black on Red)</li>
            <li><strong>Stock:</strong> Click to deal cards to the waste pile</li>
            <li><strong>Foundation:</strong> Build up from Ace to King in the same suit</li>
            <li><strong>Moves:</strong> Drag cards between piles or click to select and highlight valid moves</li>
          </ul>
        </div>

        <div className="game-container">
          <KlondikeGameBoard
            onGameWin={handleGameWin}
            onScoreChange={handleScoreChange}
            onMoveCount={handleMoveCount}
            className="demo-game-board"
          />
        </div>

        {gameWon && (
          <div className="victory-overlay">
            <div className="victory-message">
              <h2>🎉 Congratulations! 🎉</h2>
              <p>You won the game!</p>
              <div className="victory-stats">
                <div>Final Score: <strong>{score}</strong></div>
                <div>Total Moves: <strong>{moves}</strong></div>
              </div>
              <button onClick={resetGame} className="play-again-btn">
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="demo-features">
          <h3>Features Demonstrated:</h3>
          <div className="feature-grid">
            <div className="feature-item">
              <h4>🎮 Complete Game Logic</h4>
              <p>Full Klondike solitaire rules implementation with move validation</p>
            </div>
            <div className="feature-item">
              <h4>🖱️ Drag & Drop</h4>
              <p>Intuitive card movement with visual feedback and drop zone highlighting</p>
            </div>
            <div className="feature-item">
              <h4>🎯 Click to Select</h4>
              <p>Click cards to select and see valid move hints highlighted in green</p>
            </div>
            <div className="feature-item">
              <h4>📊 Score Tracking</h4>
              <p>Real-time score updates and move counting with game statistics</p>
            </div>
            <div className="feature-item">
              <h4>🎨 Responsive Design</h4>
              <p>Adapts to different screen sizes with smooth animations</p>
            </div>
            <div className="feature-item">
              <h4>🏆 Win Detection</h4>
              <p>Automatic win condition checking with celebration effects</p>
            </div>
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
};

export default KlondikeGameBoardDemo;