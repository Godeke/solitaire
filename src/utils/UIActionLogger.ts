/**
 * UIActionLogger - Enhanced logging system for UI actions and game state debugging
 * Extends RendererLogger to provide comprehensive UI interaction tracking
 */

import { RendererLogger } from './RendererLogger';
import { GameStateSnapshotManager } from './GameStateSnapshot';
import { Card, GameState, Position } from '../types/card';
import {
  UIActionEvent,
  UIActionEventType,
  UIActionEventData,
  GameStateSnapshot,
  CardSnapshot,
  PerformanceMetrics,
  MoveValidationResult,
  generateEventId,
  createTimestamp
} from '../types/UIActionLogging';

/**
 * Enhanced logger for UI actions that uses the existing RendererLogger
 * Provides structured event tracking for debugging game state issues
 */
export class UIActionLogger {
  private static instance: UIActionLogger;
  private eventBuffer: UIActionEvent[] = [];
  private sequenceNumber: number = 0;
  private performanceTimers: Map<string, number> = new Map();
  private currentGameState: GameState | null = null;
  private logger: RendererLogger;

  private constructor() {
    this.logger = RendererLogger.getInstance();
    this.logger.info('UI_ACTION_LOGGER', 'UIActionLogger initialized');
  }

  public static getInstance(): UIActionLogger {
    if (!UIActionLogger.instance) {
      UIActionLogger.instance = new UIActionLogger();
    }
    return UIActionLogger.instance;
  }

  // Delegate logging methods to the RendererLogger
  public debug(category: string, message: string, data?: any): void {
    this.logger.debug(category, message, data);
  }

  public info(category: string, message: string, data?: any): void {
    this.logger.info(category, message, data);
  }

  public warn(category: string, message: string, data?: any): void {
    this.logger.warn(category, message, data);
  }

  public error(category: string, message: string, data?: any): void {
    this.logger.error(category, message, data);
  }

  /**
   * Set the current game state for snapshot creation
   */
  public setCurrentGameState(gameState: GameState | null): void {
    this.currentGameState = gameState;

    if (gameState) {
      this.debug('UI_ACTION_LOGGER', 'Game state updated for logging', {
        gameType: gameState.gameType,
        moveCount: gameState.moves.length,
        score: gameState.score
      });
    } else {
      this.debug('UI_ACTION_LOGGER', 'Game state cleared for logging');
    }
  }

  /**
   * Log a UI action event with optional game state snapshots
   */
  public logUIAction(
    type: UIActionEventType,
    component: string,
    data: UIActionEventData,
    captureStateBefore: boolean = false,
    captureStateAfter: boolean = false,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const event: UIActionEvent = {
      id: generateEventId(),
      timestamp: createTimestamp(),
      type,
      component,
      data,
      performance
    };

    // Capture game state snapshots if requested
    if (captureStateBefore && this.currentGameState) {
      const snapshotBefore = this.createGameStateSnapshot('before_action', `${component}.${type}`);
      if (snapshotBefore) {
        event.gameStateBefore = snapshotBefore;
      }
    }

    if (captureStateAfter && this.currentGameState) {
      const snapshotAfter = this.createGameStateSnapshot('after_action', `${component}.${type}`);
      if (snapshotAfter) {
        event.gameStateAfter = snapshotAfter;
      }
    }

    // Add to event buffer
    this.eventBuffer.push(event);

    // Log the event using the base logger
    this.info('UI_ACTION', `${component}: ${type}`, {
      eventId: event.id,
      data: event.data,
      performance: event.performance
    });

    return event;
  }

  /**
   * Log drag start event
   */
  public logDragStart(
    component: string,
    card: Card,
    sourcePosition: Position,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const cardSnapshot = this.createCardSnapshot(card);
    
    return this.logUIAction(
      UIActionEventType.DRAG_START,
      component,
      {
        card: cardSnapshot,
        sourcePosition: {
          x: sourcePosition.index,
          y: sourcePosition.cardIndex || 0,
          zone: `${sourcePosition.zone}-${sourcePosition.index}`
        }
      },
      true, // Capture state before
      false,
      performance
    );
  }

