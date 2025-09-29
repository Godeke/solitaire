import React, { useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import { uiActionLogger, withPerformanceLogging } from '../utils/UIActionLogger';
import { UIActionEventType, MoveValidationResult } from '../types/UIActionLogging';
import './DropZone.css';

export interface DropZoneProps {
  position: Position;
  onCardDrop?: (card: Card, from: Position, to: Position) => boolean;
  isValidDropTarget?: (card: Card, from: Position) => boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  showPlaceholder?: boolean;
}

interface DragItem {
  type: string;
  card: Card;
  from: Position;
}

interface DropResult {
  to: Position;
}

const CARD_TYPE = 'CARD';

export const DropZone: React.FC<DropZoneProps> = ({
  position,
  onCardDrop,
  isValidDropTarget,
  children,
  className = '',
  style,
  placeholder = 'Drop cards here',
  showPlaceholder = true
}) => {
  const hasChildren = React.Children.count(children) > 0;


  // Enhanced drop handler with comprehensive logging
  const handleDrop = useCallback(withPerformanceLogging(
    'dropzone-drop',
    (item: DragItem): DropResult => {
      const operationId = `drop-${Date.now()}`;
      uiActionLogger.startPerformanceTimer(operationId);

      try {
        const sourcePosition: Position = item.from ?? { ...item.card.position };
        // Create validation result for logging
        let validationResult: MoveValidationResult = {
          isValid: true,
          reason: 'Drop accepted',
          validationTime: 0
        };

        // Perform validation if validator is provided
        if (isValidDropTarget) {
          const validationStart = performance.now();
          const isValid = isValidDropTarget(item.card, sourcePosition);
          const validationEnd = performance.now();
          
          validationResult = {
            isValid,
            reason: isValid ? 'Drop validation passed' : 'Drop validation failed',
            validationTime: validationEnd - validationStart,
            ruleViolations: isValid ? undefined : ['Drop target validation failed']
          };
        }

        // Log the drop attempt
        const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
        uiActionLogger.logDragDrop(
          'DropZone',
          item.card,
          sourcePosition,
          position,
          validationResult,
          performanceMetrics
        );

        // Execute the drop callback if provided
        if (onCardDrop) {
          const dropResult = onCardDrop(item.card, sourcePosition, position);

          // Log the drop execution result
          uiActionLogger.logMoveExecuted(
            'DropZone',
            sourcePosition,
            position,
            [item.card],
            'user',
            performanceMetrics
          );

          // If drop was rejected, log the failure
          if (!dropResult) {
            uiActionLogger.logStateChange(
              'DropZone',
              'pile_update',
              [`drop-rejected-${position.zone}-${position.index}`],
              performanceMetrics
            );
          }
        }

        return { to: position };
      } catch (error) {
        // Log any errors during drop processing
        uiActionLogger.error('DROPZONE', 'Drop operation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          card: `${item.card.getRankName()} of ${item.card.getSuitName()}`,
          from: sourcePosition,
          to: position
        });
        
        uiActionLogger.endPerformanceTimer(operationId);
        throw error;
      }
    }
  ), [position, onCardDrop, isValidDropTarget]);

  // Enhanced validation handler with detailed logging
  const handleCanDrop = useCallback(withPerformanceLogging(
    'dropzone-validation',
    (item: DragItem): boolean => {
      const operationId = `validation-${Date.now()}`;
      uiActionLogger.startPerformanceTimer(operationId);

      try {
        const sourcePosition: Position = item.from ?? { ...item.card.position };
        let canDropResult = true;
        let validationReason = 'No validation function provided';
        const ruleViolations: string[] = [];

        if (isValidDropTarget) {
          const validationStart = performance.now();
          canDropResult = isValidDropTarget(item.card, sourcePosition);
          const validationEnd = performance.now();
          
          validationReason = canDropResult 
            ? 'Validation passed' 
            : 'Validation failed - invalid drop target';
          
          if (!canDropResult) {
            ruleViolations.push('Drop target validation failed');
          }

          // Create detailed validation result
          const validationResult: MoveValidationResult = {
            isValid: canDropResult,
            reason: validationReason,
            ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
            validationTime: validationEnd - validationStart
          };

          // Log the hover/validation event
          const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
          uiActionLogger.logDragHover(
            'DropZone',
            item.card,
            position,
            validationResult,
            performanceMetrics
          );
        } else {
          // Log hover without validation
          const performanceMetrics = uiActionLogger.endPerformanceTimer(operationId);
          uiActionLogger.logDragHover(
            'DropZone',
            item.card,
            position,
            {
              isValid: true,
              reason: 'No validation required',
              validationTime: 0
            },
            performanceMetrics
          );
        }

        return canDropResult;
      } catch (error) {
        // Log validation errors
        uiActionLogger.error('DROPZONE', 'Validation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          card: `${item.card.getRankName()} of ${item.card.getSuitName()}`,
          position: position
        });
        
        uiActionLogger.endPerformanceTimer(operationId);
        return false;
      }
    }
  ), [position, isValidDropTarget]);

  const [{ isOver, canDrop, draggedCard }, drop] = useDrop({
    accept: CARD_TYPE,
    drop: handleDrop,
    canDrop: handleCanDrop,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      draggedCard: monitor.getItem()?.card
    })
  });

  const dropTargetRef = useCallback((node: HTMLDivElement | null) => {
    if (hasChildren) {
      drop(null);
      return;
    }

    drop(node);
  }, [drop, hasChildren]);

  const targetLabel = useMemo(() => {
    switch (position.zone) {
      case 'foundation':
        return `foundation ${position.index + 1}`;
      case 'tableau':
        return `${hasChildren ? 'column' : 'empty column'} ${position.index + 1}`;
      default:
        return `${position.zone} ${position.index + 1}`;
    }
  }, [position, hasChildren]);


  // Log hover state changes for detailed interaction tracking
  React.useEffect(() => {
    if (draggedCard && isOver) {
      const hoverOperationId = `hover-${Date.now()}`;
      uiActionLogger.startPerformanceTimer(hoverOperationId);
      
      // Log hover enter event
      const performanceMetrics = uiActionLogger.endPerformanceTimer(hoverOperationId);
      uiActionLogger.logUIAction(
        UIActionEventType.DRAG_HOVER,
        'DropZone',
        {
          card: uiActionLogger.createCardSnapshot(draggedCard),
          targetPosition: {
            x: position.index,
            y: position.cardIndex || 0,
            zone: `${position.zone}-${position.index}`
          },
          validationResult: {
            isValid: canDrop,
            reason: canDrop ? 'Hover validation passed' : 'Hover validation failed',
            validationTime: 0
          }
        },
        false,
        false,
        performanceMetrics
      );
    }
  }, [isOver, canDrop, draggedCard, position]);

  const getDropZoneClasses = useCallback(() => {
    const classes = ['drop-zone', className];

    if (canDrop) {
      classes.push('can-drop');
    }

    if (isOver && canDrop) {
      classes.push('drop-active');
    } else if (isOver && !canDrop) {
      classes.push('drop-invalid');
    }

    if (!hasChildren && showPlaceholder) {
      classes.push('empty');
    }

    return classes.join(' ');
  }, [canDrop, isOver, className, hasChildren, showPlaceholder]);

  // Log animation state changes when hover state changes
  React.useEffect(() => {
    if (isOver || canDrop) {
      const animationId = `dropzone-animation-${Date.now()}`;
      uiActionLogger.startPerformanceTimer(animationId);
      
      // Log animation start
      setTimeout(() => {
        const performanceMetrics = uiActionLogger.endPerformanceTimer(animationId);
        if (performanceMetrics) {
          uiActionLogger.logUIAction(
            UIActionEventType.STATE_CHANGE,
            'DropZone',
            {
              changeType: 'pile_update',
              changedElements: [`dropzone-animation-${position.zone}-${position.index}`]
            },
            false,
            false,
            {
              ...performanceMetrics,
              animationDuration: performanceMetrics.operationDuration
            }
          );
        }
      }, 100); // Small delay to capture animation
    }
  }, [isOver, canDrop, position]);

  return (
    <motion.div
      ref={dropTargetRef}
      className={getDropZoneClasses()}
      style={style}
      initial={{ scale: 1, backgroundColor: 'rgba(0, 0, 0, 0)' }}
      animate={{
        scale: isOver && canDrop ? 1.05 : 1,
        backgroundColor: isOver && canDrop ? 'rgba(76, 175, 80, 0.1)' : 
                        isOver && !canDrop ? 'rgba(244, 67, 54, 0.1)' : 
                        'rgba(0, 0, 0, 0)'
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}

    >
      <div
        ref={dropTargetRef}
        className="drop-zone-surface"
        style={{ pointerEvents: hasChildren ? 'none' : 'auto' }}
      />

      {children}
      
      {!hasChildren && showPlaceholder && (
        <div className="drop-zone-placeholder">
          <div className="placeholder-content">
            {placeholder}
          </div>
        </div>
      )}
      
      {isOver && canDrop && (
        <motion.div
          className="drop-indicator"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onAnimationStart={() => {
            uiActionLogger.logUIAction(
              UIActionEventType.STATE_CHANGE,
              'DropZone',
              {
                changeType: 'pile_update',
                changedElements: [`drop-indicator-show-${position.zone}-${position.index}`]
              }
            );
          }}
        >
          <div className="drop-indicator-content">
            Drop onto {targetLabel}
          </div>
        </motion.div>
      )}
      
      {isOver && !canDrop && (
        <motion.div
          className="drop-invalid-indicator"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onAnimationStart={() => {
            uiActionLogger.logUIAction(
              UIActionEventType.STATE_CHANGE,
              'DropZone',
              {
                changeType: 'pile_update',
                changedElements: [`drop-invalid-indicator-show-${position.zone}-${position.index}`]
              }
            );
          }}
        >
          <div className="drop-invalid-content">
            Cannot drop onto {targetLabel}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DropZone;
