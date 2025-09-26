import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameManager } from '../components/GameManager';
import { GameStateManager } from '../utils/GameStateManager';

// Mock the GameStateManager
vi.mock('../utils/GameStateManager', () => ({
  GameStateManager: {
    loadGameState: vi.fn(),
    saveGameState: vi.fn(),
    clearGameState: vi.fn(),
    hasSavedGameState: vi.fn(),
  }
}));

// Mock the KlondikeGameBoard component
vi.mock('../components/KlondikeGameBoard', () => ({
  KlondikeGameBoard: ({ onGameWin, onScoreChange, onMoveCount }: any) => (
    <div data-testid="klondike-game-board">
      <button 
        onClick={() => onGameWin?.()}
        data-testid="mock-win-button"
      >
        Mock Win
      </button>
      <button 
        onClick={() => onScoreChange?.(100)}
        data-testid="mock-score-button"
      >
        Mock Score
      </button>
      <button 
        onClick={() => onMoveCount?.(5)}
        data-testid="mock-moves-button"
      >
        Mock Moves
      </button>
    </div>
  )
}));

describe('GameManager', () => {
  const mockGameStateManager = GameStateManager as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameStateManager.loadGameState.mockReturnValue(null);
    mockGameStateManager.hasSavedGameState.mockReturnValue(false);
  });

  it('renders main menu by default', () => {
    render(<GameManager />);
    
    expect(screen.getByTestId('main-menu')).toBeInTheDocument();
    expect(screen.getByText('Solitaire Collection')).toBeInTheDocument();
    expect(screen.getByText('Choose your favorite solitaire variant')).toBeInTheDocument();
  });

  it('renders game cards in main menu', () => {
    render(<GameManager />);
    
    expect(screen.getByTestId('klondike-card')).toBeInTheDocument();
    expect(screen.getByTestId('spider-card')).toBeInTheDocument();
    expect(screen.getByTestId('freecell-card')).toBeInTheDocument();
    
    expect(screen.getByText('Klondike')).toBeInTheDocument();
    expect(screen.getByText('Spider')).toBeInTheDocument();
    expect(screen.getByText('FreeCell')).toBeInTheDocument();
  });

  it('starts Klondike game when play button is clicked', async () => {
    render(<GameManager />);
    
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-view')).toBeInTheDocument();
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
  });

  it('shows continue button when saved game exists', () => {
    mockGameStateManager.hasSavedGameState.mockReturnValue(true);
    
    render(<GameManager />);
    
    expect(screen.getByTestId('continue-klondike')).toBeInTheDocument();
  });

  it('continues saved game when continue button is clicked', async () => {
    mockGameStateManager.hasSavedGameState.mockReturnValue(true);
    
    render(<GameManager />);
    
    const continueButton = screen.getByTestId('continue-klondike');
    fireEvent.click(continueButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-view')).toBeInTheDocument();
    });
  });

  it('renders game controls in game view', async () => {
    render(<GameManager />);
    
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-controls')).toBeInTheDocument();
      expect(screen.getByTestId('menu-button')).toBeInTheDocument();
      expect(screen.getByTestId('new-game-button')).toBeInTheDocument();
    });
  });

  it('returns to menu when menu button is clicked', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-view')).toBeInTheDocument();
    });
    
    // Go back to menu
    const menuButton = screen.getByTestId('menu-button');
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('main-menu')).toBeInTheDocument();
    });
  });

  it('starts new game when new game button is clicked', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-view')).toBeInTheDocument();
    });
    
    // Start new game
    const newGameButton = screen.getByTestId('new-game-button');
    fireEvent.click(newGameButton);
    
    expect(mockGameStateManager.clearGameState).toHaveBeenCalledWith('klondike');
  });

  it('displays game statistics', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('score-display')).toBeInTheDocument();
      expect(screen.getByTestId('moves-display')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Score: 0')).toBeInTheDocument();
    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
  });

  it('updates score when game board reports score change', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
    
    // Trigger score change
    const mockScoreButton = screen.getByTestId('mock-score-button');
    fireEvent.click(mockScoreButton);
    
    await waitFor(() => {
      expect(screen.getByText('Score: 100')).toBeInTheDocument();
    });
  });

  it('updates move count when game board reports move change', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
    
    // Trigger move count change
    const mockMovesButton = screen.getByTestId('mock-moves-button');
    fireEvent.click(mockMovesButton);
    
    await waitFor(() => {
      expect(screen.getByText('Moves: 5')).toBeInTheDocument();
    });
  });

  it('shows win message when game is won', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
    
    // Trigger win
    const mockWinButton = screen.getByTestId('mock-win-button');
    fireEvent.click(mockWinButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('win-message')).toBeInTheDocument();
      expect(screen.getByText('🎉 Congratulations! You won!')).toBeInTheDocument();
    });
  });

  it('calls onStateChange callback when state changes', async () => {
    const onStateChange = vi.fn();
    render(<GameManager onStateChange={onStateChange} />);
    
    // Should call with initial state
    expect(onStateChange).toHaveBeenCalledWith('menu', undefined);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('game', 'klondike');
    });
  });

  it('renders placeholder for unimplemented games', async () => {
    render(<GameManager initialState="game" initialGameType="spider" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('game-placeholder')).toBeInTheDocument();
      expect(screen.getByText('Spider Solitaire')).toBeInTheDocument();
      expect(screen.getByText('This game variant is not yet implemented.')).toBeInTheDocument();
    });
  });

  it('disables spider and freecell play buttons', () => {
    render(<GameManager />);
    
    const spiderButton = screen.getByTestId('play-spider');
    const freecellButton = screen.getByTestId('play-freecell');
    
    expect(spiderButton).toBeDisabled();
    expect(freecellButton).toBeDisabled();
    expect(spiderButton).toHaveTextContent('Coming Soon');
    expect(freecellButton).toHaveTextContent('Coming Soon');
  });

  it('applies custom className', () => {
    render(<GameManager className="custom-class" />);
    
    const gameManager = screen.getByTestId('game-manager');
    expect(gameManager).toHaveClass('game-manager', 'custom-class');
  });

  it('loads saved game state when entering game mode', async () => {
    const mockGameState = {
      gameType: 'klondike' as const,
      tableau: [],
      foundation: [],
      moves: [],
      score: 50,
      timeStarted: new Date()
    };
    
    mockGameStateManager.loadGameState.mockReturnValue(mockGameState);
    
    render(<GameManager />);
    
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(mockGameStateManager.loadGameState).toHaveBeenCalledWith('klondike');
    });
  });

  it('resets statistics when starting new game', async () => {
    render(<GameManager />);
    
    // Start game
    const playButton = screen.getByTestId('play-klondike');
    fireEvent.click(playButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('klondike-game-board')).toBeInTheDocument();
    });
    
    // Update score and moves
    fireEvent.click(screen.getByTestId('mock-score-button'));
    fireEvent.click(screen.getByTestId('mock-moves-button'));
    
    await waitFor(() => {
      expect(screen.getByText('Score: 100')).toBeInTheDocument();
      expect(screen.getByText('Moves: 5')).toBeInTheDocument();
    });
    
    // Start new game
    const newGameButton = screen.getByTestId('new-game-button');
    fireEvent.click(newGameButton);
    
    await waitFor(() => {
      expect(screen.getByText('Score: 0')).toBeInTheDocument();
      expect(screen.getByText('Moves: 0')).toBeInTheDocument();
    });
  });
});