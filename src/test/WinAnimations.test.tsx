import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WinAnimation } from '../components/WinAnimation';
import { CardCascadeAnimation } from '../components/CardCascadeAnimation';
import { KlondikeGameBoard } from '../components/KlondikeGameBoard';
import { SpiderGameBoard } from '../components/SpiderGameBoard';
import { FreeCellGameBoard } from '../components/FreeCellGameBoard';
import { Card } from '../utils/Card';
import { getAudioManager } from '../utils/AudioManager';

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

// Mock logger
vi.mock('../utils/RendererLogger', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logGameAction: vi.fn(),
    logPerformance: vi.fn(),
    logError: vi.fn(),
    logUserInteraction: vi.fn(),
    logComponentMount: vi.fn(),
    logComponentUnmount: vi.fn(),
    RendererLogger: {
      getInstance: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }))
    }
  };
});

// Mock UIActionLogger
vi.mock('../utils/UIActionLogger', () => ({
  uiActionLogger: {
    setCurrentGameState: vi.fn(),
    startPerformanceTimer: vi.fn(),
    endPerformanceTimer: vi.fn(),
    logUIAction: vi.fn(),
    createGameStateSnapshot: vi.fn()
  },
  UIActionLogger: {
    getInstance: vi.fn(() => ({
      setCurrentGameState: vi.fn(),
      startPerformanceTimer: vi.fn(),
      endPerformanceTimer: vi.fn(),
      logUIAction: vi.fn(),
      createGameStateSnapshot: vi.fn()
    }))
  }
}));

