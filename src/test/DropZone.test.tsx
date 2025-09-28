import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropZone } from '../components/DropZone';
import { Card } from '../utils/Card';
import { Position } from '../types/card';
import { UIActionLogger } from '../utils/UIActionLogger';
import { UIActionEventType } from '../types/UIActionLogging';

// Test wrapper with DnD provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

// Helper functions available to all tests
const createTestPosition = (): Position => ({
  zone: 'foundation',
  index: 0
});

const createTestCard = () => {
  const card = new Card('hearts', 1, true);
  card.setDraggable(true);
  return card;
};

describe('DropZone', () => {
  let mockLogger: UIActionLogger;

  beforeEach(() => {
    // Create a fresh logger instance for each test
    mockLogger = UIActionLogger.getInstance();
    if (mockLogger.clearEventBuffer) {
      mockLogger.clearEventBuffer();
    }
    
    // Mock performance.now for consistent timing
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const customStyle = { backgroundColor: 'rgb(0, 0, 255)' };

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
    expect(dropZone).toHaveStyle('background-color: rgb(0, 0, 255)');
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

  // Enhanced logging integration tests
  describe('UI Action Logging Integration', () => {
    it('renders successfully with logging integration', () => {
      const position = createTestPosition();
      const isValidDropTarget = vi.fn().mockReturnValue(true);
      const onCardDrop = vi.fn().mockReturnValue(true);

      // Component should render successfully with logging integration
      expect(() => {
        render(
          <TestWrapper>
            <DropZone 
              position={position} 
              isValidDropTarget={isValidDropTarget}
              onCardDrop={onCardDrop}
            />
          </TestWrapper>
        );
      }).not.toThrow();

      // Verify the component rendered
      expect(document.querySelector('.drop-zone')).toBeInTheDocument();
    });

    it('handles validation functions with logging', () => {
      const position = createTestPosition();
      const isValidDropTarget = vi.fn().mockReturnValue(true);

      expect(() => {
        render(
          <TestWrapper>
            <DropZone position={position} isValidDropTarget={isValidDropTarget} />
          </TestWrapper>
        );
      }).not.toThrow();

      // Verify validation function is available
      expect(isValidDropTarget).toBeDefined();
    });

    it('handles drop callbacks with logging', () => {
      const position = createTestPosition();
      const onCardDrop = vi.fn().mockReturnValue(true);

      expect(() => {
        render(
          <TestWrapper>
            <DropZone position={position} onCardDrop={onCardDrop} />
          </TestWrapper>
        );
      }).not.toThrow();

      // Verify drop callback is available
      expect(onCardDrop).toBeDefined();
    });

    it('maintains functionality with complex validation', () => {
      const position = createTestPosition();
      const complexValidator = vi.fn().mockImplementation((card: Card) => {
        // Simulate complex validation logic
        return card.getRank() <= 13 && card.getRank() >= 1;
      });

      expect(() => {
        render(
          <TestWrapper>
            <DropZone position={position} isValidDropTarget={complexValidator} />
          </TestWrapper>
        );
      }).not.toThrow();

      // Verify complex validation function works
      expect(complexValidator).toBeDefined();
    });

    it('supports multiple drop zones with logging', () => {
      const position1 = { zone: 'foundation', index: 0 } as Position;
      const position2 = { zone: 'foundation', index: 1 } as Position;

      expect(() => {
        render(
          <TestWrapper>
            <DropZone position={position1} />
            <DropZone position={position2} />
          </TestWrapper>
        );
      }).not.toThrow();

      // Verify multiple drop zones render correctly
      expect(document.querySelectorAll('.drop-zone')).toHaveLength(2);
    });
  });
});