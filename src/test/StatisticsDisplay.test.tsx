/**
 * Unit tests for StatisticsDisplay component
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatisticsDisplay } from '../components/StatisticsDisplay';
import { StatisticsManager } from '../utils/StatisticsManager';

// Mock StatisticsManager
vi.mock('../utils/StatisticsManager', () => ({
  StatisticsManager: {
    getAllStatistics: vi.fn(),
    calculateWinPercentage: vi.fn(),
    formatDuration: vi.fn(),
    resetAllStatistics: vi.fn(),
    resetGameStatistics: vi.fn(),
  },
}));

// Mock RendererLogger
vi.mock('../utils/RendererLogger', () => ({
  logUserInteraction: vi.fn(),
  logComponentMount: vi.fn(),
  logComponentUnmount: vi.fn(),
}));

const mockStatisticsManager = StatisticsManager as any;

describe('StatisticsDisplay', () => {
  const mockStatistics = {
    klondike: {
      gamesPlayed: 10,
      gamesWon: 7,
      bestTime: 120000,
      currentStreak: 3,
      longestStreak: 5,
      totalTime: 1200000,
      averageTime: 120000,
      totalMoves: 500,
      averageMoves: 50,
      lastPlayed: new Date('2024-01-01T12:00:00Z'),
      fastestWin: 90000
    },
    spider: {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTime: 0,
      averageTime: 0,
      totalMoves: 0,
      averageMoves: 0
    },
    freecell: {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTime: 0,
      averageTime: 0,
      totalMoves: 0,
      averageMoves: 0
    },
    overall: {
      gamesPlayed: 10,
      gamesWon: 7,
      bestTime: 120000,
      currentStreak: 3,
      longestStreak: 5,
      totalTime: 1200000,
      averageTime: 120000,
      totalMoves: 500,
      averageMoves: 50,
      lastPlayed: new Date('2024-01-01T12:00:00Z'),
      fastestWin: 90000
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStatisticsManager.getAllStatistics.mockReturnValue(mockStatistics);
    mockStatisticsManager.calculateWinPercentage.mockReturnValue(70);
    mockStatisticsManager.formatDuration.mockImplementation((ms: number) => {
      if (ms === 0) return '--';
      if (ms === 90000) return '1:30';
      if (ms === 120000) return '2:00';
      if (ms === 1200000) return '20:00';
      return `${Math.floor(ms / 1000)}s`;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render statistics display with overall tab selected by default', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('statistics-display')).toBeInTheDocument();
      expect(screen.getByTestId('overall-tab')).toHaveClass('active');
      expect(screen.getByTestId('overall-statistics')).toBeInTheDocument();
    });

    it('should render loading state when statistics are null', () => {
      mockStatisticsManager.getAllStatistics.mockReturnValue(null);
      
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('statistics-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
    });

    it('should render no statistics message when no games played', () => {
      const emptyStats = {
        ...mockStatistics,
        overall: { ...mockStatistics.overall, gamesPlayed: 0 }
      };
      mockStatisticsManager.getAllStatistics.mockReturnValue(emptyStats);

      render(<StatisticsDisplay />);

      expect(screen.getByTestId('no-statistics')).toBeInTheDocument();
      expect(screen.getByText('No games played yet. Start playing to see your statistics!')).toBeInTheDocument();
    });

    it('should render all game tabs', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('overall-tab')).toBeInTheDocument();
      expect(screen.getByTestId('klondike-tab')).toBeInTheDocument();
      expect(screen.getByTestId('spider-tab')).toBeInTheDocument();
      expect(screen.getByTestId('freecell-tab')).toBeInTheDocument();
    });

    it('should disable spider and freecell tabs', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('spider-tab')).toBeDisabled();
      expect(screen.getByTestId('freecell-tab')).toBeDisabled();
      expect(screen.getByTestId('klondike-tab')).not.toBeDisabled();
    });
  });

  describe('statistics display', () => {
    it('should display correct statistics for overall tab', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('overall-games-played')).toHaveTextContent('10');
      expect(screen.getByTestId('overall-games-won')).toHaveTextContent('7');
      expect(screen.getByTestId('overall-win-rate')).toHaveTextContent('70%');
      expect(screen.getByTestId('overall-current-streak')).toHaveTextContent('3');
      expect(screen.getByTestId('overall-best-streak')).toHaveTextContent('5');
    });

    it('should display time statistics correctly', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('overall-best-time')).toHaveTextContent('2:00');
      expect(screen.getByTestId('overall-average-time')).toHaveTextContent('2:00');
      expect(screen.getByTestId('overall-total-time')).toHaveTextContent('20:00');
      expect(screen.getByTestId('overall-fastest-win')).toHaveTextContent('1:30');
    });

    it('should display move statistics correctly', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('overall-total-moves')).toHaveTextContent('500');
      expect(screen.getByTestId('overall-average-moves')).toHaveTextContent('50');
      expect(screen.getByTestId('overall-last-played')).toHaveTextContent('1/1/2024');
    });
  });

  describe('tab switching', () => {
    it('should switch to klondike tab when clicked', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('klondike-tab'));

      expect(screen.getByTestId('klondike-tab')).toHaveClass('active');
      expect(screen.getByTestId('overall-tab')).not.toHaveClass('active');
      expect(screen.getByTestId('klondike-statistics')).toBeInTheDocument();
    });

    it('should not switch to disabled tabs', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('spider-tab'));

      expect(screen.getByTestId('overall-tab')).toHaveClass('active');
      expect(screen.getByTestId('spider-tab')).not.toHaveClass('active');
    });

    it('should display correct statistics for klondike tab', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('klondike-tab'));

      expect(screen.getByTestId('klondike-games-played')).toHaveTextContent('10');
      expect(screen.getByTestId('klondike-games-won')).toHaveTextContent('7');
      expect(screen.getByTestId('klondike-win-rate')).toHaveTextContent('70%');
    });
  });

  describe('reset functionality', () => {
    it('should show reset confirmation dialog when reset button clicked', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('reset-statistics-button'));

      expect(screen.getByTestId('reset-confirm-overlay')).toBeInTheDocument();
      expect(screen.getByText('Confirm Reset')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to reset all statistics/)).toBeInTheDocument();
    });

    it('should show game-specific reset message for individual games', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('klondike-tab'));
      fireEvent.click(screen.getByTestId('reset-statistics-button'));

      expect(screen.getByText(/Are you sure you want to reset klondike statistics/)).toBeInTheDocument();
    });

    it('should reset all statistics when confirmed from overall tab', async () => {
      const onResetStatistics = vi.fn();
      render(<StatisticsDisplay onResetStatistics={onResetStatistics} />);

      fireEvent.click(screen.getByTestId('reset-statistics-button'));
      fireEvent.click(screen.getByTestId('confirm-reset'));

      await waitFor(() => {
        expect(mockStatisticsManager.resetAllStatistics).toHaveBeenCalled();
        expect(onResetStatistics).toHaveBeenCalled();
      });
    });

    it('should reset game-specific statistics when confirmed from game tab', async () => {
      const onResetStatistics = vi.fn();
      render(<StatisticsDisplay onResetStatistics={onResetStatistics} />);

      fireEvent.click(screen.getByTestId('klondike-tab'));
      fireEvent.click(screen.getByTestId('reset-statistics-button'));
      fireEvent.click(screen.getByTestId('confirm-reset'));

      await waitFor(() => {
        expect(mockStatisticsManager.resetGameStatistics).toHaveBeenCalledWith('klondike');
        expect(onResetStatistics).toHaveBeenCalled();
      });
    });

    it('should cancel reset when cancel button clicked', () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('reset-statistics-button'));
      fireEvent.click(screen.getByTestId('cancel-reset'));

      expect(screen.queryByTestId('reset-confirm-overlay')).not.toBeInTheDocument();
      expect(mockStatisticsManager.resetAllStatistics).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper test ids for all interactive elements', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByTestId('statistics-display')).toBeInTheDocument();
      expect(screen.getByTestId('overall-tab')).toBeInTheDocument();
      expect(screen.getByTestId('klondike-tab')).toBeInTheDocument();
      expect(screen.getByTestId('reset-statistics-button')).toBeInTheDocument();
    });

    it('should have proper button text for reset actions', () => {
      render(<StatisticsDisplay />);

      expect(screen.getByText('Reset All Statistics')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('klondike-tab'));
      expect(screen.getByText('Reset klondike Statistics')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional statistics gracefully', () => {
      const incompleteStats = {
        ...mockStatistics,
        klondike: {
          ...mockStatistics.klondike,
          fastestWin: undefined,
          lastPlayed: undefined
        }
      };
      mockStatisticsManager.getAllStatistics.mockReturnValue(incompleteStats);

      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('klondike-tab'));

      // Should not crash and should not display undefined fields
      expect(screen.getByTestId('klondike-statistics')).toBeInTheDocument();
      expect(screen.queryByTestId('klondike-fastest-win')).not.toBeInTheDocument();
      expect(screen.queryByTestId('klondike-last-played')).not.toBeInTheDocument();
    });

    it('should handle zero values correctly', () => {
      const zeroStats = {
        ...mockStatistics,
        klondike: {
          gamesPlayed: 1,
          gamesWon: 0,
          bestTime: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalTime: 60000,
          averageTime: 60000,
          totalMoves: 25,
          averageMoves: 25
        }
      };
      mockStatisticsManager.getAllStatistics.mockReturnValue(zeroStats);
      mockStatisticsManager.calculateWinPercentage.mockReturnValue(0);

      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('klondike-tab'));

      expect(screen.getByTestId('klondike-win-rate')).toHaveTextContent('0%');
      expect(screen.getByTestId('klondike-current-streak')).toHaveTextContent('0');
    });

    it('should reload statistics after reset', async () => {
      render(<StatisticsDisplay />);

      fireEvent.click(screen.getByTestId('reset-statistics-button'));
      fireEvent.click(screen.getByTestId('confirm-reset'));

      await waitFor(() => {
        // Should call getAllStatistics again after reset
        expect(mockStatisticsManager.getAllStatistics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<StatisticsDisplay className="custom-class" />);

      expect(screen.getByTestId('statistics-display')).toHaveClass('custom-class');
    });
  });
});