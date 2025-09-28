/**
 * UIActionLogger - Enhanced logging system for UI actions and game state debugging
 * Extends RendererLogger to provide comprehensive UI interaction tracking
 */

import { RendererLogger, LogLevel } from './RendererLogger';
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
import {
  analyzeUIActionEvents,
  UIActionLogAnalysisOptions,
  UIActionLogAnalysisReport
} from './debugging/UIActionLogAnalyzer';
import {
  filterUIActionEvents,
  searchUIActionEvents,
  UIActionLogFilterCriteria,
  UIActionLogSearchOptions
} from './debugging/UIActionLogFilter';
import {
  generateReplayTestCases,
  GeneratedTestCase,
  TestGenerationOptions
} from './debugging/UIActionLogTestGenerator';
import {
  prepareVisualizationData,
  VisualizationPreparedData
} from './debugging/UIActionLogVisualizer';

type DispatchMode = 'summary' | 'individual';

interface UIActionLoggerConfig {
  loggingLevel: LogLevel;
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    flushIntervalMs: number;
    dispatchMode: DispatchMode;
  };
  memory: {
    warningThresholdBytes: number;
  };
}

interface MemoryUsageStats {
  eventCount: number;
  approximateBytes: number;
  approximateKilobytes: number;
  approximateMegabytes: number;
  thresholdBytes: number;
  thresholdExceeded: boolean;
}

interface LoggingOverheadMetrics {
  eventCount: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
}

type UIActionLoggerMode = 'normal' | 'reduced' | 'silent';

interface UIActionLoggerIssue {
  type: 'dispatch-failure' | 'mode-changed' | 'event-dropped';
  timestamp: string;
  reason: string;
  context?: 'batch' | 'event';
  mode?: UIActionLoggerMode;
  eventType?: UIActionEventType;
  component?: string;
  droppedCount?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface UIActionLoggerHealthStatus {
  mode: UIActionLoggerMode;
  dispatchFailureCount: number;
  consecutiveDispatchFailures: number;
  memoryWarningIssued: boolean;
  droppedEventCount: number;
  pendingDispatchCount: number;
  recentIssues: UIActionLoggerIssue[];
}

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
  private config: UIActionLoggerConfig = {
    loggingLevel: LogLevel.DEBUG,
    batching: {
      enabled: false,
      maxBatchSize: 25,
      flushIntervalMs: 250,
      dispatchMode: 'summary'
    },
    memory: {
      warningThresholdBytes: 5 * 1024 * 1024 // 5 MB
    }
  };
  private pendingDispatch: UIActionEvent[] = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private bufferSizeBytes = 0;
  private memoryWarningIssued = false;
  private loggingOverhead = {
    eventCount: 0,
    totalDuration: 0,
    maxDuration: 0
  };
  private operationMode: UIActionLoggerMode = 'normal';
  private dispatchFailureCount = 0;
  private consecutiveDispatchFailures = 0;
  private droppedEventCount = 0;
  private issues: UIActionLoggerIssue[] = [];
  private readonly maxIssues = 30;
  private readonly maxDispatchFailuresBeforeSilent = 3;

