/**
 * UI Action Replay Engine
 * Provides functionality to replay logged UI actions for debugging and testing
 */

import { 
  UIActionEvent, 
  UIActionEventType, 
  ReplayOptions, 
  ReplayResult, 
  ReplayError, 
  ReplayPerformanceMetrics,
  GameStateSnapshot,
  CardSnapshot,
  isValidUIActionEvent,
  isValidGameStateSnapshot
} from '../types/UIActionLogging';
import { GameState } from '../types/card';
import { logGameAction, logError, logPerformance } from './RendererLogger';

/**
 * Replay engine state for managing replay execution
 */
interface ReplayEngineState {
  currentStep: number;
  totalSteps: number;
  isReplaying: boolean;
  isPaused: boolean;
  currentGameState: GameState | null;
  errors: ReplayError[];
  startTime: number;
}

/**
 * Event processing result for internal tracking
 */
interface EventProcessingResult {
  success: boolean;
  error?: string;
  gameState?: GameState;
  processingTime: number;
}

/**
 * UIActionReplayEngine class for processing and replaying logged UI actions
 */
export class UIActionReplayEngine {
  private state: ReplayEngineState;
  private events: UIActionEvent[];
  private options: ReplayOptions;
  private gameEngineInstance: any; // Will be injected during replay

  constructor() {
    this.state = {
      currentStep: 0,
      totalSteps: 0,
      isReplaying: false,
      isPaused: false,
      currentGameState: null,
      errors: [],
      startTime: 0
    };
    this.events = [];
    this.options = {
      events: [],
      stepByStep: false,
      validateStates: true
    };
    this.gameEngineInstance = null;
  }

  /**
   * Initialize replay with events and options
   */
  public initializeReplay(options: ReplayOptions): boolean {
    try {
      logGameAction('Initializing replay engine', 'REPLAY', { 
        eventCount: options.events.length,
        stopAtStep: options.stopAtStep,
        stepByStep: options.stepByStep
      });

      // Validate events
      const validationResult = this.validateEvents(options.events);
      if (!validationResult.isValid) {
        logError(new Error('Event validation failed during replay initialization'), 'REPLAY', {
          errors: validationResult.errors
        });
        return false;
      }

      this.events = [...options.events];
      this.options = { ...options };
      this.gameEngineInstance = null;
      this.state = {
        currentStep: 0,
        totalSteps: this.events.length,
        isReplaying: false,
        isPaused: false,
        currentGameState: null,
        errors: [],
        startTime: 0
      };

      return true;
    } catch (error) {
      logError(new Error('Failed to initialize replay engine'), 'REPLAY', { error: error.message });
      return false;
    }
  }

  /**
   * Attach a game engine instance for replay-controlled move execution
   */
  public attachGameEngine(gameEngineInstance: any): void {
    this.gameEngineInstance = gameEngineInstance ?? null;
    logGameAction('Attached game engine to replay engine', 'REPLAY', {
      hasEngine: !!gameEngineInstance
    });
  }

  /**
   * Start replay execution
   */
  public async startReplay(gameEngineInstance?: any): Promise<ReplayResult> {
    const startTime = performance.now();
    
    try {
      logGameAction('Starting replay execution', 'REPLAY', {
        totalSteps: this.state.totalSteps,
        stepByStep: this.options.stepByStep
      });

      if (gameEngineInstance) {
        this.attachGameEngine(gameEngineInstance);
      } else if (!this.gameEngineInstance) {
        logGameAction('Replay engine starting without attached game engine', 'REPLAY', {
          fallbackToSnapshots: true
        });
      }

      this.state.isReplaying = true;
      this.state.startTime = startTime;

      // Initialize game state from first event if available
      if (this.events.length > 0 && this.events[0].gameStateBefore) {
        const initialState = this.reconstructGameStateFromSnapshot(this.events[0].gameStateBefore);
        if (initialState) {
          this.state.currentGameState = initialState;
          if (this.gameEngineInstance?.setGameState) {
            this.gameEngineInstance.setGameState(initialState);
          }
        }
      }

      // Execute replay based on options
      if (this.options.stepByStep) {
        return await this.executeStepByStepReplay();
      } else {
        return await this.executeFullReplay();
      }
    } catch (error) {
      logError(new Error('Replay execution failed'), 'REPLAY', { error: error.message });
      this.state.isReplaying = false;
      
      return {
        success: false,
        finalGameState: this.state.currentGameState,
        stepsExecuted: this.state.currentStep,
        errors: [...this.state.errors, {
          step: this.state.currentStep,
          event: this.events[this.state.currentStep] || null,
          error: error.message,
          recoverable: false
        }],
        performance: this.calculatePerformanceMetrics(startTime)
      };
    }
  }

  /**
   * Execute full replay without pausing with enhanced state reconstruction
   */
  private async executeFullReplay(): Promise<ReplayResult> {
    const stopAtStep = this.options.stopAtStep || this.events.length;
    let lastValidState = this.state.currentGameState;
    
    logGameAction('Starting full replay execution', 'REPLAY', {
      totalEvents: this.events.length,
      stopAtStep,
      validateStates: this.options.validateStates
    });
    
    for (let i = 0; i < Math.min(stopAtStep, this.events.length); i++) {
      this.state.currentStep = i;
      const event = this.events[i];
      
      logGameAction('Processing replay event', 'REPLAY', {
        step: i,
        eventId: event.id,
        eventType: event.type,
        component: event.component
      });
      
      const result = await this.processEvent(event);
      if (!result.success) {
        const error: ReplayError = {
          step: i,
          event,
          error: result.error || 'Unknown processing error',
          recoverable: this.isRecoverableError(result.error || '')
        };
        
        this.state.errors.push(error);
        
        logError(new Error('Replay event processing failed'), 'REPLAY', {
          step: i,
          eventId: event.id,
          error: error.error,
          recoverable: error.recoverable
        });
        
        // Handle error recovery
        if (error.recoverable) {
          // Try to recover using fallback methods
          const recoveredState = await this.attemptErrorRecovery(event, lastValidState);
          if (recoveredState) {
            this.state.currentGameState = recoveredState;
            lastValidState = recoveredState;
            logGameAction('Successfully recovered from error', 'REPLAY', { step: i });
          }
        } else {
          // Non-recoverable error, stop replay
          logError(new Error('Non-recoverable error encountered, stopping replay'), 'REPLAY', { step: i });
          break;
        }
      } else if (result.gameState) {
        this.state.currentGameState = result.gameState;
        lastValidState = result.gameState;
        
        // Validate state consistency if enabled
        if (this.options.validateStates && event.gameStateAfter) {
          const isConsistent = this.validateStateConsistency(result.gameState, event.gameStateAfter);
          if (!isConsistent) {
            const error: ReplayError = {
              step: i,
              event,
              error: 'State consistency validation failed',
              recoverable: true
            };
            this.state.errors.push(error);
            
            logError(new Error('State consistency validation failed'), 'REPLAY', {
              step: i,
              eventId: event.id,
              expectedScore: event.gameStateAfter.score,
              actualScore: result.gameState.score
            });
          }
        }
      }
    }

    this.state.isReplaying = false;
    
    const finalResult: ReplayResult = {
      success: this.state.errors.filter(e => !e.recoverable).length === 0,
      finalGameState: this.state.currentGameState,
      stepsExecuted: this.state.currentStep + 1,
      errors: this.state.errors,
      performance: this.calculatePerformanceMetrics(this.state.startTime)
    };
    
    logGameAction('Full replay execution completed', 'REPLAY', {
      success: finalResult.success,
      stepsExecuted: finalResult.stepsExecuted,
      errorCount: finalResult.errors?.length || 0,
      totalTime: finalResult.performance.totalReplayTime
    });
    
    return finalResult;
  }

  /**
   * Attempt to recover from processing errors using fallback methods
   */
  private async attemptErrorRecovery(failedEvent: UIActionEvent, lastValidState: GameState | null): Promise<GameState | null> {
    try {
      logGameAction('Attempting error recovery', 'REPLAY', {
        eventId: failedEvent.id,
        eventType: failedEvent.type,
        hasLastValidState: !!lastValidState
      });

      // Strategy 1: Use gameStateAfter from the failed event if available
      if (failedEvent.gameStateAfter) {
        const recoveredState = this.reconstructGameStateFromSnapshot(failedEvent.gameStateAfter);
        if (recoveredState) {
          logGameAction('Recovered using gameStateAfter snapshot', 'REPLAY', { eventId: failedEvent.id });
          return recoveredState;
        }
      }

      // Strategy 2: Use gameStateBefore and skip the problematic operation
      if (failedEvent.gameStateBefore) {
        const recoveredState = this.reconstructGameStateFromSnapshot(failedEvent.gameStateBefore);
        if (recoveredState) {
          logGameAction('Recovered using gameStateBefore snapshot', 'REPLAY', { eventId: failedEvent.id });
          return recoveredState;
        }
      }

      // Strategy 3: Use last valid state if available
      if (lastValidState) {
        logGameAction('Using last valid state for recovery', 'REPLAY', { eventId: failedEvent.id });
        return lastValidState;
      }

      // Strategy 4: Look for the next event with a valid gameStateBefore
      const nextValidEvent = this.findNextEventWithValidState(this.state.currentStep + 1);
      if (nextValidEvent && nextValidEvent.gameStateBefore) {
        const recoveredState = this.reconstructGameStateFromSnapshot(nextValidEvent.gameStateBefore);
        if (recoveredState) {
          logGameAction('Recovered using next valid event state', 'REPLAY', { 
            failedEventId: failedEvent.id,
            recoveryEventId: nextValidEvent.id
          });
          return recoveredState;
        }
      }

      logError(new Error('All recovery strategies failed'), 'REPLAY', { eventId: failedEvent.id });
      return null;
    } catch (error) {
      logError(new Error('Error during recovery attempt'), 'REPLAY', { 
        eventId: failedEvent.id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Find the next event with a valid game state snapshot
   */
  private findNextEventWithValidState(startIndex: number): UIActionEvent | null {
    for (let i = startIndex; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.gameStateBefore && isValidGameStateSnapshot(event.gameStateBefore)) {
        return event;
      }
    }
    return null;
  }

  /**
   * Recreate game state from a sequence of events (partial replay functionality)
   */
  public async recreateGameStateFromEvents(
    events: UIActionEvent[], 
    targetStep?: number,
    initialState?: GameState
  ): Promise<{ success: boolean; gameState: GameState | null; errors: ReplayError[] }> {
    const startTime = performance.now();
    const errors: ReplayError[] = [];
    let currentState = initialState || null;
    
    try {
      logGameAction('Starting game state recreation from events', 'REPLAY', {
        eventCount: events.length,
        targetStep,
        hasInitialState: !!initialState
      });

      // Validate events first
      const validationResult = this.validateEvents(events);
      if (!validationResult.isValid) {
        logError(new Error('Event validation failed for state recreation'), 'REPLAY', {
          errors: validationResult.errors
        });
        
        // Convert validation errors to ReplayError format
        const validationErrors: ReplayError[] = validationResult.errors.map((error, index) => ({
          step: index,
          event: events[index] || null,
          error: error,
          recoverable: false
        }));
        
        return { success: false, gameState: null, errors: validationErrors };
      }

      // If no initial state provided, try to get it from the first event
      if (!currentState && events.length > 0 && events[0].gameStateBefore) {
        currentState = this.reconstructGameStateFromSnapshot(events[0].gameStateBefore);
        if (!currentState) {
          logError(new Error('Failed to establish initial state for recreation'), 'REPLAY');
          return { success: false, gameState: null, errors: [] };
        }
      }

      // Set the initial state in the game engine if we have one
      if (this.gameEngineInstance && currentState) {
        this.gameEngineInstance.setGameState(currentState);
      }

      const endStep = targetStep !== undefined ? Math.min(targetStep, events.length) : events.length;
      
      // Process events sequentially
      for (let i = 0; i < endStep; i++) {
        const event = events[i];
        
        try {
          // Create a temporary game engine instance for processing
          if (this.gameEngineInstance && currentState) {
            this.gameEngineInstance.setGameState(currentState);
          }
          
          const result = await this.processEvent(event);
          
          if (result.success && result.gameState) {
            currentState = result.gameState;
          } else if (!result.success) {
            const error: ReplayError = {
              step: i,
              event,
              error: result.error || 'Unknown processing error',
              recoverable: this.isRecoverableError(result.error || '')
            };
            errors.push(error);
            
            // Try recovery if error is recoverable
            if (error.recoverable) {
              const recoveredState = await this.attemptErrorRecovery(event, currentState);
              if (recoveredState) {
                currentState = recoveredState;
              }
            } else {
              // Non-recoverable error
              break;
            }
          }
        } catch (error) {
          const replayError: ReplayError = {
            step: i,
            event,
            error: error.message,
            recoverable: false
          };
          errors.push(replayError);
          break;
        }
      }

      const success = errors.filter(e => !e.recoverable).length === 0;
      
      logGameAction('Game state recreation completed', 'REPLAY', {
        success,
        stepsProcessed: endStep,
        errorCount: errors.length,
        processingTime: performance.now() - startTime
      });

      return { success, gameState: currentState, errors };
      
    } catch (error) {
      logError(new Error('Failed to recreate game state from events'), 'REPLAY', { error: error.message });
      return { success: false, gameState: null, errors };
    }
  }

  /**
   * Execute step-by-step replay with pause capabilities
   */
  private async executeStepByStepReplay(): Promise<ReplayResult> {
    // For step-by-step, we prepare the engine but don't execute automatically
    // The caller will use nextStep() to advance
    
    return {
      success: true,
      finalGameState: this.state.currentGameState,
      stepsExecuted: 0,
      errors: [],
      performance: this.calculatePerformanceMetrics(this.state.startTime)
    };
  }

  /**
   * Execute the next step in step-by-step replay
   */
  public async nextStep(): Promise<EventProcessingResult> {
    if (!this.state.isReplaying || this.state.currentStep >= this.events.length) {
      return {
        success: false,
        error: 'No more steps to execute or replay not active',
        processingTime: 0
      };
    }

    const event = this.events[this.state.currentStep];
    const result = await this.processEvent(event);
    
    if (result.success && result.gameState) {
      this.state.currentGameState = result.gameState;
    }
    
    this.state.currentStep++;
    if (this.state.currentStep >= this.state.totalSteps) {
      this.state.isReplaying = false;
    }
    
    return result;
  }

  /**
   * Pause the replay execution
   */
  public pauseReplay(): void {
    this.state.isPaused = true;
    logGameAction('Replay paused', 'REPLAY', { currentStep: this.state.currentStep });
  }

  /**
   * Resume the replay execution
   */
  public resumeReplay(): void {
    this.state.isPaused = false;
    logGameAction('Replay resumed', 'REPLAY', { currentStep: this.state.currentStep });
  }

  /**
   * Stop the replay execution
   */
  public stopReplay(): void {
    this.state.isReplaying = false;
    this.state.isPaused = false;
    logGameAction('Replay stopped', 'REPLAY', { 
      stepsExecuted: this.state.currentStep,
      totalSteps: this.state.totalSteps
    });
  }

  /**
   * Process a single UI action event
   */
  private async processEvent(event: UIActionEvent): Promise<EventProcessingResult> {
    const startTime = performance.now();
    
    try {
      logGameAction('Processing replay event', 'REPLAY', {
        eventId: event.id,
        eventType: event.type,
        component: event.component
      });

      // Validate event structure
      if (!isValidUIActionEvent(event)) {
        return {
          success: false,
          error: 'Invalid event structure',
          processingTime: performance.now() - startTime
        };
      }

      // Process event based on type
      let gameState: GameState | undefined;
      
      switch (event.type) {
        case UIActionEventType.MOVE_EXECUTED:
          gameState = await this.processMovedExecutedEvent(event);
          break;
          
        case UIActionEventType.DRAG_DROP:
          gameState = await this.processDragDropEvent(event);
          break;
          
        case UIActionEventType.STATE_CHANGE:
          gameState = await this.processStateChangeEvent(event);
          break;
          
        case UIActionEventType.CARD_FLIP:
          gameState = await this.processCardFlipEvent(event);
          break;
          
        case UIActionEventType.DRAG_START:
          // Non-state-modifying event, just log it
          logGameAction('Processing drag start event', 'REPLAY', { eventType: event.type });
          break;
          
        default:
          // For other event types, we may not need to modify game state
          logGameAction('Skipping non-state-modifying event', 'REPLAY', { eventType: event.type });
          break;
      }

      // Validate state consistency if enabled
      if (this.options.validateStates && event.gameStateAfter && gameState) {
        const isConsistent = this.validateStateConsistency(gameState, event.gameStateAfter);
        if (!isConsistent) {
          return {
            success: false,
            error: 'Game state inconsistency detected',
            processingTime: performance.now() - startTime
          };
        }
      }

      return {
        success: true,
        gameState,
        processingTime: performance.now() - startTime
      };
      
    } catch (error) {
      logError(new Error('Error processing replay event'), 'REPLAY', {
        eventId: event.id,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Process a move executed event
   */
  private async processMovedExecutedEvent(event: UIActionEvent): Promise<GameState | undefined> {
    if (!this.gameEngineInstance || !event.data.sourcePosition || !event.data.targetPosition) {
      // If we have gameStateAfter, use that instead
      if (event.gameStateAfter) {
        return this.reconstructGameStateFromSnapshot(event.gameStateAfter);
      }
      // Throw error for missing required data
      throw new Error('Missing event data for move execution');
    }

    try {
      // Execute the move using the game engine
      const card = event.data.card;
      if (card) {
        const newState = this.gameEngineInstance.executeMove(
          event.data.sourcePosition,
          event.data.targetPosition,
          card
        );
        return newState;
      }
    } catch (error) {
      logError(new Error('Failed to process move executed event'), 'REPLAY', { error: error.message });
      // Re-throw the error so it can be handled at the event processing level
      throw error;
    }
    
    return undefined;
  }

  /**
   * Process a drag drop event
   */
  private async processDragDropEvent(event: UIActionEvent): Promise<GameState | undefined> {
    // For drag drop events, we typically want to execute the resulting move
    return this.processMovedExecutedEvent(event);
  }

  /**
   * Process a state change event
   */
  private async processStateChangeEvent(event: UIActionEvent): Promise<GameState | undefined> {
    // If we have the after state, reconstruct it
    if (event.gameStateAfter) {
      return this.reconstructGameStateFromSnapshot(event.gameStateAfter);
    }
    return undefined;
  }

  /**
   * Process a card flip event
   */
  private async processCardFlipEvent(event: UIActionEvent): Promise<GameState | undefined> {
    // Card flip events may need special handling depending on the game engine
    if (event.gameStateAfter) {
      return this.reconstructGameStateFromSnapshot(event.gameStateAfter);
    }
    return undefined;
  }

  /**
   * Reconstruct game state from a snapshot with enhanced validation
   */
  private reconstructGameStateFromSnapshot(snapshot: GameStateSnapshot): GameState | null {
    try {
      if (!isValidGameStateSnapshot(snapshot)) {
        logError(new Error('Invalid game state snapshot'), 'REPLAY', { 
          snapshotId: snapshot?.metadata?.sequenceNumber,
          reason: 'Failed snapshot validation'
        });
        return null;
      }

      // Validate card snapshots within the game state
      const validationErrors = this.validateCardSnapshots(snapshot);
      if (validationErrors.length > 0) {
        logError(new Error('Invalid card snapshots in game state'), 'REPLAY', { 
          errors: validationErrors,
          snapshotId: snapshot.metadata.sequenceNumber
        });
        return null;
      }

      // Convert snapshot to GameState format with enhanced error handling
      const gameState: GameState = {
        gameType: snapshot.gameType,
        tableau: this.reconstructCardPiles(snapshot.tableau, 'tableau'),
        foundation: this.reconstructCardPiles(snapshot.foundation, 'foundation'),
        stock: snapshot.stock ? this.reconstructCardPile(snapshot.stock, 'stock') : undefined,
        waste: snapshot.waste ? this.reconstructCardPile(snapshot.waste, 'waste') : undefined,
        freeCells: snapshot.freeCells ? this.reconstructCardPile(snapshot.freeCells, 'freeCells') : undefined,
        moves: [], // Moves history is not preserved in snapshots
        score: snapshot.score,
        timeStarted: new Date(snapshot.gameStartTime)
      };

      // Validate the reconstructed game state
      if (!this.validateReconstructedGameState(gameState, snapshot)) {
        logError(new Error('Reconstructed game state validation failed'), 'REPLAY', {
          snapshotId: snapshot.metadata.sequenceNumber
        });
        return null;
      }

      logGameAction('Successfully reconstructed game state from snapshot', 'REPLAY', {
        snapshotId: snapshot.metadata.sequenceNumber,
        gameType: snapshot.gameType,
        score: snapshot.score,
        moveCount: snapshot.moveCount
      });

      return gameState;
    } catch (error) {
      logError(new Error('Failed to reconstruct game state from snapshot'), 'REPLAY', { 
        error: error.message,
        snapshotId: snapshot?.metadata?.sequenceNumber
      });
      return null;
    }
  }

  /**
   * Validate card snapshots within a game state snapshot
   */
  private validateCardSnapshots(snapshot: GameStateSnapshot): string[] {
    const errors: string[] = [];
    
    // Validate tableau cards
    snapshot.tableau.forEach((pile, pileIndex) => {
      pile.forEach((card, cardIndex) => {
        if (!this.isValidCardSnapshot(card)) {
          errors.push(`Invalid card in tableau pile ${pileIndex}, position ${cardIndex}`);
        }
      });
    });

    // Validate foundation cards
    snapshot.foundation.forEach((pile, pileIndex) => {
      pile.forEach((card, cardIndex) => {
        if (!this.isValidCardSnapshot(card)) {
          errors.push(`Invalid card in foundation pile ${pileIndex}, position ${cardIndex}`);
        }
      });
    });

    // Validate stock cards
    if (snapshot.stock) {
      snapshot.stock.forEach((card, cardIndex) => {
        if (!this.isValidCardSnapshot(card)) {
          errors.push(`Invalid card in stock, position ${cardIndex}`);
        }
      });
    }

    // Validate waste cards
    if (snapshot.waste) {
      snapshot.waste.forEach((card, cardIndex) => {
        if (!this.isValidCardSnapshot(card)) {
          errors.push(`Invalid card in waste, position ${cardIndex}`);
        }
      });
    }

    // Validate free cells cards
    if (snapshot.freeCells) {
      snapshot.freeCells.forEach((card, cardIndex) => {
        if (!this.isValidCardSnapshot(card)) {
          errors.push(`Invalid card in free cells, position ${cardIndex}`);
        }
      });
    }

    return errors;
  }

  /**
   * Validate a single card snapshot
   */
  private isValidCardSnapshot(card: any): boolean {
    return (
      typeof card === 'object' &&
      card !== null &&
      typeof card.id === 'string' &&
      typeof card.suit === 'string' &&
      typeof card.rank === 'number' &&
      card.rank >= 1 && card.rank <= 13 &&
      typeof card.faceUp === 'boolean' &&
      typeof card.draggable === 'boolean' &&
      typeof card.position === 'object' &&
      card.position !== null &&
      typeof card.position.x === 'number' &&
      typeof card.position.y === 'number'
    );
  }

  /**
   * Reconstruct multiple card piles with error handling
   */
  private reconstructCardPiles(piles: CardSnapshot[][], pileType: string): any[][] {
    return piles.map((pile, index) => {
      try {
        return this.reconstructCardPile(pile, `${pileType}-${index}`);
      } catch (error) {
        logError(new Error(`Failed to reconstruct ${pileType} pile ${index}`), 'REPLAY', { error: error.message });
        return []; // Return empty pile on error
      }
    });
  }

  /**
   * Reconstruct a single card pile with error handling
   */
  private reconstructCardPile(pile: CardSnapshot[], pileType: string): any[] {
    return pile.map((cardSnapshot, index) => {
      try {
        return this.convertCardSnapshotToCard(cardSnapshot);
      } catch (error) {
        logError(new Error(`Failed to reconstruct card in ${pileType} at position ${index}`), 'REPLAY', { 
          error: error.message,
          cardId: cardSnapshot?.id
        });
        throw error; // Re-throw to be caught by pile reconstruction
      }
    });
  }

  /**
   * Validate the reconstructed game state against the original snapshot
   */
  private validateReconstructedGameState(gameState: GameState, originalSnapshot: GameStateSnapshot): boolean {
    try {
      // Check basic properties
      if (gameState.gameType !== originalSnapshot.gameType) {
        return false;
      }

      if (gameState.score !== originalSnapshot.score) {
        return false;
      }

      // Check pile counts
      if (gameState.tableau.length !== originalSnapshot.tableau.length) {
        return false;
      }

      if (gameState.foundation.length !== originalSnapshot.foundation.length) {
        return false;
      }

      // Check individual pile sizes
      for (let i = 0; i < gameState.tableau.length; i++) {
        if (gameState.tableau[i].length !== originalSnapshot.tableau[i].length) {
          return false;
        }
      }

      for (let i = 0; i < gameState.foundation.length; i++) {
        if (gameState.foundation[i].length !== originalSnapshot.foundation[i].length) {
          return false;
        }
      }

      // Check optional piles
      if (originalSnapshot.stock && (!gameState.stock || gameState.stock.length !== originalSnapshot.stock.length)) {
        return false;
      }

      if (originalSnapshot.waste && (!gameState.waste || gameState.waste.length !== originalSnapshot.waste.length)) {
        return false;
      }

      if (originalSnapshot.freeCells && (!gameState.freeCells || gameState.freeCells.length !== originalSnapshot.freeCells.length)) {
        return false;
      }

      return true;
    } catch (error) {
      logError(new Error('Error during game state validation'), 'REPLAY', { error: error.message });
      return false;
    }
  }

  /**
   * Convert CardSnapshot to Card object
   */
  private convertCardSnapshotToCard(cardSnapshot: any): any {
    // This would need to be implemented based on the actual Card class structure
    // For now, return the snapshot as-is since the types are compatible
    return {
      id: cardSnapshot.id,
      suit: cardSnapshot.suit,
      rank: cardSnapshot.rank,
      faceUp: cardSnapshot.faceUp,
      draggable: cardSnapshot.draggable,
      position: cardSnapshot.position
    };
  }

  /**
   * Validate events array for replay
   */
  private validateEvents(events: UIActionEvent[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(events)) {
      errors.push('Events must be an array');
      return { isValid: false, errors };
    }

    if (events.length === 0) {
      errors.push('Events array cannot be empty');
      return { isValid: false, errors };
    }

    // Validate each event
    events.forEach((event, index) => {
      if (!isValidUIActionEvent(event)) {
        errors.push(`Invalid event at index ${index}`);
      }
    });

    // Check chronological order
    for (let i = 1; i < events.length; i++) {
      const prevTime = new Date(events[i - 1].timestamp).getTime();
      const currTime = new Date(events[i].timestamp).getTime();
      
      if (currTime < prevTime) {
        errors.push(`Events not in chronological order at index ${i}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate state consistency between replayed and logged states
   */
  private validateStateConsistency(replayedState: GameState, loggedSnapshot: GameStateSnapshot): boolean {
    try {
      const inconsistencies: string[] = [];

      // Compare basic game properties
      if (replayedState.gameType !== loggedSnapshot.gameType) {
        inconsistencies.push(`Game type mismatch: ${replayedState.gameType} vs ${loggedSnapshot.gameType}`);
      }

      if (replayedState.score !== loggedSnapshot.score) {
        inconsistencies.push(`Score mismatch: ${replayedState.score} vs ${loggedSnapshot.score}`);
      }

      // Compare tableau structure
      if (replayedState.tableau.length !== loggedSnapshot.tableau.length) {
        inconsistencies.push(`Tableau pile count mismatch: ${replayedState.tableau.length} vs ${loggedSnapshot.tableau.length}`);
      } else {
        // Compare individual tableau piles
        for (let i = 0; i < replayedState.tableau.length; i++) {
          const replayedPile = replayedState.tableau[i];
          const loggedPile = loggedSnapshot.tableau[i];
          
          if (replayedPile.length !== loggedPile.length) {
            inconsistencies.push(`Tableau pile ${i} size mismatch: ${replayedPile.length} vs ${loggedPile.length}`);
          } else {
            // Compare individual cards in the pile
            for (let j = 0; j < replayedPile.length; j++) {
              const cardInconsistencies = this.compareCards(replayedPile[j], loggedPile[j], `tableau[${i}][${j}]`);
              inconsistencies.push(...cardInconsistencies);
            }
          }
        }
      }

      // Compare foundation structure
      if (replayedState.foundation.length !== loggedSnapshot.foundation.length) {
        inconsistencies.push(`Foundation pile count mismatch: ${replayedState.foundation.length} vs ${loggedSnapshot.foundation.length}`);
      } else {
        // Compare individual foundation piles
        for (let i = 0; i < replayedState.foundation.length; i++) {
          const replayedPile = replayedState.foundation[i];
          const loggedPile = loggedSnapshot.foundation[i];
          
          if (replayedPile.length !== loggedPile.length) {
            inconsistencies.push(`Foundation pile ${i} size mismatch: ${replayedPile.length} vs ${loggedPile.length}`);
          } else {
            // Compare individual cards in the pile
            for (let j = 0; j < replayedPile.length; j++) {
              const cardInconsistencies = this.compareCards(replayedPile[j], loggedPile[j], `foundation[${i}][${j}]`);
              inconsistencies.push(...cardInconsistencies);
            }
          }
        }
      }

      // Compare stock pile
      if (loggedSnapshot.stock) {
        if (!replayedState.stock) {
          inconsistencies.push('Stock pile missing in replayed state');
        } else if (replayedState.stock.length !== loggedSnapshot.stock.length) {
          inconsistencies.push(`Stock pile size mismatch: ${replayedState.stock.length} vs ${loggedSnapshot.stock.length}`);
        } else {
          for (let i = 0; i < replayedState.stock.length; i++) {
            const cardInconsistencies = this.compareCards(replayedState.stock[i], loggedSnapshot.stock[i], `stock[${i}]`);
            inconsistencies.push(...cardInconsistencies);
          }
        }
      } else if (replayedState.stock && replayedState.stock.length > 0) {
        inconsistencies.push('Unexpected stock pile in replayed state');
      }

      // Compare waste pile
      if (loggedSnapshot.waste) {
        if (!replayedState.waste) {
          inconsistencies.push('Waste pile missing in replayed state');
        } else if (replayedState.waste.length !== loggedSnapshot.waste.length) {
          inconsistencies.push(`Waste pile size mismatch: ${replayedState.waste.length} vs ${loggedSnapshot.waste.length}`);
        } else {
          for (let i = 0; i < replayedState.waste.length; i++) {
            const cardInconsistencies = this.compareCards(replayedState.waste[i], loggedSnapshot.waste[i], `waste[${i}]`);
            inconsistencies.push(...cardInconsistencies);
          }
        }
      } else if (replayedState.waste && replayedState.waste.length > 0) {
        inconsistencies.push('Unexpected waste pile in replayed state');
      }

      // Compare free cells (for FreeCell variant)
      if (loggedSnapshot.freeCells) {
        if (!replayedState.freeCells) {
          inconsistencies.push('Free cells missing in replayed state');
        } else if (replayedState.freeCells.length !== loggedSnapshot.freeCells.length) {
          inconsistencies.push(`Free cells size mismatch: ${replayedState.freeCells.length} vs ${loggedSnapshot.freeCells.length}`);
        } else {
          for (let i = 0; i < replayedState.freeCells.length; i++) {
            const cardInconsistencies = this.compareCards(replayedState.freeCells[i], loggedSnapshot.freeCells[i], `freeCells[${i}]`);
            inconsistencies.push(...cardInconsistencies);
          }
        }
      } else if (replayedState.freeCells && replayedState.freeCells.length > 0) {
        inconsistencies.push('Unexpected free cells in replayed state');
      }

      // Log inconsistencies if found
      if (inconsistencies.length > 0) {
        logError(new Error('State consistency validation failed'), 'REPLAY', {
          inconsistencyCount: inconsistencies.length,
          inconsistencies: inconsistencies.slice(0, 10), // Log first 10 inconsistencies
          snapshotId: loggedSnapshot.metadata?.sequenceNumber
        });
        return false;
      }

      return true;
    } catch (error) {
      logError(new Error('Error during state consistency validation'), 'REPLAY', { 
        error: error.message,
        snapshotId: loggedSnapshot.metadata?.sequenceNumber
      });
      return false;
    }
  }

  /**
   * Determine if an error is recoverable with enhanced error categorization
   */
  private isRecoverableError(error: string): boolean {
    const recoverableErrors = [
      'Invalid event structure',
      'Missing event data',
      'Animation timing mismatch',
      'State consistency validation failed',
      'Invalid card snapshot',
      'Missing card data',
      'Validation timeout',
      'Performance metric collection failed',
      'Non-critical animation error',
      'UI synchronization issue'
    ];
    
    const nonRecoverableErrors = [
      'Fatal game engine error',
      'Critical state corruption',
      'Memory allocation failure',
      'System resource exhaustion',
      'Invalid game type',
      'Corrupted event log structure'
    ];
    
    // Check for non-recoverable errors first
    const isNonRecoverable = nonRecoverableErrors.some(nonRecoverableError => 
      error.toLowerCase().includes(nonRecoverableError.toLowerCase())
    );
    
    if (isNonRecoverable) {
      return false;
    }
    
    // Check for recoverable errors
    return recoverableErrors.some(recoverableError => 
      error.toLowerCase().includes(recoverableError.toLowerCase())
    );
  }

  /**
   * Validate and sanitize corrupted or incomplete event logs
   */
  public validateAndSanitizeEventLog(events: UIActionEvent[]): {
    validEvents: UIActionEvent[];
    corruptedEvents: { index: number; event: any; reason: string }[];
    incompleteEvents: { index: number; event: UIActionEvent; missingFields: string[] }[];
    sanitizationReport: {
      totalEvents: number;
      validEvents: number;
      corruptedEvents: number;
      incompleteEvents: number;
      sanitizedEvents: number;
    };
  } {
    const validEvents: UIActionEvent[] = [];
    const corruptedEvents: { index: number; event: any; reason: string }[] = [];
    const incompleteEvents: { index: number; event: UIActionEvent; missingFields: string[] }[] = [];
    let sanitizedCount = 0;

    logGameAction('Starting event log validation and sanitization', 'REPLAY', {
      totalEvents: events.length
    });

    events.forEach((event, index) => {
      try {
        // Check for completely corrupted events
        if (!event || typeof event !== 'object') {
          corruptedEvents.push({
            index,
            event,
            reason: 'Event is not a valid object'
          });
          return;
        }

        // Check for missing critical fields
        const missingFields = this.checkMissingEventFields(event);
        if (missingFields.length > 0) {
          // Try to sanitize the event
          const sanitizedEvent = this.sanitizeIncompleteEvent(event, index);
          if (sanitizedEvent) {
            validEvents.push(sanitizedEvent);
            sanitizedCount++;
            logGameAction('Successfully sanitized incomplete event', 'REPLAY', {
              eventIndex: index,
              eventId: sanitizedEvent.id,
              missingFields
            });
          } else {
            incompleteEvents.push({
              index,
              event,
              missingFields
            });
          }
          return;
        }

        // Validate event structure
        if (!isValidUIActionEvent(event)) {
          corruptedEvents.push({
            index,
            event,
            reason: 'Event failed structure validation'
          });
          return;
        }

        // Validate game state snapshots if present
        if (event.gameStateBefore && !isValidGameStateSnapshot(event.gameStateBefore)) {
          // Try to sanitize the snapshot
          const sanitizedEvent = { ...event };
          delete sanitizedEvent.gameStateBefore;
          validEvents.push(sanitizedEvent);
          sanitizedCount++;
          logGameAction('Removed invalid gameStateBefore snapshot', 'REPLAY', {
            eventIndex: index,
            eventId: event.id
          });
          return;
        }

        if (event.gameStateAfter && !isValidGameStateSnapshot(event.gameStateAfter)) {
          // Try to sanitize the snapshot
          const sanitizedEvent = { ...event };
          delete sanitizedEvent.gameStateAfter;
          validEvents.push(sanitizedEvent);
          sanitizedCount++;
          logGameAction('Removed invalid gameStateAfter snapshot', 'REPLAY', {
            eventIndex: index,
            eventId: event.id
          });
          return;
        }

        // Event is valid
        validEvents.push(event);

      } catch (error) {
        corruptedEvents.push({
          index,
          event,
          reason: `Validation error: ${error.message}`
        });
      }
    });

    const sanitizationReport = {
      totalEvents: events.length,
      validEvents: validEvents.length,
      corruptedEvents: corruptedEvents.length,
      incompleteEvents: incompleteEvents.length,
      sanitizedEvents: sanitizedCount
    };

    logGameAction('Event log validation and sanitization completed', 'REPLAY', sanitizationReport);

    return {
      validEvents,
      corruptedEvents,
      incompleteEvents,
      sanitizationReport
    };
  }

  /**
   * Check for missing required fields in an event
   */
  private checkMissingEventFields(event: any): string[] {
    const requiredFields = ['id', 'timestamp', 'type', 'component', 'data'];
    const missingFields: string[] = [];

    requiredFields.forEach(field => {
      if (!event[field]) {
        missingFields.push(field);
      }
    });

    // Check for valid timestamp format
    if (event.timestamp && isNaN(Date.parse(event.timestamp))) {
      missingFields.push('timestamp (invalid format)');
    }

    // Check for valid event type
    if (event.type && !Object.values(UIActionEventType).includes(event.type)) {
      missingFields.push('type (invalid value)');
    }

    return missingFields;
  }

  /**
   * Attempt to sanitize an incomplete event
   */
  private sanitizeIncompleteEvent(event: any, index: number): UIActionEvent | null {
    try {
      const sanitizedEvent: any = { ...event };

      // Generate missing ID
      if (!sanitizedEvent.id) {
        sanitizedEvent.id = `sanitized-event-${index}-${Date.now()}`;
      }

      // Generate missing timestamp
      if (!sanitizedEvent.timestamp) {
        sanitizedEvent.timestamp = new Date().toISOString();
      }

      // Set default component if missing
      if (!sanitizedEvent.component) {
        sanitizedEvent.component = 'Unknown';
      }

      // Set default data if missing
      if (!sanitizedEvent.data) {
        sanitizedEvent.data = {};
      }

      // Validate event type - if invalid or missing, try to infer from data
      if (!sanitizedEvent.type || !Object.values(UIActionEventType).includes(sanitizedEvent.type)) {
        const inferredType = this.inferEventTypeFromData(sanitizedEvent.data);
        if (inferredType) {
          sanitizedEvent.type = inferredType;
        } else {
          // Cannot sanitize without valid type
          return null;
        }
      }

      // Final validation
      if (isValidUIActionEvent(sanitizedEvent)) {
        return sanitizedEvent as UIActionEvent;
      }

      return null;
    } catch (error) {
      logError(new Error('Failed to sanitize incomplete event'), 'REPLAY', {
        eventIndex: index,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Infer event type from event data
   */
  private inferEventTypeFromData(data: any): UIActionEventType | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Check for drag and drop indicators
    if (data.sourcePosition && data.targetPosition) {
      return UIActionEventType.DRAG_DROP;
    }

    if (data.sourcePosition && !data.targetPosition) {
      return UIActionEventType.DRAG_START;
    }

    // Check for move indicators
    if (data.moveType || data.moveSuccess !== undefined) {
      return UIActionEventType.MOVE_EXECUTED;
    }

    // Check for click indicators
    if (data.clickTarget || data.clickCoordinates) {
      return UIActionEventType.CARD_CLICK;
    }

    // Check for state change indicators
    if (data.changeType) {
      return UIActionEventType.STATE_CHANGE;
    }

    return null;
  }

  /**
   * Calculate performance metrics for replay
   */
  private calculatePerformanceMetrics(startTime: number): ReplayPerformanceMetrics {
    const totalTime = performance.now() - startTime;
    const stepsExecuted = this.state.currentStep;
    
    return {
      totalReplayTime: totalTime,
      averageEventProcessingTime: stepsExecuted > 0 ? totalTime / stepsExecuted : 0,
      stateReconstructionTime: 0, // Would need to be tracked separately
      validationTime: 0 // Would need to be tracked separately
    };
  }

  /**
   * Get current replay state information
   */
  public getReplayState(): Readonly<ReplayEngineState> {
    return { ...this.state };
  }

  /**
   * Finalize replay execution and produce a result summary
   */
  public finalizeReplay(): ReplayResult {
    if (this.state.isReplaying) {
      this.state.isReplaying = false;
    }
    this.state.isPaused = true;

    const result: ReplayResult = {
      success: this.state.errors.filter(error => !error.recoverable).length === 0,
      finalGameState: this.state.currentGameState,
      stepsExecuted: this.state.currentStep,
      errors: [...this.state.errors],
      performance: this.calculatePerformanceMetrics(this.state.startTime)
    };

    logGameAction('Replay finalized', 'REPLAY', {
      stepsExecuted: result.stepsExecuted,
      success: result.success,
      errorCount: result.errors?.length || 0
    });

    return result;
  }

  /**
   * Get current replay progress as percentage
   */
  public getProgress(): number {
    if (this.state.totalSteps === 0) return 0;
    return (this.state.currentStep / this.state.totalSteps) * 100;
  }

  /**
   * Check if replay is currently active
   */
  public isActive(): boolean {
    return this.state.isReplaying;
  }

  /**
   * Check if replay is currently paused
   */
  public isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get total number of events to replay
   */
  public getTotalSteps(): number {
    return this.state.totalSteps;
  }

  /**
   * Get current step number
   */
  public getCurrentStep(): number {
    return this.state.currentStep;
  }

  /**
   * Compare two cards and return list of inconsistencies
   */
  private compareCards(replayedCard: any, loggedCard: CardSnapshot, location: string): string[] {
    const inconsistencies: string[] = [];

    if (!replayedCard && !loggedCard) {
      return inconsistencies; // Both null/undefined, consistent
    }

    if (!replayedCard || !loggedCard) {
      inconsistencies.push(`Card existence mismatch at ${location}: ${!!replayedCard} vs ${!!loggedCard}`);
      return inconsistencies;
    }

    if (replayedCard.id !== loggedCard.id) {
      inconsistencies.push(`Card ID mismatch at ${location}: ${replayedCard.id} vs ${loggedCard.id}`);
    }

    if (replayedCard.suit !== loggedCard.suit) {
      inconsistencies.push(`Card suit mismatch at ${location}: ${replayedCard.suit} vs ${loggedCard.suit}`);
    }

    if (replayedCard.rank !== loggedCard.rank) {
      inconsistencies.push(`Card rank mismatch at ${location}: ${replayedCard.rank} vs ${loggedCard.rank}`);
    }

    if (replayedCard.faceUp !== loggedCard.faceUp) {
      inconsistencies.push(`Card faceUp mismatch at ${location}: ${replayedCard.faceUp} vs ${loggedCard.faceUp}`);
    }

    // Note: We don't compare draggable and position as these may legitimately differ during replay

    return inconsistencies;
  }

  /**
   * Perform comprehensive state validation with detailed reporting
   */
  public performComprehensiveStateValidation(
    replayedState: GameState, 
    loggedSnapshot: GameStateSnapshot
  ): {
    isValid: boolean;
    inconsistencies: string[];
    validationReport: {
      basicPropertiesValid: boolean;
      tableauValid: boolean;
      foundationValid: boolean;
      stockValid: boolean;
      wasteValid: boolean;
      freeCellsValid: boolean;
    };
  } {
    const inconsistencies: string[] = [];
    const validationReport = {
      basicPropertiesValid: true,
      tableauValid: true,
      foundationValid: true,
      stockValid: true,
      wasteValid: true,
      freeCellsValid: true
    };

    try {
      // Validate basic properties
      if (replayedState.gameType !== loggedSnapshot.gameType) {
        inconsistencies.push(`Game type mismatch: ${replayedState.gameType} vs ${loggedSnapshot.gameType}`);
        validationReport.basicPropertiesValid = false;
      }

      if (replayedState.score !== loggedSnapshot.score) {
        inconsistencies.push(`Score mismatch: ${replayedState.score} vs ${loggedSnapshot.score}`);
        validationReport.basicPropertiesValid = false;
      }

      // Validate tableau
      const tableauInconsistencies = this.validatePileStructure(
        replayedState.tableau, 
        loggedSnapshot.tableau, 
        'tableau'
      );
      if (tableauInconsistencies.length > 0) {
        inconsistencies.push(...tableauInconsistencies);
        validationReport.tableauValid = false;
      }

      // Validate foundation
      const foundationInconsistencies = this.validatePileStructure(
        replayedState.foundation, 
        loggedSnapshot.foundation, 
        'foundation'
      );
      if (foundationInconsistencies.length > 0) {
        inconsistencies.push(...foundationInconsistencies);
        validationReport.foundationValid = false;
      }

      // Validate stock
      if (loggedSnapshot.stock || replayedState.stock) {
        if (loggedSnapshot.stock && !replayedState.stock) {
          inconsistencies.push('Stock pile missing in replayed state');
          validationReport.stockValid = false;
        } else if (!loggedSnapshot.stock && replayedState.stock && replayedState.stock.length > 0) {
          inconsistencies.push('Unexpected stock pile in replayed state');
          validationReport.stockValid = false;
        } else {
          const stockInconsistencies = this.validateSinglePile(
            replayedState.stock || [], 
            loggedSnapshot.stock || [], 
            'stock'
          );
          if (stockInconsistencies.length > 0) {
            inconsistencies.push(...stockInconsistencies);
            validationReport.stockValid = false;
          }
        }
      }

      // Validate waste
      if (loggedSnapshot.waste || replayedState.waste) {
        const wasteInconsistencies = this.validateSinglePile(
          replayedState.waste || [], 
          loggedSnapshot.waste || [], 
          'waste'
        );
        if (wasteInconsistencies.length > 0) {
          inconsistencies.push(...wasteInconsistencies);
          validationReport.wasteValid = false;
        }
      }

      // Validate free cells
      if (loggedSnapshot.freeCells || replayedState.freeCells) {
        const freeCellsInconsistencies = this.validateSinglePile(
          replayedState.freeCells || [], 
          loggedSnapshot.freeCells || [], 
          'freeCells'
        );
        if (freeCellsInconsistencies.length > 0) {
          inconsistencies.push(...freeCellsInconsistencies);
          validationReport.freeCellsValid = false;
        }
      }

      return {
        isValid: inconsistencies.length === 0,
        inconsistencies,
        validationReport
      };

    } catch (error) {
      logError(new Error('Error during comprehensive state validation'), 'REPLAY', { error: error.message });
      return {
        isValid: false,
        inconsistencies: [`Validation error: ${error.message}`],
        validationReport
      };
    }
  }

  /**
   * Validate a multi-pile structure (tableau or foundation)
   */
  private validatePileStructure(replayedPiles: any[][], loggedPiles: CardSnapshot[][], pileType: string): string[] {
    const inconsistencies: string[] = [];

    if (replayedPiles.length !== loggedPiles.length) {
      inconsistencies.push(`${pileType} pile count mismatch: ${replayedPiles.length} vs ${loggedPiles.length}`);
      return inconsistencies;
    }

    for (let i = 0; i < replayedPiles.length; i++) {
      const pileInconsistencies = this.validateSinglePile(replayedPiles[i], loggedPiles[i], `${pileType}[${i}]`);
      inconsistencies.push(...pileInconsistencies);
    }

    return inconsistencies;
  }

  /**
   * Validate a single pile of cards
   */
  private validateSinglePile(replayedPile: any[], loggedPile: CardSnapshot[], pileLocation: string): string[] {
    const inconsistencies: string[] = [];

    if (replayedPile.length !== loggedPile.length) {
      inconsistencies.push(`${pileLocation} size mismatch: ${replayedPile.length} vs ${loggedPile.length}`);
      return inconsistencies;
    }

    for (let i = 0; i < replayedPile.length; i++) {
      const cardInconsistencies = this.compareCards(replayedPile[i], loggedPile[i], `${pileLocation}[${i}]`);
      inconsistencies.push(...cardInconsistencies);
    }

    return inconsistencies;
  }
}

/**
 * Singleton instance for global access
 */
export const uiActionReplayEngine = new UIActionReplayEngine();
