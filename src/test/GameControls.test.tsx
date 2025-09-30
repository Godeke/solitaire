import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameControls } from '../components/GameControls';

// Mock AudioManager and UserPreferences
vi.mock('../utils/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
    isEnabled: vi.fn(() => true),
    getVolume: vi.fn(() => 0.7)
  }))
}));

vi.mock('../utils/UserPreferences', () => ({
  UserPreferencesManager: {
    getInstance: vi.fn(() => ({
      getAudioPreferences: vi.fn(() => ({ enabled: true, volume: 0.7 })),
      setAudioEnabled: vi.fn(),
      setAudioVolume: vi.fn()
    }))
  }
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('GameControls', () => {
  const defaultProps = {
    onNewGame: vi.fn(),
    onBackToMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('renders basic controls correctly', () => {
    render(<GameControls {...defaultProps} />);
    
    expect(screen.getByTestId('game-controls')).toBeInTheDocument();
    expect(screen.getByTestId('menu-button')).toBeInTheDocument();
    expect(screen.getByTestId('new-game-button')).toBeInTheDocument();
    
    expect(screen.getByText('← Menu')).toBeInTheDocument();
    expect(screen.getByText('🔄 New Game')).toBeInTheDocument();
  });

  it('displays game type label when provided', () => {
    render(<GameControls {...defaultProps} gameType="klondike" />);
    
    const gameTypeLabel = screen.getByTestId('game-type-label');
    expect(gameTypeLabel).toBeInTheDocument();
    expect(gameTypeLabel).toHaveTextContent('Klondike');
  });

  it('capitalizes game type correctly', () => {
    render(<GameControls {...defaultProps} gameType="freecell" />);
    
    const gameTypeLabel = screen.getByTestId('game-type-label');
    expect(gameTypeLabel).toHaveTextContent('Freecell');
  });

  it('calls onNewGame when new game button is clicked', () => {
    render(<GameControls {...defaultProps} />);
    
    const newGameButton = screen.getByTestId('new-game-button');
    fireEvent.click(newGameButton);
    
    expect(defaultProps.onNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls onBackToMenu when menu button is clicked', () => {
    render(<GameControls {...defaultProps} />);
    
    const menuButton = screen.getByTestId('menu-button');
    fireEvent.click(menuButton);
    
    expect(defaultProps.onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it('renders undo button when onUndo is provided', () => {
    const onUndo = vi.fn();
    render(<GameControls {...defaultProps} onUndo={onUndo} canUndo={true} />);
    
    const undoButton = screen.getByTestId('undo-button');
    expect(undoButton).toBeInTheDocument();
    expect(undoButton).toHaveTextContent('↶ Undo');
    expect(undoButton).not.toBeDisabled();
  });

  it('disables undo button when canUndo is false', () => {
    const onUndo = vi.fn();
    render(<GameControls {...defaultProps} onUndo={onUndo} canUndo={false} />);
    
    const undoButton = screen.getByTestId('undo-button');
    expect(undoButton).toBeDisabled();
    expect(undoButton).toHaveClass('disabled');
  });

  it('calls onUndo when undo button is clicked and enabled', () => {
    const onUndo = vi.fn();
    render(<GameControls {...defaultProps} onUndo={onUndo} canUndo={true} />);
    
    const undoButton = screen.getByTestId('undo-button');
    fireEvent.click(undoButton);
    
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not call onUndo when undo button is disabled', () => {
    const onUndo = vi.fn();
    render(<GameControls {...defaultProps} onUndo={onUndo} canUndo={false} />);
    
    const undoButton = screen.getByTestId('undo-button');
    fireEvent.click(undoButton);
    
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('renders hint button when onHint is provided', () => {
    const onHint = vi.fn();
    render(<GameControls {...defaultProps} onHint={onHint} canHint={true} />);
    
    const hintButton = screen.getByTestId('hint-button');
    expect(hintButton).toBeInTheDocument();
    expect(hintButton).toHaveTextContent('💡 Hint');
    expect(hintButton).not.toBeDisabled();
  });

  it('disables hint button when canHint is false', () => {
    const onHint = vi.fn();
    render(<GameControls {...defaultProps} onHint={onHint} canHint={false} />);
    
    const hintButton = screen.getByTestId('hint-button');
    expect(hintButton).toBeDisabled();
    expect(hintButton).toHaveClass('disabled');
  });

  it('calls onHint when hint button is clicked and enabled', () => {
    const onHint = vi.fn();
    render(<GameControls {...defaultProps} onHint={onHint} canHint={true} />);
    
    const hintButton = screen.getByTestId('hint-button');
    fireEvent.click(hintButton);
    
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it('does not render undo button when onUndo is not provided', () => {
    render(<GameControls {...defaultProps} />);
    
    expect(screen.queryByTestId('undo-button')).not.toBeInTheDocument();
  });

  it('does not render hint button when onHint is not provided', () => {
    render(<GameControls {...defaultProps} />);
    
    expect(screen.queryByTestId('hint-button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<GameControls {...defaultProps} className="custom-class" />);
    
    const gameControls = screen.getByTestId('game-controls');
    expect(gameControls).toHaveClass('game-controls', 'custom-class');
  });

  it('has correct button titles for accessibility', () => {
    const onUndo = vi.fn();
    const onHint = vi.fn();
    
    render(
      <GameControls 
        {...defaultProps} 
        onUndo={onUndo} 
        onHint={onHint}
        canUndo={true}
        canHint={true}
      />
    );
    
    expect(screen.getByTestId('menu-button')).toHaveAttribute('title', 'Back to Main Menu');
    expect(screen.getByTestId('new-game-button')).toHaveAttribute('title', 'Start New Game');
    expect(screen.getByTestId('undo-button')).toHaveAttribute('title', 'Undo Last Move');
    expect(screen.getByTestId('hint-button')).toHaveAttribute('title', 'Show Hint');
  });

  it('renders all game types correctly', () => {
    const gameTypes: Array<'klondike' | 'spider' | 'freecell'> = ['klondike', 'spider', 'freecell'];
    
    gameTypes.forEach(gameType => {
      const { rerender } = render(<GameControls {...defaultProps} gameType={gameType} />);
      
      const gameTypeLabel = screen.getByTestId('game-type-label');
      const expectedText = gameType.charAt(0).toUpperCase() + gameType.slice(1);
      expect(gameTypeLabel).toHaveTextContent(expectedText);
      
      rerender(<div />); // Clean up for next iteration
    });
  });

  describe('Audio Controls', () => {
    it('renders audio controls by default', async () => {
      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('audio-controls')).toBeInTheDocument();
        expect(screen.getByTestId('audio-toggle-button')).toBeInTheDocument();
        expect(screen.getByTestId('volume-slider')).toBeInTheDocument();
      });
    });

    it('does not render audio controls when showAudioControls is false', () => {
      render(<GameControls {...defaultProps} showAudioControls={false} />);
      
      expect(screen.queryByTestId('audio-controls')).not.toBeInTheDocument();
    });

    it('displays correct audio toggle button icon when audio is enabled', async () => {
      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const toggleButton = screen.getByTestId('audio-toggle-button');
        expect(toggleButton).toHaveTextContent('🔊');
        expect(toggleButton).toHaveAttribute('title', 'Mute Audio');
      });
    });

    it('displays correct audio toggle button icon when audio is disabled', async () => {
      const { getAudioManager } = await import('../utils/AudioManager');
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockAudioManager = getAudioManager();
      const mockPreferencesManager = UserPreferencesManager.getInstance();
      
      vi.mocked(mockPreferencesManager.getAudioPreferences).mockReturnValue({
        enabled: false,
        volume: 0.7
      });

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const toggleButton = screen.getByTestId('audio-toggle-button');
        expect(toggleButton).toHaveTextContent('🔇');
        expect(toggleButton).toHaveAttribute('title', 'Enable Audio');
        expect(toggleButton).toHaveClass('disabled');
      });
    });

    it('toggles audio when toggle button is clicked', async () => {
      const { getAudioManager } = await import('../utils/AudioManager');
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockAudioManager = getAudioManager();
      const mockPreferencesManager = UserPreferencesManager.getInstance();

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const toggleButton = screen.getByTestId('audio-toggle-button');
        fireEvent.click(toggleButton);
      });

      expect(mockAudioManager.setEnabled).toHaveBeenCalledWith(false);
      expect(mockPreferencesManager.setAudioEnabled).toHaveBeenCalledWith(false);
    });

    it('shows volume slider when audio is enabled', async () => {
      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider');
        expect(volumeSlider).toBeInTheDocument();
        expect(volumeSlider).toHaveAttribute('type', 'range');
        expect(volumeSlider).toHaveAttribute('min', '0');
        expect(volumeSlider).toHaveAttribute('max', '1');
        expect(volumeSlider).toHaveAttribute('step', '0.1');
      });
    });

    it('hides volume slider when audio is disabled', async () => {
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockPreferencesManager = UserPreferencesManager.getInstance();
      vi.mocked(mockPreferencesManager.getAudioPreferences).mockReturnValue({
        enabled: false,
        volume: 0.7
      });

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('volume-slider')).not.toBeInTheDocument();
      });
    });

    it('updates volume when slider is changed', async () => {
      const { getAudioManager } = await import('../utils/AudioManager');
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockAudioManager = getAudioManager();
      const mockPreferencesManager = UserPreferencesManager.getInstance();

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider');
        fireEvent.change(volumeSlider, { target: { value: '0.5' } });
      });

      expect(mockAudioManager.setVolume).toHaveBeenCalledWith(0.5);
      expect(mockPreferencesManager.setAudioVolume).toHaveBeenCalledWith(0.5);
    });

    it('displays correct volume in slider title', async () => {
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockPreferencesManager = UserPreferencesManager.getInstance();
      vi.mocked(mockPreferencesManager.getAudioPreferences).mockReturnValue({
        enabled: true,
        volume: 0.8
      });

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider');
        expect(volumeSlider).toHaveAttribute('title', 'Volume: 80%');
      });
    });

    it('initializes with correct audio preferences', async () => {
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockPreferencesManager = UserPreferencesManager.getInstance();
      vi.mocked(mockPreferencesManager.getAudioPreferences).mockReturnValue({
        enabled: false,
        volume: 0.3
      });

      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockPreferencesManager.getAudioPreferences).toHaveBeenCalled();
      });
    });

    it('handles audio preference loading errors gracefully', async () => {
      const { UserPreferencesManager } = await import('../utils/UserPreferences');
      
      const mockPreferencesManager = UserPreferencesManager.getInstance();
      vi.mocked(mockPreferencesManager.getAudioPreferences).mockImplementation(() => {
        throw new Error('Preferences loading failed');
      });

      // Should not throw
      expect(() => render(<GameControls {...defaultProps} />)).not.toThrow();
    });

    it('maintains audio controls layout in responsive design', async () => {
      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const audioControls = screen.getByTestId('audio-controls');
        const rightSection = audioControls.closest('.game-controls-right');
        
        expect(rightSection).toBeInTheDocument();
        expect(audioControls).toBeInTheDocument();
      });
    });

    it('applies correct CSS classes to audio controls', async () => {
      render(<GameControls {...defaultProps} />);
      
      await waitFor(() => {
        const audioControls = screen.getByTestId('audio-controls');
        const toggleButton = screen.getByTestId('audio-toggle-button');
        const volumeSlider = screen.getByTestId('volume-slider');
        
        expect(audioControls).toHaveClass('audio-controls');
        expect(toggleButton).toHaveClass('control-button', 'audio-toggle-button');
        expect(volumeSlider).toHaveClass('volume-slider');
      });
    });
  });
});