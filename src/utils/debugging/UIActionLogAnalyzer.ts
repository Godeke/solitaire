import { UIActionEvent, UIActionEventType, MoveValidationResult } from '../../types/UIActionLogging';

export interface UIActionLogAnalysisOptions {
  slowEventThresholdMs?: number;
  inactivityThresholdMs?: number;
  consecutiveFailureThreshold?: number;
}

export interface UIActionTimelineEntry {
  eventId: string;
  timestamp: string;
  type: UIActionEventType;
  component: string;
  durationMs?: number;
  description: string;
  hasStateBefore: boolean;
  hasStateAfter: boolean;
}

export interface UIActionInteractionSequence {
  sequenceId: string;
  component: string;
  interactionType: 'drag' | 'move' | 'click' | 'state' | 'other';
  cardId?: string;
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  events: UIActionEvent[];
  outcome?: 'success' | 'failed' | 'cancelled' | 'unknown';
  validationsFailed: number;
  performanceSummary: {
    sampleCount: number;
    averageDuration: number;
    maxDuration: number;
  };
}

export interface UIActionLogAnomaly {
  type:
    | 'slow-event'
    | 'validation-failure-burst'
    | 'inactivity-gap'
    | 'missing-game-state'
    | 'dropped-interaction'
    | 'sequence-duration-warning';
  eventId?: string;
  timestamp?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface SlowEvent {
  event: UIActionEvent;
  durationMs: number;
  thresholdMs: number;
}

export interface UIActionLogAnalysisReport {
  timeframe: {
    start?: string;
    end?: string;
    durationMs: number;
  };
  counts: {
    totalEvents: number;
    byType: Record<string, number>;
    byComponent: Record<string, number>;
  };
  performance: {
    eventsWithMetrics: number;
    averageDuration: number;
    maxDuration: number;
    slowEvents: SlowEvent[];
  };
  timeline: UIActionTimelineEntry[];
  interactions: UIActionInteractionSequence[];
  anomalies: UIActionLogAnomaly[];
  notes: string[];
}

interface DragSequenceBuilder {
  id: string;
  component: string;
  cardId: string;
  events: UIActionEvent[];
  startTimestamp: string;
}

const DEFAULT_OPTIONS: Required<UIActionLogAnalysisOptions> = {
  slowEventThresholdMs: 150,
  inactivityThresholdMs: 15_000,
  consecutiveFailureThreshold: 3
};

/**
 * Analyze a collection of UI action events and return structured insights for developers.
 */
export function analyzeUIActionEvents(
  events: UIActionEvent[],
  options: UIActionLogAnalysisOptions = {}
): UIActionLogAnalysisReport {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const countsByType: Record<string, number> = {};
  const countsByComponent: Record<string, number> = {};
  const timeline: UIActionTimelineEntry[] = [];
  const anomalies: UIActionLogAnomaly[] = [];
  const slowEvents: SlowEvent[] = [];
  const interactions: UIActionInteractionSequence[] = [];
  const notes: string[] = [];

  let metricsCount = 0;
  let metricsDurationTotal = 0;
  let metricsMaxDuration = 0;

  let previousTimestampMs: number | null = null;
  let previousEvent: UIActionEvent | null = null;

  const failureTracker = new Map<string, number>();
  const activeDragSequences = new Map<string, DragSequenceBuilder>();

  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];

  for (const event of sorted) {
    countsByType[event.type] = (countsByType[event.type] || 0) + 1;
    countsByComponent[event.component] = (countsByComponent[event.component] || 0) + 1;

    const timestampMs = safeParseTimestamp(event.timestamp);

    if (previousTimestampMs !== null && timestampMs !== null) {
      const gap = timestampMs - previousTimestampMs;
      if (gap > config.inactivityThresholdMs) {
        anomalies.push({
          type: 'inactivity-gap',
          eventId: event.id,
          timestamp: event.timestamp,
          message: `Inactivity gap of ${(gap / 1000).toFixed(1)}s detected between events`,
          metadata: {
            gapMs: gap,
            previousEventId: previousEvent?.id
          }
        });
      }
    }

    const interactionType = deriveInteractionType(event);
    const hasStateBefore = Boolean(event.gameStateBefore);
    const hasStateAfter = Boolean(event.gameStateAfter);

    timeline.push({
      eventId: event.id,
      timestamp: event.timestamp,
      type: event.type,
      component: event.component,
      durationMs: event.performance?.operationDuration,
      description: describeEvent(event),
      hasStateBefore,
      hasStateAfter
    });

    const duration = event.performance?.operationDuration;
    if (typeof duration === 'number') {
      metricsCount += 1;
      metricsDurationTotal += duration;
      metricsMaxDuration = Math.max(metricsMaxDuration, duration);

      if (duration > config.slowEventThresholdMs) {
        slowEvents.push({ event, durationMs: duration, thresholdMs: config.slowEventThresholdMs });
        anomalies.push({
          type: 'slow-event',
          eventId: event.id,
          timestamp: event.timestamp,
          message: `${event.type} exceeded slow-event threshold (${duration}ms)`,
          metadata: {
            durationMs: duration,
            thresholdMs: config.slowEventThresholdMs,
            component: event.component
          }
        });
      }
    }

    if (requiresGameState(event.type) && !hasStateAfter) {
      anomalies.push({
        type: 'missing-game-state',
        eventId: event.id,
        timestamp: event.timestamp,
        message: `${event.type} did not capture a post-event game state snapshot`,
        metadata: {
          component: event.component,
          type: event.type
        }
      });
    }

    trackValidationFailures(event, config.consecutiveFailureThreshold, failureTracker, anomalies);

    if (interactionType === 'drag' && event.data.card?.id) {
      handleDragInteraction(event, activeDragSequences, interactions, anomalies, config);
    } else {
      interactions.push(buildSingleEventInteraction(event, interactionType));
    }

    previousTimestampMs = timestampMs;
    previousEvent = event;
  }

