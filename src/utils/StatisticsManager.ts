/**
 * Statistics tracking and persistence manager for solitaire games
 */

import { GameStatistics } from '../types/game';
import { logger, logError } from './RendererLogger';

/**
 * Extended statistics interface with additional tracking data
 */
export interface ExtendedGameStatistics extends GameStatistics {
  lastPlayed?: Date;
  fastestWin?: number;
  totalMoves?: number;
  averageMoves?: number;
}

/**
 * Statistics for all game types
 */
export interface AllGameStatistics {
  klondike: ExtendedGameStatistics;
  spider: ExtendedGameStatistics;
  freecell: ExtendedGameStatistics;
  overall: ExtendedGameStatistics;
}

/**
 * Serializable version of statistics for storage
 */
interface SerializableStatistics {
  klondike: SerializableGameStatistics;
  spider: SerializableGameStatistics;
  freecell: SerializableGameStatistics;
  overall: SerializableGameStatistics;
}

interface SerializableGameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  bestTime: number;
  currentStreak: number;
  longestStreak: number;
  totalTime: number;
  averageTime: number;
  lastPlayed?: string; // ISO string
  fastestWin?: number;
  totalMoves?: number;
  averageMoves?: number;
}

/**
 * Game completion data for updating statistics
 */
export interface GameCompletionData {
  gameType: 'klondike' | 'spider' | 'freecell';
  won: boolean;
  duration: number; // in milliseconds
  moves: number;
  score: number;
  completedAt: Date;
}

/**
 * Manager class for game statistics tracking and persistence
 */
export class StatisticsManager {
  private static readonly STATISTICS_KEY = 'solitaire_statistics';
  private static statistics: AllGameStatistics | null = null;

  /**
   * Initialize default statistics for a game type
   */
  private static createDefaultGameStatistics(): ExtendedGameStatistics {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTime: 0,
      averageTime: 0,
      lastPlayed: undefined,
      fastestWin: undefined,
      totalMoves: 0,
      averageMoves: 0
    };
  }

  /**
   * Initialize default statistics for all game types
   */
  private static createDefaultStatistics(): AllGameStatistics {
    return {
      klondike: this.createDefaultGameStatistics(),
      spider: this.createDefaultGameStatistics(),
      freecell: this.createDefaultGameStatistics(),
      overall: this.createDefaultGameStatistics()
    };
  }

  /**
   * Load statistics from local storage
   */
  static loadStatistics(): AllGameStatistics {
    if (this.statistics) {
      return this.statistics;
    }

    try {
      const stored = localStorage.getItem(this.STATISTICS_KEY);
      
      if (!stored) {
        logger.debug('STORAGE', 'No statistics found, creating defaults');
        this.statistics = this.createDefaultStatistics();
        return this.statistics;
      }

      const serializable: SerializableStatistics = JSON.parse(stored);
      this.statistics = this.deserializeStatistics(serializable);
      
      logger.info('STORAGE', 'Statistics loaded', {
        totalGames: this.statistics.overall.gamesPlayed,
        totalWins: this.statistics.overall.gamesWon
      });
      
      return this.statistics;
    } catch (error) {
      logError(error as Error, 'StatisticsManager.loadStatistics');
      this.statistics = this.createDefaultStatistics();
      return this.statistics;
    }
  }

  /**
   * Save statistics to local storage
   */
  static saveStatistics(): boolean {
    if (!this.statistics) {
      return false;
    }

    try {
      const serializable = this.serializeStatistics(this.statistics);
      localStorage.setItem(this.STATISTICS_KEY, JSON.stringify(serializable));
      
      logger.debug('STORAGE', 'Statistics saved', {
        totalGames: this.statistics.overall.gamesPlayed,
        totalWins: this.statistics.overall.gamesWon
      });
      
      return true;
    } catch (error) {
      logError(error as Error, 'StatisticsManager.saveStatistics');
      return false;
    }
  }

  /**
   * Record a completed game and update statistics
   */
  static recordGameCompletion(data: GameCompletionData): void {
    const stats = this.loadStatistics();
    const gameStats = stats[data.gameType];
    const overallStats = stats.overall;

    // Update game-specific statistics
    this.updateGameStatistics(gameStats, data);
    
    // Update overall statistics
    this.updateGameStatistics(overallStats, data);

    // Save updated statistics
    this.saveStatistics();

    logger.info('GAME', 'Game completion recorded', {
      gameType: data.gameType,
      won: data.won,
      duration: data.duration,
      moves: data.moves,
      newWinRate: this.calculateWinPercentage(gameStats)
    });
  }

  /**
   * Update statistics for a specific game type or overall
   */
  private static updateGameStatistics(stats: ExtendedGameStatistics, data: GameCompletionData): void {
    // Update basic counters
    stats.gamesPlayed++;
    stats.lastPlayed = data.completedAt;
    
    // Update time tracking
    stats.totalTime += data.duration;
    stats.averageTime = stats.totalTime / stats.gamesPlayed;
    
    // Update move tracking
    stats.totalMoves = (stats.totalMoves || 0) + data.moves;
    stats.averageMoves = stats.totalMoves / stats.gamesPlayed;

    if (data.won) {
      stats.gamesWon++;
      stats.currentStreak++;
      
      // Update best time (only for wins)
      if (stats.bestTime === 0 || data.duration < stats.bestTime) {
        stats.bestTime = data.duration;
      }
      
      // Update fastest win
      if (!stats.fastestWin || data.duration < stats.fastestWin) {
        stats.fastestWin = data.duration;
      }
      
      // Update longest streak
      if (stats.currentStreak > stats.longestStreak) {
        stats.longestStreak = stats.currentStreak;
      }
    } else {
      // Reset current streak on loss
      stats.currentStreak = 0;
    }
  }

  /**
   * Get statistics for a specific game type
   */
  static getGameStatistics(gameType: 'klondike' | 'spider' | 'freecell'): ExtendedGameStatistics {
    const stats = this.loadStatistics();
    return { ...stats[gameType] };
  }

  /**
   * Get overall statistics across all games
   */
  static getOverallStatistics(): ExtendedGameStatistics {
    const stats = this.loadStatistics();
    return { ...stats.overall };
  }

  /**
   * Get all statistics
   */
  static getAllStatistics(): AllGameStatistics {
    return this.loadStatistics();
  }

  /**
   * Calculate win percentage for given statistics
   */
  static calculateWinPercentage(stats: ExtendedGameStatistics): number {
    if (stats.gamesPlayed === 0) return 0;
    return Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
  }

  /**
   * Format time duration to human readable string
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds === 0) return '--';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Reset statistics for a specific game type
   */
  static resetGameStatistics(gameType: 'klondike' | 'spider' | 'freecell'): void {
    const stats = this.loadStatistics();
    stats[gameType] = this.createDefaultGameStatistics();
    
    // Recalculate overall statistics
    this.recalculateOverallStatistics(stats);
    
    this.saveStatistics();
    
    logger.info('GAME', 'Game statistics reset', { gameType });
  }

  /**
   * Reset all statistics
   */
  static resetAllStatistics(): void {
    this.statistics = this.createDefaultStatistics();
    this.saveStatistics();
    
    logger.info('GAME', 'All statistics reset');
  }

  /**
   * Recalculate overall statistics from individual game statistics
   */
  private static recalculateOverallStatistics(stats: AllGameStatistics): void {
    const overall = stats.overall;
    const games = [stats.klondike, stats.spider, stats.freecell];
    
    // Reset overall stats
    overall.gamesPlayed = 0;
    overall.gamesWon = 0;
    overall.totalTime = 0;
    overall.totalMoves = 0;
    overall.bestTime = 0;
    overall.longestStreak = 0;
    overall.currentStreak = 0;
    overall.fastestWin = undefined;
    overall.lastPlayed = undefined;
    
    // Aggregate from individual games
    for (const gameStats of games) {
      overall.gamesPlayed += gameStats.gamesPlayed;
      overall.gamesWon += gameStats.gamesWon;
      overall.totalTime += gameStats.totalTime;
      overall.totalMoves = (overall.totalMoves || 0) + (gameStats.totalMoves || 0);
      
      if (gameStats.bestTime > 0 && (overall.bestTime === 0 || gameStats.bestTime < overall.bestTime)) {
        overall.bestTime = gameStats.bestTime;
      }
      
      if (gameStats.longestStreak > overall.longestStreak) {
        overall.longestStreak = gameStats.longestStreak;
      }
      
      if (gameStats.fastestWin && (!overall.fastestWin || gameStats.fastestWin < overall.fastestWin)) {
        overall.fastestWin = gameStats.fastestWin;
      }
      
      if (gameStats.lastPlayed && (!overall.lastPlayed || gameStats.lastPlayed > overall.lastPlayed)) {
        overall.lastPlayed = gameStats.lastPlayed;
      }
    }
    
    // Calculate averages
    overall.averageTime = overall.gamesPlayed > 0 ? overall.totalTime / overall.gamesPlayed : 0;
    overall.averageMoves = overall.gamesPlayed > 0 ? (overall.totalMoves || 0) / overall.gamesPlayed : 0;
  }

  /**
   * Serialize statistics for storage
   */
  private static serializeStatistics(stats: AllGameStatistics): SerializableStatistics {
    return {
      klondike: this.serializeGameStatistics(stats.klondike),
      spider: this.serializeGameStatistics(stats.spider),
      freecell: this.serializeGameStatistics(stats.freecell),
      overall: this.serializeGameStatistics(stats.overall)
    };
  }

  /**
   * Serialize individual game statistics
   */
  private static serializeGameStatistics(stats: ExtendedGameStatistics): SerializableGameStatistics {
    return {
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      bestTime: stats.bestTime,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalTime: stats.totalTime,
      averageTime: stats.averageTime,
      lastPlayed: stats.lastPlayed?.toISOString(),
      fastestWin: stats.fastestWin,
      totalMoves: stats.totalMoves,
      averageMoves: stats.averageMoves
    };
  }

  /**
   * Deserialize statistics from storage
   */
  private static deserializeStatistics(serializable: SerializableStatistics): AllGameStatistics {
    return {
      klondike: this.deserializeGameStatistics(serializable.klondike),
      spider: this.deserializeGameStatistics(serializable.spider),
      freecell: this.deserializeGameStatistics(serializable.freecell),
      overall: this.deserializeGameStatistics(serializable.overall)
    };
  }

  /**
   * Deserialize individual game statistics
   */
  private static deserializeGameStatistics(serializable: SerializableGameStatistics): ExtendedGameStatistics {
    return {
      gamesPlayed: serializable.gamesPlayed,
      gamesWon: serializable.gamesWon,
      bestTime: serializable.bestTime,
      currentStreak: serializable.currentStreak,
      longestStreak: serializable.longestStreak,
      totalTime: serializable.totalTime,
      averageTime: serializable.averageTime,
      lastPlayed: serializable.lastPlayed ? new Date(serializable.lastPlayed) : undefined,
      fastestWin: serializable.fastestWin,
      totalMoves: serializable.totalMoves || 0,
      averageMoves: serializable.averageMoves || 0
    };
  }

  /**
   * Clear cached statistics (force reload from storage)
   */
  static clearCache(): void {
    this.statistics = null;
  }

  /**
   * Check if statistics exist in storage
   */
  static hasStoredStatistics(): boolean {
    return localStorage.getItem(this.STATISTICS_KEY) !== null;
  }
}