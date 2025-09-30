import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => {
      const React = require('react');
      return React.createElement('div', props, children);
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

// Create a comprehensive UIActionLogger mock factory with proper singleton behavior
const mockUIActionLoggerInstance = {
  setCurrentGameState: vi.fn(),
  startPerformanceTimer: vi.fn(),
  endPerformanceTimer: vi.fn(() => ({ operationDuration: 10, memoryUsage: 1000 })),
  logUIAction: vi.fn(() => ({ 
    id: 'test-event-id',
    type: 'CARD_CLICK',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: { clickTarget: 'test-card' }
  })),
  createGameStateSnapshot: vi.fn((reason, triggeredBy) => ({ 
    id: 'test-snapshot',
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
  logStateChange: vi.fn(() => ({ 
    id: 'test-state-change',
    type: 'STATE_CHANGE',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: { changeType: 'test' }
  })),
  logCardClick: vi.fn(() => ({ 
    id: 'test-click',
    type: 'CARD_CLICK',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: { clickTarget: 'test-card-1' }
  })),
  logDragStart: vi.fn(() => ({ 
    id: 'test-drag-start',
    type: 'DRAG_START',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: {}
  })),
  logDragHover: vi.fn(() => ({ 
    id: 'test-drag-hover',
    type: 'DRAG_HOVER',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: {}
  })),
  logDragDrop: vi.fn(() => ({ 
    id: 'test-drag-drop',
    type: 'DRAG_DROP',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: {}
  })),
  logDragCancel: vi.fn(() => ({ 
    id: 'test-drag-cancel',
    type: 'DRAG_CANCEL',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: {}
  })),
  logMoveAttempt: vi.fn(() => ({ 
    id: 'test-move-attempt',
    type: 'MOVE_ATTEMPT',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: { moveSuccess: false }
  })),
  logMoveExecuted: vi.fn(() => ({ 
    id: 'test-move-executed',
    type: 'MOVE_EXECUTED',
    timestamp: new Date().toISOString(),
    component: 'test',
    data: { moveSuccess: true }
  })),
  clearEventBuffer: vi.fn(),
  flushPendingEvents: vi.fn(),
  getEventBuffer: vi.fn(() => []),
  getEventsByType: vi.fn(() => []),
  getEventsByComponent: vi.fn(() => []),
  getEventsInTimeRange: vi.fn(() => []),
  exportEvents: vi.fn(() => '[]'),
  importEvents: vi.fn(() => true),
  getPerformanceStatistics: vi.fn(() => ({
    totalEvents: 0,
    averageOperationDuration: 0,
    slowestOperation: null
  })),
  getLoggingOverheadMetrics: vi.fn(() => ({
    eventCount: 0,
    totalDuration: 0,
    averageDuration: 0,
    maxDuration: 0
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

// Mock withPerformanceLogging function that properly wraps and executes functions
const mockWithPerformanceLogging = vi.fn((operationName, fn) => {
  return (...args) => {
    // Execute the wrapped function and return its result
    return fn(...args);
  };
});

const createUIActionLoggerMock = () => ({
  withPerformanceLogging: mockWithPerformanceLogging,
  uiActionLogger: mockUIActionLoggerInstance,
  UIActionLogger: {
    getInstance: vi.fn(() => mockUIActionLoggerInstance)
  },
  logDragOperation: vi.fn(),
  logGameMove: vi.fn(),
  UIActionLoggerHealthStatus: {} // Interface, no implementation needed
});

// Mock UIActionLogger with multiple path variations to handle different import contexts
vi.mock('../utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('src/utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('@utils/UIActionLogger', () => createUIActionLoggerMock());
vi.mock('./utils/UIActionLogger', () => createUIActionLoggerMock());

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