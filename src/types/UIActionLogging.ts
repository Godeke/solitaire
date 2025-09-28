/**
 * Core interfaces and types for UI Action Logging system
 * Provides structured event tracking for debugging game state issues
 */

/**
 * Position interface for tracking card and element positions
 */
export interface Position {
  x: number;
  y: number;
  zone?: string; // Optional zone identifier (e.g., 'tableau-0', 'foundation-hearts')
}

/**
 * Enumeration of all UI action event types
 */
export enum UIActionEventType {
  // Drag & Drop Events
  DRAG_START = 'drag_start',
  DRAG_HOVER = 'drag_hover', 
  DRAG_DROP = 'drag_drop',
  DRAG_CANCEL = 'drag_cancel',
  
  // Click Events
  CARD_CLICK = 'card_click',
  BUTTON_CLICK = 'button_click',
  ZONE_CLICK = 'zone_click',
  
  // Move Events
  MOVE_ATTEMPT = 'move_attempt',
  MOVE_EXECUTED = 'move_executed',
  MOVE_VALIDATED = 'move_validated',
  AUTO_MOVE = 'auto_move',
  
  // State Events
  STATE_CHANGE = 'state_change',
  CARD_FLIP = 'card_flip',
  SCORE_UPDATE = 'score_update',
  WIN_CONDITION = 'win_condition'
}

/**
 * Performance metrics for logged operations
 */
export interface PerformanceMetrics {
  operationDuration: number; // Duration in milliseconds
  renderTime?: number; // Time spent rendering in milliseconds
  validationTime?: number; // Time spent validating moves in milliseconds
  stateUpdateTime?: number; // Time spent updating game state in milliseconds
  animationDuration?: number; // Animation duration in milliseconds
  memoryUsage?: number; // Memory usage in bytes
}

/**
 * Move validation result with detailed reasoning
 */
export interface MoveValidationResult {
  isValid: boolean;
  reason: string;
  ruleViolations?: string[];
  suggestedMoves?: Position[];
  validationTime: number; // Time taken for validation in milliseconds
}

/**
 * Snapshot of a card's state at a specific moment
 */
export interface CardSnapshot {
  id: string;
  suit: string;
  rank: number;
  faceUp: boolean;
  draggable: boolean;
  position: Position;
}

/**
 * Complete game state snapshot for debugging and replay
 */
export interface GameStateSnapshot {
  timestamp: string; // ISO timestamp
  gameType: 'klondike' | 'spider' | 'freecell';
  tableau: CardSnapshot[][];
  foundation: CardSnapshot[][];
  stock?: CardSnapshot[];
  waste?: CardSnapshot[];
  freeCells?: CardSnapshot[]; // For FreeCell variant
  score: number;
  moveCount: number;
  gameStartTime: string; // ISO timestamp
  metadata: {
    snapshotReason: string;
    triggeredBy: string;
    sequenceNumber: number;
  };
}/*
*
 * Event data for different types of UI actions
 */
export interface UIActionEventData {
  // Drag & Drop Events
  card?: CardSnapshot;
  sourcePosition?: Position;
  targetPosition?: Position;
  validationResult?: MoveValidationResult;
  
  // Click Events
  clickTarget?: string;
  clickCoordinates?: { x: number; y: number };
  
  // Move Events
  moveType?: 'user' | 'auto' | 'undo';
  moveSuccess?: boolean;
  moveReason?: string;
  
  // State Change Events
  changeType?: 'card_flip' | 'pile_update' | 'score_change' | 'win_condition';
  changedElements?: string[];
  
  // Additional context data
  [key: string]: any; // Allow for extensible event data
}

/**
 * Core UI action event structure
 */
export interface UIActionEvent {
  id: string; // Unique event identifier
  timestamp: string; // ISO timestamp
  type: UIActionEventType;
  component: string; // Component that generated the event
  data: UIActionEventData;
  gameStateBefore?: GameStateSnapshot;
  gameStateAfter?: GameStateSnapshot;
  performance?: PerformanceMetrics;
}

/**
 * Drag operation tracking for complete lifecycle logging
 */
export interface DragOperation {
  operationId: string;
  startTime: number;
  card: CardSnapshot;
  sourcePosition: Position;
  events: DragEvent[];
  endTime?: number;
  result?: 'success' | 'cancelled' | 'invalid';
}

/**
 * Individual drag event within a drag operation
 */
export interface DragEvent {
  timestamp: number;
  type: 'start' | 'hover' | 'drop' | 'cancel';
  position?: Position;
  validationResult?: boolean;
  validationReason?: string;
}

/**
 * Replay system interfaces
 */
export interface ReplayOptions {
  events: UIActionEvent[];
  stopAtStep?: number;
  stepByStep?: boolean;
  validateStates?: boolean;
}

export interface ReplayResult {
  success: boolean;
  finalGameState: any; // Will be typed more specifically when game state types are available
  stepsExecuted: number;
  errors?: ReplayError[];
  performance: ReplayPerformanceMetrics;
}

export interface ReplayError {
  step: number;
  event: UIActionEvent;
  error: string;
  recoverable: boolean;
}

export interface ReplayPerformanceMetrics {
  totalReplayTime: number;
  averageEventProcessingTime: number;
  stateReconstructionTime: number;
  validationTime?: number;
}

/**
 * Utility type for serializable event data
 */
export type SerializableUIActionEvent = Omit<UIActionEvent, 'gameStateBefore' | 'gameStateAfter'> & {
  gameStateBefore?: string; // JSON serialized GameStateSnapshot
  gameStateAfter?: string; // JSON serialized GameStateSnapshot
};

/**
 * Utility functions for UI Action Logging
 */

/**
 * Validates if an object conforms to the UIActionEvent interface
 */
export function isValidUIActionEvent(obj: any): obj is UIActionEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.type === 'string' &&
    Object.values(UIActionEventType).includes(obj.type) &&
    typeof obj.component === 'string' &&
    typeof obj.data === 'object' &&
    obj.data !== null
  );
}

/**
 * Validates if an object conforms to the GameStateSnapshot interface
 */
export function isValidGameStateSnapshot(obj: any): obj is GameStateSnapshot {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.timestamp === 'string' &&
    ['klondike', 'spider', 'freecell'].includes(obj.gameType) &&
    Array.isArray(obj.tableau) &&
    Array.isArray(obj.foundation) &&
    typeof obj.score === 'number' &&
    typeof obj.moveCount === 'number' &&
    typeof obj.gameStartTime === 'string' &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null &&
    typeof obj.metadata.snapshotReason === 'string' &&
    typeof obj.metadata.triggeredBy === 'string' &&
    typeof obj.metadata.sequenceNumber === 'number'
  );
}

/**
 * Validates if an object conforms to the CardSnapshot interface
 */
export function isValidCardSnapshot(obj: any): obj is CardSnapshot {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.suit === 'string' &&
    typeof obj.rank === 'number' &&
    typeof obj.faceUp === 'boolean' &&
    typeof obj.draggable === 'boolean' &&
    typeof obj.position === 'object' &&
    obj.position !== null &&
    typeof obj.position.x === 'number' &&
    typeof obj.position.y === 'number'
  );
}

/**
 * Creates a unique event ID
 */
export function generateEventId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Creates an ISO timestamp string
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}