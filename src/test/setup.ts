import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }) => {
      const React = require('react');
      return React.createElement('div', props, children);
    })
  }
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