/**
 * DragDropLogger - Specialized logger for tracking complete drag-and-drop operations
 * Provides detailed lifecycle tracking, validation logging, and operation correlation
 */

import { UIActionLogger } from './UIActionLogger';
import { Card, Position } from '../types/card';
import {
  UIActionEvent,
  UIActionEventType,
  DragOperation,
  DragEvent,
  CardSnapshot,
  MoveValidationResult,
  PerformanceMetrics,
  generateEventId,
  createTimestamp
} from '../types/UIActionLogging';

/**
 * Enhanced drag operation with correlation tracking
 */
export interface EnhancedDragOperation extends DragOperation {
  correlationId: string; // Links related operations across components
  parentOperationId?: string; // For multi-step operations
  childOperationIds: string[]; // For operations that spawn sub-operations
  validationHistory: ValidationHistoryEntry[];
  performanceMetrics: DragPerformanceMetrics;
}

/**
 * Validation history entry for detailed tracking
 */
export interface ValidationHistoryEntry {
  timestamp: number;
  position: Position;
  isValid: boolean;
  reason: string;
  ruleViolations?: string[];
  validationTime: number;
}

/**
 * Performance metrics specific to drag operations
 */
export interface DragPerformanceMetrics {
  totalDuration: number;
  dragStartTime: number;
  firstHoverTime?: number;
  validationTimes: number[];
  dropProcessingTime?: number;
  animationDuration?: number;
  renderingTime?: number;
}

/**
 * Drag operation correlation data for multi-step operations
 */
export interface DragOperationCorrelation {
  correlationId: string;
  operations: EnhancedDragOperation[];
  startTime: number;
  endTime?: number;
  totalValidations: number;
  successfulDrops: number;
  cancelledOperations: number;
}

/**
 * DragDropLogger class for comprehensive drag-and-drop operation tracking
 */
export class DragDropLogger {
  private static instance: DragDropLogger;
  private uiActionLogger: UIActionLogger;
  private activeOperations: Map<string, EnhancedDragOperation> = new Map();
  private completedOperations: EnhancedDragOperation[] = [];
  private operationCorrelations: Map<string, DragOperationCorrelation> = new Map();
  private performanceTimers: Map<string, number> = new Map();

  private constructor() {
    this.uiActionLogger = UIActionLogger.getInstance();
    this.uiActionLogger.info('DRAG_DROP_LOGGER', 'DragDropLogger initialized');
  }

  public static getInstance(): DragDropLogger {
    if (!DragDropLogger.instance) {
      DragDropLogger.instance = new DragDropLogger();
    }
    return DragDropLogger.instance;
  }

  /**
   * Start tracking a new drag operation
   */
  public startDragOperation(
    component: string,
    card: Card,
    sourcePosition: Position,
    correlationId?: string,
    parentOperationId?: string
  ): string {
    const operationId = generateEventId();
    const startTime = performance.now();
    const cardSnapshot = this.uiActionLogger.createCardSnapshot(card);

    // Create enhanced drag operation
    const operation: EnhancedDragOperation = {
      operationId,
      startTime,
      card: cardSnapshot,
      sourcePosition: this.convertPosition(sourcePosition),
      events: [],
      correlationId: correlationId || operationId,
      parentOperationId,
      childOperationIds: [],
      validationHistory: [],
      performanceMetrics: {
        totalDuration: 0,
        dragStartTime: startTime,
        validationTimes: []
      }
    };

    // Add drag start event
    const startEvent: DragEvent = {
      timestamp: startTime,
      type: 'start',
      position: this.convertPosition(sourcePosition)
    };
    operation.events.push(startEvent);

    // Store active operation
    this.activeOperations.set(operationId, operation);

    // Handle correlation tracking
    this.updateCorrelation(operation.correlationId, operation);

    // Link to parent operation if specified
    if (parentOperationId) {
      const parentOperation = this.activeOperations.get(parentOperationId);
      if (parentOperation) {
        parentOperation.childOperationIds.push(operationId);
      }
    }

    // Log using UIActionLogger
    const performanceMetrics: PerformanceMetrics = {
      operationDuration: 0 // Will be updated when operation completes
    };

    this.uiActionLogger.logDragStart(component, card, sourcePosition, performanceMetrics);

    this.uiActionLogger.debug('DRAG_DROP_LOGGER', 'Drag operation started', {
      operationId,
      correlationId: operation.correlationId,
      parentOperationId,
      cardId: card.id,
      sourcePosition
    });

    return operationId;
  }