  /**
   * Log drag hover event
   */
  public logDragHover(
    component: string,
    card: Card,
    targetPosition: Position,
    validationResult?: MoveValidationResult,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const cardSnapshot = this.createCardSnapshot(card);
    
    return this.logUIAction(
      UIActionEventType.DRAG_HOVER,
      component,
      {
        card: cardSnapshot,
        targetPosition: {
          x: targetPosition.index,
          y: targetPosition.cardIndex || 0,
          zone: `${targetPosition.zone}-${targetPosition.index}`
        },
        validationResult
      },
      false,
      false,
      performance
    );
  }

  /**
   * Log drag drop event
   */
  public logDragDrop(
    component: string,
    card: Card,
    sourcePosition: Position,
    targetPosition: Position,
    validationResult: MoveValidationResult,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const cardSnapshot = this.createCardSnapshot(card);
    
    return this.logUIAction(
      UIActionEventType.DRAG_DROP,
      component,
      {
        card: cardSnapshot,
        sourcePosition: {
          x: sourcePosition.index,
          y: sourcePosition.cardIndex || 0,
          zone: `${sourcePosition.zone}-${sourcePosition.index}`
        },
        targetPosition: {
          x: targetPosition.index,
          y: targetPosition.cardIndex || 0,
          zone: `${targetPosition.zone}-${targetPosition.index}`
        },
        validationResult
      },
      true, // Capture state before
      true, // Capture state after
      performance
    );
  }

  /**
   * Log drag cancel event
   */
  public logDragCancel(
    component: string,
    card: Card,
    reason: string,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const cardSnapshot = this.createCardSnapshot(card);
    
    return this.logUIAction(
      UIActionEventType.DRAG_CANCEL,
      component,
      {
        card: cardSnapshot,
        moveReason: reason
      },
      false,
      false,
      performance
    );
  }

  /**
   * Log card click event
   */
  public logCardClick(
    component: string,
    card: Card,
    clickCoordinates: { x: number; y: number },
    performance?: PerformanceMetrics
  ): UIActionEvent {
    const cardSnapshot = this.createCardSnapshot(card);
    
    return this.logUIAction(
      UIActionEventType.CARD_CLICK,
      component,
      {
        card: cardSnapshot,
        clickTarget: `card-${card.id}`,
        clickCoordinates
      },
      false,
      false,
      performance
    );
  }

  /**
   * Log move attempt event
   */
  public logMoveAttempt(
    component: string,
    sourcePosition: Position,
    targetPosition: Position,
    cards: Card[],
    validationResult: MoveValidationResult,
    performance?: PerformanceMetrics
  ): UIActionEvent {
    return this.logUIAction(
      UIActionEventType.MOVE_ATTEMPT,
      component,
      {
        sourcePosition: {
          x: sourcePosition.index,
          y: sourcePosition.cardIndex || 0,
          zone: `${sourcePosition.zone}-${sourcePosition.index}`
        },
        targetPosition: {
          x: targetPosition.index,
          y: targetPosition.cardIndex || 0,
          zone: `${targetPosition.zone}-${targetPosition.index}`
        },
        validationResult,
        moveSuccess: validationResult.isValid
      },
      true, // Capture state before
      false,
      performance
    );
  }

  /**
   * Log move executed event
   */
  public logMoveExecuted(
    component: string,
    sourcePosition: Position,
    targetPosition: Position,
    cards: Card[],
    moveType: 'user' | 'auto' | 'undo' = 'user',
    performance?: PerformanceMetrics
  ): UIActionEvent {
    return this.logUIAction(
      UIActionEventType.MOVE_EXECUTED,
      component,
      {
        sourcePosition: {
          x: sourcePosition.index,
          y: sourcePosition.cardIndex || 0,
          zone: `${sourcePosition.zone}-${sourcePosition.index}`
        },
        targetPosition: {
          x: targetPosition.index,
          y: targetPosition.cardIndex || 0,
          zone: `${targetPosition.zone}-${targetPosition.index}`
        },
        moveType,
        moveSuccess: true
      },
      false,
      true, // Capture state after
      performance
    );
  }

  /**
   * Log state change event
   */
  public logStateChange(
    component: string,
    changeType: 'card_flip' | 'pile_update' | 'score_change' | 'win_condition',
    changedElements: string[],
    performance?: PerformanceMetrics
  ): UIActionEvent {
    return this.logUIAction(
      UIActionEventType.STATE_CHANGE,
      component,
      {
        changeType,
        changedElements
      },
      false,
      true, // Capture state after
      performance
    );
  }

