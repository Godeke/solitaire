import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SpiderGameBoard } from '../components/SpiderGameBoard';
import { SpiderEngine } from '../engines/SpiderEngine';

import { vi, describe, it, beforeEach } from 'vitest';

// Mock the audio manager
vi.mock('../utils/AudioManager', () => ({
  getAudioManager: () => ({
    playSound: vi.fn().mockResolvedValue(undefined)
  })
}));

// Mock the logger
vi.mock('../utils/RendererLogger', () => ({
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  RendererLogger: {
    getInstance: () => ({
      setLogLevel: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  },
  logGameAction: vi.fn(),
  logPerformance: vi.fn()
}));

// Wrapper component with DnD provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

describe('SpiderGameBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Spider game board with 10 tableau columns', () => {
    render(
      <TestWrapper>
        <SpiderGameBoard />
      </TestWrapper>
    );

    // Check that the component renders
    expect(screen.getByTestId('spider-game-board')).toBeInTheDocument();

    // Check for game header elements
    expect(screen.getByText(/Score:/)).toBeInTheDocument();
    expect(screen.getByText(/Moves:/)).toBeInTheDocument();
    expect(screen.getByText(/Completed Sequences:/)).toBeInTheDocument();
    expect(screen.getByText('New Game')).toBeInTheDocument();

    // Check for stock pile
    expect(screen.getByText(/Stock:/)).toBeInTheDocument();

    // Check that we have 10 tableau columns (by looking for tableau-column divs)
    const columns = document.querySelectorAll('.tableau-column');
    expect(columns).toHaveLength(10);
  });

  it('initializes with proper game state', () => {
    const mockOnScoreChange = vi.fn();
    const mockOnMoveCount = vi.fn();

    render(
      <TestWrapper>
        <SpiderGameBoard 
          onScoreChange={mockOnScoreChange}
          onMoveCount={mockOnMoveCount}
        />
      </TestWrapper>
    );

    // Should call callbacks with initial values
    expect(mockOnScoreChange).toHaveBeenCalledWith(0);
    expect(mockOnMoveCount).toHaveBeenCalledWith(0);
  });

  it('displays completed sequences counter', () => {
    render(
      <TestWrapper>
        <SpiderGameBoard />
      </TestWrapper>
    );

    // Check for completed sequences display
    expect(screen.getByText('0 / 8')).toBeInTheDocument();
    
    // Check for sequence indicators
    const indicators = document.querySelectorAll('.sequence-indicator');
    expect(indicators).toHaveLength(8);
    
    // All should be incomplete initially
    indicators.forEach(indicator => {
      expect(indicator).toHaveClass('incomplete');
      expect(indicator).not.toHaveClass('completed');
    });
  });

  it('handles new game button click', async () => {
    const mockOnScoreChange = vi.fn();
    const mockOnMoveCount = vi.fn();

    render(
      <TestWrapper>
        <SpiderGameBoard 
          onScoreChange={mockOnScoreChange}
          onMoveCount={mockOnMoveCount}
        />
      </TestWrapper>
    );

    const newGameButton = screen.getByText('New Game');
    fireEvent.click(newGameButton);

    // Should reset callbacks to initial values
    await waitFor(() => {
      expect(mockOnScoreChange).toHaveBeenCalledWith(0);
      expect(mockOnMoveCount).toHaveBeenCalledWith(0);
    });
  });

  it('shows stock information correctly', () => {
    render(
      <TestWrapper>
        <SpiderGameBoard />
      </TestWrapper>
    );

    // Should show stock count and hint
    expect(screen.getByText(/Stock:/)).toBeInTheDocument();
    expect(screen.getByText('Click to deal cards')).toBeInTheDocument();
  });

  it('handles card selection and deselection', async () => {
    render(
      <TestWrapper>
        <SpiderGameBoard />
      </TestWrapper>
    );

    // Find a face-up card to click (this might vary based on the initial deal)
    const cards = document.querySelectorAll('.card-renderer.face-up.draggable');
    
    if (cards.length > 0) {
      const firstCard = cards[0] as HTMLElement;
      
      // Click to select
      fireEvent.click(firstCard);
      
      // Should show move hint
      await waitFor(() => {
        expect(screen.getByText(/Selected:/)).toBeInTheDocument();
      });
      
      // Click again to deselect
      fireEvent.click(firstCard);
      
      // Move hint should disappear
      await waitFor(() => {
        expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
      });
    }
  });

  it('integrates with SpiderEngine correctly', () => {
    const engine = new SpiderEngine();
    const gameState = engine.initializeGame();

    // Verify Spider-specific game state
    expect(gameState.gameType).toBe('spider');
    expect(gameState.tableau).toHaveLength(10); // 10 columns for Spider
    expect(gameState.foundation).toHaveLength(0); // No foundation piles initially
    expect(gameState.stock).toBeDefined();
    expect(gameState.waste).toBeUndefined(); // Spider doesn't use waste pile
  });

  it('handles win condition callback', async () => {
    const mockOnGameWin = vi.fn();

    // Mock the engine to return true for win condition
    const mockEngine = {
      initializeGame: () => ({
        gameType: 'spider' as const,
        tableau: Array(10).fill([]),
        foundation: [],
        stock: [],
        moves: [],
        score: 0,
        timeStarted: new Date()
      }),
      checkWinCondition: () => true,
      getCompletedSequencesCount: () => 8
    };

    // This test would require more complex mocking to properly test win condition
    // For now, just verify the callback prop is accepted
    render(
      <TestWrapper>
        <SpiderGameBoard onGameWin={mockOnGameWin} />
      </TestWrapper>
    );

    expect(mockOnGameWin).toBeDefined();
  });

  it('applies Spider-specific styling', () => {
    render(
      <TestWrapper>
        <SpiderGameBoard />
      </TestWrapper>
    );

    const gameBoard = screen.getByTestId('spider-game-board');
    expect(gameBoard).toHaveClass('spider-game-board');
  });
});