  /**
   * Log drag hover event with validation
   */
  public logDragHover(
    operationId: string,
    component: string,
    targetPosition: Position,
    validationResult: MoveValidationResult
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.uiActionLogger.warn('DRAG_DROP_LOGGER', `Active operation not found: ${operationId}`);
      return;
    }

    const timestamp = performance.now();
    const convertedPosition = this.convertPosition(targetPosition);

    // Add hover event
    const hoverEvent: DragEvent = {
      timestamp,
      type: 'hover',
      position: convertedPosition,
      validationResult: validationResult.isValid,
      validationReason: validationResult.reason
    };
    operation.events.push(hoverEvent);

    // Add to validation history
    const validationEntry: ValidationHistoryEntry = {
      timestamp,
      position: convertedPosition,
      isValid: validationResult.isValid,
      reason: validationResult.reason,
      ruleViolations: validationResult.ruleViolations,
      validationTime: validationResult.validationTime
    };
    operation.validationHistory.push(validationEntry);

    // Update performance metrics
    operation.performanceMetrics.validationTimes.push(validationResult.validationTime);
    if (!operation.performanceMetrics.firstHoverTime) {
      operation.performanceMetrics.firstHoverTime = timestamp;
    }

    // Log using UIActionLogger
    const card = this.createCardFromSnapshot(operation.card);
    const performanceMetrics: PerformanceMetrics = {
      operationDuration: timestamp - operation.startTime,
      validationTime: validationResult.validationTime
    };

    this.uiActionLogger.logDragHover(component, card, targetPosition, validationResult, performanceMetrics);

    this.uiActionLogger.debug('DRAG_DROP_LOGGER', 'Drag hover logged', {
      operationId,
      targetPosition: convertedPosition,
      isValid: validationResult.isValid,
      validationTime: validationResult.validationTime
    });
  }

  /**
   * Complete drag operation with drop
   */
  public completeDragOperation(
    operationId: string,
    component: string,
    targetPosition: Position,
    validationResult: MoveValidationResult,
    success: boolean = true
  ): EnhancedDragOperation | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.uiActionLogger.warn('DRAG_DROP_LOGGER', `Active operation not found: ${operationId}`);
      return null;
    }

    const endTime = performance.now();
    const convertedPosition = this.convertPosition(targetPosition);

    // Add drop event
    const dropEvent: DragEvent = {
      timestamp: endTime,
      type: 'drop',
      position: convertedPosition,
      validationResult: validationResult.isValid,
      validationReason: validationResult.reason
    };
    operation.events.push(dropEvent);

    // Set operation result and timing
    operation.endTime = endTime;
    operation.result = success && validationResult.isValid ? 'success' : 'invalid';

    // Update performance metrics
    operation.performanceMetrics.totalDuration = endTime - operation.startTime;
    operation.performanceMetrics.dropProcessingTime = validationResult.validationTime;
    operation.performanceMetrics.validationTimes.push(validationResult.validationTime);

    // Add final validation to history
    const finalValidation: ValidationHistoryEntry = {
      timestamp: endTime,
      position: convertedPosition,
      isValid: validationResult.isValid,
      reason: validationResult.reason,
      ruleViolations: validationResult.ruleViolations,
      validationTime: validationResult.validationTime
    };
    operation.validationHistory.push(finalValidation);

    // Move to completed operations
    this.activeOperations.delete(operationId);
    this.completedOperations.push(operation);

    // Update correlation
    this.updateCorrelationCompletion(operation.correlationId, operation);

    // Log using UIActionLogger
    const card = this.createCardFromSnapshot(operation.card);
    const performanceMetrics: PerformanceMetrics = {
      operationDuration: operation.performanceMetrics.totalDuration,
      validationTime: validationResult.validationTime,
      renderTime: operation.performanceMetrics.renderingTime,
      animationDuration: operation.performanceMetrics.animationDuration
    };

    this.uiActionLogger.logDragDrop(
      component,
      card,
      this.convertPositionBack(operation.sourcePosition),
      targetPosition,
      validationResult,
      performanceMetrics
    );

    this.uiActionLogger.info('DRAG_DROP_LOGGER', 'Drag operation completed', {
      operationId,
      result: operation.result,
      totalDuration: operation.performanceMetrics.totalDuration,
      validationCount: operation.validationHistory.length,
      correlationId: operation.correlationId
    });

    return operation;
  }

  /**
   * Cancel drag operation
   */
  public cancelDragOperation(
    operationId: string,
    component: string,
    reason: string
  ): EnhancedDragOperation | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.uiActionLogger.warn('DRAG_DROP_LOGGER', `Active operation not found: ${operationId}`);
      return null;
    }

    const endTime = performance.now();

    // Add cancel event
    const cancelEvent: DragEvent = {
      timestamp: endTime,
      type: 'cancel',
      validationReason: reason
    };
    operation.events.push(cancelEvent);

    // Set operation result and timing
    operation.endTime = endTime;
    operation.result = 'cancelled';
    operation.performanceMetrics.totalDuration = endTime - operation.startTime;

    // Move to completed operations
    this.activeOperations.delete(operationId);
    this.completedOperations.push(operation);

    // Update correlation
    this.updateCorrelationCompletion(operation.correlationId, operation);

    // Log using UIActionLogger
    const card = this.createCardFromSnapshot(operation.card);
    const performanceMetrics: PerformanceMetrics = {
      operationDuration: operation.performanceMetrics.totalDuration
    };

    this.uiActionLogger.logDragCancel(component, card, reason, performanceMetrics);

    this.uiActionLogger.info('DRAG_DROP_LOGGER', 'Drag operation cancelled', {
      operationId,
      reason,
      totalDuration: operation.performanceMetrics.totalDuration,
      correlationId: operation.correlationId
    });

    return operation;
  }

  /**
   * Get active drag operations
   */
  public getActiveOperations(): EnhancedDragOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get completed drag operations
   */
  public getCompletedOperations(): EnhancedDragOperation[] {
    return [...this.completedOperations];
  }

  /**
   * Get operations by correlation ID
   */
  public getOperationsByCorrelation(correlationId: string): EnhancedDragOperation[] {
    const correlation = this.operationCorrelations.get(correlationId);
    return correlation ? [...correlation.operations] : [];
  }

  /**
   * Get operation correlation data
   */
  public getOperationCorrelation(correlationId: string): DragOperationCorrelation | null {
    return this.operationCorrelations.get(correlationId) || null;
  }

  /**
   * Get all operation correlations
   */
  public getAllCorrelations(): DragOperationCorrelation[] {
    return Array.from(this.operationCorrelations.values());
  }

  /**
   * Get performance statistics for drag operations
   */
  public getPerformanceStatistics(): {
    totalOperations: number;
    averageDuration: number;
    averageValidationTime: number;
    successRate: number;
    cancelRate: number;
    operationsByResult: Record<string, number>;
    correlationStats: {
      totalCorrelations: number;
      averageOperationsPerCorrelation: number;
      multiStepOperations: number;
    };
  } {
    const allOperations = [...this.completedOperations];
    
    if (allOperations.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        averageValidationTime: 0,
        successRate: 0,
        cancelRate: 0,
        operationsByResult: {},
        correlationStats: {
          totalCorrelations: 0,
          averageOperationsPerCorrelation: 0,
          multiStepOperations: 0
        }
      };
    }

    const durations = allOperations.map(op => op.performanceMetrics.totalDuration);
    const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    const allValidationTimes = allOperations.flatMap(op => op.performanceMetrics.validationTimes);
    const averageValidationTime = allValidationTimes.length > 0 
      ? allValidationTimes.reduce((sum, time) => sum + time, 0) / allValidationTimes.length 
      : 0;

    const successfulOps = allOperations.filter(op => op.result === 'success').length;
    const cancelledOps = allOperations.filter(op => op.result === 'cancelled').length;

    const operationsByResult = allOperations.reduce((counts, op) => {
      const result = op.result || 'unknown';
      counts[result] = (counts[result] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const correlations = Array.from(this.operationCorrelations.values());
    const multiStepOperations = correlations.filter(corr => corr.operations.length > 1).length;
    const averageOperationsPerCorrelation = correlations.length > 0
      ? correlations.reduce((sum, corr) => sum + corr.operations.length, 0) / correlations.length
      : 0;

    return {
      totalOperations: allOperations.length,
      averageDuration,
      averageValidationTime,
      successRate: allOperations.length > 0 ? successfulOps / allOperations.length : 0,
      cancelRate: allOperations.length > 0 ? cancelledOps / allOperations.length : 0,
      operationsByResult,
      correlationStats: {
        totalCorrelations: correlations.length,
        averageOperationsPerCorrelation,
        multiStepOperations
      }
    };
  }

  /**
   * Clear completed operations (keep active ones)
   */
  public clearCompletedOperations(): void {
    const clearedCount = this.completedOperations.length;
    this.completedOperations = [];
    
    // Clear completed correlations
    for (const [correlationId, correlation] of this.operationCorrelations.entries()) {
      if (correlation.endTime) {
        this.operationCorrelations.delete(correlationId);
      }
    }

    this.uiActionLogger.info('DRAG_DROP_LOGGER', 'Completed operations cleared', {
      clearedOperations: clearedCount
    });
  }

  /**
   * Export drag operations as JSON
   */
  public exportOperations(): string {
    try {
      const exportData = {
        activeOperations: Array.from(this.activeOperations.values()),
        completedOperations: this.completedOperations,
        correlations: Array.from(this.operationCorrelations.values())
      };
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.uiActionLogger.error('DRAG_DROP_LOGGER', 'Failed to export operations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return '{}';
    }
  }

  // Private helper methods

  private convertPosition(position: Position): Position {
    return {
      x: position.index,
      y: position.cardIndex || 0,
      zone: `${position.zone}-${position.index}`
    };
  }

  private convertPositionBack(position: Position): Position {
    const zoneParts = position.zone?.split('-') || ['unknown', '0'];
    return {
      zone: zoneParts[0] as any,
      index: position.x,
      cardIndex: position.y
    };
  }

  private createCardFromSnapshot(snapshot: CardSnapshot): Card {
    // Create a minimal Card object from snapshot for logging
    return {
      id: snapshot.id,
      suit: snapshot.suit as any,
      rank: snapshot.rank,
      faceUp: snapshot.faceUp
    } as Card;
  }

  private updateCorrelation(correlationId: string, operation: EnhancedDragOperation): void {
    let correlation = this.operationCorrelations.get(correlationId);
    
    if (!correlation) {
      correlation = {
        correlationId,
        operations: [],
        startTime: operation.startTime,
        totalValidations: 0,
        successfulDrops: 0,
        cancelledOperations: 0
      };
      this.operationCorrelations.set(correlationId, correlation);
    }

    correlation.operations.push(operation);
  }

  private updateCorrelationCompletion(correlationId: string, operation: EnhancedDragOperation): void {
    const correlation = this.operationCorrelations.get(correlationId);
    if (!correlation) return;

    correlation.endTime = operation.endTime;
    correlation.totalValidations += operation.validationHistory.length;

    if (operation.result === 'success') {
      correlation.successfulDrops++;
    } else if (operation.result === 'cancelled') {
      correlation.cancelledOperations++;
    }
  }
}

// Export singleton instance
export const dragDropLogger = DragDropLogger.getInstance();

// Convenience functions for common drag-drop logging patterns
export const withDragOperationLogging = <T extends any[], R>(
  component: string,
  operationName: string,
  fn: (operationId: string, ...args: T) => R
) => {
  return (card: Card, sourcePosition: Position, ...args: T): R => {
    const logger = DragDropLogger.getInstance();
    const operationId = logger.startDragOperation(component, card, sourcePosition);
    
    try {
      const result = fn(operationId, ...args);
      return result;
    } catch (error) {
      logger.cancelDragOperation(operationId, component, `Error in ${operationName}: ${error}`);
      throw error;
    }
  };
};

export const logDragValidation = (
  operationId: string,
  component: string,
  targetPosition: Position,
  validationResult: MoveValidationResult
): void => {
  const logger = DragDropLogger.getInstance();
  logger.logDragHover(operationId, component, targetPosition, validationResult);
};

export const completeDragWithResult = (
  operationId: string,
  component: string,
  targetPosition: Position,
  validationResult: MoveValidationResult,
  success: boolean = true
): EnhancedDragOperation | null => {
  const logger = DragDropLogger.getInstance();
  return logger.completeDragOperation(operationId, component, targetPosition, validationResult, success);
};