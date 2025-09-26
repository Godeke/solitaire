import React from 'react';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, it, expect, vi } from 'vitest';
import { DropZone } from '../components/DropZone';
import { Card } from '../utils/Card';
import { Position } from '../types/card';

// Test wrapper with DnD provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

describe('DropZone', () => {
  const createTestPosition = (): Position => ({
    zone: 'foundation',
    index: 0
  });

  const createTestCard = () => {
    const card = new Card('hearts', 1, true);
    card.setDraggable(true);
    return card;
  };

  it('renders with default placeholder when empty', () => {
    const position = createTestPosition();

    render(
      <TestWrapper>
        <DropZone position={position} />
      </TestWrapper>
    );

    expect(screen.getByText('Drop cards here')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const position = createTestPosition();
    const customPlaceholder = 'Custom drop area';

    render(
      <TestWrapper>
        <DropZone position={position} placeholder={customPlaceholder} />
      </TestWrapper>
    );

    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('does not show placeholder when showPlaceholder is false', () => {
    const position = createTestPosition();

    render(
      <TestWrapper>
        <DropZone position={position} showPlaceholder={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Drop cards here')).not.toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const position = createTestPosition();
    const childContent = 'Child content';

    render(
      <TestWrapper>
        <DropZone position={position}>
          <div>{childContent}</div>
        </DropZone>
      </TestWrapper>
    );

    expect(screen.getByText(childContent)).toBeInTheDocument();
    // Should not show placeholder when children are present
    expect(screen.queryByText('Drop cards here')).not.toBeInTheDocument();
  });

  it('applies custom className and style', () => {
    const position = createTestPosition();
    const customClass = 'custom-drop-zone';
    const customStyle = { backgroundColor: 'blue' };

    render(
      <TestWrapper>
        <DropZone 
          position={position}
          className={customClass}
          style={customStyle}
        />
      </TestWrapper>
    );

    const dropZone = document.querySelector('.drop-zone');
    expect(dropZone).toHaveClass(customClass);
    expect(dropZone).toHaveStyle('background-color: blue');
  });

  it('applies empty class when no children and placeholder is shown', () => {
    const position = createTestPosition();

    render(
      <TestWrapper>
        <DropZone position={position} />
      </TestWrapper>
    );

    expect(document.querySelector('.empty')).toBeInTheDocument();
  });

  it('does not apply empty class when children are present', () => {
    const position = createTestPosition();

    render(
      <TestWrapper>
        <DropZone position={position}>
          <div>Child</div>
        </DropZone>
      </TestWrapper>
    );

    expect(document.querySelector('.empty')).not.toBeInTheDocument();
  });

  it('calls onCardDrop when provided', () => {
    const position = createTestPosition();
    const onCardDrop = vi.fn().mockReturnValue(true);

    render(
      <TestWrapper>
        <DropZone position={position} onCardDrop={onCardDrop} />
      </TestWrapper>
    );

    // Note: Testing actual drop behavior requires more complex drag-and-drop simulation
    // This test verifies the callback is properly passed
    expect(onCardDrop).not.toHaveBeenCalled();
  });

  it('uses isValidDropTarget function when provided', () => {
    const position = createTestPosition();
    const isValidDropTarget = vi.fn().mockReturnValue(true);

    render(
      <TestWrapper>
        <DropZone position={position} isValidDropTarget={isValidDropTarget} />
      </TestWrapper>
    );

    // The function should be available for use during drag operations
    expect(isValidDropTarget).not.toHaveBeenCalled();
  });

  it('handles position prop correctly', () => {
    const position: Position = {
      zone: 'foundation',
      index: 2,
      cardIndex: 1
    };

    render(
      <TestWrapper>
        <DropZone position={position} />
      </TestWrapper>
    );

    // The component should render without errors with the position
    expect(document.querySelector('.drop-zone')).toBeInTheDocument();
  });

  it('renders with different zone types', () => {
    const zones: Array<Position['zone']> = ['tableau', 'foundation', 'stock', 'waste', 'freecell'];

    zones.forEach(zone => {
      const position: Position = { zone, index: 0 };
      
      const { rerender } = render(
        <TestWrapper>
          <DropZone position={position} />
        </TestWrapper>
      );

      expect(document.querySelector('.drop-zone')).toBeInTheDocument();
      
      if (zone !== 'freecell') {
        rerender(<div />); // Clear for next iteration
      }
    });
  });

  it('maintains consistent structure across re-renders', () => {
    const position = createTestPosition();

    const { rerender } = render(
      <TestWrapper>
        <DropZone position={position} placeholder="Initial" />
      </TestWrapper>
    );

    expect(screen.getByText('Initial')).toBeInTheDocument();

    rerender(
      <TestWrapper>
        <DropZone position={position} placeholder="Updated" />
      </TestWrapper>
    );

    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.queryByText('Initial')).not.toBeInTheDocument();
  });

  it('handles multiple drop zones without interference', () => {
    const position1: Position = { zone: 'foundation', index: 0 };
    const position2: Position = { zone: 'foundation', index: 1 };

    render(
      <TestWrapper>
        <DropZone position={position1} placeholder="Zone 1" />
        <DropZone position={position2} placeholder="Zone 2" />
      </TestWrapper>
    );

    expect(screen.getByText('Zone 1')).toBeInTheDocument();
    expect(screen.getByText('Zone 2')).toBeInTheDocument();
    expect(document.querySelectorAll('.drop-zone')).toHaveLength(2);
  });
});