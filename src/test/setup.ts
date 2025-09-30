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

// Mock UIActionLogger with multiple path variations
vi.mock('../utils/UIActionLogger', () => ({
  withPerformanceLogging: vi.fn((name, fn) => fn),
  uiActionLogger: {
    setCurrentGameState: vi.fn(),
    startPerformanceTimer: vi.fn(),
    endPerformanceTimer: vi.fn(() => ({ duration: 10, memoryUsage: 1000 })),
    logUIAction: vi.fn(),
    createGameStateSnapshot: vi.fn(() => ({ id: 'test-snapshot' })),
    createCardSnapshot: vi.fn(() => ({ id: 'test-card' })),
    logStateChange: vi.fn(),
    clearEventBuffer: vi.fn(),
    flushPendingEvents: vi.fn(),
    getEventBuffer: vi.fn(() => []),
    getEventsByType: vi.fn(() => []),
    getEventsByComponent: vi.fn(() => []),
    exportEvents: vi.fn(() => '[]'),
    importEvents: vi.fn(),
    getPerformanceStatistics: vi.fn(() => ({})),
    configure: vi.fn(),
    logCardClick: vi.fn(),
    logCardDrag: vi.fn(),
    logCardDrop: vi.fn(),
    logDragStart: vi.fn(),
    logDragHover: vi.fn(),
    logDragDrop: vi.fn(),
    logDragCancel: vi.fn(),
    logMoveAttempt: vi.fn(),
    logMoveExecuted: vi.fn()
  },
  UIActionLogger: {
    getInstance: vi.fn(() => ({
      setCurrentGameState: vi.fn(),
      startPerformanceTimer: vi.fn(),
      endPerformanceTimer: vi.fn(() => ({ duration: 10, memoryUsage: 1000 })),
      logUIAction: vi.fn(),
      createGameStateSnapshot: vi.fn(() => ({ id: 'test-snapshot' })),
      createCardSnapshot: vi.fn(() => ({ id: 'test-card' })),
      logStateChange: vi.fn(),
      clearEventBuffer: vi.fn(),
      flushPendingEvents: vi.fn(),
      getEventBuffer: vi.fn(() => []),
      getEventsByType: vi.fn(() => []),
      getEventsByComponent: vi.fn(() => []),
      exportEvents: vi.fn(() => '[]'),
      importEvents: vi.fn(),
      getPerformanceStatistics: vi.fn(() => ({})),
      configure: vi.fn(),
      logUserInteraction: vi.fn(),
      logGameAction: vi.fn(),
      logPerformance: vi.fn(),
      logCardClick: vi.fn(),
      logCardDrag: vi.fn(),
      logCardDrop: vi.fn(),
      logDragStart: vi.fn(),
      logDragHover: vi.fn(),
      logDragDrop: vi.fn(),
      logDragCancel: vi.fn(),
      logMoveAttempt: vi.fn(),
      logMoveExecuted: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }))
  }
}));

// Also mock with absolute path for different import contexts
vi.mock('src/utils/UIActionLogger', () => ({
  withPerformanceLogging: vi.fn((name, fn) => fn),
  uiActionLogger: {
    setCurrentGameState: vi.fn(),
    startPerformanceTimer: vi.fn(),
    endPerformanceTimer: vi.fn(() => ({ duration: 10, memoryUsage: 1000 })),
    logUIAction: vi.fn(),
    createGameStateSnapshot: vi.fn(() => ({ id: 'test-snapshot' })),
    createCardSnapshot: vi.fn(() => ({ id: 'test-card' })),
    logStateChange: vi.fn(),
    clearEventBuffer: vi.fn(),
    flushPendingEvents: vi.fn(),
    getEventBuffer: vi.fn(() => []),
    getEventsByType: vi.fn(() => []),
    getEventsByComponent: vi.fn(() => []),
    exportEvents: vi.fn(() => '[]'),
    importEvents: vi.fn(),
    getPerformanceStatistics: vi.fn(() => ({})),
    configure: vi.fn(),
    logCardClick: vi.fn(),
    logCardDrag: vi.fn(),
    logCardDrop: vi.fn(),
    logDragStart: vi.fn(),
    logDragHover: vi.fn(),
    logDragDrop: vi.fn(),
    logDragCancel: vi.fn(),
    logMoveAttempt: vi.fn(),
    logMoveExecuted: vi.fn()
  },
  UIActionLogger: {
    getInstance: vi.fn(() => ({
      setCurrentGameState: vi.fn(),
      startPerformanceTimer: vi.fn(),
      endPerformanceTimer: vi.fn(() => ({ duration: 10, memoryUsage: 1000 })),
      logUIAction: vi.fn(),
      createGameStateSnapshot: vi.fn(() => ({ id: 'test-snapshot' })),
      createCardSnapshot: vi.fn(() => ({ id: 'test-card' })),
      logStateChange: vi.fn(),
      clearEventBuffer: vi.fn(),
      flushPendingEvents: vi.fn(),
      getEventBuffer: vi.fn(() => []),
      getEventsByType: vi.fn(() => []),
      getEventsByComponent: vi.fn(() => []),
      exportEvents: vi.fn(() => '[]'),
      importEvents: vi.fn(),
      getPerformanceStatistics: vi.fn(() => ({})),
      configure: vi.fn(),
      logUserInteraction: vi.fn(),
      logGameAction: vi.fn(),
      logPerformance: vi.fn(),
      logCardClick: vi.fn(),
      logCardDrag: vi.fn(),
      logCardDrop: vi.fn(),
      logDragStart: vi.fn(),
      logDragHover: vi.fn(),
      logDragDrop: vi.fn(),
      logDragCancel: vi.fn(),
      logMoveAttempt: vi.fn(),
      logMoveExecuted: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }))
  }
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

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