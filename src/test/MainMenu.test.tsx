import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MainMenu } from '../components/MainMenu';
import { GameStateManager } from '../utils/GameStateManager';

// Mock the GameStateManager
vi.mock('../utils/GameStateManager', () => ({
  GameStateManager: {
    hasSavedGameState: vi.fn(),
    loadGameState: vi.fn(),
    saveGameState: vi.fn(),
    clearGameState: vi.fn()
  }
}));

// Mock the logger
vi.mock('../utils/RendererLogger', () => ({
  logUserInteraction: vi.fn(),
  logComponentMount: vi.fn(),
  logComponentUnmount: vi.fn(),
  logError: vi.fn()
}));

describe('MainMenu', () => {
  const mockOnStartGame = vi.fn();
  const mockOnContinueGame = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: no saved games
    vi.mocked(GameStateManager.hasSavedGameState).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderMainMenu = (props = {}) => {
    return render(
      <MainMenu
        onStartGame={mockOnStartGame}
        onContinueGame={mockOnContinueGame}
        {...props}
      />
    );
  };

  describe('Rendering', () => {
    it('renders the main menu with title and subtitle', () => {
      renderMainMenu();
      
      expect(screen.getByText('Solitaire Collection')).toBeInTheDocument();
      expect(screen.getByText('Choose your favorite solitaire variant')).toBeInTheDocument();
    });

    it('renders with proper test id', () => {
      renderMainMenu();
      
      expect(screen.getByTestId('main-menu')).toBeInTheDocument();
    });

    it('renders all game variants', () => {
      renderMainMenu();
      
      expect(screen.getByTestId('klondike-card')).toBeInTheDocument();
      expect(screen.getByTestId('spider-card')).toBeInTheDocument();
      expect(screen.getByTestId('freecell-card')).toBeInTheDocument();
    });

    it('shows game descriptions and features', () => {
      renderMainMenu();
      
      expect(screen.getByText(/The classic solitaire game with 7 tableau columns/)).toBeInTheDocument();
      expect(screen.getByText(/Build sequences in the same suit across 10 tableau columns/)).toBeInTheDocument();
      expect(screen.getByText(/Strategic solitaire with 4 free cells/)).toBeInTheDocument();
    });

    it('shows difficulty badges', () => {
      renderMainMenu();
      
      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Hard')).toBeInTheDocument();
    });

    it('renders footer information', () => {
      renderMainMenu();
      
      expect(screen.getByText('Version 1.0.0')).toBeInTheDocument();
      expect(screen.getByText('© 2024 Solitaire Collection')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderMainMenu({ className: 'custom-class' });
      
      expect(container.firstChild).toHaveClass('main-menu', 'custom-class');
    });
  });

  describe('Game Availability', () => {
    it('shows Klondike as available with New Game button', () => {
      renderMainMenu();
      
      const klondikeCard = screen.getByTestId('klondike-card');
      expect(klondikeCard).not.toHaveClass('disabled');
      
      const playButton = screen.getByTestId('play-klondike');
      expect(playButton).toBeEnabled();
      expect(playButton).toHaveTextContent('New Game');
    });

    it('shows Spider and FreeCell as coming soon', () => {
      renderMainMenu();
      
      const spiderCard = screen.getByTestId('spider-card');
      const freecellCard = screen.getByTestId('freecell-card');
      
      expect(spiderCard).toHaveClass('disabled');
      expect(freecellCard).toHaveClass('disabled');
      
      const spiderButton = screen.getByTestId('play-spider');
      const freecellButton = screen.getByTestId('play-freecell');
      
      expect(spiderButton).toBeDisabled();
      expect(freecellButton).toBeDisabled();
      expect(spiderButton).toHaveTextContent('Coming Soon');
      expect(freecellButton).toHaveTextContent('Coming Soon');
    });
  });

  describe('Saved Game State', () => {
    it('shows continue button when saved game exists', () => {
      vi.mocked(GameStateManager.hasSavedGameState).mockImplementation((gameType) => {
        return gameType === 'klondike';
      });
      
      renderMainMenu();
      
      expect(screen.getByTestId('continue-klondike')).toBeInTheDocument();
      expect(screen.getByTestId('continue-klondike')).toHaveTextContent('Continue Game');
    });

    it('does not show continue button when no saved game exists', () => {
      vi.mocked(GameStateManager.hasSavedGameState).mockReturnValue(false);
      
      renderMainMenu();
      
      expect(screen.queryByTestId('continue-klondike')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onStartGame when New Game button is clicked', async () => {
      renderMainMenu();
      
      const playButton = screen.getByTestId('play-klondike');
      fireEvent.click(playButton);
      
      await waitFor(() => {
        expect(mockOnStartGame).toHaveBeenCalledWith('klondike');
      });
    });

    it('calls onContinueGame when Continue Game button is clicked', async () => {
      vi.mocked(GameStateManager.hasSavedGameState).mockImplementation((gameType) => {
        return gameType === 'klondike';
      });
      
      renderMainMenu();
      
      const continueButton = screen.getByTestId('continue-klondike');
      fireEvent.click(continueButton);
      
      await waitFor(() => {
        expect(mockOnContinueGame).toHaveBeenCalledWith('klondike');
      });
    });

    it('does not call callbacks for disabled games', () => {
      renderMainMenu();
      
      const spiderButton = screen.getByTestId('play-spider');
      const freecellButton = screen.getByTestId('play-freecell');
      
      fireEvent.click(spiderButton);
      fireEvent.click(freecellButton);
      
      expect(mockOnStartGame).not.toHaveBeenCalled();
      expect(mockOnContinueGame).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('renders game selection grid', () => {
      renderMainMenu();
      
      const gameSelection = screen.getByTestId('game-selection');
      expect(gameSelection).toBeInTheDocument();
      expect(gameSelection).toHaveClass('game-selection');
    });

    it('renders all game cards in the grid', () => {
      renderMainMenu();
      
      const gameSelection = screen.getByTestId('game-selection');
      const gameCards = gameSelection.querySelectorAll('.game-card');
      
      expect(gameCards).toHaveLength(3);
    });
  });

  describe('Accessibility', () => {
    it('has proper test ids for all interactive elements', () => {
      vi.mocked(GameStateManager.hasSavedGameState).mockReturnValue(true);
      
      renderMainMenu();
      
      expect(screen.getByTestId('main-menu')).toBeInTheDocument();
      expect(screen.getByTestId('game-selection')).toBeInTheDocument();
      expect(screen.getByTestId('klondike-card')).toBeInTheDocument();
      expect(screen.getByTestId('spider-card')).toBeInTheDocument();
      expect(screen.getByTestId('freecell-card')).toBeInTheDocument();
      expect(screen.getByTestId('play-klondike')).toBeInTheDocument();
      expect(screen.getByTestId('continue-klondike')).toBeInTheDocument();
      expect(screen.getByTestId('play-spider')).toBeInTheDocument();
      expect(screen.getByTestId('play-freecell')).toBeInTheDocument();
    });

    it('has proper button states for accessibility', () => {
      renderMainMenu();
      
      const klondikeButton = screen.getByTestId('play-klondike');
      const spiderButton = screen.getByTestId('play-spider');
      const freecellButton = screen.getByTestId('play-freecell');
      
      expect(klondikeButton).toBeEnabled();
      expect(spiderButton).toBeDisabled();
      expect(freecellButton).toBeDisabled();
    });
  });

  describe('Game Features Display', () => {
    it('displays features for each game variant', () => {
      renderMainMenu();
      
      // Check for Klondike features
      expect(screen.getByText('Classic gameplay')).toBeInTheDocument();
      expect(screen.getByText('Auto-complete')).toBeInTheDocument();
      expect(screen.getByText('Undo moves')).toBeInTheDocument();
      expect(screen.getByText('Score tracking')).toBeInTheDocument();
      
      // Check for Spider features
      expect(screen.getByText('10 tableau columns')).toBeInTheDocument();
      expect(screen.getByText('Same suit sequences')).toBeInTheDocument();
      expect(screen.getByText('Multiple difficulty levels')).toBeInTheDocument();
      
      // Check for FreeCell features
      expect(screen.getByText('4 free cells')).toBeInTheDocument();
      expect(screen.getByText('All cards visible')).toBeInTheDocument();
      expect(screen.getByText('Strategic gameplay')).toBeInTheDocument();
    });
  });
});