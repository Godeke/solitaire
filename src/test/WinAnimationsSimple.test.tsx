import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WinAnimation } from '../components/WinAnimation';
import { CardCascadeAnimation } from '../components/CardCascadeAnimation';
import { Card } from '../utils/Card';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock audio manager
vi.mock('../utils/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    playSound: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
    dispose: vi.fn()
  }))
}));

// Mock all logger functions
vi.mock('../utils/RendererLogger', () => ({
  logGameAction: vi.fn(),
  logPerformance: vi.fn(),
  logError: vi.fn(),
  logUserInteraction: vi.fn(),
  logComponentMount: vi.fn(),
  logComponentUnmount: vi.fn()
}));

describe('Win Animations - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window dimensions for cascade calculations
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WinAnimation Component', () => {
    const defaultProps = {
      isVisible: true,
      gameType: 'klondike' as const,
      score: 1500,
      moves: 120,
      duration: 300000, // 5 minutes
      onAnimationComplete: vi.fn()
    };

    it('renders win animation when visible', () => {
      render(<WinAnimation {...defaultProps} />);
      
      expect(screen.getByTestId('win-animation')).toBeInTheDocument();
      expect(screen.getByText('Klondike Conquered!')).toBeInTheDocument();
    });

    it('displays correct game-specific celebration message', () => {
      const { rerender } = render(<WinAnimation {...defaultProps} gameType="spider" />);
      expect(screen.getByText('Spider Mastered!')).toBeInTheDocument();

      rerender(<WinAnimation {...defaultProps} gameType="freecell" />);
      expect(screen.getByText('FreeCell Champion!')).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<WinAnimation {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByTestId('win-animation')).not.toBeInTheDocument();
    });

    it('calls onAnimationComplete after timeout', async () => {
      const onComplete = vi.fn();
      render(<WinAnimation {...defaultProps} onAnimationComplete={onComplete} />);
      
      // Wait for animation to complete (4 seconds)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      }, { timeout: 5000 });
    });
  });

  describe('CardCascadeAnimation Component', () => {
    const createTestCards = (count: number): Card[] => {
      const cards: Card[] = [];
      for (let i = 0; i < count; i++) {
        const suit = ['hearts', 'diamonds', 'clubs', 'spades'][i % 4] as 'hearts' | 'diamonds' | 'clubs' | 'spades';
        const rank = (i % 13) + 1;
        const card = new Card(suit, rank);
        card.faceUp = true;
        cards.push(card);
      }
      return cards;
    };

    const defaultProps = {
      isVisible: true,
      cards: createTestCards(10),
      gameType: 'klondike' as const,
      onAnimationComplete: vi.fn()
    };

    it('renders cascade animation when visible', () => {
      render(<CardCascadeAnimation {...defaultProps} />);
      
      expect(screen.getByTestId('card-cascade-animation')).toBeInTheDocument();
    });

    it('handles empty card array gracefully', () => {
      render(<CardCascadeAnimation {...defaultProps} cards={[]} />);
      
      expect(screen.queryByTestId('card-cascade-animation')).not.toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<CardCascadeAnimation {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByTestId('card-cascade-animation')).not.toBeInTheDocument();
    });

    it('calls onAnimationComplete after timeout', async () => {
      const onComplete = vi.fn();
      render(<CardCascadeAnimation {...defaultProps} onAnimationComplete={onComplete} />);
      
      // Wait for animation to complete (2.5 seconds + card delays)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      }, { timeout: 4000 });
    });
  });

  describe('Win Animation Integration', () => {
    it('renders both animations in sequence', async () => {
      const cascadeComplete = vi.fn();
      const winComplete = vi.fn();

      const { rerender } = render(
        <div>
          <CardCascadeAnimation
            isVisible={true}
            cards={[new Card('hearts', 1)]}
            gameType="klondike"
            onAnimationComplete={cascadeComplete}
          />
        </div>
      );

      expect(screen.getByTestId('card-cascade-animation')).toBeInTheDocument();

      // Wait for cascade to complete
      await waitFor(() => {
        expect(cascadeComplete).toHaveBeenCalled();
      }, { timeout: 4000 });

      // Then show win animation
      rerender(
        <div>
          <WinAnimation
            isVisible={true}
            gameType="klondike"
            score={1000}
            moves={100}
            duration={180000}
            onAnimationComplete={winComplete}
          />
        </div>
      );

      expect(screen.getByTestId('win-animation')).toBeInTheDocument();
    });
  });

  describe('Performance and Accessibility', () => {
    it('handles large number of cards efficiently', () => {
      const manyCards = Array.from({ length: 100 }, (_, i) => {
        const suit = ['hearts', 'diamonds', 'clubs', 'spades'][i % 4] as 'hearts' | 'diamonds' | 'clubs' | 'spades';
        const rank = (i % 13) + 1;
        const card = new Card(suit, rank);
        card.faceUp = true;
        return card;
      });
      
      const startTime = performance.now();
      render(
        <CardCascadeAnimation
          isVisible={true}
          cards={manyCards}
          gameType="klondike"
        />
      );
      const endTime = performance.now();

      // Should render within reasonable time (less than 200ms)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('cleans up timers on unmount', () => {
      const { unmount } = render(
        <WinAnimation
          isVisible={true}
          gameType="klondike"
          score={1000}
          moves={100}
          duration={180000}
        />
      );

      // Unmount should not cause any errors
      expect(() => unmount()).not.toThrow();
    });

    it('supports reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <WinAnimation
          isVisible={true}
          gameType="klondike"
          score={1000}
          moves={100}
          duration={180000}
        />
      );

      // Animation should still render but with reduced motion styles
      expect(screen.getByTestId('win-animation')).toBeInTheDocument();
    });
  });

  describe('Game Type Specific Features', () => {
    it('displays different messages for different game types', () => {
      const gameTypes: Array<{ type: 'klondike' | 'spider' | 'freecell', message: string }> = [
        { type: 'klondike', message: 'Klondike Conquered!' },
        { type: 'spider', message: 'Spider Mastered!' },
        { type: 'freecell', message: 'FreeCell Champion!' }
      ];

      gameTypes.forEach(({ type, message }) => {
        const { unmount } = render(
          <WinAnimation
            isVisible={true}
            gameType={type}
            score={1000}
            moves={100}
            duration={180000}
          />
        );

        expect(screen.getByText(message)).toBeInTheDocument();
        unmount();
      });
    });

    it('handles different card sets for different games', () => {
      const klondikeCards = [new Card('hearts', 1), new Card('spades', 13)];
      const spiderCards = Array.from({ length: 20 }, (_, i) => new Card('hearts', (i % 13) + 1));

      const { rerender } = render(
        <CardCascadeAnimation
          isVisible={true}
          cards={klondikeCards}
          gameType="klondike"
        />
      );

      expect(screen.getByTestId('card-cascade-animation')).toBeInTheDocument();

      rerender(
        <CardCascadeAnimation
          isVisible={true}
          cards={spiderCards}
          gameType="spider"
        />
      );

      expect(screen.getByTestId('card-cascade-animation')).toBeInTheDocument();
    });
  });
});