  private constructor() {
    this.logger = RendererLogger.getInstance();
    this.logger.setLogLevel(this.config.loggingLevel);
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
    const loggingStart = this.getTimestamp();
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

    let storedEvent: UIActionEvent = event;

    if (this.operationMode === 'reduced') {
      storedEvent = this.createReducedEvent(event);
    }

    if (this.operationMode === 'silent') {
      this.droppedEventCount += 1;
      this.recordIssue({
        type: 'event-dropped',
        timestamp: storedEvent.timestamp,
        reason: 'silent-mode-active',
        eventType: storedEvent.type,
        component: storedEvent.component
      });
    } else {
      this.eventBuffer.push(storedEvent);
      this.trackMemoryUsage(storedEvent);

      if (this.operationMode === 'reduced' && storedEvent === event) {
        const reducedEvent = this.createReducedEvent(event);
        this.eventBuffer[this.eventBuffer.length - 1] = reducedEvent;
        storedEvent = reducedEvent;
      }

      this.queueEventForDispatch(storedEvent);
    }

    const duration = this.getTimestamp() - loggingStart;
    this.recordLoggingOverhead(duration);

    return storedEvent;
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
   * Configure logging behaviour at runtime
   */
  public configure(options: {
    loggingLevel?: LogLevel;
    batching?: Partial<UIActionLoggerConfig['batching']>;
    memory?: Partial<UIActionLoggerConfig['memory']>;
  }): void {
    if (options.loggingLevel !== undefined) {
      this.config.loggingLevel = options.loggingLevel;
      this.logger.setLogLevel(options.loggingLevel);
    }

    if (options.batching) {
      const previousState = this.config.batching.enabled;
      this.config.batching = {
        ...this.config.batching,
        ...options.batching
      };

      if (previousState && !this.config.batching.enabled) {
        this.flushPendingEvents('batching-disabled');
      }

      if (!previousState && this.config.batching.enabled && this.pendingDispatch.length > 0) {
        this.scheduleBatchFlush();
      }

      if (this.batchFlushTimer && !this.config.batching.enabled) {
        this.clearBatchTimer();
      }

      if (this.batchFlushTimer && this.config.batching.enabled && options.batching.flushIntervalMs !== undefined) {
        this.clearBatchTimer();
        if (this.pendingDispatch.length > 0) {
          this.scheduleBatchFlush();
        }
      }
    }

    if (options.memory) {
      this.config.memory = {
        ...this.config.memory,
        ...options.memory
      };

      if (this.bufferSizeBytes <= this.config.memory.warningThresholdBytes) {
        this.memoryWarningIssued = false;
      }
    }
  }

  /**
   * Return current configuration (copy)
   */
  public getConfiguration(): UIActionLoggerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Flush any pending batched events immediately
   */
  public flushPendingEvents(reason: string = 'manual'): void {
    if (this.pendingDispatch.length === 0) {
      this.clearBatchTimer();
      return;
    }

    const eventsToDispatch = [...this.pendingDispatch];
    this.pendingDispatch = [];
    this.clearBatchTimer();

    if (this.operationMode === 'silent') {
      this.droppedEventCount += eventsToDispatch.length;
      this.recordIssue({
        type: 'event-dropped',
        timestamp: new Date().toISOString(),
        reason: `silent-mode-batch-${reason}`,
        context: 'batch',
        droppedCount: eventsToDispatch.length
      });
      return;
    }

    if (this.config.batching.dispatchMode === 'summary') {
      try {
        this.logger.info('UI_ACTION_BATCH', `Dispatching ${eventsToDispatch.length} UI events`, {
          reason,
          count: eventsToDispatch.length,
          events: eventsToDispatch.map(event => ({
            id: event.id,
            type: event.type,
            component: event.component,
            performance: event.performance
          }))
        });
        this.resetDispatchFailures();
      } catch (error) {
        this.handleDispatchFailure(error, eventsToDispatch[0], 'batch');
      }
    } else {
      eventsToDispatch.forEach(event => this.emitEvent(event));
    }
  }

  /**
   * Report approximate in-memory footprint of the logger
   */
  public getMemoryUsageStats(): MemoryUsageStats {
    const approximateKilobytes = this.bufferSizeBytes / 1024;
    const approximateMegabytes = approximateKilobytes / 1024;
    const thresholdExceeded = this.bufferSizeBytes > this.config.memory.warningThresholdBytes;

    return {
      eventCount: this.eventBuffer.length,
      approximateBytes: this.bufferSizeBytes,
      approximateKilobytes,
      approximateMegabytes,
      thresholdBytes: this.config.memory.warningThresholdBytes,
      thresholdExceeded
    };
  }

  /**
   * Retrieve logging overhead metrics collected for UIActionLogger operations
   */
  public getLoggingOverheadMetrics(): LoggingOverheadMetrics {
    const { eventCount, totalDuration, maxDuration } = this.loggingOverhead;
    const averageDuration = eventCount > 0 ? totalDuration / eventCount : 0;

    return {
      eventCount,
      totalDuration,
      averageDuration,
      maxDuration
    };
  }

  public getHealthStatus(): UIActionLoggerHealthStatus {
    return {
      mode: this.operationMode,
      dispatchFailureCount: this.dispatchFailureCount,
      consecutiveDispatchFailures: this.consecutiveDispatchFailures,
      memoryWarningIssued: this.memoryWarningIssued,
      droppedEventCount: this.droppedEventCount,
      pendingDispatchCount: this.pendingDispatch.length,
      recentIssues: [...this.issues]
    };
  }

  /**
   * Emit a consolidated performance summary entry
   */
  public logPerformanceSummary(): void {
    const performanceStats = this.getPerformanceStatistics();
    const overheadStats = this.getLoggingOverheadMetrics();
    const memoryStats = this.getMemoryUsageStats();

    this.info('PERF', 'UIActionLogger performance summary', {
      performanceStats,
      overheadStats,
      memoryStats
    });
  }

  private queueEventForDispatch(event: UIActionEvent): void {
    if (!this.config.batching.enabled) {
      this.emitEvent(event);
      return;
    }

    this.pendingDispatch.push(event);

    if (this.pendingDispatch.length >= this.config.batching.maxBatchSize) {
      this.flushPendingEvents('batch-size');
      return;
    }

    if (!this.batchFlushTimer) {
      this.scheduleBatchFlush();
    }
  }

  private emitEvent(event: UIActionEvent): void {
    if (this.operationMode === 'silent') {
      this.droppedEventCount += 1;
      this.recordIssue({
        type: 'event-dropped',
        timestamp: event.timestamp,
        reason: 'silent-mode-active',
        context: 'event',
        eventType: event.type,
        component: event.component
      });
      return;
    }

    try {
      this.info('UI_ACTION', `${event.component}: ${event.type}`, {
        eventId: event.id,
        data: event.data,
        performance: event.performance
      });
      this.resetDispatchFailures();
    } catch (error) {
      this.handleDispatchFailure(error, event, 'event');
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchFlushTimer) {
      return;
    }

    this.batchFlushTimer = setTimeout(() => {
      this.flushPendingEvents('interval');
    }, this.config.batching.flushIntervalMs);
  }

  private clearBatchTimer(): void {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
  }

  private trackMemoryUsage(event: UIActionEvent): void {
    const estimatedSize = this.estimateEventSize(event);
    this.bufferSizeBytes += estimatedSize;

    if (!this.memoryWarningIssued && this.bufferSizeBytes > this.config.memory.warningThresholdBytes) {
      this.memoryWarningIssued = true;
      this.warn('UI_ACTION_LOGGER', 'UI action event buffer memory usage exceeded threshold', {
        approximateBytes: this.bufferSizeBytes,
        thresholdBytes: this.config.memory.warningThresholdBytes
      });
      if (this.operationMode === 'normal') {
        this.enterReducedMode('memory-threshold-exceeded');
      } else if (
        this.operationMode === 'reduced' &&
        this.bufferSizeBytes > this.config.memory.warningThresholdBytes * 1.5
      ) {
        this.enterSilentMode('memory-threshold-critical');
      }
    }
  }

  private estimateEventSize(event: UIActionEvent): number {
    try {
      const serialized = JSON.stringify(event);
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(serialized).length;
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(serialized, 'utf8');
      }
      return serialized.length;
    } catch {
      return 0;
    }
  }

  private recordLoggingOverhead(duration: number): void {
    this.loggingOverhead.eventCount += 1;
    this.loggingOverhead.totalDuration += duration;
    if (duration > this.loggingOverhead.maxDuration) {
      this.loggingOverhead.maxDuration = duration;
    }
  }

  private createReducedEvent(source: UIActionEvent): UIActionEvent {
    return {
      id: source.id,
      timestamp: source.timestamp,
      type: source.type,
      component: source.component,
      data: this.createReducedEventData(source),
      performance: source.performance
        ? { operationDuration: source.performance.operationDuration }
        : undefined
    };
  }

  private createReducedEventData(source: UIActionEvent): UIActionEventData {
    const dataKeys = source.data ? Object.keys(source.data) : [];

    return {
      summary: `${source.component}:${source.type}`,
      dataKeys: dataKeys.slice(0, 5),
      note: 'Event truncated due to logging resource constraints'
    } as UIActionEventData;
  }

  private handleDispatchFailure(error: unknown, event: UIActionEvent | undefined, context: 'batch' | 'event'): void {
    this.dispatchFailureCount += 1;
    this.consecutiveDispatchFailures += 1;

    this.recordIssue({
      type: 'dispatch-failure',
      timestamp: new Date().toISOString(),
      reason: context === 'batch' ? 'batch-dispatch-failure' : 'event-dispatch-failure',
      context,
      eventType: event?.type,
      component: event?.component,
      error: this.serializeError(error)
    });

    if (this.operationMode === 'normal') {
      this.enterReducedMode('dispatch-failure');
    }

    if (this.consecutiveDispatchFailures >= this.maxDispatchFailuresBeforeSilent) {
      this.enterSilentMode('persistent-dispatch-failures', error);
    }
  }

