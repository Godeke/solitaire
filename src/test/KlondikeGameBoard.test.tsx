import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KlondikeGameBoard } from '../components/KlondikeGameBoard';

// Mock the DragDropProvider to avoid drag and drop issues in tests
vi.mock('../components/DragDropProvider', () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock CardRenderer to avoid drag and drop complexity
vi.mock('../components/CardRenderer', () => ({
  CardRenderer: ({ card, onCardClick, className }: any) => (
    <div 
      data-testid={`card-${card.id}-${card.position.zone}`}
      className={className}
      onClick={() => onCardClick && onCardClick(card)}
    >
      {card.faceUp ? `${card.rank}-${card.suit}` : 'face-down'}
    </div>
  )
}));

// Mock DropZone to avoid drag and drop complexity
vi.mock('../components/DropZone', () => ({
  DropZone: ({ children, placeholder, showPlaceholder }: any) => (
    <div className="drop-zone">
      {children}
      {showPlaceholder && placeholder && <div>{placeholder}</div>}
    </div>
  )
}));

describe('KlondikeGameBoard', () => {
  let mockOnGameWin: ReturnType<typeof vi.fn>;
  let mockOnScoreChange: ReturnType<typeof vi.fn>;
  let mockOnMoveCount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnGameWin = vi.fn();
    mockOnScoreChange = vi.fn();
    mockOnMoveCount = vi.fn();
  });

  it('renders the game board with all required elements', () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    // Check for game header elements
    expect(screen.getByText(/Score:/)).toBeInTheDocument();
    expect(screen.getByText(/Moves:/)).toBeInTheDocument();
    expect(screen.getByText('New Game')).toBeInTheDocument();

    // Check for tableau columns (should have 7 columns)
    const tableauColumns = document.querySelectorAll('.tableau-column');
    expect(tableauColumns).toHaveLength(7);

    // Check for foundation piles (should have 4 piles)
    const foundationPiles = screen.getAllByText(/Foundation \d/);
    expect(foundationPiles).toHaveLength(4);

    // Check for stock and waste areas
    expect(screen.getByText('Waste')).toBeInTheDocument();
  });

  it('initializes game with proper card distribution', () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    // Should have cards in tableau (face-up and face-down)
    const cards = screen.getAllByTestId(/card-/);
    expect(cards.length).toBeGreaterThan(0);

    // Initial score should be 0
    expect(screen.getByText('Score: 0')).toBeInTheDocument();
    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
  });

  it('handles new game button click', async () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    const newGameButton = screen.getByText('New Game');
    fireEvent.click(newGameButton);

    // Should call score and move callbacks
    await waitFor(() => {
      expect(mockOnScoreChange).toHaveBeenCalledWith(0);
      expect(mockOnMoveCount).toHaveBeenCalledWith(0);
    });
  });

  it('applies custom className', () => {
    const customClass = 'custom-game-board';
    render(
      <KlondikeGameBoard
        className={customClass}
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    const gameBoard = screen.getByTestId('klondike-game-board');
    expect(gameBoard).toHaveClass(customClass);
  });

  it('renders game board structure correctly', () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    const gameBoard = document.querySelector('.klondike-game-board');
    expect(gameBoard).toBeInTheDocument();
    
    // Check that main areas are present
    const tableauArea = document.querySelector('.tableau-area');
    expect(tableauArea).toBeInTheDocument();
    
    const topArea = document.querySelector('.top-area');
    expect(topArea).toBeInTheDocument();
  });

  it('updates callbacks on initialization', async () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    // Initial callbacks should be called with starting values
    await waitFor(() => {
      expect(mockOnScoreChange).toHaveBeenCalledWith(0);
      expect(mockOnMoveCount).toHaveBeenCalledWith(0);
    });
  });

  it('renders stack visualization for stock pile', () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    // Stock pile should have stack visualization elements
    const stockStack = document.querySelector('.stock-stack');
    expect(stockStack).toBeInTheDocument();

    // Should have stack indicators when there are multiple cards
    const stockStackIndicators = document.querySelector('.stock-stack-indicators');
    if (stockStackIndicators) {
      // If indicators exist, there should be stack cards
      const stackCards = document.querySelectorAll('.stock-stack-card');
      expect(stackCards.length).toBeGreaterThan(0);
    }
  });

  it('renders stack visualization for waste pile when cards are dealt', async () => {
    render(
      <KlondikeGameBoard
        onGameWin={mockOnGameWin}
        onScoreChange={mockOnScoreChange}
        onMoveCount={mockOnMoveCount}
      />
    );

    // Click on stock to deal cards to waste
    const stockCards = screen.getAllByTestId(/card-.*-stock/);
    if (stockCards.length > 0) {
      fireEvent.click(stockCards[0]);
      
      await waitFor(() => {
        // After dealing, waste stack should exist and show stack indicators
        const wasteStack = document.querySelector('.waste-stack');
        expect(wasteStack).toBeInTheDocument();
        
        // Should have waste stack indicators when multiple cards are dealt
        const wasteStackIndicators = document.querySelector('.waste-stack-indicators');
        if (wasteStackIndicators) {
          const stackCards = document.querySelectorAll('.waste-stack-card');
          expect(stackCards.length).toBeGreaterThan(0);
        }
      });
    }
  });
});