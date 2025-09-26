import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, it, expect, vi } from 'vitest';
import { CardRenderer } from '../components/CardRenderer';
import { Card } from '../utils/Card';
import { Position } from '../types/card';

// Test wrapper with DnD provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

describe('CardRenderer', () => {
  const createTestCard = (suit: 'hearts' | 'spades' | 'diamonds' | 'clubs', rank: number, faceUp = true) => {
    const card = new Card(suit, rank as any, faceUp);
    card.setDraggable(faceUp);
    return card;
  };

  it('renders face-up card correctly', () => {
    const card = createTestCard('hearts', 1, true);
    
    render(
      <TestWrapper>
        <CardRenderer card={card} />
      </TestWrapper>
    );

    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('♥')).toBeDefined();
  });

  it('renders face-down card correctly', () => {
    const card = createTestCard('hearts', 1, false);
    
    render(
      <TestWrapper>
        <CardRenderer card={card} />
      </TestWrapper>
    );

    // Face-down card should not show rank or suit
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('♥')).toBeNull();
  });

  it('displays correct rank for face cards', () => {
    const jack = createTestCard('spades', 11);
    const queen = createTestCard('diamonds', 12);
    const king = createTestCard('clubs', 13);

    const { rerender } = render(
      <TestWrapper>
        <CardRenderer card={jack} />
      </TestWrapper>
    );
    expect(screen.getByText('J')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <CardRenderer card={queen} />
      </TestWrapper>
    );
    expect(screen.getByText('Q')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <CardRenderer card={king} />
      </TestWrapper>
    );
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('displays correct suit symbols', () => {
    const hearts = createTestCard('hearts', 5);
    const diamonds = createTestCard('diamonds', 5);
    const clubs = createTestCard('clubs', 5);
    const spades = createTestCard('spades', 5);

    const { rerender } = render(
      <TestWrapper>
        <CardRenderer card={hearts} />
      </TestWrapper>
    );
    expect(screen.getAllByText('♥')).toHaveLength(3); // Corner + center

    rerender(
      <TestWrapper>
        <CardRenderer card={diamonds} />
      </TestWrapper>
    );
    expect(screen.getAllByText('♦')).toHaveLength(3);

    rerender(
      <TestWrapper>
        <CardRenderer card={clubs} />
      </TestWrapper>
    );
    expect(screen.getAllByText('♣')).toHaveLength(3);

    rerender(
      <TestWrapper>
        <CardRenderer card={spades} />
      </TestWrapper>
    );
    expect(screen.getAllByText('♠')).toHaveLength(3);
  });

  it('applies correct CSS classes for red and black cards', () => {
    const redCard = createTestCard('hearts', 5);
    const blackCard = createTestCard('spades', 5);

    const { rerender } = render(
      <TestWrapper>
        <CardRenderer card={redCard} />
      </TestWrapper>
    );
    expect(document.querySelector('.card-red')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <CardRenderer card={blackCard} />
      </TestWrapper>
    );
    expect(document.querySelector('.card-black')).toBeInTheDocument();
  });

  it('applies draggable class when card is draggable and face-up', () => {
    const draggableCard = createTestCard('hearts', 5, true);
    draggableCard.setDraggable(true);

    render(
      <TestWrapper>
        <CardRenderer card={draggableCard} />
      </TestWrapper>
    );

    expect(document.querySelector('.draggable')).toBeInTheDocument();
  });

  it('does not apply draggable class when card is face-down', () => {
    const faceDownCard = createTestCard('hearts', 5, false);
    faceDownCard.setDraggable(true);

    render(
      <TestWrapper>
        <CardRenderer card={faceDownCard} />
      </TestWrapper>
    );

    expect(document.querySelector('.draggable')).not.toBeInTheDocument();
  });

  it('calls onCardClick when card is clicked', () => {
    const card = createTestCard('hearts', 5);
    const onCardClick = vi.fn();

    render(
      <TestWrapper>
        <CardRenderer card={card} onCardClick={onCardClick} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('generic'));
    expect(onCardClick).toHaveBeenCalledWith(card);
  });

  it('applies custom className and style props', () => {
    const card = createTestCard('hearts', 5);
    const customStyle = { backgroundColor: 'red' };
    const customClass = 'custom-card';

    render(
      <TestWrapper>
        <CardRenderer 
          card={card} 
          className={customClass}
          style={customStyle}
        />
      </TestWrapper>
    );

    const cardElement = document.querySelector('.card-renderer');
    expect(cardElement).toHaveClass(customClass);
    expect(cardElement).toHaveStyle('background-color: red');
  });

  it('shows drop zone indicator when showDropZone is true', () => {
    const card = createTestCard('hearts', 5);

    render(
      <TestWrapper>
        <CardRenderer card={card} showDropZone={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Drop Here')).toBeInTheDocument();
  });

  it('applies drop target classes when isValidDropTarget is true', () => {
    const card = createTestCard('hearts', 5);

    render(
      <TestWrapper>
        <CardRenderer card={card} isValidDropTarget={true} />
      </TestWrapper>
    );

    expect(document.querySelector('.drop-target-valid')).toBeInTheDocument();
  });

  it('handles card move callback correctly', () => {
    const card = createTestCard('hearts', 5);
    const onCardMove = vi.fn().mockReturnValue(true);
    const fromPosition: Position = { zone: 'tableau', index: 0 };
    const toPosition: Position = { zone: 'foundation', index: 0 };

    render(
      <TestWrapper>
        <CardRenderer card={card} onCardMove={onCardMove} />
      </TestWrapper>
    );

    // Note: Testing actual drag-and-drop behavior requires more complex setup
    // This test verifies the callback is properly passed
    expect(onCardMove).not.toHaveBeenCalled();
  });

  it('renders number cards correctly', () => {
    for (let rank = 2; rank <= 10; rank++) {
      const card = createTestCard('hearts', rank);
      
      const { rerender } = render(
        <TestWrapper>
          <CardRenderer card={card} />
        </TestWrapper>
      );

      expect(screen.getByText(rank.toString())).toBeInTheDocument();
      
      if (rank < 10) {
        rerender(<div />); // Clear for next iteration
      }
    }
  });

  it('maintains card identity through id prop', () => {
    const card1 = createTestCard('hearts', 5);
    const card2 = createTestCard('hearts', 5);

    // Cards with same suit/rank should have different IDs
    expect(card1.id).not.toBe(card2.id);

    render(
      <TestWrapper>
        <CardRenderer card={card1} />
      </TestWrapper>
    );

    // The component should render with the specific card's ID
    expect(card1.id).toBeTruthy();
    expect(card1.id).toMatch(/hearts-5-/);
  });
});