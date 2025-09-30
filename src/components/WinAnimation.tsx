import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAudioManager } from '../utils/AudioManager';
import { logGameAction } from '../utils/RendererLogger';
import './WinAnimation.css';

export interface WinAnimationProps {
  /** Whether the win animation should be shown */
  isVisible: boolean;
  /** Game type for customized animations */
  gameType: 'klondike' | 'spider' | 'freecell';
  /** Final score achieved */
  score: number;
  /** Number of moves taken */
  moves: number;
  /** Game duration in milliseconds */
  duration: number;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Custom CSS class */
  className?: string;
}

export const WinAnimation: React.FC<WinAnimationProps> = ({
  isVisible,
  gameType,
  score,
  moves,
  duration,
  onAnimationComplete,
  className = ''
}) => {
  const [showParticles, setShowParticles] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Format duration for display
  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }, []);

  // Get game-specific celebration message
  const getCelebrationMessage = useCallback((): string => {
    switch (gameType) {
      case 'klondike':
        return 'Klondike Conquered!';
      case 'spider':
        return 'Spider Mastered!';
      case 'freecell':
        return 'FreeCell Champion!';
      default:
        return 'Victory!';
    }
  }, [gameType]);

  // Handle animation sequence
  useEffect(() => {
    if (isVisible) {
      logGameAction('Win animation started', gameType, {
        score,
        moves,
        duration,
        gameType
      });

      // Play celebration sound
      const audioManager = getAudioManager();
      audioManager.playSound('game-win');

      // Start particle animation immediately
      setShowParticles(true);

      // Show stats after a delay
      const statsTimer = setTimeout(() => {
        setShowStats(true);
      }, 1000);

      // Complete animation after full sequence
      const completeTimer = setTimeout(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        logGameAction('Win animation completed', gameType);
      }, 4000);

      return () => {
        clearTimeout(statsTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setShowParticles(false);
      setShowStats(false);
    }
  }, [isVisible, gameType, score, moves, duration, onAnimationComplete]);

  // Generate particle elements
  const generateParticles = () => {
    const particles = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const delay = Math.random() * 2;
      const duration = 2 + Math.random() * 2;
      const startX = Math.random() * 100;
      const endX = startX + (Math.random() - 0.5) * 40;
      const rotation = Math.random() * 360;

      particles.push(
        <motion.div
          key={`particle-${i}`}
          className="win-particle"
          initial={{
            x: `${startX}vw`,
            y: '100vh',
            opacity: 0,
            rotate: 0,
            scale: 0
          }}
          animate={{
            x: `${endX}vw`,
            y: '-10vh',
            opacity: [0, 1, 1, 0],
            rotate: rotation,
            scale: [0, 1, 1, 0]
          }}
          transition={{
            duration,
            delay,
            ease: 'easeOut'
          }}
        />
      );
    }

    return particles;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`win-animation-overlay ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          data-testid="win-animation"
        >
          {/* Background overlay */}
          <div className="win-background" />

          {/* Particle effects */}
          {showParticles && (
            <div className="win-particles-container">
              {generateParticles()}
            </div>
          )}

          {/* Main celebration content */}
          <motion.div
            className="win-content"
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: 0.2
            }}
          >
            {/* Trophy/Crown icon */}
            <motion.div
              className="win-icon"
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ 
                type: 'spring',
                stiffness: 150,
                damping: 15,
                delay: 0.5
              }}
            >
              🏆
            </motion.div>

            {/* Celebration message */}
            <motion.h1
              className="win-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              {getCelebrationMessage()}
            </motion.h1>

            {/* Game statistics */}
            <AnimatePresence>
              {showStats && (
                <motion.div
                  className="win-stats"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="win-stat">
                    <span className="win-stat-label">Score:</span>
                    <motion.span
                      className="win-stat-value"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: 'spring',
                        stiffness: 300,
                        delay: 0.2
                      }}
                    >
                      {score.toLocaleString()}
                    </motion.span>
                  </div>
                  
                  <div className="win-stat">
                    <span className="win-stat-label">Moves:</span>
                    <motion.span
                      className="win-stat-value"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: 'spring',
                        stiffness: 300,
                        delay: 0.4
                      }}
                    >
                      {moves}
                    </motion.span>
                  </div>
                  
                  <div className="win-stat">
                    <span className="win-stat-label">Time:</span>
                    <motion.span
                      className="win-stat-value"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: 'spring',
                        stiffness: 300,
                        delay: 0.6
                      }}
                    >
                      {formatDuration(duration)}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sparkle effects around the content */}
            <div className="win-sparkles">
              {Array.from({ length: 8 }, (_, i) => (
                <motion.div
                  key={`sparkle-${i}`}
                  className="win-sparkle"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    rotate: 360
                  }}
                  transition={{
                    duration: 2,
                    delay: 1 + (i * 0.2),
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                  style={{
                    position: 'absolute',
                    left: `${20 + (i * 10)}%`,
                    top: `${20 + ((i % 4) * 15)}%`
                  }}
                >
                  ✨
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Fireworks effect */}
          <div className="win-fireworks">
            {Array.from({ length: 3 }, (_, i) => (
              <motion.div
                key={`firework-${i}`}
                className="win-firework"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ 
                  scale: [0, 1, 1.5],
                  opacity: [1, 1, 0]
                }}
                transition={{
                  duration: 1.5,
                  delay: 1.5 + (i * 0.5),
                  ease: 'easeOut'
                }}
                style={{
                  left: `${30 + (i * 20)}%`,
                  top: `${30 + (i * 10)}%`
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WinAnimation;