# Design Document

## Overview

This design outlines a systematic approach to fix all unit test failures in the solitaire game collection. The primary issues stem from incomplete mock configurations that don't match the actual module exports, causing import/export errors and missing functionality in tests.

The solution involves updating the test setup file to provide complete and accurate mocks that mirror the actual module structures while maintaining the test isolation and verification capabilities.

## Architecture

### Current Test Architecture
- **Test Setup**: Single `setup.ts` file that configures all mocks and global objects
- **Mock Strategy**: Vi.mock() calls that replace entire modules with mock implementations
- **Test Isolation**: Each test file imports mocked versions of dependencies
- **Assertion Strategy**: Tests verify behavior through mock function calls and DOM assertions

### Proposed Fix Architecture
- **Enhanced Mock Definitions**: Complete mock objects that match actual module exports
- **Consistent Export Structure**: Mocks provide all exports that real modules provide
- **Singleton Behavior**: Mocks maintain singleton patterns where actual modules use them
- **Comprehensive Coverage**: All imported functions and classes have mock implementations

## Components and Interfaces

### 1. UIActionLogger Mock Enhancement

**Current Issues:**
- Missing `withPerformanceLogging` export
- Incomplete mock factory function
- Inconsistent singleton behavior

**Design Solution:**
```typescript
// Enhanced mock factory that provides all exports
const createUIActionLoggerMock = () => ({
  // Main exports
  withPerformanceLogging: mockWithPerformanceLogging,
  uiActionLogger: mockUIActionLoggerInstance,
  UIActionLogger: {
    getInstance: vi.fn(() => mockUIActionLoggerInstance)
  },
  
  // Additional utility exports
  logDragOperation: vi.fn(),
  logGameMove: vi.fn(),
  UIActionLoggerHealthStatus: {} // Interface placeholder
});
```

**Key Features:**
- `withPerformanceLogging`: Higher-order function that wraps and executes the provided function
- Singleton instance management with consistent behavior
- All logging methods return properly structured mock events
- Performance timing methods provide realistic mock data

### 2. AudioManager Mock Enhancement

**Current Issues:**
- Missing `AudioManager` class constructor export
- Missing `initializeAudioManager` function export
- Incomplete singleton behavior for `getAudioManager`

**Design Solution:**
```typescript
// Mock AudioManager class
const MockAudioManager = vi.fn().mockImplementation((config) => ({
  playSound: vi.fn().mockResolvedValue(undefined),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn(() => 0.7),
  isEnabled: vi.fn(() => true),
  toggleAudio: vi.fn(() => true),
  getConfig: vi.fn(() => ({ enabled: true, volume: 0.7, useGeneratedSounds: true })),
  dispose: vi.fn()
}));

// Enhanced mock factory
const createAudioManagerMock = () => ({
  AudioManager: MockAudioManager,
  getAudioManager: vi.fn(() => mockAudioManagerInstance),
  initializeAudioManager: vi.fn((config) => new MockAudioManager(config))
});
```

**Key Features:**
- Complete class constructor that accepts configuration
- Singleton management for global instance
- All methods return appropriate mock values
- Proper disposal and lifecycle management

### 3. Component Integration Fixes

**GameManager Component Issues:**
- Tests expect placeholder elements for unimplemented games
- Current implementation renders actual game boards instead of placeholders

**Design Solution:**
- Update test expectations to match actual component behavior
- Verify that Spider game board renders correctly instead of looking for placeholder
- Adjust test assertions to match the current component implementation

**CardRenderer Integration Issues:**
- Click events not being captured by logging system
- Mock UIActionLogger not receiving expected calls

**Design Solution:**
- Ensure click handlers properly call logging functions
- Verify mock logging functions are properly connected
- Add proper event simulation in tests

### 4. React DND and Framer Motion Mock Improvements

**Current Issues:**
- Incomplete mock implementations causing component render failures
- Missing prop handling in motion components

**Design Solution:**
```typescript
// Enhanced framer-motion mock
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
```

**Key Features:**
- Proper prop filtering to avoid React DOM warnings
- Maintains component structure for testing
- Preserves children rendering behavior

## Data Models

### Mock Event Structure
```typescript
interface MockUIActionEvent {
  id: string;
  type: UIActionEventType;
  timestamp: string;
  component: string;
  data: UIActionEventData;
  performance?: PerformanceMetrics;
}
```

### Mock Configuration Structure
```typescript
interface MockAudioManagerConfig {
  enabled: boolean;
  volume: number;
  useGeneratedSounds: boolean;
}
```

## Error Handling

### Mock Error Scenarios
1. **Import/Export Errors**: Ensure all mocks provide expected exports
2. **Singleton Consistency**: Maintain consistent instance references across test runs
3. **Async Operation Handling**: Properly mock async methods with resolved promises
4. **Component Render Errors**: Handle prop filtering and component structure preservation

### Fallback Strategies
1. **Missing Mock Methods**: Provide default vi.fn() implementations for any missing methods
2. **Configuration Errors**: Use sensible defaults when mock configurations are incomplete
3. **Test Environment Differences**: Ensure mocks work consistently across different test environments

## Testing Strategy

### Mock Verification Approach
1. **Export Completeness**: Verify all expected exports are available in mocks
2. **Behavior Consistency**: Ensure mock behavior matches expected patterns
3. **Integration Testing**: Test that components work correctly with enhanced mocks
4. **Regression Prevention**: Ensure existing passing tests continue to pass

### Test Execution Strategy
1. **Incremental Fixes**: Apply fixes in logical groups to isolate issues
2. **Verification Steps**: Run tests after each fix group to verify improvements
3. **Coverage Maintenance**: Ensure test coverage remains high throughout fixes
4. **Performance Monitoring**: Monitor test execution time to ensure mocks don't slow down tests

## Implementation Phases

### Phase 1: Core Mock Fixes
- Fix UIActionLogger mock exports and functionality
- Fix AudioManager mock exports and class constructor
- Update test setup with enhanced mock factories

### Phase 2: Component Integration Fixes
- Fix GameManager test expectations
- Fix CardRenderer event handling
- Fix WinAnimation component integration

### Phase 3: Mock Enhancement and Cleanup
- Improve React DND and Framer Motion mocks
- Clean up unused mock code
- Optimize mock performance

### Phase 4: Verification and Documentation
- Run complete test suite to verify 100% pass rate
- Document any test behavior changes
- Update mock documentation for future maintenance