  if (activeDragSequences.size > 0) {
    for (const sequence of activeDragSequences.values()) {
      const durationMs = computeDuration(sequence.startTimestamp, sequence.events[sequence.events.length - 1]?.timestamp);
      anomalies.push({
        type: 'dropped-interaction',
        message: 'Drag sequence did not complete with drop or cancel event',
        eventId: sequence.events[sequence.events.length - 1]?.id,
        timestamp: sequence.events[sequence.events.length - 1]?.timestamp,
        metadata: {
          cardId: sequence.cardId,
          component: sequence.component,
          durationMs,
          eventsCaptured: sequence.events.length
        }
      });
      interactions.push(finalizeDragSequence(sequence, sequence.events[sequence.events.length - 1]));
    }
  }

  if (slowEvents.length === 0) {
    notes.push('No slow events detected with current thresholds.');
  }
  if (metricsCount === 0) {
    notes.push('No performance metrics were captured in the provided events.');
  }

  const timeframe = {
    start: firstEvent?.timestamp,
    end: lastEvent?.timestamp,
    durationMs: computeDuration(firstEvent?.timestamp, lastEvent?.timestamp)
  };

  return {
    timeframe,
    counts: {
      totalEvents: sorted.length,
      byType: countsByType,
      byComponent: countsByComponent
    },
    performance: {
      eventsWithMetrics: metricsCount,
      averageDuration: metricsCount > 0 ? metricsDurationTotal / metricsCount : 0,
      maxDuration: metricsMaxDuration,
      slowEvents
    },
    timeline,
    interactions: interactions.sort((a, b) => a.startTimestamp.localeCompare(b.startTimestamp)),
    anomalies,
    notes
  };
}

function safeParseTimestamp(timestamp: string | undefined): number | null {
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

function deriveInteractionType(event: UIActionEvent): UIActionInteractionSequence['interactionType'] {
  switch (event.type) {
    case UIActionEventType.DRAG_START:
    case UIActionEventType.DRAG_HOVER:
    case UIActionEventType.DRAG_DROP:
    case UIActionEventType.DRAG_CANCEL:
      return 'drag';
    case UIActionEventType.MOVE_ATTEMPT:
    case UIActionEventType.MOVE_EXECUTED:
    case UIActionEventType.MOVE_VALIDATED:
    case UIActionEventType.AUTO_MOVE:
      return 'move';
    case UIActionEventType.CARD_CLICK:
    case UIActionEventType.BUTTON_CLICK:
    case UIActionEventType.ZONE_CLICK:
      return 'click';
    case UIActionEventType.STATE_CHANGE:
    case UIActionEventType.CARD_FLIP:
    case UIActionEventType.SCORE_UPDATE:
    case UIActionEventType.WIN_CONDITION:
      return 'state';
    default:
      return 'other';
  }
}

function requiresGameState(type: UIActionEventType): boolean {
  return (
    type === UIActionEventType.MOVE_EXECUTED ||
    type === UIActionEventType.MOVE_VALIDATED ||
    type === UIActionEventType.STATE_CHANGE ||
    type === UIActionEventType.WIN_CONDITION
  );
}

function trackValidationFailures(
  event: UIActionEvent,
  threshold: number,
  tracker: Map<string, number>,
  anomalies: UIActionLogAnomaly[]
): void {
  const validation = event.data?.validationResult as MoveValidationResult | undefined;
  const key = event.component;

  if (validation && validation.isValid === false) {
    const nextCount = (tracker.get(key) || 0) + 1;
    tracker.set(key, nextCount);
    if (nextCount >= threshold) {
      anomalies.push({
        type: 'validation-failure-burst',
        eventId: event.id,
        timestamp: event.timestamp,
        message: `${nextCount} consecutive validation failures detected in ${event.component}`,
        metadata: {
          component: event.component,
          threshold,
          lastReason: validation.reason,
          violations: validation.ruleViolations
        }
      });
    }
  } else if (event.type === UIActionEventType.MOVE_EXECUTED || event.type === UIActionEventType.MOVE_VALIDATED) {
    tracker.set(key, 0);
  }
}

function handleDragInteraction(
  event: UIActionEvent,
  activeSequences: Map<string, DragSequenceBuilder>,
  interactions: UIActionInteractionSequence[],
  anomalies: UIActionLogAnomaly[],
  config: Required<UIActionLogAnalysisOptions>
): void {
  const cardId = event.data.card?.id;
  if (!cardId) {
    interactions.push(buildSingleEventInteraction(event, 'drag'));
    return;
  }

  let builder = activeSequences.get(cardId);
  if (!builder) {
    builder = {
      id: `drag-${cardId}-${event.timestamp}`,
      component: event.component,
      cardId,
      events: [],
      startTimestamp: event.timestamp
    };
    activeSequences.set(cardId, builder);
  }

  builder.events.push(event);

  if (event.type === UIActionEventType.DRAG_DROP || event.type === UIActionEventType.DRAG_CANCEL) {
    const sequence = finalizeDragSequence(builder, event);
    interactions.push(sequence);
    activeSequences.delete(cardId);

    if (sequence.durationMs > config.inactivityThresholdMs) {
      anomalies.push({
        type: 'sequence-duration-warning',
        eventId: event.id,
        timestamp: event.timestamp,
        message: `Drag sequence for card ${sequence.cardId} took ${(sequence.durationMs / 1000).toFixed(1)}s`,
        metadata: {
          component: sequence.component,
          durationMs: sequence.durationMs,
          eventsCaptured: sequence.events.length
        }
      });
    }
  }
}

function finalizeDragSequence(builder: DragSequenceBuilder, closingEvent: UIActionEvent): UIActionInteractionSequence {
  const endTimestamp = closingEvent.timestamp;
  const durationMs = computeDuration(builder.startTimestamp, endTimestamp);
  const validationsFailed = builder.events.filter(evt => evt.data?.validationResult?.isValid === false).length;
  const performanceSummary = summarizePerformance(builder.events);

  let outcome: UIActionInteractionSequence['outcome'] = 'unknown';
  if (closingEvent.type === UIActionEventType.DRAG_DROP) {
    const validation = closingEvent.data?.validationResult as MoveValidationResult | undefined;
    if (validation) {
      outcome = validation.isValid ? 'success' : 'failed';
    } else {
      outcome = 'success';
    }
  } else if (closingEvent.type === UIActionEventType.DRAG_CANCEL) {
    outcome = 'cancelled';
  }

  return {
    sequenceId: builder.id,
    component: builder.component,
    interactionType: 'drag',
    cardId: builder.cardId,
    startTimestamp: builder.startTimestamp,
    endTimestamp,
    durationMs,
    events: [...builder.events],
    outcome,
    validationsFailed,
    performanceSummary
  };
}

function buildSingleEventInteraction(
  event: UIActionEvent,
  interactionType: UIActionInteractionSequence['interactionType']
): UIActionInteractionSequence {
  const performanceSummary = summarizePerformance([event]);
  const validationFailed = event.data?.validationResult?.isValid === false ? 1 : 0;
  let outcome: UIActionInteractionSequence['outcome'] = 'unknown';

  if (interactionType === 'move') {
    if (event.type === UIActionEventType.MOVE_EXECUTED) {
      outcome = event.data?.moveSuccess === false ? 'failed' : 'success';
    } else if (event.type === UIActionEventType.MOVE_ATTEMPT && validationFailed) {
      outcome = 'failed';
    }
  }

  if (interactionType === 'click') {
    outcome = 'success';
  }

  return {
    sequenceId: event.id,
    component: event.component,
    interactionType,
    cardId: event.data?.card?.id,
    startTimestamp: event.timestamp,
    endTimestamp: event.timestamp,
    durationMs: 0,
    events: [event],
    outcome,
    validationsFailed: validationFailed,
    performanceSummary
  };
}

function summarizePerformance(events: UIActionEvent[]): {
  sampleCount: number;
  averageDuration: number;
  maxDuration: number;
} {
  const durations = events
    .map(evt => evt.performance?.operationDuration)
    .filter((duration): duration is number => typeof duration === 'number');

  if (durations.length === 0) {
    return {
      sampleCount: 0,
      averageDuration: 0,
      maxDuration: 0
    };
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: durations.length,
    averageDuration: total / durations.length,
    maxDuration: Math.max(...durations)
  };
}

function computeDuration(start?: string, end?: string): number {
  const startMs = safeParseTimestamp(start ?? '');
  const endMs = safeParseTimestamp(end ?? '');

  if (startMs === null || endMs === null) {
    return 0;
  }

  return Math.max(0, endMs - startMs);
}

function describeEvent(event: UIActionEvent): string {
  const parts = [event.component, event.type];

  if (event.data?.card?.id) {
    parts.push(`card=${event.data.card.id}`);
  }
  if (event.data?.moveType) {
    parts.push(`move=${event.data.moveType}`);
  }
  if (event.data?.validationResult !== undefined) {
    const validation = event.data.validationResult as MoveValidationResult | boolean;
    const isValid = typeof validation === 'boolean' ? validation : validation.isValid;
    parts.push(`valid=${isValid}`);
  }
  if (typeof event.performance?.operationDuration === 'number') {
    parts.push(`duration=${event.performance.operationDuration}ms`);
  }

  return parts.join(' | ');
}

