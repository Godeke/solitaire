/**
 * Unit tests for StatisticsManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatisticsManager, GameCompletionData, ExtendedGameStatistics } from '../utils/StatisticsManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock RendererLogger
vi.mock('../utils/RendererLogger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

describe('StatisticsManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Clear cached statistics
    StatisticsManager.clearCache();
  });

  afterEach(() => {
    // Clean up after each test
    StatisticsManager.clearCache();
  });

  describe('loadStatistics', () => {
    it('should create default statistics when no stored data exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const stats = StatisticsManager.loadStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.klondike.gamesPlayed).toBe(0);
      expect(stats.spider.gamesPlayed).toBe(0);
      expect(stats.freecell.gamesPlayed).toBe(0);
      expect(stats.overall.gamesPlayed).toBe(0);
    });

    it('should load existing statistics from localStorage', () => {
      const mockStats = {
        klondike: {
          gamesPlayed: 5,
          gamesWon: 3,
          bestTime: 120000,
          currentStreak: 2,
          longestStreak: 3,
          totalTime: 600000,
          averageTime: 120000,
          totalMoves: 250,
          averageMoves: 50
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
          gamesPlayed: 5,
          gamesWon: 3,
          bestTime: 120000,
          currentStreak: 2,
          longestStreak: 3,
          totalTime: 600000,
          averageTime: 120000,
          totalMoves: 250,
          averageMoves: 50
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockStats));
      
      const stats = StatisticsManager.loadStatistics();
      
      expect(stats.klondike.gamesPlayed).toBe(5);
      expect(stats.klondike.gamesWon).toBe(3);
      expect(stats.overall.gamesPlayed).toBe(5);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const stats = StatisticsManager.loadStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.klondike.gamesPlayed).toBe(0);
    });
  });

  describe('recordGameCompletion', () => {
    it('should record a won game correctly', () => {
      const completionData: GameCompletionData = {
        gameType: 'klondike',
        won: true,
        duration: 120000, // 2 minutes
        moves: 50,
        score: 100,
        completedAt: new Date('2024-01-01T12:00:00Z')
      };

      StatisticsManager.recordGameCompletion(completionData);

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(1);
      expect(stats.bestTime).toBe(120000);
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
      expect(stats.totalTime).toBe(120000);
      expect(stats.averageTime).toBe(120000);
      expect(stats.totalMoves).toBe(50);
      expect(stats.averageMoves).toBe(50);
    });

    it('should record a lost game correctly', () => {
      const completionData: GameCompletionData = {
        gameType: 'klondike',
        won: false,
        duration: 60000, // 1 minute
        moves: 25,
        score: 50,
        completedAt: new Date('2024-01-01T12:00:00Z')
      };

      StatisticsManager.recordGameCompletion(completionData);

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(0);
      expect(stats.bestTime).toBe(0); // No wins, so no best time
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.totalTime).toBe(60000);
      expect(stats.averageTime).toBe(60000);
    });

    it('should update streak correctly for consecutive wins', () => {
      // First win
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date('2024-01-01T12:00:00Z')
      });

      // Second win
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 100000,
        moves: 45,
        score: 120,
        completedAt: new Date('2024-01-01T12:30:00Z')
      });

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.currentStreak).toBe(2);
      expect(stats.longestStreak).toBe(2);
      expect(stats.bestTime).toBe(100000); // Better time
    });

    it('should reset current streak on loss', () => {
      // Win
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date('2024-01-01T12:00:00Z')
      });

      // Loss
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: false,
        duration: 60000,
        moves: 25,
        score: 50,
        completedAt: new Date('2024-01-01T12:30:00Z')
      });

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(1); // Previous streak preserved
    });

    it('should update overall statistics', () => {
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date('2024-01-01T12:00:00Z')
      });

      const overallStats = StatisticsManager.getOverallStatistics();
      expect(overallStats.gamesPlayed).toBe(1);
      expect(overallStats.gamesWon).toBe(1);
      expect(overallStats.totalTime).toBe(120000);
    });
  });

  describe('calculateWinPercentage', () => {
    it('should return 0 for no games played', () => {
      const stats: ExtendedGameStatistics = {
        gamesPlayed: 0,
        gamesWon: 0,
        bestTime: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTime: 0,
        averageTime: 0
      };

      const percentage = StatisticsManager.calculateWinPercentage(stats);
      expect(percentage).toBe(0);
    });

    it('should calculate correct win percentage', () => {
      const stats: ExtendedGameStatistics = {
        gamesPlayed: 10,
        gamesWon: 7,
        bestTime: 120000,
        currentStreak: 2,
        longestStreak: 5,
        totalTime: 1200000,
        averageTime: 120000
      };

      const percentage = StatisticsManager.calculateWinPercentage(stats);
      expect(percentage).toBe(70);
    });

    it('should round win percentage correctly', () => {
      const stats: ExtendedGameStatistics = {
        gamesPlayed: 3,
        gamesWon: 1,
        bestTime: 120000,
        currentStreak: 0,
        longestStreak: 1,
        totalTime: 360000,
        averageTime: 120000
      };

      const percentage = StatisticsManager.calculateWinPercentage(stats);
      expect(percentage).toBe(33); // 33.33... rounded to 33
    });
  });

  describe('formatDuration', () => {
    it('should format zero duration', () => {
      expect(StatisticsManager.formatDuration(0)).toBe('--');
    });

    it('should format seconds only', () => {
      expect(StatisticsManager.formatDuration(30000)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(StatisticsManager.formatDuration(90000)).toBe('1:30');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(StatisticsManager.formatDuration(3661000)).toBe('1:01:01');
    });

    it('should pad minutes and seconds with zeros', () => {
      expect(StatisticsManager.formatDuration(3605000)).toBe('1:00:05');
    });
  });

  describe('resetGameStatistics', () => {
    it('should reset statistics for specific game type', () => {
      // Add some statistics
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date()
      });

      // Reset klondike statistics
      StatisticsManager.resetGameStatistics('klondike');

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.gamesPlayed).toBe(0);
      expect(stats.gamesWon).toBe(0);
      expect(stats.bestTime).toBe(0);
    });

    it('should recalculate overall statistics after reset', () => {
      // Add statistics for multiple games
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date()
      });

      StatisticsManager.recordGameCompletion({
        gameType: 'spider',
        won: true,
        duration: 180000,
        moves: 75,
        score: 150,
        completedAt: new Date()
      });

      // Reset klondike
      StatisticsManager.resetGameStatistics('klondike');

      const overallStats = StatisticsManager.getOverallStatistics();
      expect(overallStats.gamesPlayed).toBe(1); // Only spider game remains
      expect(overallStats.totalTime).toBe(180000);
    });
  });

  describe('resetAllStatistics', () => {
    it('should reset all statistics to default values', () => {
      // Add some statistics
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date()
      });

      // Reset all
      StatisticsManager.resetAllStatistics();

      const allStats = StatisticsManager.getAllStatistics();
      expect(allStats.klondike.gamesPlayed).toBe(0);
      expect(allStats.spider.gamesPlayed).toBe(0);
      expect(allStats.freecell.gamesPlayed).toBe(0);
      expect(allStats.overall.gamesPlayed).toBe(0);
    });
  });

  describe('saveStatistics', () => {
    it('should save statistics to localStorage', () => {
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: new Date()
      });

      const result = StatisticsManager.saveStatistics();
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'solitaire_statistics',
        expect.any(String)
      );
    });

    it('should handle save errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = StatisticsManager.saveStatistics();
      
      expect(result).toBe(false);
    });
  });

  describe('hasStoredStatistics', () => {
    it('should return true when statistics exist in storage', () => {
      localStorageMock.getItem.mockReturnValue('{}');
      
      const hasStats = StatisticsManager.hasStoredStatistics();
      
      expect(hasStats).toBe(true);
    });

    it('should return false when no statistics exist in storage', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const hasStats = StatisticsManager.hasStoredStatistics();
      
      expect(hasStats).toBe(false);
    });
  });

  describe('serialization and deserialization', () => {
    it('should correctly serialize and deserialize dates', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      let savedData: string = '';
      
      // Mock localStorage to capture saved data
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        savedData = value;
      });
      
      localStorageMock.getItem.mockImplementation((key: string) => {
        return savedData || null;
      });
      
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 120000,
        moves: 50,
        score: 100,
        completedAt: testDate
      });

      // Force save and reload
      StatisticsManager.saveStatistics();
      StatisticsManager.clearCache();
      
      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.lastPlayed).toBeInstanceOf(Date);
      expect(stats.lastPlayed?.getTime()).toBe(testDate.getTime());
    });

    it('should handle missing optional fields gracefully', () => {
      const incompleteStats = {
        klondike: {
          gamesPlayed: 1,
          gamesWon: 1,
          bestTime: 120000,
          currentStreak: 1,
          longestStreak: 1,
          totalTime: 120000,
          averageTime: 120000
          // Missing totalMoves, averageMoves, lastPlayed, fastestWin
        },
        spider: {
          gamesPlayed: 0,
          gamesWon: 0,
          bestTime: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalTime: 0,
          averageTime: 0
        },
        freecell: {
          gamesPlayed: 0,
          gamesWon: 0,
          bestTime: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalTime: 0,
          averageTime: 0
        },
        overall: {
          gamesPlayed: 1,
          gamesWon: 1,
          bestTime: 120000,
          currentStreak: 1,
          longestStreak: 1,
          totalTime: 120000,
          averageTime: 120000
        }
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(incompleteStats));
      
      const stats = StatisticsManager.loadStatistics();
      
      expect(stats.klondike.totalMoves).toBe(0);
      expect(stats.klondike.averageMoves).toBe(0);
      expect(stats.klondike.lastPlayed).toBeUndefined();
      expect(stats.klondike.fastestWin).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers correctly', () => {
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: Number.MAX_SAFE_INTEGER,
        moves: Number.MAX_SAFE_INTEGER,
        score: Number.MAX_SAFE_INTEGER,
        completedAt: new Date()
      });

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.totalTime).toBe(Number.MAX_SAFE_INTEGER);
      expect(stats.totalMoves).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle zero duration games', () => {
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: 0,
        moves: 1,
        score: 10,
        completedAt: new Date()
      });

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.bestTime).toBe(0);
      expect(stats.averageTime).toBe(0);
    });

    it('should handle negative values gracefully', () => {
      StatisticsManager.recordGameCompletion({
        gameType: 'klondike',
        won: true,
        duration: -1000, // Invalid negative duration
        moves: -5, // Invalid negative moves
        score: -10, // Invalid negative score
        completedAt: new Date()
      });

      const stats = StatisticsManager.getGameStatistics('klondike');
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(1);
      // The system should still record the game even with invalid values
    });
  });
});