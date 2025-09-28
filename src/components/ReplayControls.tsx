import React, { useState, useCallback } from 'react';
import { ReplayState } from './GameManager';
import { UIActionEvent, ReplayResult } from '../types/UIActionLogging';
import { logUserInteraction, logError } from '../utils/RendererLogger';
import './ReplayControls.css';

export interface ReplayControlsProps {
  replayState: ReplayState;
  onStep: () => Promise<any>;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onValidate: (events: UIActionEvent[]) => Promise<ReplayResult>;
  className?: string;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  replayState,
  onStep,
  onPause,
  onResume,
  onStop,
  onValidate,
  className = ''
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ReplayResult | null>(null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const handleStep = useCallback(async () => {
    try {
      logUserInteraction('Replay step forward', 'ReplayControls', {
        currentStep: replayState.currentStep,
        totalSteps: replayState.totalSteps
      });
      
      await onStep();
    } catch (error) {
      logError(error as Error, 'ReplayControls.handleStep');
    }
  }, [onStep, replayState.currentStep, replayState.totalSteps]);

  const handlePause = useCallback(() => {
    logUserInteraction('Replay pause', 'ReplayControls', {
      currentStep: replayState.currentStep
    });
    onPause();
  }, [onPause, replayState.currentStep]);

  const handleResume = useCallback(() => {
    logUserInteraction('Replay resume', 'ReplayControls', {
      currentStep: replayState.currentStep
    });
    onResume();
  }, [onResume, replayState.currentStep]);

  const handleStop = useCallback(() => {
    logUserInteraction('Replay stop', 'ReplayControls', {
      currentStep: replayState.currentStep,
      totalSteps: replayState.totalSteps
    });
    onStop();
  }, [onStop, replayState.currentStep, replayState.totalSteps]);

  const handleValidate = useCallback(async () => {
    try {
      setIsValidating(true);
      setValidationResult(null);
      
      logUserInteraction('Replay validation started', 'ReplayControls', {
        eventCount: replayState.events.length
      });

      const result = await onValidate(replayState.events);
      setValidationResult(result);
      
      logUserInteraction('Replay validation completed', 'ReplayControls', {
        success: result.success,
        errorCount: result.errors?.length || 0
      });
    } catch (error) {
      logError(error as Error, 'ReplayControls.handleValidate');
    } finally {
      setIsValidating(false);
    }
  }, [onValidate, replayState.events]);

  const toggleValidationDetails = useCallback(() => {
    setShowValidationDetails(prev => !prev);
  }, []);

  const canStep = replayState.isActive && replayState.currentStep < replayState.totalSteps;
  const canPause = replayState.isActive && !replayState.isPaused;
  const canResume = replayState.isActive && replayState.isPaused;

  return (
    <div className={`replay-controls ${className}`} data-testid="replay-controls">
      <div className="replay-controls-header">
        <h3>Replay Mode</h3>
        <div className="replay-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${replayState.totalSteps > 0 ? (replayState.currentStep / replayState.totalSteps) * 100 : 0}%` 
              }}
            />
          </div>
          <span className="progress-text">
            {replayState.currentStep} / {replayState.totalSteps}
          </span>
        </div>
      </div>

      <div className="replay-controls-buttons">
        <div className="playback-controls">
          <button
            onClick={handleStep}
            disabled={!canStep}
            className="step-button"
            data-testid="replay-step-button"
            title="Execute next step"
          >
            Step Forward
          </button>
          
          {canPause ? (
            <button
              onClick={handlePause}
              className="pause-button"
              data-testid="replay-pause-button"
              title="Pause replay"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={!canResume}
              className="resume-button"
              data-testid="replay-resume-button"
              title="Resume replay"
            >
              Resume
            </button>
          )}
          
          <button
            onClick={handleStop}
            className="stop-button"
            data-testid="replay-stop-button"
            title="Stop replay and return to game"
          >
            Stop Replay
          </button>
        </div>

        <div className="validation-controls">
          <button
            onClick={handleValidate}
            disabled={isValidating || replayState.events.length === 0}
            className="validate-button"
            data-testid="replay-validate-button"
            title="Validate replay against original events"
          >
            {isValidating ? 'Validating...' : 'Validate Replay'}
          </button>
        </div>
      </div>

      {validationResult && (
        <div className="validation-result" data-testid="validation-result">
          <div className="validation-summary">
            <span className={`validation-status ${validationResult.success ? 'success' : 'error'}`}>
              Validation {validationResult.success ? 'Passed' : 'Failed'}
            </span>
            <span className="validation-stats">
              Steps: {validationResult.stepsExecuted} | 
              Errors: {validationResult.errors?.length || 0} |
              Time: {validationResult.performance.totalReplayTime.toFixed(2)}ms
            </span>
            {validationResult.errors && validationResult.errors.length > 0 && (
              <button
                onClick={toggleValidationDetails}
                className="details-toggle"
                data-testid="validation-details-toggle"
              >
                {showValidationDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>

          {showValidationDetails && validationResult.errors && validationResult.errors.length > 0 && (
            <div className="validation-details" data-testid="validation-details">
              <h4>Validation Errors:</h4>
              <ul className="error-list">
                {validationResult.errors.map((error, index) => (
                  <li key={index} className={`error-item ${error.recoverable ? 'recoverable' : 'fatal'}`}>
                    <div className="error-header">
                      <span className="error-step">Step {error.step}</span>
                      <span className="error-type">{error.recoverable ? 'Recoverable' : 'Fatal'}</span>
                    </div>
                    <div className="error-message">{error.error}</div>
                    {error.event && (
                      <div className="error-event">
                        Event: {error.event.type} ({error.event.component})
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {replayState.replayResult && (
        <div className="replay-final-result" data-testid="replay-final-result">
          <h4>Replay Result</h4>
          <div className="result-summary">
            <span className={`result-status ${replayState.replayResult.success ? 'success' : 'error'}`}>
              {replayState.replayResult.success ? 'Success' : 'Failed'}
            </span>
            <div className="result-details">
              <span>Steps Executed: {replayState.replayResult.stepsExecuted}</span>
              <span>Total Time: {replayState.replayResult.performance.totalReplayTime.toFixed(2)}ms</span>
              <span>Avg Step Time: {replayState.replayResult.performance.averageEventProcessingTime.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplayControls;