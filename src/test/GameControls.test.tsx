import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GameControls } from '../components/GameControls';

describe('GameControls', () => {
  const defaultProps = {
    onNewGame: vi.fn(),
    onBackToMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
});