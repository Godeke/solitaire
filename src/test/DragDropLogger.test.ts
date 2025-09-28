/**
 * Unit tests for DragDropLogger
 * Tests drag-and-drop event capture, correlation, and lifecycle tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Card, Position } from '../types/card';
import { MoveValidationResult } from '../types/UIActionLogging';

// Mock UIActionLogger
vi.mock('../utils/UIActionLogger', () => ({
  UIActionLogger: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logDragStart: vi.fn(),
      logDragHover: vi.fn(),
      logDragDrop: vi.fn(),
      logDragCancel: vi.fn(),
      createCardSnapshot: vi.fn((card: Card) => ({
        id: card.id,
        suit: card.suit,
        rank: card.rank,
        faceUp: card.faceUp,
        draggable: true,
        position: { x: 0, y: 0, zone: 'test' }
      }))
    }))
  }
}));

// Import after mocking
import { DragDropLogger, EnhancedDragOperation } from '../utils/DragDropLogger';

// Mock performance.now()
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true
});

describe('DragDropLogger', () => {
  let logger: DragDropLogger;
  let mockCard: Card;
  let mockSourcePosition: Position;
  let mockTargetPosition: Position;
  let mockValidationResult: MoveValidationResult;

  beforeEach(() => {
    // Reset singleton instance
    (DragDropLogger as any).instance = undefined;
    logger = DragDropLogger.getInstance();
    
    // Reset performance timer
    let timeCounter = 1000;
    mockPerformanceNow.mockImplementation(() => timeCounter++);

    // Create mock objects
    mockCard = {
      id: 'test-card-1',
      suit: 'hearts',
      rank: 7,
      faceUp: true,
      position: { zone: 'tableau', index: 0 },
      draggable: true
    };

    mockSourcePosition = {
      zone: 'tableau' as any,
      index: 0,
      cardIndex: 2
    };

    mockTargetPosition = {
      zone: 'foundation' as any,
      index: 1,
      cardIndex: 0
    };

    mockValidationResult = {
      isValid: true,
      reason: 'Valid move',
      validationTime: 5.5
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DragDropLogger.getInstance();
      const instance2 = DragDropLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Drag Operation Lifecycle', () => {
    it('should start a drag operation and return operation ID', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(operationId).toMatch(/^event-\d+-[a-z0-9]+$/);
    });

    it('should track active operations', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      const activeOps = logger.getActiveOperations();
      
      expect(activeOps).toHaveLength(1);
      expect(activeOps[0].operationId).toBe(operationId);
      expect(activeOps[0].card.id).toBe(mockCard.id);
    });

    it('should create operation with correct initial state', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      const activeOps = logger.getActiveOperations();
      const operation = activeOps[0];
      
      expect(operation.operationId).toBe(operationId);
      expect(operation.correlationId).toBe(operationId); // Default correlation ID
      expect(operation.parentOperationId).toBeUndefined();
      expect(operation.childOperationIds).toEqual([]);
      expect(operation.events).toHaveLength(1);
      expect(operation.events[0].type).toBe('start');
      expect(operation.validationHistory).toEqual([]);
      expect(operation.result).toBeUndefined();
    });

    it('should support custom correlation ID', () => {
      const customCorrelationId = 'custom-correlation-123';
      const operationId = logger.startDragOperation(
        'CardRenderer', 
        mockCard, 
        mockSourcePosition, 
        customCorrelationId
      );
      
      const activeOps = logger.getActiveOperations();
      expect(activeOps[0].correlationId).toBe(customCorrelationId);
    });

    it('should support parent-child operation relationships', () => {
      const parentId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      const childId = logger.startDragOperation(
        'DropZone', 
        mockCard, 
        mockTargetPosition, 
        undefined, 
        parentId
      );
      
      const activeOps = logger.getActiveOperations();
      const parentOp = activeOps.find(op => op.operationId === parentId);
      const childOp = activeOps.find(op => op.operationId === childId);
      
      expect(parentOp?.childOperationIds).toContain(childId);
      expect(childOp?.parentOperationId).toBe(parentId);
    });
  });

  describe('Drag Hover Logging', () => {
    it('should log hover events with validation', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      
      const activeOps = logger.getActiveOperations();
      const operation = activeOps[0];
      
      expect(operation.events).toHaveLength(2);
      expect(operation.events[1].type).toBe('hover');
      expect(operation.events[1].validationResult).toBe(true);
      expect(operation.events[1].validationReason).toBe('Valid move');
      
      expect(operation.validationHistory).toHaveLength(1);
      expect(operation.validationHistory[0].isValid).toBe(true);
      expect(operation.validationHistory[0].validationTime).toBe(5.5);
    });

    it('should track multiple hover events', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      // First hover - invalid
      const invalidResult: MoveValidationResult = {
        isValid: false,
        reason: 'Invalid target',
        validationTime: 3.2
      };
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, invalidResult);
      
      // Second hover - valid
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      
      const activeOps = logger.getActiveOperations();
      const operation = activeOps[0];
      
      expect(operation.events).toHaveLength(3); // start + 2 hovers
      expect(operation.validationHistory).toHaveLength(2);
      expect(operation.performanceMetrics.validationTimes).toEqual([3.2, 5.5]);
    });

    it('should handle hover on non-existent operation gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      logger.logDragHover('non-existent-id', 'DropZone', mockTargetPosition, mockValidationResult);
      
      // Should not throw, just log warning
      expect(consoleSpy).not.toHaveBeenCalled(); // UIActionLogger.warn is mocked
      
      consoleSpy.mockRestore();
    });

    it('should set first hover time correctly', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      
      const activeOps = logger.getActiveOperations();
      const operation = activeOps[0];
      
      expect(operation.performanceMetrics.firstHoverTime).toBeDefined();
      expect(operation.performanceMetrics.firstHoverTime).toBeGreaterThan(operation.startTime);
    });
  });

  describe('Drag Operation Completion', () => {
    it('should complete drag operation successfully', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      
      const completedOp = logger.completeDragOperation(
        operationId, 
        'DropZone', 
        mockTargetPosition, 
        mockValidationResult, 
        true
      );
      
      expect(completedOp).toBeDefined();
      expect(completedOp?.result).toBe('success');
      expect(completedOp?.endTime).toBeDefined();
      expect(completedOp?.performanceMetrics.totalDuration).toBeGreaterThan(0);
      
      // Should be moved to completed operations
      expect(logger.getActiveOperations()).toHaveLength(0);
      expect(logger.getCompletedOperations()).toHaveLength(1);
    });

    it('should handle invalid drop result', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      const invalidResult: MoveValidationResult = {
        isValid: false,
        reason: 'Invalid drop target',
        validationTime: 2.1
      };
      
      const completedOp = logger.completeDragOperation(
        operationId, 
        'DropZone', 
        mockTargetPosition, 
        invalidResult, 
        false
      );
      
      expect(completedOp?.result).toBe('invalid');
      expect(completedOp?.validationHistory).toHaveLength(1);
      expect(completedOp?.validationHistory[0].isValid).toBe(false);
    });

    it('should handle completion of non-existent operation', () => {
      const result = logger.completeDragOperation(
        'non-existent-id', 
        'DropZone', 
        mockTargetPosition, 
        mockValidationResult, 
        true
      );
      
      expect(result).toBeNull();
    });

    it('should update performance metrics on completion', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      const completedOp = logger.completeDragOperation(
        operationId, 
        'DropZone', 
        mockTargetPosition, 
        mockValidationResult, 
        true
      );
      
      expect(completedOp?.performanceMetrics.totalDuration).toBeGreaterThan(0);
      expect(completedOp?.performanceMetrics.dropProcessingTime).toBe(5.5);
      expect(completedOp?.performanceMetrics.validationTimes).toContain(5.5);
    });
  });

  describe('Drag Operation Cancellation', () => {
    it('should cancel drag operation with reason', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      
      const cancelledOp = logger.cancelDragOperation(
        operationId, 
        'CardRenderer', 
        'User pressed escape'
      );
      
      expect(cancelledOp).toBeDefined();
      expect(cancelledOp?.result).toBe('cancelled');
      expect(cancelledOp?.endTime).toBeDefined();
      expect(cancelledOp?.events).toHaveLength(3); // start + hover + cancel
      expect(cancelledOp?.events[2].type).toBe('cancel');
      expect(cancelledOp?.events[2].validationReason).toBe('User pressed escape');
      
      // Should be moved to completed operations
      expect(logger.getActiveOperations()).toHaveLength(0);
      expect(logger.getCompletedOperations()).toHaveLength(1);
    });

    it('should handle cancellation of non-existent operation', () => {
      const result = logger.cancelDragOperation(
        'non-existent-id', 
        'CardRenderer', 
        'Test reason'
      );
      
      expect(result).toBeNull();
    });
  });

  describe('Operation Correlation', () => {
    it('should track operations by correlation ID', () => {
      const correlationId = 'multi-step-operation';
      
      const op1Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition, correlationId);
      const op2Id = logger.startDragOperation('DropZone', mockCard, mockTargetPosition, correlationId);
      
      const correlatedOps = logger.getOperationsByCorrelation(correlationId);
      expect(correlatedOps).toHaveLength(2);
      expect(correlatedOps.map(op => op.operationId)).toContain(op1Id);
      expect(correlatedOps.map(op => op.operationId)).toContain(op2Id);
    });

    it('should create correlation data structure', () => {
      const correlationId = 'test-correlation';
      
      logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition, correlationId);
      
      const correlation = logger.getOperationCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation?.correlationId).toBe(correlationId);
      expect(correlation?.operations).toHaveLength(1);
      expect(correlation?.totalValidations).toBe(0);
      expect(correlation?.successfulDrops).toBe(0);
      expect(correlation?.cancelledOperations).toBe(0);
    });

    it('should update correlation statistics on completion', () => {
      const correlationId = 'test-correlation';
      
      const op1Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition, correlationId);
      logger.logDragHover(op1Id, 'DropZone', mockTargetPosition, mockValidationResult);
      logger.completeDragOperation(op1Id, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      const op2Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition, correlationId);
      logger.cancelDragOperation(op2Id, 'CardRenderer', 'Test cancel');
      
      const correlation = logger.getOperationCorrelation(correlationId);
      expect(correlation?.totalValidations).toBe(2); // 1 hover + 1 completion
      expect(correlation?.successfulDrops).toBe(1);
      expect(correlation?.cancelledOperations).toBe(1);
    });

    it('should return empty array for non-existent correlation', () => {
      const ops = logger.getOperationsByCorrelation('non-existent');
      expect(ops).toEqual([]);
    });
  });

  describe('Performance Statistics', () => {
    it('should return empty statistics when no operations exist', () => {
      const stats = logger.getPerformanceStatistics();
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.averageValidationTime).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.cancelRate).toBe(0);
      expect(stats.operationsByResult).toEqual({});
    });

    it('should calculate statistics for completed operations', () => {
      // Create and complete multiple operations
      const op1Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.logDragHover(op1Id, 'DropZone', mockTargetPosition, mockValidationResult);
      logger.completeDragOperation(op1Id, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      const op2Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.cancelDragOperation(op2Id, 'CardRenderer', 'Test cancel');
      
      const stats = logger.getPerformanceStatistics();
      
      expect(stats.totalOperations).toBe(2);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.successRate).toBe(0.5); // 1 success out of 2
      expect(stats.cancelRate).toBe(0.5); // 1 cancel out of 2
      expect(stats.operationsByResult.success).toBe(1);
      expect(stats.operationsByResult.cancelled).toBe(1);
    });

    it('should calculate correlation statistics', () => {
      const correlationId = 'multi-op-correlation';
      
      const op1Id = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition, correlationId);
      const op2Id = logger.startDragOperation('DropZone', mockCard, mockTargetPosition, correlationId);
      
      // Complete the operations to get proper statistics
      logger.completeDragOperation(op1Id, 'DropZone', mockTargetPosition, mockValidationResult, true);
      logger.completeDragOperation(op2Id, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      const stats = logger.getPerformanceStatistics();
      
      expect(stats.correlationStats.totalCorrelations).toBe(1);
      expect(stats.correlationStats.averageOperationsPerCorrelation).toBe(2);
      expect(stats.correlationStats.multiStepOperations).toBe(1);
    });
  });

  describe('Data Management', () => {
    it('should clear completed operations', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.completeDragOperation(operationId, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      expect(logger.getCompletedOperations()).toHaveLength(1);
      
      logger.clearCompletedOperations();
      
      expect(logger.getCompletedOperations()).toHaveLength(0);
    });

    it('should preserve active operations when clearing completed', () => {
      const activeId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      const completedId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      
      logger.completeDragOperation(completedId, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      expect(logger.getActiveOperations()).toHaveLength(1);
      expect(logger.getCompletedOperations()).toHaveLength(1);
      
      logger.clearCompletedOperations();
      
      expect(logger.getActiveOperations()).toHaveLength(1);
      expect(logger.getCompletedOperations()).toHaveLength(0);
    });

    it('should export operations as JSON', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.completeDragOperation(operationId, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      const exported = logger.exportOperations();
      const parsed = JSON.parse(exported);
      
      expect(parsed.activeOperations).toBeDefined();
      expect(parsed.completedOperations).toBeDefined();
      expect(parsed.correlations).toBeDefined();
      expect(parsed.completedOperations).toHaveLength(1);
    });

    it('should handle export errors gracefully', () => {
      // Create circular reference to cause JSON.stringify to fail
      const operation = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      const activeOps = logger.getActiveOperations();
      (activeOps[0] as any).circular = activeOps[0];
      
      const exported = logger.exportOperations();
      expect(exported).toBe('{}'); // Should return empty object on error
    });
  });

  describe('Integration with UIActionLogger', () => {
    it('should integrate with UIActionLogger for drag events', () => {
      // Test that the logger integrates with UIActionLogger without errors
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.logDragHover(operationId, 'DropZone', mockTargetPosition, mockValidationResult);
      logger.completeDragOperation(operationId, 'DropZone', mockTargetPosition, mockValidationResult, true);
      
      // Verify operation was completed successfully
      expect(logger.getCompletedOperations()).toHaveLength(1);
      expect(logger.getCompletedOperations()[0].result).toBe('success');
    });

    it('should integrate with UIActionLogger for drag cancellation', () => {
      const operationId = logger.startDragOperation('CardRenderer', mockCard, mockSourcePosition);
      logger.cancelDragOperation(operationId, 'CardRenderer', 'Test reason');
      
      // Verify operation was cancelled successfully
      expect(logger.getCompletedOperations()).toHaveLength(1);
      expect(logger.getCompletedOperations()[0].result).toBe('cancelled');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide withDragOperationLogging wrapper', async () => {
      const { withDragOperationLogging } = await import('../utils/DragDropLogger');
      
      const mockFn = vi.fn((operationId: string, arg1: string) => `${operationId}-${arg1}`);
      const wrappedFn = withDragOperationLogging('TestComponent', 'testOperation', mockFn);
      
      const result = wrappedFn(mockCard, mockSourcePosition, 'test-arg');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result).toMatch(/^event-\d+-[a-z0-9]+-test-arg$/);
      
      // Should have created an active operation
      expect(logger.getActiveOperations()).toHaveLength(1);
    });

    it('should handle errors in wrapped function', async () => {
      const { withDragOperationLogging } = await import('../utils/DragDropLogger');
      
      const mockFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const wrappedFn = withDragOperationLogging('TestComponent', 'testOperation', mockFn);
      
      expect(() => wrappedFn(mockCard, mockSourcePosition)).toThrow('Test error');
      
      // Should have cancelled the operation
      expect(logger.getActiveOperations()).toHaveLength(0);
      expect(logger.getCompletedOperations()).toHaveLength(1);
      expect(logger.getCompletedOperations()[0].result).toBe('cancelled');
    });
  });
});