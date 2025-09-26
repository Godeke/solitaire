import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import './DropZone.css';

export interface DropZoneProps {
  position: Position;
  onCardDrop?: (card: Card, from: Position, to: Position) => boolean;
  isValidDropTarget?: (card: Card) => boolean;
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
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop, draggedCard }, drop] = useDrop({
    accept: CARD_TYPE,
    drop: (item: DragItem): DropResult => {
      console.log('📦 DROPZONE DROP:', {
        draggedCard: `${item.card.getRankName()} of ${item.card.getSuitName()}`,
        from: item.from,
        to: position,
        hasOnCardDrop: !!onCardDrop
      });
      
      if (onCardDrop) {
        console.log('📞 CALLING DropZone onCardDrop...');
        onCardDrop(item.card, item.from, position);
      }
      return { to: position };
    },
    canDrop: (item: DragItem) => {
      let canDropResult = true;
      if (isValidDropTarget) {
        canDropResult = isValidDropTarget(item.card);
      }
      
      console.log('🎯 DROPZONE CAN DROP CHECK:', {
        draggedCard: `${item.card.getRankName()} of ${item.card.getSuitName()}`,
        dropZone: `${position.zone}[${position.index}]`,
        hasValidator: !!isValidDropTarget,
        canDropResult
      });
      
      return canDropResult;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      draggedCard: monitor.getItem()?.card
    })
  });

  drop(ref);

  const getDropZoneClasses = () => {
    const classes = ['drop-zone', className];
    
    if (canDrop) {
      classes.push('can-drop');
    }
    
    if (isOver && canDrop) {
      classes.push('drop-active');
    } else if (isOver && !canDrop) {
      classes.push('drop-invalid');
    }
    
    if (!children && showPlaceholder) {
      classes.push('empty');
    }
    
    return classes.join(' ');
  };

  return (
    <motion.div
      ref={ref}
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
      {children}
      
      {!children && showPlaceholder && (
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
        >
          <div className="drop-indicator-content">
            Drop {draggedCard?.getRankName()} of {draggedCard?.getSuitName()}
          </div>
        </motion.div>
      )}
      
      {isOver && !canDrop && (
        <motion.div
          className="drop-invalid-indicator"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <div className="drop-invalid-content">
            Invalid move
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DropZone;