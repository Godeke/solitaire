import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import './CardRenderer.css';

export interface CardRendererProps {
  card: Card;
  onCardMove?: (card: Card, from: Position, to: Position) => boolean;
  onCardClick?: (card: Card) => void;
  isValidDropTarget?: boolean;
  showDropZone?: boolean;
  style?: React.CSSProperties;
  className?: string;
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
  className = ''
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: CARD_TYPE,
    item: (): DragItem => ({
      type: CARD_TYPE,
      card,
      from: card.position
    }),
    canDrag: () => card.draggable && card.faceUp,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult<DropResult>();
      if (item && dropResult && onCardMove) {
        const success = onCardMove(item.card, item.from, dropResult.to);
        if (!success) {
          // Handle failed move - could add animation or feedback here
          console.log('Move failed');
        }
      }
    }
  });

  // Drop functionality
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: CARD_TYPE,
    drop: (): DropResult => ({
      to: card.position
    }),
    canDrop: (item: DragItem) => {
      // Basic validation - more complex validation should be in the game engine
      return item.card.id !== card.id && isValidDropTarget;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  // Combine drag and drop refs
  drag(drop(ref));

  const handleClick = () => {
    if (onCardClick) {
      onCardClick(card);
    }
  };

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

  return (
    <motion.div
      ref={ref}
      className={getCardClasses()}
      style={style}
      onClick={handleClick}
      data-testid={`card-${card.id}-${card.position.zone}`}
      initial={{ scale: 1 }}
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
    >
      {card.faceUp ? (
        <div className={`card-face card-${getSuitColor()}`}>
          <div className="card-corner top-left">
            <div className="rank">{getRankDisplay()}</div>
            <div className="suit">{getSuitSymbol()}</div>
          </div>
          <div className="card-center">
            <div className="suit-large">{getSuitSymbol()}</div>
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