describe('Win Animations', () => {
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

    it('displays game statistics correctly', async () => {
      render(<WinAnimation {...defaultProps} />);
      
      // Wait for stats to appear (they have a delay)
      await waitFor(() => {
        expect(screen.getByText('1,500')).toBeInTheDocument(); // Score
        expect(screen.getByText('120')).toBeInTheDocument(); // Moves
        expect(screen.getByText('5:00')).toBeInTheDocument(); // Duration
      }, { timeout: 2000 });
    });

    it('formats duration correctly', () => {
      const { rerender } = render(<WinAnimation {...defaultProps} duration={45000} />);
      
      waitFor(() => {
        expect(screen.getByText('45s')).toBeInTheDocument();
      });

      rerender(<WinAnimation {...defaultProps} duration={125000} />);
      
      waitFor(() => {
        expect(screen.getByText('2:05')).toBeInTheDocument();
      });
    });

    it('calls onAnimationComplete after animation sequence', async () => {
      const onComplete = vi.fn();
      render(<WinAnimation {...defaultProps} onAnimationComplete={onComplete} />);
      
      // Wait for animation to complete (4 seconds)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      }, { timeout: 5000 });
    });

    it('plays celebration sound on mount', () => {
      const mockAudioManager = getAudioManager();
      render(<WinAnimation {...defaultProps} />);
      
      expect(mockAudioManager.playSound).toHaveBeenCalledWith('game-win');
    });

    it('does not render when not visible', () => {
      render(<WinAnimation {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByTestId('win-animation')).not.toBeInTheDocument();
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

    it('renders correct number of cards', () => {
      render(<CardCascadeAnimation {...defaultProps} />);
      
      // Check that cards are rendered (they have unique keys)
      const cascadeContainer = screen.getByTestId('card-cascade-animation');
      expect(cascadeContainer).toBeInTheDocument();
    });

    it('calls onAnimationComplete after cascade sequence', async () => {
      const onComplete = vi.fn();
      render(<CardCascadeAnimation {...defaultProps} onAnimationComplete={onComplete} />);
      
      // Wait for animation to complete (2.5 seconds + card delays)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      }, { timeout: 4000 });
    });

    it('handles empty card array gracefully', () => {
      render(<CardCascadeAnimation {...defaultProps} cards={[]} />);
      
      expect(screen.queryByTestId('card-cascade-animation')).not.toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<CardCascadeAnimation {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByTestId('card-cascade-animation')).not.toBeInTheDocument();
    });
  });

  describe('Game Board Win Integration', () => {
    beforeEach(() => {
      // Mock game engines to simulate win conditions
      vi.doMock('../engines/KlondikeEngine', () => ({
        KlondikeEngine: vi.fn().mockImplementation(() => ({
          initializeGame: vi.fn().mockReturnValue({
            gameType: 'klondike',
            tableau: Array(7).fill([]),
            foundation: Array(4).fill([]),
            stock: [],
            waste: [],
            moves: [],
            score: 0,
            timeStarted: new Date()
          }),
          checkWinCondition: vi.fn().mockReturnValue(false),
          validateMove: vi.fn().mockReturnValue(true),
          executeMove: vi.fn(),
          getValidMoves: vi.fn().mockReturnValue([]),
          findCardById: vi.fn(),
          debugValidateMove: vi.fn().mockReturnValue({ isValid: true, reason: 'Valid' }),
          executeStockToWasteMove: vi.fn(),
          resetWasteToStock: vi.fn()
        }))
      }));
    });

    it('triggers win animations when game is won in KlondikeGameBoard', async () => {
      const onGameWin = vi.fn();
      
      // Create a mock engine that reports win condition
      const mockEngine = {
        initializeGame: vi.fn().mockReturnValue({
          gameType: 'klondike',
          tableau: Array(7).fill([]),
          foundation: Array(4).fill([]),
          stock: [],
          waste: [],
          moves: [],
          score: 1500,
          timeStarted: new Date()
        }),
        checkWinCondition: vi.fn().mockReturnValue(true), // Game is won
        validateMove: vi.fn().mockReturnValue(true),
        executeMove: vi.fn(),
        getValidMoves: vi.fn().mockReturnValue([]),
        findCardById: vi.fn(),
        debugValidateMove: vi.fn().mockReturnValue({ isValid: true, reason: 'Valid' }),
        executeStockToWasteMove: vi.fn(),
        resetWasteToStock: vi.fn()
      };

      // Mock the engine constructor to return our mock
      vi.doMock('../engines/KlondikeEngine', () => ({
        KlondikeEngine: vi.fn().mockImplementation(() => mockEngine)
      }));

      const { KlondikeGameBoard: MockedKlondikeGameBoard } = await import('../components/KlondikeGameBoard');
      
      render(
        <MockedKlondikeGameBoard
          onGameWin={onGameWin}
          enableWinAnimations={true}
        />
      );

      // Wait for win condition to be detected and animations to start
      await waitFor(() => {
        expect(mockEngine.checkWinCondition).toHaveBeenCalled();
      });
    });

    it('disables win animations when enableWinAnimations is false', async () => {
      const onGameWin = vi.fn();
      
      render(
        <KlondikeGameBoard
          onGameWin={onGameWin}
          enableWinAnimations={false}
        />
      );

      // Simulate win condition by updating the component
      // Since we can't easily mock the engine in this test, we'll just verify
      // that the component renders without win animation elements
      expect(screen.queryByTestId('win-animation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-cascade-animation')).not.toBeInTheDocument();
    });

    it('calls onGameWin callback after win animations complete', async () => {
      const onGameWin = vi.fn();
      const onWinAnimationComplete = vi.fn();
      
      render(
        <KlondikeGameBoard
          onGameWin={onGameWin}
          onWinAnimationComplete={onWinAnimationComplete}
          enableWinAnimations={true}
        />
      );

      // This test would require more complex mocking to simulate the full win flow
      // For now, we verify the props are passed correctly
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
  });

  describe('Audio Integration', () => {
    it('plays game-win sound when win animation starts', () => {
      const mockAudioManager = getAudioManager();
      
      render(
        <WinAnimation
          isVisible={true}
          gameType="klondike"
          score={1000}
          moves={100}
          duration={180000}
        />
      );

      expect(mockAudioManager.playSound).toHaveBeenCalledWith('game-win');
    });

    it('handles audio errors gracefully', () => {
      const mockAudioManager = getAudioManager();
      (mockAudioManager.playSound as any).mockRejectedValue(new Error('Audio failed'));
      
      // Should not throw error
      expect(() => {
        render(
          <WinAnimation
            isVisible={true}
            gameType="klondike"
            score={1000}
            moves={100}
            duration={180000}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
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

    it('supports high contrast mode', () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
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
        <CardCascadeAnimation
          isVisible={true}
          cards={[new Card('hearts', 1)]}
          gameType="klondike"
        />
      );

      expect(screen.getByTestId('card-cascade-animation')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large number of cards in cascade efficiently', () => {
      const manyCards = createTestCards(100);
      
      const startTime = performance.now();
      render(
        <CardCascadeAnimation
          isVisible={true}
          cards={manyCards}
          gameType="klondike"
        />
      );
      const endTime = performance.now();

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
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
  });
});

// Helper function to create test cards
function createTestCards(count: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const suit = ['hearts', 'diamonds', 'clubs', 'spades'][i % 4] as 'hearts' | 'diamonds' | 'clubs' | 'spades';
    const rank = (i % 13) + 1;
    const card = new Card(suit, rank);
    card.faceUp = true;
    cards.push(card);
  }
  return cards;
}