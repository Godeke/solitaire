/**
 * Example demonstrating the logging system usage
 * This file shows how to properly use the logging utilities throughout the application
 */

import { 
  logger, 
  logGameAction, 
  logUserInteraction, 
  logError, 
  logPerformance,
  LogLevel 
} from './RendererLogger';

export class LoggingExample {
  
  /**
   * Example of basic logging methods
   */
  static basicLoggingExample(): void {
    // Basic log levels
    logger.debug('EXAMPLE', 'This is a debug message', { detail: 'verbose info' });
    logger.info('EXAMPLE', 'This is an info message', { status: 'normal' });
    logger.warn('EXAMPLE', 'This is a warning message', { issue: 'minor problem' });
    logger.error('EXAMPLE', 'This is an error message', { error: 'something went wrong' });
  }

  /**
   * Example of game action logging
   */
  static gameActionExample(): void {
    // Log game initialization
    logGameAction('Game initialized', 'klondike', {
      difficulty: 'normal',
      dealCount: 3,
      timestamp: new Date().toISOString()
    });

    // Log player moves
    logGameAction('Card moved', 'klondike', {
      from: { zone: 'tableau', index: 0 },
      to: { zone: 'foundation', index: 1 },
      cardId: 'hearts-ace-123',
      score: 150
    });

    // Log game completion
    logGameAction('Game won', 'klondike', {
      finalScore: 2450,
      totalMoves: 127,
      duration: 480000, // 8 minutes in milliseconds
      difficulty: 'normal'
    });
  }

  /**
   * Example of user interaction logging
   */
  static userInteractionExample(): void {
    // Log button clicks
    logUserInteraction('New game clicked', 'GameControls', {
      previousGameType: 'klondike',
      newGameType: 'spider'
    });

    // Log navigation
    logUserInteraction('Back to menu', 'GameManager', {
      currentScore: 1200,
      timeSpent: 300000 // 5 minutes
    });

    // Log drag and drop
    logUserInteraction('Card drag started', 'CardRenderer', {
      cardId: 'spades-king-456',
      position: { zone: 'tableau', index: 3 }
    });

    logUserInteraction('Card dropped', 'DropZone', {
      cardId: 'spades-king-456',
      targetZone: 'tableau',
      targetIndex: 5,
      success: true
    });
  }

  /**
   * Example of error logging
   */
  static errorLoggingExample(): void {
    try {
      // Simulate some operation that might fail
      throw new Error('Failed to save game state');
    } catch (error) {
      logError(error as Error, 'GameStateManager.save', {
        gameType: 'klondike',
        gameState: {
          score: 1500,
          moves: 45
        },
        storageAvailable: localStorage !== undefined
      });
    }

    // Log validation errors
    logger.error('VALIDATION', 'Invalid move attempted', {
      from: { zone: 'stock', index: 0 },
      to: { zone: 'foundation', index: 0 },
      reason: 'Cannot move face-down card to foundation',
      cardId: 'unknown-card'
    });
  }

  /**
   * Example of performance logging
   */
  static performanceLoggingExample(): void {
    const startTime = performance.now();
    
    // Simulate some expensive operation
    for (let i = 0; i < 1000000; i++) {
      Math.random();
    }
    
    const duration = performance.now() - startTime;
    
    logPerformance('Game initialization', duration, {
      cardsDealt: 52,
      tableauColumns: 7,
      foundationPiles: 4
    });

    // Log render performance
    logPerformance('Card animation', 16.7, {
      animationType: 'move',
      cardCount: 1,
      distance: 200,
      fps: 60
    });
  }

  /**
   * Example of component lifecycle logging
   */
  static componentLifecycleExample(): void {
    // Component mount
    logger.debug('COMPONENT', 'KlondikeGameBoard mounted', {
      props: {
        gameKey: 1,
        onGameWin: 'function',
        onScoreChange: 'function'
      }
    });

    // Component state change
    logger.debug('COMPONENT', 'GameManager state changed', {
      previousState: 'menu',
      newState: 'game',
      gameType: 'klondike'
    });

    // Component unmount
    logger.debug('COMPONENT', 'GameControls unmounted', {
      reason: 'navigation',
      destination: 'menu'
    });
  }

  /**
   * Example of conditional logging based on log level
   */
  static conditionalLoggingExample(): void {
    // Set log level to INFO to filter out DEBUG messages
    logger.setLogLevel(LogLevel.INFO);

    logger.debug('EXAMPLE', 'This debug message will be filtered out');
    logger.info('EXAMPLE', 'This info message will be logged');
    logger.warn('EXAMPLE', 'This warning will be logged');
    logger.error('EXAMPLE', 'This error will be logged');

    // Reset to DEBUG level
    logger.setLogLevel(LogLevel.DEBUG);
  }

  /**
   * Example of structured data logging
   */
  static structuredDataExample(): void {
    // Log complex game state
    logger.info('GAME_STATE', 'Current game state snapshot', {
      gameType: 'klondike',
      tableau: {
        columns: 7,
        totalCards: 28,
        faceUpCards: 7
      },
      foundation: {
        piles: 4,
        completedPiles: 1,
        totalCards: 13
      },
      stock: {
        remainingCards: 11
      },
      waste: {
        visibleCards: 3
      },
      score: 1850,
      moves: 89,
      timeElapsed: 720000, // 12 minutes
      hints: {
        available: 2,
        used: 1
      }
    });
  }

  /**
   * Run all logging examples
   */
  static runAllExamples(): void {
    logger.info('EXAMPLE', 'Starting logging examples demonstration');
    
    this.basicLoggingExample();
    this.gameActionExample();
    this.userInteractionExample();
    this.errorLoggingExample();
    this.performanceLoggingExample();
    this.componentLifecycleExample();
    this.conditionalLoggingExample();
    this.structuredDataExample();
    
    logger.info('EXAMPLE', 'Logging examples demonstration completed');
  }
}