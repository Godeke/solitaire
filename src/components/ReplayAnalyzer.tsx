import React, { useState, useCallback, useMemo } from 'react';
import { UIActionEvent, UIActionEventType, ReplayResult } from '../types/UIActionLogging';
import { logUserInteraction, logError } from '../utils/RendererLogger';
import './ReplayAnalyzer.css';

export interface ReplayAnalyzerProps {
  events: UIActionEvent[];
  replayResult?: ReplayResult | null;
  onEventSelect?: (event: UIActionEvent, index: number) => void;
  onFilterChange?: (filteredEvents: UIActionEvent[]) => void;
  className?: string;
}

interface EventFilter {
  eventTypes: UIActionEventType[];
  components: string[];
  timeRange: { start?: string; end?: string };
  hasErrors: boolean | null;
  searchText: string;
}

interface EventStatistics {
  totalEvents: number;
  eventTypeBreakdown: Record<string, number>;
  componentBreakdown: Record<string, number>;
  averageProcessingTime: number;
  errorCount: number;
  timeSpan: { start: string; end: string };
}

export const ReplayAnalyzer: React.FC<ReplayAnalyzerProps> = ({
  events,
  replayResult,
  onEventSelect,
  onFilterChange,
  className = ''
}) => {
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [filter, setFilter] = useState<EventFilter>({
    eventTypes: [],
    components: [],
    timeRange: {},
    hasErrors: null,
    searchText: ''
  });

  // Calculate event statistics
  const statistics = useMemo((): EventStatistics => {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        eventTypeBreakdown: {},
        componentBreakdown: {},
        averageProcessingTime: 0,
        errorCount: 0,
        timeSpan: { start: '', end: '' }
      };
    }

    const eventTypeBreakdown: Record<string, number> = {};
    const componentBreakdown: Record<string, number> = {};
    let totalProcessingTime = 0;
    let errorCount = 0;

    events.forEach(event => {
      // Count event types
      eventTypeBreakdown[event.type] = (eventTypeBreakdown[event.type] || 0) + 1;
      
      // Count components
      componentBreakdown[event.component] = (componentBreakdown[event.component] || 0) + 1;
      
      // Sum processing times
      if (event.performance?.operationDuration) {
        totalProcessingTime += event.performance.operationDuration;
      }
      
      // Count errors (events with validation failures or error data)
      if (event.data.validationResult === false || event.type.includes('error')) {
        errorCount++;
      }
    });

    return {
      totalEvents: events.length,
      eventTypeBreakdown,
      componentBreakdown,
      averageProcessingTime: totalProcessingTime / events.length,
      errorCount,
      timeSpan: {
        start: events[0]?.timestamp || '',
        end: events[events.length - 1]?.timestamp || ''
      }
    };
  }, [events]);

  // Filter events based on current filter settings
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by event types
    if (filter.eventTypes.length > 0) {
      filtered = filtered.filter(event => filter.eventTypes.includes(event.type));
    }

    // Filter by components
    if (filter.components.length > 0) {
      filtered = filtered.filter(event => filter.components.includes(event.component));
    }

    // Filter by time range
    if (filter.timeRange.start) {
      filtered = filtered.filter(event => event.timestamp >= filter.timeRange.start!);
    }
    if (filter.timeRange.end) {
      filtered = filtered.filter(event => event.timestamp <= filter.timeRange.end!);
    }

    // Filter by error status
    if (filter.hasErrors !== null) {
      filtered = filtered.filter(event => {
        const hasError = event.data.validationResult === false || event.type.includes('error');
        return filter.hasErrors ? hasError : !hasError;
      });
    }

    // Filter by search text
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter(event => 
        event.type.toLowerCase().includes(searchLower) ||
        event.component.toLowerCase().includes(searchLower) ||
        JSON.stringify(event.data).toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [events, filter]);

  // Notify parent of filter changes
  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filteredEvents);
    }
  }, [filteredEvents, onFilterChange]);

  const handleEventClick = useCallback((event: UIActionEvent, index: number) => {
    try {
      setSelectedEventIndex(index);
      setShowEventDetails(true);
      
      logUserInteraction('Event selected in replay analyzer', 'ReplayAnalyzer', {
        eventType: event.type,
        eventIndex: index,
        component: event.component
      });

      if (onEventSelect) {
        onEventSelect(event, index);
      }
    } catch (error) {
      logError(error as Error, 'ReplayAnalyzer.handleEventClick');
    }
  }, [onEventSelect]);

  const handleFilterChange = useCallback((newFilter: Partial<EventFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilter({
      eventTypes: [],
      components: [],
      timeRange: {},
      hasErrors: null,
      searchText: ''
    });
  }, []);

  const selectedEvent = selectedEventIndex !== null ? filteredEvents[selectedEventIndex] : null;

  return (
    <div className={`replay-analyzer ${className}`} data-testid="replay-analyzer">
      <div className="analyzer-header">
        <h3>Replay Analysis</h3>
        <div className="analyzer-stats">
          <span>Total Events: {statistics.totalEvents}</span>
          <span>Filtered: {filteredEvents.length}</span>
          <span>Errors: {statistics.errorCount}</span>
          <span>Avg Time: {statistics.averageProcessingTime.toFixed(2)}ms</span>
        </div>
      </div>

      <div className="analyzer-filters">
        <div className="filter-row">
          <input
            type="text"
            placeholder="Search events..."
            value={filter.searchText}
            onChange={(e) => handleFilterChange({ searchText: e.target.value })}
            className="search-input"
          />
          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        </div>

        <div className="filter-row">
          <select
            multiple
            value={filter.eventTypes}
            onChange={(e) => handleFilterChange({ 
              eventTypes: Array.from(e.target.selectedOptions, option => option.value as UIActionEventType)
            })}
            className="filter-select"
          >
            {Object.keys(statistics.eventTypeBreakdown).map(type => (
              <option key={type} value={type}>
                {type} ({statistics.eventTypeBreakdown[type]})
              </option>
            ))}
          </select>

          <select
            multiple
            value={filter.components}
            onChange={(e) => handleFilterChange({ 
              components: Array.from(e.target.selectedOptions, option => option.value)
            })}
            className="filter-select"
          >
            {Object.keys(statistics.componentBreakdown).map(component => (
              <option key={component} value={component}>
                {component} ({statistics.componentBreakdown[component]})
              </option>
            ))}
          </select>

          <select
            value={filter.hasErrors === null ? '' : filter.hasErrors.toString()}
            onChange={(e) => handleFilterChange({ 
              hasErrors: e.target.value === '' ? null : e.target.value === 'true'
            })}
            className="filter-select"
          >
            <option value="">All Events</option>
            <option value="true">Errors Only</option>
            <option value="false">Success Only</option>
          </select>
        </div>
      </div>

      <div className="analyzer-content">
        <div className="events-list">
          <div className="events-header">
            <span>Time</span>
            <span>Type</span>
            <span>Component</span>
            <span>Status</span>
            <span>Duration</span>
          </div>
          
          <div className="events-body">
            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className={`event-row ${selectedEventIndex === index ? 'selected' : ''} ${
                  event.data.validationResult === false ? 'error' : 'success'
                }`}
                onClick={() => handleEventClick(event, index)}
                data-testid={`event-row-${index}`}
              >
                <span className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="event-type">
                  {selectedEventIndex === index ? `${event.type} (selected)` : event.type}
                </span>
                <span className="event-component">
                  {selectedEventIndex === index ? `${event.component} (selected)` : event.component}
                </span>
                <span className={`event-status ${event.data.validationResult === false ? 'error' : 'success'}`}>
                  {event.data.validationResult === false ? 'Error' : 'Success'}
                </span>
                <span className="event-duration">
                  {event.performance?.operationDuration?.toFixed(2) || '-'}ms
                </span>
              </div>
            ))}
          </div>
        </div>

        {showEventDetails && selectedEvent && (
          <div className="event-details" data-testid="event-details">
            <div className="details-header">
              <h4>Event Details</h4>
              <button 
                onClick={() => setShowEventDetails(false)}
                className="close-details-btn"
              >
                ×
              </button>
            </div>
            
            <div className="details-content">
              <div className="detail-section">
                <h5>Basic Information</h5>
                <div className="detail-grid">
                  <span>ID:</span><span>{selectedEvent.id}</span>
                  <span>Type:</span><span>{selectedEvent.type}</span>
                  <span>Component:</span><span>{selectedEvent.component}</span>
                  <span>Timestamp:</span><span>{selectedEvent.timestamp}</span>
                </div>
              </div>

              <div className="detail-section">
                <h5>Event Data</h5>
                <pre className="json-display">
                  {JSON.stringify(selectedEvent.data, null, 2)}
                </pre>
              </div>

              {selectedEvent.performance && (
                <div className="detail-section">
                  <h5>Performance Metrics</h5>
                  <div className="detail-grid">
                    <span>Duration:</span><span>{selectedEvent.performance.operationDuration}ms</span>
                    {selectedEvent.performance.renderTime && (
                      <>
                        <span>Render Time:</span><span>{selectedEvent.performance.renderTime}ms</span>
                      </>
                    )}
                    {selectedEvent.performance.validationTime && (
                      <>
                        <span>Validation Time:</span><span>{selectedEvent.performance.validationTime}ms</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedEvent.gameStateBefore && (
                <div className="detail-section">
                  <h5>Game State Before</h5>
                  <pre className="json-display">
                    {JSON.stringify(selectedEvent.gameStateBefore, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.gameStateAfter && (
                <div className="detail-section">
                  <h5>Game State After</h5>
                  <pre className="json-display">
                    {JSON.stringify(selectedEvent.gameStateAfter, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {replayResult && (
        <div className="replay-result-summary">
          <h4>Replay Result Summary</h4>
          <div className="result-grid">
            <span>Success:</span><span className={replayResult.success ? 'success' : 'error'}>
              {replayResult.success ? 'Yes' : 'No'}
            </span>
            <span>Steps Executed:</span><span>{replayResult.stepsExecuted}</span>
            <span>Total Time:</span><span>{replayResult.performance.totalReplayTime.toFixed(2)}ms</span>
            <span>Avg Step Time:</span><span>{replayResult.performance.averageEventProcessingTime.toFixed(2)}ms</span>
            {replayResult.errors && replayResult.errors.length > 0 && (
              <>
                <span>Errors:</span><span className="error">{replayResult.errors.length}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplayAnalyzer;
