import { describe, it, expect } from 'vitest';
import {
  generateReplayTestCases,
  createVitestTestSnippet,
  createVitestTestFile
} from '../utils/debugging/UIActionLogTestGenerator';
import { UIActionEvent, UIActionEventType } from '../types/UIActionLogging';

const createEvent = (id: string, type: UIActionEventType, offsetMs: number, data: Record<string, any> = {}): UIActionEvent => ({
  id,
  timestamp: new Date(1_700_000_000_000 + offsetMs).toISOString(),
  type,
  component: 'GameManager',
  data
});

describe('UIActionLogTestGenerator', () => {
  it('splits events into replay-ready test cases', () => {
    const events: UIActionEvent[] = [
      createEvent('attempt-1', UIActionEventType.MOVE_ATTEMPT, 0, {
        validationResult: { isValid: true, validationTime: 3 }
      }),
      createEvent('executed-1', UIActionEventType.MOVE_EXECUTED, 50, { moveSuccess: true }),
      createEvent('attempt-2', UIActionEventType.MOVE_ATTEMPT, 100, {
        validationResult: { isValid: true, validationTime: 2 }
      }),
      createEvent('win', UIActionEventType.WIN_CONDITION, 150, {}),
      createEvent('post-win', UIActionEventType.STATE_CHANGE, 10_000, { changeType: 'score_change' })
    ];

    const cases = generateReplayTestCases(events, {
      grouping: 'win-condition',
      caseNamePrefix: 'Session'
    });

    expect(cases).toHaveLength(2);
    expect(cases[0].metadata.outcome).toBe('win');
    expect(cases[0].events).toHaveLength(4);
    expect(cases[1].metadata.eventCount).toBe(1);
  });

  it('serialises replay cases into Vitest snippets', () => {
    const events: UIActionEvent[] = [
      createEvent('test', UIActionEventType.CARD_CLICK, 0, { clickTarget: 'new-game' })
    ];

    const [testCase] = generateReplayTestCases(events, { grouping: 'none' });
    const snippet = createVitestTestSnippet(testCase, { includeImports: false, variableName: 'sampleEvents' });

    expect(snippet).toContain('sampleEvents');
    expect(snippet).toContain('UIActionReplayEngine');
    expect(snippet).toContain(`it('Replay Case #1'`);
  });

  it('creates a complete Vitest suite for multiple cases', () => {
    const events: UIActionEvent[] = [
      createEvent('first', UIActionEventType.CARD_CLICK, 0),
      createEvent('second', UIActionEventType.CARD_CLICK, 1000)
    ];

    const cases = generateReplayTestCases(events, { grouping: 'time-gap', timeGapThresholdMs: 500 });
    const fileSource = createVitestTestFile(cases, { suiteName: 'Generated Cases' });

    expect(fileSource).toContain("describe('Generated Cases'");
    expect(fileSource).toContain('UIActionReplayEngine');
    expect(fileSource.split('it(').length - 1).toBe(cases.length);
  });
});
