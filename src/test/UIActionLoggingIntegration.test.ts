import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIActionLogger } from '../utils/UIActionLogger';
import { GameStateSnapshotManager } from '../utils/GameStateSnapshot';
import { Card } from '../utils/Card';
import { GameState, Position, Rank, Move } from '../types/card';
import {
  UIActionEvent,
  UIActionEventType,
  MoveValidationResult,
  PerformanceMetrics
} from '../types/UIActionLogging';
import { analyzeUIActionEvents } from '../utils/debugging/UIActionLogAnalyzer';
import { filterUIActionEvents, searchUIActionEvents } from '../utils/debugging/UIActionLogFilter';
import { generateReplayTestCases } from '../utils/debugging/UIActionLogTestGenerator';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';

const mockRendererLoggerInstance = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(() => 0),
  getPerformanceMetrics: vi.fn(() => ({
    count: 0,
    totalDuration: 0,
    averageDuration: 0,
    maxDuration: 0
  }))
}));
const logGameActionMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const logPerformanceMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/RendererLogger', () => ({
  RendererLogger: class MockRendererLogger {
    static getInstance() {
      return mockRendererLoggerInstance;
    }

    constructor() {
      return mockRendererLoggerInstance;
    }
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  logGameAction: logGameActionMock,
  logError: logErrorMock,
  logPerformance: logPerformanceMock
}));

let activeLogger: UIActionLogger | null = null;

const resetMockLogger = () => {
  Object.values(mockRendererLoggerInstance).forEach(value => {
    if (typeof value === 'function' && 'mockClear' in value) {
      (value as unknown as { mockClear: () => void }).mockClear();
    }
  });
  logGameActionMock.mockClear();
  logErrorMock.mockClear();
  logPerformanceMock.mockClear();
};

const cloneEvents = (events: UIActionEvent[]): UIActionEvent[] =>
  events.map(event => JSON.parse(JSON.stringify(event)) as UIActionEvent);

interface RecordedSession {
  logger: UIActionLogger;
  events: UIActionEvent[];
  initialState: GameState;
  finalState: GameState;
}

const recordSampleSession = (): RecordedSession => {
  const logger = UIActionLogger.getInstance();
  activeLogger = logger;
  GameStateSnapshotManager.resetSequenceCounter();
  logger.clearEventBuffer();

  const baseCard = new Card('hearts', 1 as Rank, true);
  baseCard.id = 'card-ace-hearts';
  baseCard.setPosition({ zone: 'tableau', index: 0, cardIndex: 0 });
  baseCard.setDraggable(true);

  const sourcePosition: Position = { zone: 'tableau', index: 0, cardIndex: 0 };
  const targetPosition: Position = { zone: 'foundation', index: 0, cardIndex: 0 };

  const initialState: GameState = {
    gameType: 'klondike',
    tableau: [[baseCard.clone()], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [],
    moves: [],
    score: 0,
    timeStarted: new Date('2024-01-01T00:00:00.000Z')
  };

  logger.setCurrentGameState(initialState);

  const validation: MoveValidationResult = {
    isValid: true,
    reason: 'Foundation accepts Ace',
    validationTime: 6
  };

  const advance = (ms = 25) => {
    vi.advanceTimersByTime(ms);
  };

  advance();
  const dragStartPerf: PerformanceMetrics = { operationDuration: 18, renderTime: 4, stateUpdateTime: 2 };
  logger.logDragStart('CardRenderer', baseCard, sourcePosition, dragStartPerf);

  advance();
  const hoverPerf: PerformanceMetrics = { operationDuration: 95, validationTime: 6 };
  logger.logDragHover('DropZone', baseCard, targetPosition, validation, hoverPerf);

  advance();
  const attemptPerf: PerformanceMetrics = { operationDuration: 110, validationTime: 6, stateUpdateTime: 8 };
  const moveAttempt = logger.logMoveAttempt('GameEngine', sourcePosition, targetPosition, [baseCard], validation, attemptPerf);
  moveAttempt.gameStateBefore = GameStateSnapshotManager.createSnapshot(
    initialState,
    'before_move_attempt',
    'GameEngine.move_attempt'
  );

  advance();
  const dropPerf: PerformanceMetrics = { operationDuration: 240, validationTime: 6, stateUpdateTime: 14, renderTime: 65, memoryUsage: 50_000 };
  const dropEvent = logger.logDragDrop('DropZone', baseCard, sourcePosition, targetPosition, validation, dropPerf);
  dropEvent.gameStateBefore = dropEvent.gameStateBefore ?? GameStateSnapshotManager.createSnapshot(
    initialState,
    'before_drag_drop',
    'DropZone.drag_drop'
  );

  baseCard.setPosition(targetPosition);
  baseCard.setDraggable(false);

  const moveRecord: Move = {
    from: sourcePosition,
    to: targetPosition,
    cards: [baseCard.clone()],
    timestamp: new Date('2024-01-01T00:00:05.000Z'),
    autoMove: false
  };

  const finalState: GameState = {
    gameType: 'klondike',
    tableau: [[], [], [], [], [], [], []],
    foundation: [[baseCard.clone()], [], [], []],
    stock: [],
    waste: [],
    moves: [moveRecord],
    score: 10,
    timeStarted: initialState.timeStarted
  };

  advance();
  logger.setCurrentGameState(finalState);
  dropEvent.gameStateAfter = GameStateSnapshotManager.createSnapshot(
    finalState,
    'after_drag_drop',
    'DropZone.drag_drop'
  );

  advance();
  const executedPerf: PerformanceMetrics = { operationDuration: 36, stateUpdateTime: 5, validationTime: 3 };
  const moveExecuted = logger.logMoveExecuted('GameEngine', sourcePosition, targetPosition, [baseCard], 'user', executedPerf);
  moveExecuted.gameStateAfter = GameStateSnapshotManager.createSnapshot(
    finalState,
    'after_move_executed',
    'GameEngine.move_executed'
  );

  advance();
  const winPerf: PerformanceMetrics = { operationDuration: 12, stateUpdateTime: 2 };
  logger.logUIAction(
    UIActionEventType.WIN_CONDITION,
    'GameManager',
    {
      score: finalState.score,
      moveCount: finalState.moves.length,
      cardId: baseCard.id
    },
    false,
    false,
    winPerf
  );

  advance();
  const stateChangePerf: PerformanceMetrics = { operationDuration: 22 };
  logger.logStateChange('GameStateManager', 'pile_update', [baseCard.id], stateChangePerf);

  const events = logger.getEventBuffer();

  return {
    logger,
    events,
    initialState,
    finalState
  };
};

beforeEach(() => {
  resetMockLogger();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  (UIActionLogger as unknown as { instance?: UIActionLogger }).instance = undefined;
  activeLogger = null;
});

afterEach(() => {
  if (activeLogger) {
    activeLogger.flushPendingEvents('integration-test-teardown');
    activeLogger.clearEventBuffer();
    activeLogger.setCurrentGameState(null);
    activeLogger = null;
  }
  GameStateSnapshotManager.resetSequenceCounter();
  vi.useRealTimers();
});

describe('UIAction logging integration', () => {
  it('captures, analyzes, and filters a full logging session', () => {
    const { logger, events } = recordSampleSession();

    expect(events.length).toBe(7);

    const dropEvent = events.find(event => event.type === UIActionEventType.DRAG_DROP);
    expect(dropEvent).toBeDefined();
    expect(dropEvent!.gameStateBefore).toBeTruthy();
    expect(dropEvent!.gameStateAfter).toBeTruthy();

    const comparison = GameStateSnapshotManager.compareSnapshots(
      dropEvent!.gameStateBefore!,
      dropEvent!.gameStateAfter!
    );
    expect(comparison.summary.totalDifferences).toBeGreaterThan(0);
    expect(
      comparison.differences.some(diff =>
        diff.path.includes('foundation') || diff.path.includes('tableau')
      )
    ).toBe(true);

    const report = analyzeUIActionEvents(events, { slowEventThresholdMs: 200 });
    expect(report.counts.totalEvents).toBe(events.length);
    expect(report.counts.byComponent['CardRenderer']).toBe(1);
    expect(report.counts.byComponent['DropZone']).toBe(2);
    expect(report.performance.eventsWithMetrics).toBe(events.length);
    expect(report.performance.slowEvents.some(entry => entry.event.type === UIActionEventType.DRAG_DROP)).toBe(true);

    const dragSequences = report.interactions.filter(sequence => sequence.interactionType === 'drag');
    expect(dragSequences.length).toBeGreaterThan(0);
    expect(dragSequences[0].events.some(evt => evt.component === 'CardRenderer')).toBe(true);
    expect(dragSequences[0].events.some(evt => evt.component === 'DropZone')).toBe(true);

    const engineEvents = filterUIActionEvents(events, { components: ['GameEngine'] });
    expect(engineEvents.map(evt => evt.type)).toContain(UIActionEventType.MOVE_ATTEMPT);
    expect(engineEvents.map(evt => evt.type)).toContain(UIActionEventType.MOVE_EXECUTED);

    const cardSearchResults = searchUIActionEvents(events, 'card-ace-hearts');
    expect(cardSearchResults.length).toBeGreaterThan(0);
    expect(cardSearchResults.every(evt => JSON.stringify(evt).includes('card-ace-hearts'))).toBe(true);

    const perfStats = logger.getPerformanceStatistics();
    expect(perfStats.totalEvents).toBe(events.length);
    expect(perfStats.averageOperationDuration).toBeGreaterThan(0);

    const overheadStats = logger.getLoggingOverheadMetrics();
    expect(overheadStats.eventCount).toBe(events.length);
    expect(overheadStats.maxDuration).toBeGreaterThanOrEqual(0);
  });

  it('replays the recorded session and recovers from game engine errors using snapshots', async () => {
    const { events, finalState } = recordSampleSession();
    const replayEvents = cloneEvents(events);

    const replayEngine = new UIActionReplayEngine();
    replayEngine.initializeReplay({ events: replayEvents, validateStates: true });

    const mockGameEngine = {
      setGameState: vi.fn(),
      executeMove: vi.fn(),
      getGameState: vi.fn(() => finalState)
    };

    mockGameEngine.executeMove
      .mockImplementationOnce(() => {
        throw new Error('Simulated execution failure');
      })
      .mockImplementation(() => finalState);

    const result = await replayEngine.startReplay(mockGameEngine as unknown as Record<string, unknown>);

    expect(logErrorMock).toHaveBeenCalled();
    // The replay should complete successfully even with errors
    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBeGreaterThanOrEqual(0);
  });

  it('produces replayable test cases that preserve session accuracy', async () => {
    const { events, finalState } = recordSampleSession();

    const cases = generateReplayTestCases(events, { caseNamePrefix: 'Integration Session' });
    expect(cases.length).toBeGreaterThanOrEqual(1);

    const testCase =
      cases.find(currentCase => currentCase.events.some(evt => evt.type === UIActionEventType.WIN_CONDITION)) ??
      cases[0];

    expect(testCase.metadata.eventCount).toBeGreaterThan(0);
    expect(testCase.metadata.eventCount).toBeLessThanOrEqual(events.length);
    expect(testCase.metadata.outcome).toBe('win');
    expect(testCase.notes.some(note => note.includes('slow operations'))).toBe(true);

    const replayEngine = new UIActionReplayEngine();
    replayEngine.initializeReplay({ events: cloneEvents(testCase.events), validateStates: true });

    const mockGameEngine = {
      setGameState: vi.fn(),
      executeMove: vi.fn(() => finalState),
      getGameState: vi.fn(() => finalState)
    };

    const replayResult = await replayEngine.startReplay(mockGameEngine as unknown as Record<string, unknown>);

    expect(replayResult.success).toBe(true);
    expect(replayResult.stepsExecuted).toBeGreaterThan(0);
  });
});
