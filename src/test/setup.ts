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
      type: 'card_click',
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
      type: 'drag_start',
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
      type: 'drag_hover',
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
      type: 'drag_drop',
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
      type: 'drag_cancel',
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
      type: 'move_attempt',
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
      type: 'move_executed',
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
    getInstance: vi.fn(() => mockUIActionLoggerInstance),
    // Allow tests to reset the singleton instance
    instance: undefined
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
vi.mock('framer-motion', () => {
  const React = require('react');

  // List of framer-motion specific props to filter out
  const framerMotionProps = [
    'animate', 'initial', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileDrag', 'whileFocus', 'whileInView',
    'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'dragTransition',
    'layout', 'layoutId', 'layoutDependency', 'layoutScroll',
    'onAnimationStart', 'onAnimationComplete', 'onUpdate',
    'onDrag', 'onDragStart', 'onDragEnd', 'onDirectionLock',
    'onHoverStart', 'onHoverEnd', 'onTap', 'onTapStart', 'onTapCancel',
    'onFocus', 'onBlur', 'onViewportEnter', 'onViewportLeave',
    'transformTemplate', 'custom', 'inherit'
  ];

  // Helper function to filter out framer-motion props
  const filterFramerProps = (props: any) => {
    const filteredProps = { ...props };
    framerMotionProps.forEach(prop => {
      delete filteredProps[prop];
    });
    return filteredProps;
  };

  // Create mock motion components for common HTML elements
  const createMotionComponent = (element: string) =>
    vi.fn(({ children, ...props }) => {
      const filteredProps = filterFramerProps(props);
      return React.createElement(element, filteredProps, children);
    });

  return {
    motion: {
      div: createMotionComponent('div'),
      span: createMotionComponent('span'),
      button: createMotionComponent('button'),
      img: createMotionComponent('img'),
      section: createMotionComponent('section'),
      article: createMotionComponent('article'),
      header: createMotionComponent('header'),
      footer: createMotionComponent('footer'),
      nav: createMotionComponent('nav'),
      aside: createMotionComponent('aside'),
      main: createMotionComponent('main'),
      p: createMotionComponent('p'),
      h1: createMotionComponent('h1'),
      h2: createMotionComponent('h2'),
      h3: createMotionComponent('h3'),
      h4: createMotionComponent('h4'),
      h5: createMotionComponent('h5'),
      h6: createMotionComponent('h6'),
      ul: createMotionComponent('ul'),
      ol: createMotionComponent('ol'),
      li: createMotionComponent('li'),
      form: createMotionComponent('form'),
      input: createMotionComponent('input'),
      textarea: createMotionComponent('textarea'),
      select: createMotionComponent('select'),
      option: createMotionComponent('option'),
      label: createMotionComponent('label'),
      fieldset: createMotionComponent('fieldset'),
      legend: createMotionComponent('legend')
    },
    AnimatePresence: vi.fn(({ children, mode, initial, onExitComplete, ...props }) => {
      // Filter out AnimatePresence specific props
      const filteredProps = filterFramerProps(props);
      return React.createElement('div', filteredProps, children);
    }),
    useAnimation: vi.fn(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      set: vi.fn(),
      mount: vi.fn(),
      unmount: vi.fn()
    })),
    useMotionValue: vi.fn((initialValue) => ({
      get: vi.fn(() => initialValue),
      set: vi.fn(),
      onChange: vi.fn(),
      destroy: vi.fn()
    })),
    useTransform: vi.fn(() => ({
      get: vi.fn(() => 0),
      set: vi.fn(),
      onChange: vi.fn(),
      destroy: vi.fn()
    })),
    useSpring: vi.fn((value) => ({
      get: vi.fn(() => value),
      set: vi.fn(),
      onChange: vi.fn(),
      destroy: vi.fn()
    })),
    useDragControls: vi.fn(() => ({
      start: vi.fn(),
      componentControls: new Set()
    })),
    useAnimationControls: vi.fn(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      set: vi.fn(),
      mount: vi.fn(),
      unmount: vi.fn()
    })),
    // Mock common animation variants
    Variants: {},
    // Mock easing functions
    easeIn: 'easeIn',
    easeOut: 'easeOut',
    easeInOut: 'easeInOut',
    linear: 'linear',
    anticipate: 'anticipate',
    backIn: 'backIn',
    backOut: 'backOut',
    backInOut: 'backInOut',
    bounceIn: 'bounceIn',
    bounceOut: 'bounceOut',
    bounceInOut: 'bounceInOut',
    circIn: 'circIn',
    circOut: 'circOut',
    circInOut: 'circInOut'
  };
});

