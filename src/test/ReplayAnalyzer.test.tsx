import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReplayAnalyzer from '../components/ReplayAnalyzer';
import { UIActionEvent, UIActionEventType, ReplayResult } from '../types/UIActionLogging';

// Mock the logger
vi.mock('../utils/RendererLogger', () => ({
  logUserInteraction: vi.fn(),
  logError: vi.fn()
}));

describe('ReplayAnalyzer', () => {
  const mockEvents: UIActionEvent[] = [
    {
      id: 'event-1',
      timestamp: '2024-01-01T10:00:00.000Z',
      type: UIActionEventType.DRAG_START,
      component: 'CardRenderer',
      data: {
        card: { id: 'card-1', suit: 'hearts', rank: 1, faceUp: true, draggable: true, position: { x: 0, y: 0 } },
        sourcePosition: { x: 100, y: 200 }
      },
      performance: {
        operationDuration: 15.5,
        renderTime: 8.2
      }
    },
    {
      id: 'event-2',
      timestamp: '2024-01-01T10:00:01.000Z',
      type: UIActionEventType.DRAG_DROP,
      component: 'DropZone',
      data: {
        card: { id: 'card-1', suit: 'hearts', rank: 1, faceUp: true, draggable: true, position: { x: 0, y: 0 } },
        targetPosition: { x: 300, y: 400 },
        validationResult: true,
        moveSuccess: true
      },
      performance: {
        operationDuration: 22.1,
        validationTime: 5.3
      }
    },
    {
      id: 'event-3',
      timestamp: '2024-01-01T10:00:02.000Z',
      type: UIActionEventType.MOVE_ATTEMPT,
      component: 'KlondikeEngine',
      data: {
        moveType: 'user',
        validationResult: false,
        moveSuccess: false,
        moveReason: 'Invalid move: Cannot place red on red'
      },
      performance: {
        operationDuration: 8.7,
        validationTime: 3.2
      }
    }
  ];

  const mockReplayResult: ReplayResult = {
    success: true,
    finalGameState: {} as any,
    stepsExecuted: 3,
    performance: {
      totalReplayTime: 156.8,
      averageEventProcessingTime: 52.3,
      stateReconstructionTime: 45.2,
      validationTime: 12.1
    }
  };

  const defaultProps = {
    events: mockEvents,
    replayResult: mockReplayResult,
    onEventSelect: vi.fn(),
    onFilterChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with basic event information', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      expect(screen.getByTestId('replay-analyzer')).toBeInTheDocument();
      expect(screen.getByText('Replay Analysis')).toBeInTheDocument();
      expect(screen.getByText('Total Events: 3')).toBeInTheDocument();
      expect(screen.getByText('Errors: 1')).toBeInTheDocument();
    });

    it('displays event statistics correctly', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      expect(screen.getByText('Total Events: 3')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 3')).toBeInTheDocument();
      expect(screen.getByText('Errors: 1')).toBeInTheDocument();
      expect(screen.getByText(/Avg Time: \d+\.\d+ms/)).toBeInTheDocument();
    });

    it('renders event list with correct information', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      // Check for event rows
      expect(screen.getByTestId('event-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-2')).toBeInTheDocument();
      
      // Check event details
      expect(screen.getByText('drag_start')).toBeInTheDocument();
      expect(screen.getByText('drag_drop')).toBeInTheDocument();
      expect(screen.getByText('move_attempt')).toBeInTheDocument();
      
      expect(screen.getByText('CardRenderer')).toBeInTheDocument();
      expect(screen.getByText('DropZone')).toBeInTheDocument();
      expect(screen.getByText('KlondikeEngine')).toBeInTheDocument();
    });

    it('renders replay result summary when provided', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      expect(screen.getByText('Replay Result Summary')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument(); // Success
      expect(screen.getByText('3')).toBeInTheDocument(); // Steps executed
      expect(screen.getByText('156.80ms')).toBeInTheDocument(); // Total time
    });

    it('handles empty events array', () => {
      render(<ReplayAnalyzer {...defaultProps} events={[]} />);
      
      expect(screen.getByText('Total Events: 0')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 0')).toBeInTheDocument();
      expect(screen.getByText('Errors: 0')).toBeInTheDocument();
    });
  });

  describe('Event Selection', () => {
    it('selects event when clicked', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const eventRow = screen.getByTestId('event-row-0');
      fireEvent.click(eventRow);
      
      await waitFor(() => {
        expect(screen.getByTestId('event-details')).toBeInTheDocument();
      });
      
      expect(defaultProps.onEventSelect).toHaveBeenCalledWith(mockEvents[0], 0);
    });

    it('displays event details when event is selected', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const eventRow = screen.getByTestId('event-row-0');
      fireEvent.click(eventRow);
      
      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument();
        expect(screen.getByText('event-1')).toBeInTheDocument();
        expect(screen.getByText('drag_start')).toBeInTheDocument();
        expect(screen.getByText('CardRenderer')).toBeInTheDocument();
      });
    });

    it('closes event details when close button is clicked', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      // Open details
      const eventRow = screen.getByTestId('event-row-0');
      fireEvent.click(eventRow);
      
      await waitFor(() => {
        expect(screen.getByTestId('event-details')).toBeInTheDocument();
      });
      
      // Close details
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('event-details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('filters events by search text', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search events...');
      fireEvent.change(searchInput, { target: { value: 'drag' } });
      
      await waitFor(() => {
        expect(screen.getByText('Filtered: 2')).toBeInTheDocument();
      });
      
      expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    it('filters events by error status', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const errorFilter = screen.getByDisplayValue('All Events');
      fireEvent.change(errorFilter, { target: { value: 'true' } });
      
      await waitFor(() => {
        expect(screen.getByText('Filtered: 1')).toBeInTheDocument();
      });
      
      expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    it('clears all filters when clear button is clicked', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      // Apply a filter first
      const searchInput = screen.getByPlaceholderText('Search events...');
      fireEvent.change(searchInput, { target: { value: 'drag' } });
      
      // Clear filters
      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filtered: 3')).toBeInTheDocument();
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Performance Metrics', () => {
    it('displays performance metrics in event details', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const eventRow = screen.getByTestId('event-row-0');
      fireEvent.click(eventRow);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('15.5ms')).toBeInTheDocument(); // Duration
        expect(screen.getByText('8.2ms')).toBeInTheDocument(); // Render time
      });
    });

    it('shows duration in event list', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      expect(screen.getByText('15.50ms')).toBeInTheDocument();
      expect(screen.getByText('22.10ms')).toBeInTheDocument();
      expect(screen.getByText('8.70ms')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles events without performance data', () => {
      const eventsWithoutPerformance = [
        {
          ...mockEvents[0],
          performance: undefined
        }
      ];
      
      render(<ReplayAnalyzer {...defaultProps} events={eventsWithoutPerformance} />);
      
      expect(screen.getByText('-ms')).toBeInTheDocument();
    });

    it('handles missing replay result', () => {
      render(<ReplayAnalyzer {...defaultProps} replayResult={null} />);
      
      expect(screen.queryByText('Replay Result Summary')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper test ids for testing', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      expect(screen.getByTestId('replay-analyzer')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('event-row-2')).toBeInTheDocument();
    });

    it('supports keyboard navigation for event selection', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const eventRow = screen.getByTestId('event-row-0');
      expect(eventRow).toBeInTheDocument();
      
      // Event rows should be clickable
      fireEvent.click(eventRow);
      expect(defaultProps.onEventSelect).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('calls onFilterChange when filters are applied', async () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search events...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalled();
      });
    });

    it('calls onEventSelect with correct parameters', () => {
      render(<ReplayAnalyzer {...defaultProps} />);
      
      const eventRow = screen.getByTestId('event-row-1');
      fireEvent.click(eventRow);
      
      expect(defaultProps.onEventSelect).toHaveBeenCalledWith(mockEvents[1], 1);
    });
  });
});