  private resetDispatchFailures(): void {
    this.consecutiveDispatchFailures = 0;
  }

  private enterReducedMode(reason: string): void {
    if (this.operationMode !== 'normal') {
      return;
    }

    this.operationMode = 'reduced';
    this.recordIssue({
      type: 'mode-changed',
      timestamp: new Date().toISOString(),
      reason,
      mode: 'reduced'
    });

    try {
      this.warn('UI_ACTION_LOGGER', 'Entering reduced logging mode', { reason });
    } catch {
      console.warn('UI_ACTION_LOGGER reduced logging mode', reason);
    }
  }

  private enterSilentMode(reason: string, error?: unknown): void {
    if (this.operationMode === 'silent') {
      return;
    }

    this.operationMode = 'silent';
    this.recordIssue({
      type: 'mode-changed',
      timestamp: new Date().toISOString(),
      reason,
      mode: 'silent',
      error: this.serializeError(error)
    });

    this.pendingDispatch = [];
    this.clearBatchTimer();

    try {
      this.error('UI_ACTION_LOGGER', 'Entering silent logging mode due to persistent failures', {
        reason
      });
    } catch {
      console.error('UI_ACTION_LOGGER silent logging mode', reason);
    }
  }

  private recordIssue(issue: UIActionLoggerIssue): void {
    this.issues.push(issue);
    if (this.issues.length > this.maxIssues) {
      this.issues = this.issues.slice(-this.maxIssues);
    }
  }

  private serializeError(error: unknown): { message: string; stack?: string } | undefined {
    if (!error) {
      return undefined;
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    try {
      return { message: JSON.stringify(error) };
    } catch {
      return { message: 'Unknown error' };
    }
  }

  private getTimestamp(): number {
    if (typeof globalThis !== 'undefined') {
      const perf = (globalThis as any).performance;
      if (perf && typeof perf.now === 'function') {
        return perf.now();
      }
    }
    return Date.now();
  }

  /**
   * Start performance timing for an operation
   */
  public startPerformanceTimer(operationId: string): void {
    this.performanceTimers.set(operationId, this.getTimestamp());
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

    const endTime = this.getTimestamp();
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
    this.pendingDispatch = [];
    this.clearBatchTimer();
    this.bufferSizeBytes = 0;
    this.memoryWarningIssued = false;
    this.operationMode = 'normal';
    this.dispatchFailureCount = 0;
    this.consecutiveDispatchFailures = 0;
    this.droppedEventCount = 0;
    this.issues = [];
    this.loggingOverhead = {
      eventCount: 0,
      totalDuration: 0,
      maxDuration: 0
    };
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
   * Provide a full analysis report for the currently buffered events.
   */
  public analyzeEvents(options?: UIActionLogAnalysisOptions): UIActionLogAnalysisReport {
    return analyzeUIActionEvents(this.eventBuffer, options);
  }

  /**
   * Filter the buffered events using advanced criteria.
   */
  public filterLoggedEvents(criteria: UIActionLogFilterCriteria): UIActionEvent[] {
    return filterUIActionEvents(this.eventBuffer, criteria);
  }

  /**
   * Search the buffered events using free-text queries.
   */
  public searchLoggedEvents(query: string, options?: UIActionLogSearchOptions): UIActionEvent[] {
    return searchUIActionEvents(this.eventBuffer, query, options);
  }

  /**
   * Generate replay-driven Vitest cases from the buffered events.
   */
  public generateReplayTestCases(options?: TestGenerationOptions): GeneratedTestCase[] {
    return generateReplayTestCases(this.eventBuffer, options);
  }

  /**
   * Prepare visualization-friendly data structures from the buffered events.
   */
  public prepareVisualizationData(): VisualizationPreparedData {
    return prepareVisualizationData(this.eventBuffer);
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
