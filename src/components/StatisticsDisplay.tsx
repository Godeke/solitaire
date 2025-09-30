import React, { useState, useEffect } from 'react';
import { StatisticsManager, ExtendedGameStatistics, AllGameStatistics } from '../utils/StatisticsManager';
import { logUserInteraction, logComponentMount, logComponentUnmount } from '../utils/RendererLogger';
import './StatisticsDisplay.css';

export interface StatisticsDisplayProps {
  className?: string;
  onResetStatistics?: () => void;
}

export const StatisticsDisplay: React.FC<StatisticsDisplayProps> = ({
  className = '',
  onResetStatistics
}) => {
  const [statistics, setStatistics] = useState<AllGameStatistics | null>(null);
  const [selectedGame, setSelectedGame] = useState<'overall' | 'klondike' | 'spider' | 'freecell'>('overall');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Component lifecycle logging
  useEffect(() => {
    logComponentMount('StatisticsDisplay', {});
    return () => logComponentUnmount('StatisticsDisplay');
  }, []);

  // Load statistics on mount
  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = () => {
    const stats = StatisticsManager.getAllStatistics();
    setStatistics(stats);
  };

  const handleGameSelection = (gameType: 'overall' | 'klondike' | 'spider' | 'freecell') => {
    logUserInteraction('Select statistics game type', 'StatisticsDisplay', { gameType });
    setSelectedGame(gameType);
  };

  const handleResetRequest = () => {
    logUserInteraction('Request statistics reset', 'StatisticsDisplay', { gameType: selectedGame });
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    logUserInteraction('Confirm statistics reset', 'StatisticsDisplay', { gameType: selectedGame });
    
    if (selectedGame === 'overall') {
      StatisticsManager.resetAllStatistics();
    } else {
      StatisticsManager.resetGameStatistics(selectedGame);
    }
    
    loadStatistics();
    setShowResetConfirm(false);
    onResetStatistics?.();
  };

  const handleResetCancel = () => {
    logUserInteraction('Cancel statistics reset', 'StatisticsDisplay', { gameType: selectedGame });
    setShowResetConfirm(false);
  };

  const renderStatisticItem = (label: string, value: string | number, testId?: string) => (
    <div className="statistic-item" data-testid={testId}>
      <span className="statistic-label">{label}:</span>
      <span className="statistic-value">{value}</span>
    </div>
  );

  const renderGameStatistics = (stats: ExtendedGameStatistics, gameType: string) => {
    const winPercentage = StatisticsManager.calculateWinPercentage(stats);
    
    return (
      <div className="statistics-content" data-testid={`${gameType}-statistics`}>
        <div className="statistics-grid">
          <div className="statistics-section">
            <h4>Game Performance</h4>
            {renderStatisticItem('Games Played', stats.gamesPlayed, `${gameType}-games-played`)}
            {renderStatisticItem('Games Won', stats.gamesWon, `${gameType}-games-won`)}
            {renderStatisticItem('Win Rate', `${winPercentage}%`, `${gameType}-win-rate`)}
            {renderStatisticItem('Current Streak', stats.currentStreak, `${gameType}-current-streak`)}
            {renderStatisticItem('Best Streak', stats.longestStreak, `${gameType}-best-streak`)}
          </div>

          <div className="statistics-section">
            <h4>Time Performance</h4>
            {renderStatisticItem('Best Time', StatisticsManager.formatDuration(stats.bestTime), `${gameType}-best-time`)}
            {renderStatisticItem('Average Time', StatisticsManager.formatDuration(stats.averageTime), `${gameType}-average-time`)}
            {renderStatisticItem('Total Time', StatisticsManager.formatDuration(stats.totalTime), `${gameType}-total-time`)}
            {stats.fastestWin && renderStatisticItem('Fastest Win', StatisticsManager.formatDuration(stats.fastestWin), `${gameType}-fastest-win`)}
          </div>

          <div className="statistics-section">
            <h4>Move Statistics</h4>
            {renderStatisticItem('Total Moves', stats.totalMoves || 0, `${gameType}-total-moves`)}
            {renderStatisticItem('Average Moves', Math.round(stats.averageMoves || 0), `${gameType}-average-moves`)}
            {stats.lastPlayed && renderStatisticItem('Last Played', stats.lastPlayed.toLocaleDateString(), `${gameType}-last-played`)}
          </div>
        </div>
      </div>
    );
  };

  if (!statistics) {
    return (
      <div className={`statistics-display loading ${className}`} data-testid="statistics-loading">
        <p>Loading statistics...</p>
      </div>
    );
  }

  const currentStats = statistics[selectedGame];
  const hasAnyGames = statistics.overall.gamesPlayed > 0;

  return (
    <div className={`statistics-display ${className}`} data-testid="statistics-display">
      <div className="statistics-header">
        <h3>Game Statistics</h3>
        
        <div className="game-selector">
          <button
            className={`game-tab ${selectedGame === 'overall' ? 'active' : ''}`}
            onClick={() => handleGameSelection('overall')}
            data-testid="overall-tab"
          >
            Overall
          </button>
          <button
            className={`game-tab ${selectedGame === 'klondike' ? 'active' : ''}`}
            onClick={() => handleGameSelection('klondike')}
            data-testid="klondike-tab"
          >
            Klondike
          </button>
          <button
            className={`game-tab ${selectedGame === 'spider' ? 'active' : ''} disabled`}
            onClick={() => handleGameSelection('spider')}
            disabled
            data-testid="spider-tab"
          >
            Spider
          </button>
          <button
            className={`game-tab ${selectedGame === 'freecell' ? 'active' : ''} disabled`}
            onClick={() => handleGameSelection('freecell')}
            disabled
            data-testid="freecell-tab"
          >
            FreeCell
          </button>
        </div>
      </div>

      {hasAnyGames ? (
        <>
          {renderGameStatistics(currentStats, selectedGame)}
          
          <div className="statistics-actions">
            <button
              className="reset-button"
              onClick={handleResetRequest}
              data-testid="reset-statistics-button"
            >
              Reset {selectedGame === 'overall' ? 'All' : selectedGame} Statistics
            </button>
          </div>
        </>
      ) : (
        <div className="no-statistics" data-testid="no-statistics">
          <p>No games played yet. Start playing to see your statistics!</p>
        </div>
      )}

      {showResetConfirm && (
        <div className="reset-confirm-overlay" data-testid="reset-confirm-overlay">
          <div className="reset-confirm-dialog">
            <h4>Confirm Reset</h4>
            <p>
              Are you sure you want to reset {selectedGame === 'overall' ? 'all' : selectedGame} statistics? 
              This action cannot be undone.
            </p>
            <div className="reset-confirm-actions">
              <button
                className="confirm-button"
                onClick={handleResetConfirm}
                data-testid="confirm-reset"
              >
                Yes, Reset
              </button>
              <button
                className="cancel-button"
                onClick={handleResetCancel}
                data-testid="cancel-reset"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsDisplay;