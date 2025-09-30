import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock event buffer to store events for testing
let mockEventBuffer: any[] = [];

// Mock withPerformanceLogging function that properly wraps and executes functions
const mockWithPerformanceLogging = vi.fn(<T extends any[], R>(
  operationName: string,
  fn: (...args: T) => R
) => {
  return (...args: T): R => {
    // Start performance timing (mock)
    const startTime = Date.now();

    try {
      // Execute the wrapped function and return its result
      const result = fn(...args);

      // End performance timing (mock)
      const duration = Date.now() - startTime;

      // Log performance metrics (mock)
      console.debug(`PERF: ${operationName} performance`, {
        operationDuration: duration
      });

      return result;
    } catch (error) {
      // Ensure timing is ended even on error
      const duration = Date.now() - startTime;
      console.debug(`PERF: ${operationName} failed`, {
        operationDuration: duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  };
});

const mockUIActionLoggerInstance = {
  setCurrentGameState: vi.fn(),
  startPerformanceTimer: vi.fn(),
  endPerformanceTimer: vi.fn(() => ({ operationDuration: 10, memoryUsage: 1000 })),
  logUIAction: vi.fn((type: string, component: string, data: any, captureStateBefore?: boolean, captureStateAfter?: boolean, performance?: any) => {
    const event = {
      id: `test-event-${Date.now()}`,
      type,
      timestamp: new Date().toISOString(),
      component,
      data,
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  createGameStateSnapshot: vi.fn((reason, triggeredBy) => ({
    id: `test-snapshot-${Date.now()}`,
    gameType: 'klondike',
    score: 100,
    moveCount: 10,
    reason,
    triggeredBy
  })),
  createCardSnapshot: vi.fn((card) => ({
    id: card?.id || 'test-card-1',
    suit: card?.suit || 'hearts',
    rank: card?.rank || 5,
    faceUp: card?.faceUp !== false,
    position: {
      zone: card?.position?.zone || 'tableau-0',
      x: card?.position?.index || 0,
      y: card?.position?.cardIndex || 0
    }
  })),
  logStateChange: vi.fn((component: string, changeType: string, changedElements: string[], performance?: any) => {
    const event = {
      id: `test-state-change-${Date.now()}`,
      type: 'STATE_CHANGE',
      timestamp: new Date().toISOString(),
      component,
      data: { changeType, changedElements },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logCardClick: vi.fn((component: string, card: any, clickCoordinates: any, performance?: any) => {
    const event = {
      id: `test-click-${Date.now()}`,
      type: 'CARD_CLICK',
      timestamp: new Date().toISOString(),
      component,
      data: { card, clickTarget: `card-${card?.id || 'test'}`, clickCoordinates },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logDragStart: vi.fn((component: string, card: any, sourcePosition: any, performance?: any) => {
    const event = {
      id: `test-drag-start-${Date.now()}`,
      type: 'DRAG_START',
      timestamp: new Date().toISOString(),
      component,
      data: { card, sourcePosition },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logDragHover: vi.fn((component: string, card: any, targetPosition: any, validationResult?: any, performance?: any) => {
    const event = {
      id: `test-drag-hover-${Date.now()}`,
      type: 'DRAG_HOVER',
      timestamp: new Date().toISOString(),
      component,
      data: { card, targetPosition, validationResult },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logDragDrop: vi.fn((component: string, card: any, sourcePosition: any, targetPosition: any, validationResult: any, performance?: any) => {
    const event = {
      id: `test-drag-drop-${Date.now()}`,
      type: 'DRAG_DROP',
      timestamp: new Date().toISOString(),
      component,
      data: { card, sourcePosition, targetPosition, validationResult },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logDragCancel: vi.fn((component: string, card: any, reason: string, performance?: any) => {
    const event = {
      id: `test-drag-cancel-${Date.now()}`,
      type: 'DRAG_CANCEL',
      timestamp: new Date().toISOString(),
      component,
      data: { card, moveReason: reason },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logMoveAttempt: vi.fn((component: string, sourcePosition: any, targetPosition: any, cards: any[], validationResult: any, performance?: any) => {
    const event = {
      id: `test-move-attempt-${Date.now()}`,
      type: 'MOVE_ATTEMPT',
      timestamp: new Date().toISOString(),
      component,
      data: { sourcePosition, targetPosition, validationResult, moveSuccess: validationResult?.isValid || false },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  logMoveExecuted: vi.fn((component: string, sourcePosition: any, targetPosition: any, cards: any[], moveType?: string, performance?: any) => {
    const event = {
      id: `test-move-executed-${Date.now()}`,
      type: 'MOVE_EXECUTED',
      timestamp: new Date().toISOString(),
      component,
      data: { sourcePosition, targetPosition, moveType: moveType || 'user', moveSuccess: true },
      performance
    };
    mockEventBuffer.push(event);
    return event;
  }),
  clearEventBuffer: vi.fn(() => {
    mockEventBuffer = [];
  }),
  flushPendingEvents: vi.fn(),
  getEventBuffer: vi.fn(() => [...mockEventBuffer]),
  getEventsByType: vi.fn((type: string) => mockEventBuffer.filter(event => event.type === type)),
  getEventsByComponent: vi.fn((component: string) => mockEventBuffer.filter(event => event.component === component)),
  getEventsInTimeRange: vi.fn((startTime: string, endTime: string) =>
    mockEventBuffer.filter(event => event.timestamp >= startTime && event.timestamp <= endTime)
  ),
  exportEvents: vi.fn(() => JSON.stringify(mockEventBuffer, null, 2)),
  importEvents: vi.fn((eventsJson: string) => {
    try {
      const events = JSON.parse(eventsJson);
      if (Array.isArray(events)) {
        mockEventBuffer = events;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }),
  getPerformanceStatistics: vi.fn(() => {
    const eventsWithPerformance = mockEventBuffer.filter(event => event.performance?.operationDuration);
    const totalEvents = eventsWithPerformance.length;
    const totalDuration = eventsWithPerformance.reduce((sum, event) => sum + (event.performance?.operationDuration || 0), 0);
    const averageOperationDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;
    const slowestOperation = eventsWithPerformance.reduce((slowest, event) => {
      const duration = event.performance?.operationDuration || 0;
      return duration > (slowest?.operationDuration || 0) ? { operationName: `${event.component}.${event.type}`, operationDuration: duration } : slowest;
    }, null);

    return {
      totalEvents,
      averageOperationDuration,
      slowestOperation
    };
  }),
  getLoggingOverheadMetrics: vi.fn(() => ({
    eventCount: mockEventBuffer.length,
    totalDuration: mockEventBuffer.length * 0.1, // Mock overhead
    averageDuration: 0.1,
    maxDuration: 0.5
  })),
  getHealthStatus: vi.fn(() => ({
    mode: 'normal',
    dispatchFailureCount: 0,
    consecutiveDispatchFailures: 0,
    memoryWarningIssued: false,
    droppedEventCount: 0,
    pendingDispatchCount: 0,
    recentIssues: []
  })),
  configure: vi.fn(),
  logCardDrag: vi.fn(),
  logCardDrop: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const createUIActionLoggerMock = () => ({
  withPerformanceLogging: mockWithPerformanceLogging,
  uiActionLogger: mockUIActionLoggerInstance,
  UIActionLogger: {
    getInstance: vi.fn(() => mockUIActionLoggerInstance)
  },
  logDragOperation: vi.fn((component: string, operation: string, card: any, position?: any, validationResult?: any) => ({
    id: `test-drag-${operation}`,
    type: `DRAG_${operation.toUpperCase()}`,
    timestamp: new Date().toISOString(),
    component,
    data: { card, position, validationResult }
  })),
  logGameMove: vi.fn((component: string, phase: string, sourcePosition: any, targetPosition: any, cards: any[], validationResult?: any) => ({
    id: `test-move-${phase}`,
    type: phase === 'attempt' ? 'MOVE_ATTEMPT' : 'MOVE_EXECUTED',
    timestamp: new Date().toISOString(),
    component,
    data: { sourcePosition, targetPosition, cards, validationResult, moveSuccess: phase === 'executed' }
  })),
  UIActionLoggerHealthStatus: {} // Interface, no implementation needed
});

// Apply mocks with comprehensive path coverage
vi.mock('../utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('src/utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('@utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('./utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('../../utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('../../../utils/UIActionLogger', () => createUIActionLoggerMock());

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => {
      const React = require('react');
      // Filter out framer-motion specific props to avoid React warnings
      const { animate, initial, transition, whileHover, whileTap, ...domProps } = props;
      return React.createElement('div', domProps, children);
    })
  },
  AnimatePresence: vi.fn(({ children }) => {
    const React = require('react');
    return React.createElement('div', {}, children);
  })
}));

// Mock react-dnd HTML5Backend for testing
vi.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: vi.fn(() => ({
    setup: vi.fn(),
    teardown: vi.fn(),
    connectDragSource: vi.fn(),
    connectDropTarget: vi.fn(),
    connectDragPreview: vi.fn()
  }))
}));

// Mock react-dnd hooks
vi.mock('react-dnd', () => ({
  useDrag: vi.fn(() => [{ isDragging: false }, vi.fn(), vi.fn()]),
  useDrop: vi.fn(() => [{ isOver: false }, vi.fn()]),
  DndProvider: vi.fn(({ children }) => {
    const React = require('react');
    return React.createElement('div', {}, children);
  })
}));

// Create a comprehensive AudioManager mock with proper state management
const MockAudioManager = vi.fn().mockImplementation((config = {}) => {
  const mockConfig = {
    enabled: true,
    volume: 0.7,
    useGeneratedSounds: true,
    ...config
  };

  return {
    playSound: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn((enabled) => { mockConfig.enabled = enabled; }),
    setVolume: vi.fn((volume) => { mockConfig.volume = Math.max(0, Math.min(1, volume)); }),
    getVolume: vi.fn(() => mockConfig.volume),
    isEnabled: vi.fn(() => mockConfig.enabled),
    toggleAudio: vi.fn(() => { mockConfig.enabled = !mockConfig.enabled; return mockConfig.enabled; }),
    getConfig: vi.fn(() => ({ ...mockConfig })),
    stopAllSounds: vi.fn(),
    dispose: vi.fn()
  };
});

// Create singleton instance for getAudioManager
let mockAudioManagerInstance = new MockAudioManager();

const createAudioManagerMock = () => ({
  AudioManager: MockAudioManager,
  getAudioManager: vi.fn(() => mockAudioManagerInstance),
  initializeAudioManager: vi.fn((config) => {
    if (mockAudioManagerInstance && mockAudioManagerInstance.dispose) {
      mockAudioManagerInstance.dispose();
    }
    mockAudioManagerInstance = new MockAudioManager(config);
    return mockAudioManagerInstance;
  })
});

// Mock AudioManager with multiple path variations to handle different import contexts
vi.mock('../utils/AudioManager', () => createAudioManagerMock());
vi.mock('src/utils/AudioManager', () => createAudioManagerMock());
vi.mock('@utils/AudioManager', () => createAudioManagerMock());
vi.mock('./utils/AudioManager', () => createAudioManagerMock());

// Mock RendererLogger with proper singleton behavior
const mockRendererLoggerInstance = {
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(() => 1), // INFO level
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  getPerformanceMetrics: vi.fn(() => ({
    count: 0,
    totalDuration: 0,
    averageDuration: 0,
    maxDuration: 0
  })),
  getHealthStatus: vi.fn(() => ({
    mode: 'normal',
    ipcFailureCount: 0,
    consecutiveIpcFailures: 0,
    recentIssues: []
  }))
};

vi.mock('../utils/RendererLogger', () => ({
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  RendererLogger: {
    getInstance: vi.fn(() => mockRendererLoggerInstance)
  },
  logger: mockRendererLoggerInstance,
  logGameAction: vi.fn(),
  logPerformance: vi.fn(),
  logError: vi.fn(),
  logUserInteraction: vi.fn(),
  logComponentMount: vi.fn(),
  logComponentUnmount: vi.fn()
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock electronAPI for tests
Object.defineProperty(window, 'electronAPI', {
  value: {
    log: vi.fn(),
    setLogLevel: vi.fn()
  },
  writable: true,
  configurable: true
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});