// Mock react-dnd HTML5Backend for testing
vi.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: vi.fn(() => ({
    setup: vi.fn(),
    teardown: vi.fn(),
    connectDragSource: vi.fn((sourceId, node, options) => {
      // Return a function that can be called to disconnect
      return vi.fn();
    }),
    connectDropTarget: vi.fn((targetId, node, options) => {
      // Return a function that can be called to disconnect
      return vi.fn();
    }),
    connectDragPreview: vi.fn((sourceId, node, options) => {
      // Return a function that can be called to disconnect
      return vi.fn();
    }),
    canDragSource: vi.fn(() => true),
    canDropOnTarget: vi.fn(() => true),
    isDragging: vi.fn(() => false),
    isOverTarget: vi.fn(() => false),
    getDropResult: vi.fn(() => null),
    didDrop: vi.fn(() => false)
  }))
}));

// Mock react-dnd hooks with comprehensive behavior
vi.mock('react-dnd', () => {
  const React = require('react');

  // Mock state for drag and drop operations
  let mockDragState = {
    isDragging: false,
    canDrag: true,
    item: null,
    itemType: null,
    draggedId: null
  };

  let mockDropState = {
    isOver: false,
    isOverCurrent: false,
    canDrop: true,
    item: null,
    itemType: null,
    dropResult: null
  };

  return {
    // Enhanced useDrag hook
    useDrag: vi.fn((spec) => {
      const dragRef = vi.fn((node) => {
        if (node && typeof node.setAttribute === 'function') {
          // Simulate connecting the drag source
          node.setAttribute('data-testid', 'drag-source');
          node.draggable = true;
        }
      });

      const previewRef = vi.fn((node) => {
        if (node && typeof node.setAttribute === 'function') {
          // Simulate connecting the drag preview
          node.setAttribute('data-testid', 'drag-preview');
        }
      });

      // Create a mock monitor for the collect function
      const mockDragMonitor = {
        isDragging: vi.fn(() => mockDragState.isDragging),
        canDrag: vi.fn(() => mockDragState.canDrag),
        getItem: vi.fn(() => mockDragState.item),
        getItemType: vi.fn(() => mockDragState.itemType),
        getDropResult: vi.fn(() => null),
        didDrop: vi.fn(() => false),
        getInitialClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getInitialSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getDifferenceFromInitialOffset: vi.fn(() => ({ x: 0, y: 0 }))
      };

      // Mock collected props based on spec
      const collected = spec?.collect ? spec.collect(mockDragMonitor) : {
        isDragging: mockDragState.isDragging,
        canDrag: mockDragState.canDrag,
        item: mockDragState.item,
        itemType: mockDragState.itemType,
        draggedId: mockDragState.draggedId
      };

      return [collected, dragRef, previewRef];
    }),

    // Enhanced useDrop hook
    useDrop: vi.fn((spec) => {
      const dropRef = vi.fn((node) => {
        if (node && typeof node.setAttribute === 'function') {
          // Simulate connecting the drop target
          node.setAttribute('data-testid', 'drop-target');
          node.setAttribute('data-accepts', Array.isArray(spec?.accept) ? spec.accept.join(',') : spec?.accept || '');
        }
      });

      // Create a mock monitor for the collect function
      const mockDropMonitor = {
        isOver: vi.fn(() => mockDropState.isOver),
        isOverCurrent: vi.fn(() => mockDropState.isOverCurrent),
        canDrop: vi.fn(() => mockDropState.canDrop),
        getItem: vi.fn(() => mockDropState.item),
        getItemType: vi.fn(() => mockDropState.itemType),
        getDropResult: vi.fn(() => mockDropState.dropResult),
        didDrop: vi.fn(() => false),
        getInitialClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getInitialSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getDifferenceFromInitialOffset: vi.fn(() => ({ x: 0, y: 0 }))
      };

      // Mock collected props based on spec
      const collected = spec?.collect ? spec.collect(mockDropMonitor) : {
        isOver: mockDropState.isOver,
        isOverCurrent: mockDropState.isOverCurrent,
        canDrop: mockDropState.canDrop,
        item: mockDropState.item,
        itemType: mockDropState.itemType,
        dropResult: mockDropState.dropResult
      };

      return [collected, dropRef];
    }),

    // Enhanced DndProvider component
    DndProvider: vi.fn(({ children, backend, context, options, debugMode, ...props }) => {
      // Create a provider context that can be used by child components
      return React.createElement('div', {
        'data-testid': 'dnd-provider',
        'data-backend': backend?.name || 'HTML5Backend',
        ...props
      }, children);
    }),

    // Mock DndContext for advanced usage
    useDndContext: vi.fn(() => ({
      dragDropManager: {
        getBackend: vi.fn(() => ({
          setup: vi.fn(),
          teardown: vi.fn(),
          connectDragSource: vi.fn(),
          connectDropTarget: vi.fn(),
          connectDragPreview: vi.fn()
        })),
        getMonitor: vi.fn(() => ({
          isDragging: vi.fn(() => mockDragState.isDragging),
          canDragSource: vi.fn(() => mockDragState.canDrag),
          canDropOnTarget: vi.fn(() => mockDropState.canDrop),
          getItem: vi.fn(() => mockDragState.item),
          getItemType: vi.fn(() => mockDragState.itemType),
          getDropResult: vi.fn(() => mockDropState.dropResult),
          didDrop: vi.fn(() => false),
          isOverTarget: vi.fn(() => mockDropState.isOver),
          getTargetIds: vi.fn(() => []),
          getSourceId: vi.fn(() => null)
        })),
        getRegistry: vi.fn(() => ({
          addSource: vi.fn(),
          addTarget: vi.fn(),
          removeSource: vi.fn(),
          removeTarget: vi.fn()
        }))
      }
    })),

    // Mock drag layer hook for custom drag layers
    useDragLayer: vi.fn((collect) => {
      const monitor = {
        isDragging: vi.fn(() => mockDragState.isDragging),
        getItem: vi.fn(() => mockDragState.item),
        getItemType: vi.fn(() => mockDragState.itemType),
        getCurrentOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getInitialClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getInitialSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getClientOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getDifferenceFromInitialOffset: vi.fn(() => ({ x: 0, y: 0 })),
        getSourceClientOffset: vi.fn(() => ({ x: 0, y: 0 }))
      };

      return collect ? collect(monitor) : {
        isDragging: mockDragState.isDragging,
        item: mockDragState.item,
        itemType: mockDragState.itemType,
        currentOffset: { x: 0, y: 0 }
      };
    }),

    // Utility functions for testing
    __setMockDragState: (newState: Partial<typeof mockDragState>) => {
      mockDragState = { ...mockDragState, ...newState };
    },

    __setMockDropState: (newState: Partial<typeof mockDropState>) => {
      mockDropState = { ...mockDropState, ...newState };
    },

    __resetMockState: () => {
      mockDragState = {
        isDragging: false,
        canDrag: true,
        item: null,
        itemType: null,
        draggedId: null
      };
      mockDropState = {
        isOver: false,
        isOverCurrent: false,
        canDrop: true,
        item: null,
        itemType: null,
        dropResult: null
      };
    }
  };
});

// Create a comprehensive AudioManager mock with proper state management
const MockAudioManager = vi.fn().mockImplementation((config = {}) => {
  const mockConfig = {
    enabled: true,
    volume: 0.7,
    useGeneratedSounds: true,
    ...config
  };

  const instance = {
    playSound: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn((enabled) => {
      mockConfig.enabled = enabled;
    }),
    setVolume: vi.fn((volume) => {
      mockConfig.volume = Math.max(0, Math.min(1, volume));
    }),
    getVolume: vi.fn(() => mockConfig.volume),
    isEnabled: vi.fn(() => mockConfig.enabled),
    toggleAudio: vi.fn(() => {
      mockConfig.enabled = !mockConfig.enabled;
      return mockConfig.enabled;
    }),
    getConfig: vi.fn(() => ({ ...mockConfig })),
    stopAllSounds: vi.fn(),
    dispose: vi.fn()
  };

  return instance;
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
vi.mock('../../utils/AudioManager', () => createAudioManagerMock());
vi.mock('../../../utils/AudioManager', () => createAudioManagerMock());

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