  /**
   * Start performance timing for an operation
   */
  public startPerformanceTimer(operationId: string): void {
    this.performanceTimers.set(operationId, performance.now());
  }

  /**
   * End performance timing and return metrics
   */
  public endPerformanceTimer(operationId: string): PerformanceMetrics | undefined {
    const startTime = this.performanceTimers.get(operationId);
    if (startTime === undefined) {
      this.warn('UI_ACTION_LOGGER', `Performance timer not found: ${operationId}`);
      return undefined;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.performanceTimers.delete(operationId);

    const metrics: PerformanceMetrics = {
      operationDuration: duration
    };

    this.debug('PERF', `Operation ${operationId} completed`, metrics);
    return metrics;
  }

  /**
   * Create a snapshot of the current game state using GameStateSnapshotManager
   */
  public createGameStateSnapshot(reason: string, triggeredBy: string): GameStateSnapshot | null {
    if (!this.currentGameState) {
      this.warn('UI_ACTION_LOGGER', 'Cannot create game state snapshot: no current game state');
      return null;
    }

    try {
      JSON.stringify(this.currentGameState);
    } catch (serializationError) {
      this.error('UI_ACTION_LOGGER', 'Failed to serialize game state for snapshot', {
        error: serializationError instanceof Error ? serializationError.message : serializationError,
        reason,
        triggeredBy
      });
      return null;
    }

    try {
      return GameStateSnapshotManager.createSnapshot(this.currentGameState, reason, triggeredBy);
    } catch (error) {
      this.error('UI_ACTION_LOGGER', 'Failed to create game state snapshot', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reason,
        triggeredBy
      });
      return null;
    }
  }

  /**
   * Create a snapshot of a card's current state using GameStateSnapshotManager
   */
  public createCardSnapshot(card: Card): CardSnapshot {
    const baseSnapshot = GameStateSnapshotManager.createCardSnapshot(card);
    const rawZone = card.position?.zone ?? baseSnapshot.position.zone;
    const zoneBase = rawZone === 'stock' && card.faceUp ? 'tableau' : rawZone;
    const pileIndex = card.position?.index ?? baseSnapshot.position.y ?? 0;
    const stackIndex = card.position?.cardIndex ?? baseSnapshot.position.x ?? 0;

    return {
      ...baseSnapshot,
      position: {
        x: pileIndex,
        y: stackIndex,
        zone: `${zoneBase}-${pileIndex}`
      }
    };
  }

  /**
   * Get all logged events
   */
  public getEventBuffer(): UIActionEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear the event buffer
   */
  public clearEventBuffer(): void {
    const eventCount = this.eventBuffer.length;
    this.eventBuffer = [];
    this.sequenceNumber = 0;
    GameStateSnapshotManager.resetSequenceCounter();
    this.info('UI_ACTION_LOGGER', 'Event buffer cleared', { clearedEvents: eventCount });
  }

  /**
   * Get events by type
   */
  public getEventsByType(type: UIActionEventType): UIActionEvent[] {
    return this.eventBuffer.filter(event => event.type === type);
  }

  /**
   * Get events by component
   */
  public getEventsByComponent(component: string): UIActionEvent[] {
    return this.eventBuffer.filter(event => event.component === component);
  }

  /**
   * Get events within a time range
   */
  public getEventsInTimeRange(startTime: string, endTime: string): UIActionEvent[] {
    return this.eventBuffer.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Export events as JSON for replay or analysis
   */
  public exportEvents(): string {
    try {
      return JSON.stringify(this.eventBuffer, null, 2);
    } catch (error) {
      this.error('UI_ACTION_LOGGER', 'Failed to export events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventCount: this.eventBuffer.length
      });
      return '[]';
    }
  }

