import { describe, it, expect } from 'vitest';
import {
  analyzeUIActionEvents,
  UIActionLogAnalysisReport
} from '../utils/debugging/UIActionLogAnalyzer';
import { UIActionEvent, UIActionEventType, MoveValidationResult } from '../types/UIActionLogging';

interface EventFactoryOptions {
  id?: string;
  type?: UIActionEventType;
  component?: string;
  offsetMs?: number;
  data?: Partial<UIActionEvent['data']>;
  performanceMs?: number;
  gameStateAfter?: UIActionEvent['gameStateAfter'];
}

const baseTimestamp = Date.parse('2025-01-01T00:00:00.000Z');
let eventCounter = 0;

const baseCard = {
  id: 'card-1',
  suit: 'hearts',
  rank: 1,
  faceUp: true,
  draggable: true,
  position: { x: 0, y: 0, zone: 'tableau-0' }
};

function makeEvent(options: EventFactoryOptions): UIActionEvent {
  const {
    id = `event-${eventCounter++}`,
    type = UIActionEventType.DRAG_START,
    component = 'CardRenderer',
    offsetMs = 0,
    data = {},
    performanceMs,
    gameStateAfter
  } = options;

  const timestamp = new Date(baseTimestamp + offsetMs).toISOString();

  return {
    id,
    timestamp,
    type,
    component,
    data: {
      card: baseCard,
      ...data
    },
    performance: typeof performanceMs === 'number'
      ? { operationDuration: performanceMs }
      : undefined,
    gameStateAfter
  } as UIActionEvent;
}

describe('UIActionLogAnalyzer', () => {
  it('identifies slow events, anomalies, and interaction sequences', () => {
    const invalidValidation: MoveValidationResult = {
      isValid: false,
      reason: 'Rule violation',
      validationTime: 5
    };

    const events: UIActionEvent[] = [
      makeEvent({
        id: 'drag-start',
        type: UIActionEventType.DRAG_START,
        component: 'CardRenderer',
        offsetMs: 0
      }),
      makeEvent({
        id: 'drag-drop',
        type: UIActionEventType.DRAG_DROP,
        component: 'CardRenderer',
        offsetMs: 120,
        data: {
          validationResult: invalidValidation
        },
        performanceMs: 220
      }),
      makeEvent({
        id: 'move-attempt-1',
        type: UIActionEventType.MOVE_ATTEMPT,
        component: 'GameManager',
        offsetMs: 260,
        data: {
          validationResult: invalidValidation
        },
        performanceMs: 35
      }),
      makeEvent({
        id: 'move-attempt-2',
        type: UIActionEventType.MOVE_ATTEMPT,
        component: 'GameManager',
        offsetMs: 280,
        data: {
          validationResult: invalidValidation
        },
        performanceMs: 30
      }),
      makeEvent({
        id: 'move-executed',
        type: UIActionEventType.MOVE_EXECUTED,
        component: 'GameManager',
        offsetMs: 320,
        data: {
          moveSuccess: false
        },
        performanceMs: 40,
        gameStateAfter: undefined
      })
    ];

    const report: UIActionLogAnalysisReport = analyzeUIActionEvents(events, {
      slowEventThresholdMs: 100,
      consecutiveFailureThreshold: 2
    });

    expect(report.counts.totalEvents).toBe(5);
    expect(report.performance.slowEvents).toHaveLength(1);
    expect(report.performance.slowEvents[0].event.id).toBe('drag-drop');

    const anomalyTypes = report.anomalies.map(anomaly => anomaly.type);
    expect(anomalyTypes).toContain('slow-event');
    expect(anomalyTypes).toContain('validation-failure-burst');
    expect(anomalyTypes).toContain('missing-game-state');

    const dragSequence = report.interactions.find(sequence => sequence.interactionType === 'drag');
    expect(dragSequence).toBeDefined();
    expect(dragSequence?.events).toHaveLength(2);
    expect(dragSequence?.outcome).toBe('failed');
  });
});
