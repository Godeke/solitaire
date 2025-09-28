import React, { useState, useCallback, useMemo } from 'react';
import { UIActionEvent, UIActionEventType, MoveValidationResult, ReplayResult } from '../types/UIActionLogging';
import { logUserInteraction, logError } from '../utils/RendererLogger';
import { filterUIActionEvents, prepareVisualizationData, UIActionLogFilterCriteria } from '../utils';
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

const isErrorEvent = (event: UIActionEvent): boolean => {
  const validation = event.data?.validationResult as MoveValidationResult | boolean | undefined;

  if (typeof validation === 'boolean') {
    return validation === false;
  }

  if (validation && typeof validation === 'object') {
    if (validation.isValid === false) {
      return true;
    }
    if (validation.reason && validation.reason.toLowerCase().includes('invalid')) {
      return true;
    }
  }

  if (event.data?.moveSuccess === false) {
    return true;
  }

  return false;
};

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
  const overallVisualization = useMemo(() => prepareVisualizationData(events), [events]);

  const filteredEvents = useMemo(() => {
    if (events.length === 0) {
      return [];
    }

    const criteria: UIActionLogFilterCriteria = {
      eventTypes: filter.eventTypes.length > 0 ? filter.eventTypes : undefined,
      components: filter.components.length > 0 ? filter.components : undefined,
      timeRange: filter.timeRange,
      searchText: filter.searchText || undefined,
      predicate:
        filter.hasErrors === null
          ? undefined
          : (event: UIActionEvent) => {
              const hasError = isErrorEvent(event);
              return filter.hasErrors ? hasError : !hasError;
            }
    };

    return filterUIActionEvents(events, criteria);
  }, [events, filter]);

  const filteredVisualization = useMemo(
    () => prepareVisualizationData(filteredEvents),
    [filteredEvents]
  );

  const statistics = useMemo((): EventStatistics => {
    const overallAnalysis = overallVisualization.analysis;
    const filteredAnalysis = filteredVisualization.analysis;
    const errorCount = filteredEvents.filter(isErrorEvent).length;

    return {
      totalEvents: overallAnalysis.counts.totalEvents,
      eventTypeBreakdown: overallAnalysis.counts.byType,
      componentBreakdown: overallAnalysis.counts.byComponent,
      averageProcessingTime: filteredAnalysis.performance.averageDuration,
      errorCount,
      timeSpan: {
        start: overallAnalysis.timeframe.start ?? '',
        end: overallAnalysis.timeframe.end ?? ''
      }
    };
  }, [overallVisualization, filteredVisualization, filteredEvents]);

  const anomalyPreview = useMemo(() => filteredVisualization.analysis.anomalies.slice(0, 5), [filteredVisualization]);

  const slowEventPreview = useMemo(() => filteredVisualization.analysis.performance.slowEvents.slice(0, 5), [filteredVisualization]);

  const topComponents = useMemo(
    () =>
      filteredVisualization.componentPerformance
        .filter(entry => entry.averageDuration > 0)
        .sort((a, b) => b.averageDuration - a.averageDuration)
        .slice(0, 5),
    [filteredVisualization]
  );

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

      {(anomalyPreview.length > 0 || slowEventPreview.length > 0 || topComponents.length > 0) && (
        <div className="analyzer-insights">
          {anomalyPreview.length > 0 && (
            <div className="insight-panel" data-testid="anomaly-preview">
              <h4>Detected Anomalies</h4>
              <ul>
                {anomalyPreview.map((anomaly, index) => (
                  <li key={`${anomaly.type}-${anomaly.eventId ?? index}`}>
                    <span className="anomaly-type">{anomaly.type}</span>
                    <span className="anomaly-message">{anomaly.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(slowEventPreview.length > 0 || topComponents.length > 0) && (
            <div className="insight-panel" data-testid="performance-preview">
              <h4>Performance Highlights</h4>
              {slowEventPreview.length > 0 && (
                <div className="insight-subsection">
                  <h5>Slow Events</h5>
                  <ul>
                    {slowEventPreview.map(item => (
                      <li key={item.event.id}>
                        <span>{item.event.type} · {item.event.component}</span>
                        <span>{item.durationMs.toFixed(1)}ms</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {topComponents.length > 0 && (
                <div className="insight-subsection">
                  <h5>Average Duration by Component</h5>
                  <ul>
                    {topComponents.map(entry => (
                      <li key={entry.component}>
                        <span>{entry.component}</span>
                        <span>{Number.isFinite(entry.averageDuration) ? entry.averageDuration.toFixed(1) : '0.0'}ms</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

