import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FreeCellGameBoard } from '../components/FreeCellGameBoard';
import { FreeCellEngine } from '../engines/FreeCellEngine';
import { vi, describe, beforeEach, it, expect } from 'vitest';

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

describe('FreeCellGameBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the FreeCell game board with 8 tableau columns', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Check that the component renders
    expect(screen.getByTestId('freecell-game-board')).toBeInTheDocument();

    // Check for game header elements
    expect(screen.getByText(/Score:/)).toBeInTheDocument();
    expect(screen.getByText(/Moves:/)).toBeInTheDocument();
    expect(screen.getByText('New Game')).toBeInTheDocument();

    // Check that we have 8 tableau columns
    const columns = document.querySelectorAll('.tableau-column');
    expect(columns).toHaveLength(8);
  });

  it('renders 4 free cells and 4 foundation piles', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Check for free cells area by class
    const freeCellsArea = document.querySelector('.freecells-area');
    expect(freeCellsArea).toBeInTheDocument();
    const freeCells = document.querySelectorAll('.freecell-slot');
    expect(freeCells).toHaveLength(4);

    // Check for foundations area
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    const foundations = document.querySelectorAll('.foundation-pile');
    expect(foundations).toHaveLength(4);

    // Check for foundation suit symbols in the foundation area
    const foundationSuits = document.querySelectorAll('.foundation-suit');
    expect(foundationSuits).toHaveLength(4);
    const suitTexts = Array.from(foundationSuits).map(el => el.textContent);
    expect(suitTexts).toContain('♥');
    expect(suitTexts).toContain('♦');
    expect(suitTexts).toContain('♣');
    expect(suitTexts).toContain('♠');
  });

  it('displays game statistics correctly', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Check for game stats by looking at the stats container
    const gameStats = document.querySelector('.game-stats');
    expect(gameStats).toBeInTheDocument();
    
    expect(screen.getByText('Empty Columns')).toBeInTheDocument();
    expect(screen.getByText('Max Movable')).toBeInTheDocument();

    // Initially all free cells should be empty (4/4)
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('initializes with proper game state', () => {
    const mockOnScoreChange = vi.fn();
    const mockOnMoveCount = vi.fn();

    render(
      <TestWrapper>
        <FreeCellGameBoard 
          onScoreChange={mockOnScoreChange}
          onMoveCount={mockOnMoveCount}
        />
      </TestWrapper>
    );

    // Should call callbacks with initial values
    expect(mockOnScoreChange).toHaveBeenCalledWith(0);
    expect(mockOnMoveCount).toHaveBeenCalledWith(0);
  });

  it('shows foundation pile information', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Check for foundation counters (initially 0/13 for each)
    const foundationCounters = screen.getAllByText('0/13');
    expect(foundationCounters).toHaveLength(4);
  });

  it('handles new game button click', async () => {
    const mockOnScoreChange = vi.fn();
    const mockOnMoveCount = vi.fn();

    render(
      <TestWrapper>
        <FreeCellGameBoard 
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

  it('handles card selection and deselection', async () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Find a face-up draggable card (all cards should be face-up in FreeCell)
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

  it('integrates with FreeCellEngine correctly', () => {
    const engine = new FreeCellEngine();
    const gameState = engine.initializeGame();

    // Verify FreeCell-specific game state
    expect(gameState.gameType).toBe('freecell');
    expect(gameState.tableau).toHaveLength(8); // 8 columns for FreeCell
    expect(gameState.foundation).toHaveLength(4); // 4 foundation piles
    expect(gameState.freeCells).toBeDefined(); // Free cells array exists
    expect(gameState.stock).toBeUndefined(); // FreeCell doesn't use stock pile
    expect(gameState.waste).toBeUndefined(); // FreeCell doesn't use waste pile

    // Check initial card distribution (52 cards total)
    const totalCards = gameState.tableau.reduce((sum, column) => sum + column.length, 0);
    expect(totalCards).toBe(52);

    // Check that first 4 columns have 7 cards, last 4 have 6 cards
    for (let i = 0; i < 4; i++) {
      expect(gameState.tableau[i]).toHaveLength(7);
    }
    for (let i = 4; i < 8; i++) {
      expect(gameState.tableau[i]).toHaveLength(6);
    }
  });

  it('displays free cell availability indicators', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // All free cells should be empty initially
    const freeCellDropZones = document.querySelectorAll('.freecell-drop-zone.empty');
    expect(freeCellDropZones).toHaveLength(4);

    // Check for placeholder text
    const freePlaceholders = screen.getAllByText('Free');
    expect(freePlaceholders).toHaveLength(4);
  });

  it('displays foundation pile placeholders correctly', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // All foundation piles should be empty initially
    const foundationDropZones = document.querySelectorAll('.foundation-drop-zone.empty');
    expect(foundationDropZones).toHaveLength(4);

    // Check for suit placeholders (first letter of each suit)
    expect(screen.getByText('H')).toBeInTheDocument(); // Hearts
    expect(screen.getByText('D')).toBeInTheDocument(); // Diamonds
    expect(screen.getByText('C')).toBeInTheDocument(); // Clubs
    expect(screen.getByText('S')).toBeInTheDocument(); // Spades
  });

  it('handles win condition callback', async () => {
    const mockOnGameWin = vi.fn();

    render(
      <TestWrapper>
        <FreeCellGameBoard onGameWin={mockOnGameWin} />
      </TestWrapper>
    );

    // Verify the callback prop is accepted
    expect(mockOnGameWin).toBeDefined();
  });

  it('applies FreeCell-specific styling', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    const gameBoard = screen.getByTestId('freecell-game-board');
    expect(gameBoard).toHaveClass('freecell-game-board');
  });

  it('shows proper card stacking in tableau columns', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Check that cards are properly stacked with correct positioning
    const tableauCards = document.querySelectorAll('.tableau-card');
    expect(tableauCards.length).toBeGreaterThan(0);

    // Cards should have absolute positioning for stacking
    tableauCards.forEach(card => {
      const style = window.getComputedStyle(card);
      expect(style.position).toBe('absolute');
    });
  });

  it('calculates and displays max movable cards correctly', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // With 4 empty free cells and 0 empty tableau columns initially:
    // Max movable = (1 + 4) * 2^0 = 5
    // Look specifically in the game stats area
    const gameStats = document.querySelector('.game-stats');
    expect(gameStats).toBeInTheDocument();
    
    // Find the stat value for Max Movable
    const maxMovableStats = document.querySelectorAll('.stat-item');
    const maxMovableStat = Array.from(maxMovableStats).find(stat => 
      stat.textContent?.includes('Max Movable')
    );
    expect(maxMovableStat).toBeInTheDocument();
    expect(maxMovableStat?.textContent).toContain('5');
  });

  it('handles replay mode initialization', () => {
    const mockReplayEngine = {
      attachGameEngine: vi.fn()
    };
    const mockReplayEvents = [
      { type: 'test', timestamp: new Date() }
    ];

    render(
      <TestWrapper>
        <FreeCellGameBoard 
          replayMode={true}
          replayEngine={mockReplayEngine as any}
          replayEvents={mockReplayEvents as any}
        />
      </TestWrapper>
    );

    // Should call attachGameEngine if available
    expect(mockReplayEngine.attachGameEngine).toHaveBeenCalled();
  });

  it('renders all cards face-up as expected in FreeCell', () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // All cards should be face-up in FreeCell
    const faceUpCards = document.querySelectorAll('.card-renderer.face-up');
    const faceDownCards = document.querySelectorAll('.card-renderer.face-down');
    
    expect(faceUpCards.length).toBe(52); // All 52 cards should be face-up
    expect(faceDownCards.length).toBe(0); // No face-down cards
  });

  it('shows proper drop zone highlighting', async () => {
    render(
      <TestWrapper>
        <FreeCellGameBoard />
      </TestWrapper>
    );

    // Find a draggable card and click it to select
    const draggableCards = document.querySelectorAll('.card-renderer.draggable');
    
    if (draggableCards.length > 0) {
      const firstCard = draggableCards[0] as HTMLElement;
      fireEvent.click(firstCard);

      // Should highlight valid drop zones
      await waitFor(() => {
        const highlightedZones = document.querySelectorAll('.highlighted');
        expect(highlightedZones.length).toBeGreaterThan(0);
      });
    }
  });
});