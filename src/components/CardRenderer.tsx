import React, { useRef, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
import { motion } from 'framer-motion';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import { UIActionLogger } from '../utils/UIActionLogger';
import { MoveValidationResult, PerformanceMetrics } from '../types/UIActionLogging';
import './CardRenderer.css';

export interface CardRendererProps {
  card: Card;
  onCardMove?: (card: Card, from: Position, to: Position) => boolean | Promise<boolean>;
  onCardClick?: (card: Card) => void;
  isValidDropTarget?: boolean | ((draggedCard: Card, from: Position) => boolean);
  showDropZone?: boolean;
  style?: React.CSSProperties;
  className?: string;
  showCenterRank?: boolean;
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

export const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  onCardMove,
  onCardClick,
  isValidDropTarget = false,
  showDropZone = false,
  style,
  className = '',
  showCenterRank = false
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const uiLogger = UIActionLogger.getInstance();
  
  // Performance tracking for operations
  const startPerformanceTimer = useCallback((operation: string): string => {
    const timerId = `CardRenderer-${card.id}-${operation}-${Date.now()}`;
    uiLogger.startPerformanceTimer(timerId);
    return timerId;
  }, [card.id, uiLogger]);
  
  const endPerformanceTimer = useCallback((timerId: string): PerformanceMetrics | undefined => {
    return uiLogger.endPerformanceTimer(timerId);
  }, [uiLogger]);

  const evaluateDropTarget = useCallback((draggedCard: Card, sourcePosition?: Position): { canDrop: boolean; reason: string } => {
    const resolvedSource: Position = sourcePosition ?? { ...draggedCard.position };

    if (draggedCard.id === card.id) {
      return {
        canDrop: false,
        reason: 'Cannot drop card on itself'
      };
    }

    if (typeof isValidDropTarget === 'function') {
      const canStack = isValidDropTarget(draggedCard, resolvedSource);
      return {
        canDrop: canStack,
        reason: canStack ? 'Validator accepted drop target' : 'Validator rejected drop target',
      };
    }

    if (isValidDropTarget) {
      return {
        canDrop: true,
        reason: 'Marked as valid drop target'
      };
    }

    return {
      canDrop: false,
      reason: 'Not marked as valid drop target'
    };
  }, [card.id, isValidDropTarget]);

  // Drag functionality with comprehensive logging
  const [{ isDragging }, drag] = useDrag({
    type: CARD_TYPE,
    item: (): DragItem => {
      const dragTimerId = startPerformanceTimer('drag-start');
      
      const dragItem = {
        type: CARD_TYPE,
        card,
        from: { ...card.position }
      };
      
      // Log drag start with performance metrics
      const performance = endPerformanceTimer(dragTimerId);
      uiLogger.logDragStart('CardRenderer', card, card.position, performance);
      
      console.log('🖱️ DRAG START:', {
        card: `${card.getRankName()} of ${card.getSuitName()}`,
        from: card.position,
        draggable: card.draggable,
        faceUp: card.faceUp
      });
      
      return dragItem;
    },
    canDrag: () => {
      const canDragTimerId = startPerformanceTimer('can-drag-check');
      const canDrag = card.draggable && card.faceUp;
      const performance = endPerformanceTimer(canDragTimerId);
      
      // Log drag capability check
      uiLogger.debug('CardRenderer', `Can drag check for ${card.getRankName()} of ${card.getSuitName()}`, {
        draggable: card.draggable,
        faceUp: card.faceUp,
        canDrag,
        performance
      });
      
      console.log('🤔 CAN DRAG CHECK:', {
        card: `${card.getRankName()} of ${card.getSuitName()}`,
        draggable: card.draggable,
        faceUp: card.faceUp,
        canDrag
      });
      
      return canDrag;
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    end: async (item, monitor) => {
      const dragEndTimerId = startPerformanceTimer('drag-end');
      const dropResult = monitor.getDropResult<DropResult>();
      
      console.log('🎯 DRAG END:', {
        item: item ? `${item.card.getRankName()} of ${item.card.getSuitName()}` : 'null',
        dropResult,
        hasOnCardMove: !!onCardMove
      });
      
      if (item && dropResult && onCardMove) {
        console.log('📞 CALLING onCardMove...');
        
        const moveTimerId = startPerformanceTimer('card-move');
        const success = await onCardMove(item.card, item.from, dropResult.to);
        const movePerformance = endPerformanceTimer(moveTimerId);
        
        // Create validation result for logging
        const validationResult: MoveValidationResult = {
          isValid: success,
          reason: success ? 'Move completed successfully' : 'Move validation failed',
          validationTime: movePerformance?.operationDuration || 0
        };
        
        // Log the drop operation
        const dragEndPerformance = endPerformanceTimer(dragEndTimerId);
        uiLogger.logDragDrop('CardRenderer', item.card, item.from, dropResult.to, validationResult, dragEndPerformance);
        
        console.log('📞 onCardMove RESULT:', success);
        if (!success) {
          console.log('❌ Move failed in CardRenderer');
        }
      } else if (item) {
        // Log drag cancel if no valid drop occurred
        const dragEndPerformance = endPerformanceTimer(dragEndTimerId);
        const cancelReason = !dropResult ? 'No drop target' : 'No move handler available';
        uiLogger.logDragCancel('CardRenderer', item.card, cancelReason, dragEndPerformance);
      }
    }
  });

  // Drop functionality with comprehensive logging
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    drop: (_item: DragItem | undefined, monitor: DropTargetMonitor<DragItem, DropResult>): DropResult | undefined => {
      if (!monitor.isOver({ shallow: true })) {
        return undefined;
      }

      const dropTimerId = startPerformanceTimer('drop-target');
      const dropResult = { to: card.position };
      const performance = endPerformanceTimer(dropTimerId);

      // Log drop target activation
      uiLogger.debug('CardRenderer', `Drop target activated for ${card.getRankName()} of ${card.getSuitName()}`, {
        position: card.position,
        performance
      });
      
      console.log('📍 DROP TARGET:', {
        dropTarget: `${card.getRankName()} of ${card.getSuitName()}`,
        position: card.position
      });
      
      return dropResult;
    },
    canDrop: (item: DragItem) => {
      const canDropTimerId = startPerformanceTimer('can-drop-check');

      const { canDrop: canDropHere, reason: validationReason } = evaluateDropTarget(item.card, item.from);
      const performance = endPerformanceTimer(canDropTimerId);

      const validationResult: MoveValidationResult = {
        isValid: canDropHere,
        reason: validationReason,
        validationTime: performance?.operationDuration || 0
      };

      uiLogger.logDragHover('CardRenderer', item.card, card.position, validationResult, performance);

      console.log('🎯 CAN DROP CHECK:', {
        draggedCard: `${item.card.getRankName()} of ${item.card.getSuitName()}`,
        dropTarget: `${card.getRankName()} of ${card.getSuitName()}`,
        sameCard: item.card.id === card.id,
        validatorType: typeof isValidDropTarget,
        source: item.from ?? { ...item.card.position },
        validationReason,
        canDropHere
      });

      return canDropHere;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  // Combine drag and drop refs
  drag(drop(ref));

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const clickTimerId = startPerformanceTimer('card-click');
    
    // Get click coordinates relative to the card element
    const rect = event.currentTarget.getBoundingClientRect();
    const clickCoordinates = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const performance = endPerformanceTimer(clickTimerId);
    
    // Log card click event with context (with error handling)
    try {
      uiLogger.logCardClick('CardRenderer', card, clickCoordinates, performance);
    } catch (error) {
      console.warn('Failed to log card click event:', error);
    }
    
    if (onCardClick) {
      const callbackTimerId = startPerformanceTimer('click-callback');
      onCardClick(card);
      const callbackPerformance = endPerformanceTimer(callbackTimerId);
      
      // Log callback execution performance
      uiLogger.debug('CardRenderer', `Click callback executed for ${card.getRankName()} of ${card.getSuitName()}`, {
        performance: callbackPerformance
      });
    }
  }, [card, onCardClick, startPerformanceTimer, endPerformanceTimer, uiLogger]);

  const getCardClasses = () => {
    const classes = ['card-renderer', className];
    
    if (card.faceUp) {
      classes.push('face-up');
    } else {
      classes.push('face-down');
    }
    
    if (card.draggable && card.faceUp) {
      classes.push('draggable');
    }
    
    if (isDragging) {
      classes.push('dragging');
    }
    
    if (isOver && canDrop) {
      classes.push('drop-target-active');
    } else if (canDrop) {
      classes.push('drop-target-valid');
    }
    
    if (showDropZone) {
      classes.push('drop-zone');
    }
    
    return classes.join(' ');
  };

  const getSuitSymbol = () => {
    switch (card.suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  const getSuitColor = () => {
    return card.isRed() ? 'red' : 'black';
  };

  const getRankDisplay = () => {
    switch (card.rank) {
      case 1: return 'A';
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      default: return card.rank.toString();
    }
  };

  // Animation event handlers with performance logging
  const handleAnimationStart = useCallback(() => {
    const animationTimerId = startPerformanceTimer('card-animation');
    
    // Store timer ID for animation end
    if (ref.current) {
      ref.current.dataset.animationTimerId = animationTimerId;
    }
  }, [startPerformanceTimer]);
  
  const handleAnimationComplete = useCallback(() => {
    if (ref.current?.dataset.animationTimerId) {
      const performance = endPerformanceTimer(ref.current.dataset.animationTimerId);
      
      // Log animation performance
      uiLogger.debug('CardRenderer', `Animation completed for ${card.getRankName()} of ${card.getSuitName()}`, {
        performance
      });
      
      delete ref.current.dataset.animationTimerId;
    }
  }, [card, endPerformanceTimer, uiLogger]);

  return (
    <motion.div
      ref={ref}
      className={getCardClasses()}
      style={style}
      onClick={handleClick}
      data-testid={`card-${card.id}-${card.position.zone}`}
      initial={{ scale: 1, opacity: 1 }}
      whileHover={card.draggable && card.faceUp ? { scale: 1.05 } : {}}
      whileTap={card.draggable && card.faceUp ? { scale: 0.95 } : {}}
      animate={{
        opacity: isDragging ? 0.5 : 1,
        scale: isDragging ? 1.1 : 1
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      onAnimationStart={handleAnimationStart}
      onAnimationComplete={handleAnimationComplete}
    >
      {card.faceUp ? (
        <div className={`card-face card-${getSuitColor()}`}>
          <div className="card-corner top-left">
            <div className="rank">{getRankDisplay()}</div>
            <div className="suit">{getSuitSymbol()}</div>
          </div>
          <div className="card-center">
            <div className="suit-large">{getSuitSymbol()}</div>
            {showCenterRank && (
              <div className="rank-large">{getRankDisplay()}</div>
            )}
          </div>
          <div className="card-corner bottom-right">
            <div className="rank">{getRankDisplay()}</div>
            <div className="suit">{getSuitSymbol()}</div>
          </div>
        </div>
      ) : (
        <div className="card-back">
          <div className="card-back-pattern"></div>
        </div>
      )}
      
      {showDropZone && (
        <div className="drop-zone-indicator">
          <div className="drop-zone-content">Drop Here</div>
        </div>
      )}
    </motion.div>
  );
};

export default CardRenderer;
