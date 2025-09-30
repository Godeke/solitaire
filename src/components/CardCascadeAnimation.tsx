import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../utils/Card';
import { logGameAction } from '../utils/RendererLogger';
import './CardCascadeAnimation.css';

export interface CardCascadeAnimationProps {
  /** Whether the cascade animation should be shown */
  isVisible: boolean;
  /** Cards to animate in the cascade */
  cards: Card[];
  /** Game type for customized animations */
  gameType: 'klondike' | 'spider' | 'freecell';
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Custom CSS class */
  className?: string;
}

interface CascadeCard {
  card: Card;
  delay: number;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  rotation: number;
}

// Helper function to get suit symbol
const getSuitSymbol = (suit: string): string => {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
    default: return suit;
  }
};

export const CardCascadeAnimation: React.FC<CardCascadeAnimationProps> = ({
  isVisible,
  cards,
  gameType,
  onAnimationComplete,
  className = ''
}) => {
  const [cascadeCards, setCascadeCards] = useState<CascadeCard[]>([]);
  const [animationPhase, setAnimationPhase] = useState<'preparing' | 'cascading' | 'collecting' | 'complete'>('preparing');

  // Calculate cascade positions and timing
  const prepareCascade = useCallback(() => {
    if (!cards.length) return [];

    const cascadeData: CascadeCard[] = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    cards.forEach((card, index) => {
      // Stagger the delays for a wave effect
      const delay = index * 0.1;
      
      // Start positions - spread cards across the screen
      const startAngle = (index / cards.length) * 2 * Math.PI;
      const startRadius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
      const startX = centerX + Math.cos(startAngle) * startRadius;
      const startY = centerY + Math.sin(startAngle) * startRadius;

      // End positions - collect in center with slight spread
      const endSpread = 50;
      const endX = centerX + (Math.random() - 0.5) * endSpread;
      const endY = centerY + (Math.random() - 0.5) * endSpread;

      // Random rotation for visual interest
      const rotation = (Math.random() - 0.5) * 720; // Up to 2 full rotations

      cascadeData.push({
        card,
        delay,
        startPosition: { x: startX, y: startY },
        endPosition: { x: endX, y: endY },
        rotation
      });
    });

    return cascadeData;
  }, [cards]);

  // Handle animation sequence
  useEffect(() => {
    if (isVisible && cards.length > 0) {
      logGameAction('Card cascade animation started', gameType, {
        cardCount: cards.length,
        gameType
      });

      setAnimationPhase('preparing');
      const cascadeData = prepareCascade();
      setCascadeCards(cascadeData);

      // Start cascading phase
      const cascadeTimer = setTimeout(() => {
        setAnimationPhase('cascading');
      }, 100);

      // Start collecting phase
      const collectTimer = setTimeout(() => {
        setAnimationPhase('collecting');
      }, 1000 + (cards.length * 100));

      // Complete animation
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        logGameAction('Card cascade animation completed', gameType);
      }, 2500 + (cards.length * 100));

      return () => {
        clearTimeout(cascadeTimer);
        clearTimeout(collectTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setAnimationPhase('preparing');
      setCascadeCards([]);
    }
  }, [isVisible, cards, gameType, prepareCascade, onAnimationComplete]);

  // Get card image path
  const getCardImagePath = useCallback((card: Card): string => {
    if (!card.faceUp) {
      return '/assets/cards/back.png';
    }
    const suitName = card.getSuitName().toLowerCase();
    const rankName = card.getRankName().toLowerCase().replace(' ', '_');
    return `/assets/cards/${rankName}_of_${suitName}.png`;
  }, []);

  // Get animation variants based on phase
  const getCardVariants = (cascadeCard: CascadeCard) => {
    const { startPosition, endPosition, rotation } = cascadeCard;

    return {
      preparing: {
        x: startPosition.x,
        y: startPosition.y,
        rotate: 0,
        scale: 0,
        opacity: 0
      },
      cascading: {
        x: startPosition.x,
        y: startPosition.y,
        rotate: rotation * 0.3,
        scale: 1,
        opacity: 1
      },
      collecting: {
        x: endPosition.x,
        y: endPosition.y,
        rotate: rotation,
        scale: 0.8,
        opacity: 1
      },
      complete: {
        x: endPosition.x,
        y: endPosition.y + 100,
        rotate: rotation,
        scale: 0,
        opacity: 0
      }
    };
  };

  // Get transition settings based on phase
  const getTransition = (cascadeCard: CascadeCard, phase: string) => {
    const baseTransition = {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
      delay: cascadeCard.delay
    };

    switch (phase) {
      case 'cascading':
        return {
          ...baseTransition,
          stiffness: 200,
          damping: 20
        };
      case 'collecting':
        return {
          ...baseTransition,
          stiffness: 150,
          damping: 25,
          delay: cascadeCard.delay + 0.5
        };
      case 'complete':
        return {
          duration: 0.8,
          ease: 'easeIn' as const,
          delay: cascadeCard.delay + 1
        };
      default:
        return baseTransition;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && cascadeCards.length > 0 && (
        <motion.div
          className={`card-cascade-overlay ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="card-cascade-animation"
        >
          {/* Background effect */}
          <div className="cascade-background" />

          {/* Animated cards */}
          <div className="cascade-cards-container">
            {cascadeCards.map((cascadeCard, index) => (
              <motion.div
                key={`cascade-card-${cascadeCard.card.id}-${index}`}
                className="cascade-card"
                variants={getCardVariants(cascadeCard)}
                animate={animationPhase}
                transition={getTransition(cascadeCard, animationPhase)}
                style={{
                  position: 'absolute',
                  width: '60px',
                  height: '84px',
                  transformOrigin: 'center center'
                }}
              >
                {/* Card front/back */}
                <div className="cascade-card-inner">
                  <div className="cascade-card-face">
                    {cascadeCard.card.faceUp ? (
                      <div className="cascade-card-content">
                        <div className="cascade-card-rank">
                          {cascadeCard.card.getRankName()}
                        </div>
                        <div className="cascade-card-suit">
                          {getSuitSymbol(cascadeCard.card.suit)}
                        </div>
                      </div>
                    ) : (
                      <div className="cascade-card-back" />
                    )}
                  </div>
                </div>

                {/* Card glow effect */}
                <motion.div
                  className="cascade-card-glow"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: animationPhase === 'cascading' ? [0, 1, 0] : 0,
                    scale: animationPhase === 'cascading' ? [0.8, 1.2, 0.8] : 0.8
                  }}
                  transition={{
                    duration: 1,
                    delay: cascadeCard.delay,
                    repeat: animationPhase === 'cascading' ? Infinity : 0,
                    repeatDelay: 2
                  }}
                />
              </motion.div>
            ))}
          </div>

          {/* Central collection point effect */}
          <motion.div
            className="cascade-collection-point"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: animationPhase === 'collecting' ? [0, 1.5, 1] : 0,
              opacity: animationPhase === 'collecting' ? [0, 0.8, 0.3] : 0
            }}
            transition={{
              duration: 1.5,
              ease: 'easeOut'
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />

          {/* Sparkle effects during collection */}
          {animationPhase === 'collecting' && (
            <div className="cascade-sparkles">
              {Array.from({ length: 12 }, (_, i) => (
                <motion.div
                  key={`cascade-sparkle-${i}`}
                  className="cascade-sparkle"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    rotate: 360
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.1,
                    ease: 'easeOut'
                  }}
                  style={{
                    position: 'absolute',
                    left: `${45 + (i % 4) * 2.5}%`,
                    top: `${45 + Math.floor(i / 4) * 2.5}%`
                  }}
                >
                  ✨
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardCascadeAnimation;