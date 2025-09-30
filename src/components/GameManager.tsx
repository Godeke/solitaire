import React, { useState, useCallback, useEffect } from 'react';
import { KlondikeGameBoard } from './KlondikeGameBoard';
import { SpiderGameBoard } from './SpiderGameBoard';
import { FreeCellGameBoard } from './FreeCellGameBoard';
import { GameControls } from './GameControls';
import { MainMenu } from './MainMenu';
import { ReplayControls } from './ReplayControls';
import { ReplayAnalyzer } from './ReplayAnalyzer';
import { GameStateManager } from '../utils/GameStateManager';
import { StatisticsManager, GameCompletionData } from '../utils/StatisticsManager';
import { UIActionReplayEngine } from '../utils/UIActionReplayEngine';
import { getAudioManager } from '../utils/AudioManager';
import { UserPreferencesManager } from '../utils/UserPreferences';
import { GameState } from '../types/card';
import { UIActionEvent, ReplayOptions, ReplayResult } from '../types/UIActionLogging';
import { logUserInteraction, logComponentMount, logComponentUnmount, logError, logGameAction } from '../utils/RendererLogger';
import './GameManager.css';

export type GameType = 'klondike' | 'spider' | 'freecell';
export type AppState = 'menu' | 'game' | 'replay';

export interface ReplayState {
  isActive: boolean;
  events: UIActionEvent[];
  currentStep: number;
  totalSteps: number;
  isPaused: boolean;
  replayEngine: UIActionReplayEngine | null;
  replayResult: ReplayResult | null;
  replayOptions: ReplayOptions | null;
}

export interface GameManagerProps {
  initialGameType?: GameType;
  initialState?: AppState;
  onStateChange?: (state: AppState, gameType?: GameType) => void;
  className?: string;
  // Replay functionality props
  replayEvents?: UIActionEvent[];
  enableReplayMode?: boolean;
  onReplayComplete?: (result: ReplayResult) => void;
  // Developer debugging props
  showReplayAnalyzer?: boolean;
  onEventSelect?: (event: UIActionEvent, index: number) => void;
}

export const GameManager: React.FC<GameManagerProps> = ({
  initialGameType = 'klondike',
  initialState = 'menu',
  onStateChange,
  className = '',
  replayEvents,
  enableReplayMode = false,
  onReplayComplete,
  showReplayAnalyzer = false,
  onEventSelect
}) => {
  const [appState, setAppState] = useState<AppState>(initialState);
  const [currentGameType, setCurrentGameType] = useState<GameType>(initialGameType);
  const [gameKey, setGameKey] = useState<number>(0); // Force re-render of game board
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [score, setScore] = useState<number>(0);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [isGameWon, setIsGameWon] = useState<boolean>(false);
  
  // Replay state management
  const [replayState, setReplayState] = useState<ReplayState>({
    isActive: false,
    events: [],
    currentStep: 0,
    totalSteps: 0,
    isPaused: false,
    replayEngine: null,
    replayResult: null,
    replayOptions: null
  });

  // Developer debugging state
  const [showAnalyzer, setShowAnalyzer] = useState<boolean>(showReplayAnalyzer);
  const [selectedEvent, setSelectedEvent] = useState<UIActionEvent | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<UIActionEvent[]>([]);

  // Component lifecycle logging and audio initialization
  useEffect(() => {
    logComponentMount('GameManager', { initialGameType, initialState });
    
    // Initialize audio manager with user preferences
    const audioManager = getAudioManager();
    const preferencesManager = UserPreferencesManager.getInstance();
    const audioPrefs = preferencesManager.getAudioPreferences();
    
    audioManager.setEnabled(audioPrefs.enabled);
    audioManager.setVolume(audioPrefs.volume);
    
    return () => {
      logComponentUnmount('GameManager');
      audioManager.dispose();
    };
  }, []);

  // Handle app close - save current game state and record incomplete games
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Save current game state if in progress
      if (gameState && appState === 'game') {
        GameStateManager.saveGameState(gameState);
        
        // Record incomplete game as loss if not won and has progress
        if (!isGameWon && (score > 0 || moveCount > 0)) {
          const completedAt = new Date();
          const duration = completedAt.getTime() - gameState.timeStarted.getTime();
          
          const completionData: GameCompletionData = {
            gameType: currentGameType,
            won: false,
            duration,
            moves: moveCount,
            score,
            completedAt
          };
          
          StatisticsManager.recordGameCompletion(completionData);
          
          logUserInteraction('Game abandoned on app close', 'GameManager', {
            gameType: currentGameType,
            finalScore: score,
            totalMoves: moveCount,
            duration
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameState, appState, isGameWon, score, moveCount, currentGameType]);

  // Load saved game state on mount
  useEffect(() => {
    if (appState === 'game') {
      try {
        const savedState = GameStateManager.loadGameState(currentGameType);
        if (savedState) {
          setGameState(savedState);
          setScore(savedState.score);
          setMoveCount(savedState.moves.length);
          logUserInteraction('Loaded saved game', 'GameManager', { 
            gameType: currentGameType,
            score: savedState.score,
            moves: savedState.moves.length
          });
        }
      } catch (error) {
        logError(error as Error, 'GameManager.loadGameState', { gameType: currentGameType });
      }
    }
  }, [appState, currentGameType]);

  // Save game state when it changes
  useEffect(() => {
    if (gameState && appState === 'game') {
      GameStateManager.saveGameState(gameState);
    }
  }, [gameState, appState]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(appState, appState === 'game' || appState === 'replay' ? currentGameType : undefined);
    }
  }, [appState, currentGameType, onStateChange]);

  const handleStartGame = useCallback((gameType: GameType) => {
    // Record incomplete game as loss if switching games mid-play
    if (gameState && !isGameWon && (score > 0 || moveCount > 0)) {
      const completedAt = new Date();
      const duration = completedAt.getTime() - gameState.timeStarted.getTime();
      
      const completionData: GameCompletionData = {
        gameType: currentGameType,
        won: false,
        duration,
        moves: moveCount,
        score,
        completedAt
      };
      
      StatisticsManager.recordGameCompletion(completionData);
      
      logUserInteraction('Game abandoned', 'GameManager', {
        gameType: currentGameType,
        finalScore: score,
        totalMoves: moveCount,
        duration
      });
    }
    
    logUserInteraction('Start new game', 'GameManager', { gameType });
    
    setCurrentGameType(gameType);
    setAppState('game');
    setGameKey(prev => prev + 1); // Force new game
    setIsGameWon(false);
    setScore(0);
    setMoveCount(0);
    
    // Clear any existing saved state for new game
    try {
      GameStateManager.clearGameState(gameType);
    } catch (error) {
      logError(error as Error, 'GameManager.clearGameState', { gameType });
    }
  }, [gameState, isGameWon, score, moveCount, currentGameType]);

  const handleContinueGame = useCallback((gameType: GameType) => {
    logUserInteraction('Continue existing game', 'GameManager', { gameType });
    
    setCurrentGameType(gameType);
    setAppState('game');
    setIsGameWon(false);
    
    // Game state will be loaded in useEffect
  }, []);

  const handleBackToMenu = useCallback(() => {
    logUserInteraction('Back to menu', 'GameManager', { 
      currentGameType,
      score,
      moveCount,
      wasGameWon: isGameWon
    });
    
    setAppState('menu');
    setGameState(null);
    setIsGameWon(false);
  }, [currentGameType, score, moveCount, isGameWon]);

  const handleNewGame = useCallback(() => {
    setGameKey(prev => prev + 1); // Force re-render with new game
    setIsGameWon(false);
    setScore(0);
    setMoveCount(0);
    
    // Clear saved state
    GameStateManager.clearGameState(currentGameType);
  }, [currentGameType]);

  const handleGameWin = useCallback(async () => {
    const completedAt = new Date();
    const duration = gameState ? completedAt.getTime() - gameState.timeStarted.getTime() : 0;
    
    // Play win sound effect
    const audioManager = getAudioManager();
    await audioManager.playSound('game-win');
    
    logUserInteraction('Game won', 'GameManager', {
      gameType: currentGameType,
      finalScore: score,
      totalMoves: moveCount,
      duration,
      gameState: gameState ? {
        timeStarted: gameState.timeStarted,
        duration
      } : null
    });
    
    // Record game completion in statistics
    if (gameState) {
      const completionData: GameCompletionData = {
        gameType: currentGameType,
        won: true,
        duration,
        moves: moveCount,
        score,
        completedAt
      };
      
      StatisticsManager.recordGameCompletion(completionData);
    }
    
    setIsGameWon(true);
  }, [currentGameType, score, moveCount, gameState]);

  const handleScoreChange = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleMoveCountChange = useCallback((moves: number) => {
    setMoveCount(moves);
  }, []);

  // Replay functionality methods
  const handleStartReplay = useCallback(async (events: UIActionEvent[], options?: Partial<ReplayOptions>) => {
    const { stepByStep = false, validateStates = true, stopAtStep } = options ?? {};

    try {
      const replayOptions: ReplayOptions = {
        events,
        stepByStep,
        validateStates,
        ...(typeof stopAtStep === 'number' ? { stopAtStep } : {})
      };

      logGameAction('Starting replay mode', 'REPLAY', {
        eventCount: events.length,
        gameType: currentGameType,
        stepByStep: replayOptions.stepByStep,
        validateStates: replayOptions.validateStates,
        stopAtStep: replayOptions.stopAtStep
      });

      const replayEngine = new UIActionReplayEngine();
      const initialized = replayEngine.initializeReplay(replayOptions);
      if (!initialized) {
        throw new Error('Failed to initialize replay engine');
      }

      setReplayState({
        isActive: true,
        events,
        currentStep: 0,
        totalSteps: replayEngine.getTotalSteps(),
        isPaused: replayOptions.stepByStep,
        replayEngine,
        replayResult: null,
        replayOptions
      });

      setAppState('replay');
      setGameKey(prev => prev + 1);

      const result = await replayEngine.startReplay();
      const updatedCurrentStep = replayEngine.getCurrentStep();
      const updatedTotalSteps = replayEngine.getTotalSteps();

      if (replayOptions.stepByStep) {
        setReplayState(prev => ({
          ...prev,
          currentStep: updatedCurrentStep,
          totalSteps: updatedTotalSteps,
          isPaused: true,
          isActive: true
        }));
        return result;
      }

      setReplayState(prev => ({
        ...prev,
        currentStep: updatedCurrentStep,
        totalSteps: updatedTotalSteps,
        isActive: false,
        isPaused: false,
        replayResult: result
      }));

      if (onReplayComplete) {
        onReplayComplete(result);
      }

      return result;
    } catch (error) {
      logError(error as Error, 'GameManager.handleStartReplay', { eventCount: events.length });
      throw error;
    }
  }, [currentGameType, onReplayComplete]);

  // Initialize replay mode if replay events are provided
  useEffect(() => {
    if (enableReplayMode && replayEvents && replayEvents.length > 0 && !replayState.isActive && appState !== 'replay') {
      handleStartReplay(replayEvents, { stepByStep: true });
    }
  }, [enableReplayMode, replayEvents, replayState.isActive, appState, handleStartReplay]);

  const handleReplayStep = useCallback(async () => {
    const { replayEngine } = replayState;
    if (!replayEngine || !replayState.isActive) {
      return;
    }

    try {
      const result = await replayEngine.nextStep();
      const currentStep = replayEngine.getCurrentStep();
      const totalSteps = replayEngine.getTotalSteps();
      const hasCompleted = currentStep >= totalSteps;

      const finalResult = hasCompleted ? replayEngine.finalizeReplay() : null;

      setReplayState(prev => ({
        ...prev,
        currentStep,
        totalSteps,
        isActive: hasCompleted ? false : prev.isActive,
        isPaused: hasCompleted ? true : prev.isPaused,
        replayResult: finalResult ?? prev.replayResult
      }));

      logGameAction('Replay step executed', 'REPLAY', {
        step: currentStep,
        success: result.success,
        processingTime: result.processingTime
      });

      if (finalResult && onReplayComplete) {
        onReplayComplete(finalResult);
      }

      return result;
    } catch (error) {
      logError(error as Error, 'GameManager.handleReplayStep', {
        currentStep: replayState.currentStep
      });
      throw error;
    }
  }, [replayState.replayEngine, replayState.isActive, replayState.currentStep, onReplayComplete]);

  const handleReplayPause = useCallback(() => {
    if (replayState.replayEngine) {
      replayState.replayEngine.pauseReplay();
      setReplayState(prev => ({ ...prev, isPaused: true }));
      logGameAction('Replay paused', 'REPLAY', { currentStep: replayState.currentStep });
    }
  }, [replayState]);

  const handleReplayResume = useCallback(() => {
    if (replayState.replayEngine) {
      replayState.replayEngine.resumeReplay();
      setReplayState(prev => ({ ...prev, isPaused: false }));
      logGameAction('Replay resumed', 'REPLAY', { currentStep: replayState.currentStep });
    }
  }, [replayState]);

  const handleReplayStop = useCallback(() => {
    if (replayState.replayEngine) {
      replayState.replayEngine.stopReplay();
    }
    
    setReplayState({
      isActive: false,
      events: [],
      currentStep: 0,
      totalSteps: 0,
      isPaused: false,
      replayEngine: null,
      replayResult: null,
      replayOptions: null
    });

    setAppState('game');
    logGameAction('Replay stopped', 'REPLAY', { wasActive: replayState.isActive });
  }, [replayState]);

  const handleReplayValidation = useCallback(async (originalEvents: UIActionEvent[]) => {
    try {
      logGameAction('Starting replay validation', 'REPLAY', { 
        eventCount: originalEvents.length 
      });

      const validationEngine = new UIActionReplayEngine();
      const validationOptions: ReplayOptions = {
        events: originalEvents,
        validateStates: true,
        stepByStep: false
      };

      const initialized = validationEngine.initializeReplay(validationOptions);
      if (!initialized) {
        throw new Error('Failed to initialize validation engine');
      }

      const result = await validationEngine.startReplay();
      
      logGameAction('Replay validation completed', 'REPLAY', {
        success: result.success,
        stepsExecuted: result.stepsExecuted,
        errorCount: result.errors?.length || 0
      });

      return result;
    } catch (error) {
      logError(error as Error, 'GameManager.handleReplayValidation', { 
        eventCount: originalEvents.length 
      });
      throw error;
    }
  }, []);

  // Replay analyzer handlers
  const handleEventSelect = useCallback((event: UIActionEvent, index: number) => {
    setSelectedEvent(event);
    
    logUserInteraction('Event selected in replay analyzer', 'GameManager', {
      eventType: event.type,
      eventIndex: index,
      component: event.component
    });

    if (onEventSelect) {
      onEventSelect(event, index);
    }
  }, [onEventSelect]);

  const handleFilterChange = useCallback((filtered: UIActionEvent[]) => {
    setFilteredEvents(filtered);
  }, []);

  const toggleAnalyzer = useCallback(() => {
    setShowAnalyzer(prev => !prev);
    logUserInteraction('Replay analyzer toggled', 'GameManager', { 
      showing: !showAnalyzer 
    });
  }, [showAnalyzer]);

  const renderMainMenu = () => {
    return (
      <MainMenu
        onStartGame={handleStartGame}
        onContinueGame={handleContinueGame}
        className="main-menu-container"
      />
    );
  };

  const renderGameBoard = () => {
    const isReplayMode = appState === 'replay';
    
    switch (currentGameType) {
      case 'klondike':
        return (
          <KlondikeGameBoard
            key={gameKey}
            onGameWin={handleGameWin}
            onScoreChange={handleScoreChange}
            onMoveCount={handleMoveCountChange}
            className="game-board"
            // Replay mode props
            replayMode={isReplayMode}
            replayEngine={replayState.replayEngine}
            replayEvents={replayState.events}
            // Win animation props
            enableWinAnimations={true}
          />
        );
      case 'spider':
        return (
          <SpiderGameBoard
            key={gameKey}
            onGameWin={handleGameWin}
            onScoreChange={handleScoreChange}
            onMoveCount={handleMoveCountChange}
            className="game-board"
            // Replay mode props
            replayMode={isReplayMode}
            replayEngine={replayState.replayEngine}
            replayEvents={replayState.events}
            // Win animation props
            enableWinAnimations={true}
          />
        );
      case 'freecell':
        return (
          <FreeCellGameBoard
            key={gameKey}
            onGameWin={handleGameWin}
            onScoreChange={handleScoreChange}
            onMoveCount={handleMoveCountChange}
            className="game-board"
            // Replay mode props
            replayMode={isReplayMode}
            replayEngine={replayState.replayEngine}
            replayEvents={replayState.events}
            // Win animation props
            enableWinAnimations={true}
          />
        );
      default:
        return null;
    }
  };

  const renderGameView = () => {
    const isReplayMode = appState === 'replay';
    const hasReplayCompleted = replayState.currentStep >= replayState.totalSteps && !replayState.isActive;
    const shouldShowReplayResult = isReplayMode && replayState.replayResult && hasReplayCompleted;
    const replayStatusText = hasReplayCompleted ? 'Completed' : (replayState.isPaused ? 'Paused' : 'Playing');

    return (
      <div className="game-view" data-testid="game-view">
        <div className="controls-section">
          {isReplayMode ? (
            <ReplayControls
              replayState={replayState}
              onStep={handleReplayStep}
              onPause={handleReplayPause}
              onResume={handleReplayResume}
              onStop={handleReplayStop}
              onValidate={handleReplayValidation}
              className="replay-controls"
            />
          ) : (
            <GameControls
              onNewGame={handleNewGame}
              onBackToMenu={handleBackToMenu}
              gameType={currentGameType}
              className="game-controls"
            />
          )}
          
          {isReplayMode && replayState.events.length > 0 && (
            <div className="analyzer-controls">
              <button 
                onClick={toggleAnalyzer}
                className={`analyzer-toggle ${showAnalyzer ? 'active' : ''}`}
                data-testid="analyzer-toggle"
              >
                {showAnalyzer ? 'Hide' : 'Show'} Event Analyzer
              </button>
            </div>
          )}
        </div>
        
        <div className="game-info-bar">
          <div className="game-stats">
            <span className="stat-item" data-testid="score-display">
              Score: {score}
            </span>
            <span className="stat-item" data-testid="moves-display">
              Moves: {moveCount}
            </span>
            {isReplayMode && (
              <>
                <span className="stat-item" data-testid="replay-step-display">
                  Step: {replayState.currentStep} / {replayState.totalSteps}
                </span>
                <span className="stat-item" data-testid="replay-status-display">
                  Status: {replayStatusText}
                </span>
              </>
            )}
          </div>
          {isGameWon && !isReplayMode && (
            <div className="win-message" data-testid="win-message">
              🎉 Congratulations! You won!
            </div>
          )}
          {shouldShowReplayResult && (
            <div className="replay-result" data-testid="replay-result">
              Replay {replayState.replayResult.success ? 'Completed Successfully' : 'Failed'}
              {replayState.replayResult.errors && replayState.replayResult.errors.length > 0 && (
                <span className="error-count"> ({replayState.replayResult.errors.length} errors)</span>
              )}
            </div>
          )}
        </div>

        <div className="game-content-container">
          <div className="game-content">
            {renderGameBoard()}
          </div>
          
          {isReplayMode && showAnalyzer && replayState.events.length > 0 && (
            <div className="analyzer-panel" data-testid="analyzer-panel">
              <ReplayAnalyzer
                events={replayState.events}
                replayResult={replayState.replayResult}
                onEventSelect={handleEventSelect}
                onFilterChange={handleFilterChange}
                className="replay-analyzer"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`game-manager ${className}`} data-testid="game-manager">
      {appState === 'menu' ? renderMainMenu() : renderGameView()}
    </div>
  );
};

export default GameManager;