  /**
   * Import events from JSON
   */
  public importEvents(eventsJson: string): boolean {
    try {
      const events = JSON.parse(eventsJson) as UIActionEvent[];
      
      // Validate events structure
      if (!Array.isArray(events)) {
        throw new Error('Invalid events format: expected array');
      }

      // Basic validation of event structure
      for (const event of events) {
        if (!event.id || !event.timestamp || !event.type || !event.component) {
          throw new Error('Invalid event structure');
        }
      }

      this.eventBuffer = events;
      this.info('UI_ACTION_LOGGER', 'Events imported successfully', {
        importedCount: events.length
      });
      
      return true;
    } catch (error) {
      this.error('UI_ACTION_LOGGER', 'Failed to import events', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get performance statistics from logged events
   */
  public getPerformanceStatistics(): {
    totalEvents: number;
    averageOperationDuration: number;
    slowestOperation: { event: UIActionEvent; duration: number } | null;
    fastestOperation: { event: UIActionEvent; duration: number } | null;
    eventsByType: Record<string, number>;
  } {
    const eventsWithPerformance = this.eventBuffer.filter(event => event.performance?.operationDuration);
    
    if (eventsWithPerformance.length === 0) {
      return {
        totalEvents: this.eventBuffer.length,
        averageOperationDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        eventsByType: {}
      };
    }

    const durations = eventsWithPerformance.map(event => event.performance!.operationDuration);
    const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    
    const slowestEvent = eventsWithPerformance.reduce((slowest, current) => 
      (current.performance!.operationDuration > slowest.performance!.operationDuration) ? current : slowest
    );
    
    const fastestEvent = eventsWithPerformance.reduce((fastest, current) => 
      (current.performance!.operationDuration < fastest.performance!.operationDuration) ? current : fastest
    );

    const eventsByType = this.eventBuffer.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      totalEvents: this.eventBuffer.length,
      averageOperationDuration: averageDuration,
      slowestOperation: {
        event: slowestEvent,
        duration: slowestEvent.performance!.operationDuration
      },
      fastestOperation: {
        event: fastestEvent,
        duration: fastestEvent.performance!.operationDuration
      },
      eventsByType
    };
  }
}

// Export singleton instance
export const uiActionLogger = UIActionLogger.getInstance();

// Convenience functions for common UI action logging patterns
export const logDragOperation = (
  component: string,
  operation: 'start' | 'hover' | 'drop' | 'cancel',
  card: Card,
  sourcePosition?: Position,
  targetPosition?: Position,
  validationResult?: MoveValidationResult,
  performance?: PerformanceMetrics
) => {
  const logger = UIActionLogger.getInstance();
  
  switch (operation) {
    case 'start':
      if (sourcePosition) {
        return logger.logDragStart(component, card, sourcePosition, performance);
      }
      break;
    case 'hover':
      if (targetPosition) {
        return logger.logDragHover(component, card, targetPosition, validationResult, performance);
      }
      break;
    case 'drop':
      if (sourcePosition && targetPosition && validationResult) {
        return logger.logDragDrop(component, card, sourcePosition, targetPosition, validationResult, performance);
      }
      break;
    case 'cancel':
      return logger.logDragCancel(component, card, 'User cancelled drag operation', performance);
  }
  
  throw new Error(`Invalid drag operation or missing required parameters: ${operation}`);
};

export const logGameMove = (
  component: string,
  phase: 'attempt' | 'executed',
  sourcePosition: Position,
  targetPosition: Position,
  cards: Card[],
  validationResult?: MoveValidationResult,
  moveType: 'user' | 'auto' | 'undo' = 'user',
  performance?: PerformanceMetrics
) => {
  const logger = UIActionLogger.getInstance();
  
  if (phase === 'attempt' && validationResult) {
    return logger.logMoveAttempt(component, sourcePosition, targetPosition, cards, validationResult, performance);
  } else if (phase === 'executed') {
    return logger.logMoveExecuted(component, sourcePosition, targetPosition, cards, moveType, performance);
  }
  
  throw new Error(`Invalid move phase or missing required parameters: ${phase}`);
};

export const withPerformanceLogging = <T extends any[], R>(
  operationName: string,
  fn: (...args: T) => R
) => {
  return (...args: T): R => {
    const logger = UIActionLogger.getInstance();
    const operationId = `${operationName}-${Date.now()}`;
    
    logger.startPerformanceTimer(operationId);
    try {
      const result = fn(...args);
      const metrics = logger.endPerformanceTimer(operationId);
      
      if (metrics) {
        logger.debug('PERF', `${operationName} performance`, metrics);
      }
      
      return result;
    } catch (error) {
      logger.endPerformanceTimer(operationId);
      throw error;
    }
  };
};
