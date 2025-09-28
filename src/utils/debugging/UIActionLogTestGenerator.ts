import { UIActionEvent, UIActionEventType } from '../../types/UIActionLogging';

export interface TestGenerationOptions {
  grouping?: 'win-condition' | 'time-gap' | 'none';
  maxEventsPerCase?: number;
  timeGapThresholdMs?: number;
  caseNamePrefix?: string;
  caseNameFormatter?: (context: GeneratedTestCase['metadata'], index: number) => string;
}

export interface GeneratedTestCase {
  id: string;
  name: string;
  events: UIActionEvent[];
  metadata: {
    startTimestamp: string;
    endTimestamp: string;
    durationMs: number;
    eventCount: number;
    outcome: 'win' | 'loss' | 'validation-failure' | 'unknown';
  };
  notes: string[];
}

export interface VitestSnippetOptions {
  variableName?: string;
  includeImports?: boolean;
  indent?: number;
  replayEngineImportPath?: string;
}

export interface VitestFileOptions extends VitestSnippetOptions {
  suiteName?: string;
}

const DEFAULT_TEST_OPTIONS: Required<Omit<TestGenerationOptions, 'caseNameFormatter' | 'caseNamePrefix'>> = {
  grouping: 'win-condition',
  maxEventsPerCase: 250,
  timeGapThresholdMs: 10_000
};

/**
 * Create replay-driven test cases from logged UI action events.
 */
export function generateReplayTestCases(
  events: UIActionEvent[],
  options: TestGenerationOptions = {}
): GeneratedTestCase[] {
  if (events.length === 0) {
    return [];
  }

  const config = { ...DEFAULT_TEST_OPTIONS, ...options };
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const cases: GeneratedTestCase[] = [];

  let buffer: UIActionEvent[] = [];
  let caseIndex = 1;
  let previousTimestamp: number | null = null;

  const finalizeCase = () => {
    if (buffer.length === 0) {
      return;
    }
    const metadata = buildMetadata(buffer);
    const defaultName = `${options.caseNamePrefix ?? 'Replay Case'} #${caseIndex}`;
    const name = options.caseNameFormatter ? options.caseNameFormatter(metadata, caseIndex) : defaultName;
    cases.push({
      id: `case-${caseIndex}`,
      name,
      events: [...buffer],
      metadata,
      notes: buildNotes(buffer)
    });
    buffer = [];
    caseIndex += 1;
  };

  for (const event of sorted) {
    const timestamp = Date.parse(event.timestamp);
    const gap = previousTimestamp !== null && timestamp ? timestamp - previousTimestamp : 0;
    const splitOnGap = config.grouping === 'time-gap' && gap > config.timeGapThresholdMs && buffer.length > 0;

    if (splitOnGap || (buffer.length >= config.maxEventsPerCase && buffer.length > 0)) {
      finalizeCase();
    }

    buffer.push(event);

    if (config.grouping === 'win-condition' && event.type === UIActionEventType.WIN_CONDITION) {
      finalizeCase();
    }

    previousTimestamp = timestamp;
  }

  finalizeCase();

  return cases;
}

/**
 * Create a Vitest snippet exercising a generated test case with the replay engine.
 */
export function createVitestTestSnippet(
  testCase: GeneratedTestCase,
  options: VitestSnippetOptions = {}
): string {
  const variableName = options.variableName ?? 'events';
  const indent = options.indent ?? 2;
  const replayImport = options.replayEngineImportPath ?? '../utils/UIActionReplayEngine';
  const padding = ' '.repeat(indent);
  const eventsLiteral = JSON.stringify(testCase.events, null, 2);
  const escapedName = testCase.name.replace(/'/g, "\\'");
  const lines: string[] = [];

  if (options.includeImports !== false) {
    lines.push("import { it, expect } from 'vitest';");
    lines.push(`import { UIActionReplayEngine } from '${replayImport}';`, '');
  }

  lines.push(`const ${variableName} = ${eventsLiteral};`, '');
  lines.push(`it('${escapedName}', async () => {`);
  lines.push(`${padding}const engine = new UIActionReplayEngine();`);
  lines.push(`${padding}engine.initializeReplay({ events: ${variableName}, validateStates: true });`);
  lines.push(`${padding}const result = await engine.startReplay();`);
  lines.push(`${padding}expect(result.success).toBe(true);`);
  lines.push('});');

  return lines.join('\n');
}

/**
 * Create a complete Vitest file containing multiple generated cases.
 */
export function createVitestTestFile(
  cases: GeneratedTestCase[],
  options: VitestFileOptions = {}
): string {
  if (cases.length === 0) {
    return "import { describe } from 'vitest';\n\ndescribe('UI Action Replay', () => {\n  // No cases generated\n});\n";
  }

  const { suiteName = 'UI Action Replay' } = options;
  const replayImport = options.replayEngineImportPath ?? '../utils/UIActionReplayEngine';
  const lines: string[] = [];

  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push(`import { UIActionReplayEngine } from '${replayImport}';`, '');
  lines.push(`describe('${suiteName.replace(/'/g, "\\'")}', () => {`);

  cases.forEach((testCase, index) => {
    const variableName = `events${index + 1}`;
    const snippet = createVitestTestSnippet(testCase, {
      ...options,
      includeImports: false,
      variableName,
      indent: 4
    });
    const indentedSnippet = snippet
      .split('\n')
      .map(line => (line.length > 0 ? `  ${line}` : line))
      .join('\n');
    lines.push(indentedSnippet, '');
  });

  lines.push('});', '');

  return lines.join('\n');
}

function buildMetadata(events: UIActionEvent[]): GeneratedTestCase['metadata'] {
  const startTimestamp = events[0].timestamp;
  const endTimestamp = events[events.length - 1].timestamp;
  const durationMs = computeDuration(startTimestamp, endTimestamp);
  const outcome = determineOutcome(events);
  return {
    startTimestamp,
    endTimestamp,
    durationMs,
    eventCount: events.length,
    outcome
  };
}

function determineOutcome(events: UIActionEvent[]): GeneratedTestCase['metadata']['outcome'] {
  if (events.some(event => event.type === UIActionEventType.WIN_CONDITION)) {
    return 'win';
  }

  if (events.some(event => event.data?.validationResult?.isValid === false)) {
    return 'validation-failure';
  }

  if (events.some(event => event.data?.moveSuccess === false)) {
    return 'loss';
  }

  return 'unknown';
}

function buildNotes(events: UIActionEvent[]): string[] {
  const notes: string[] = [];
  if (events.some(event => event.performance?.operationDuration && event.performance.operationDuration > 200)) {
    notes.push('Contains slow operations (>200ms).');
  }
  if (events.some(event => event.data?.validationResult?.isValid === false)) {
    notes.push('Includes validation failures that should be asserted.');
  }
  if (events.some(event => event.gameStateBefore && event.gameStateAfter)) {
    notes.push('Includes game state snapshots suitable for deep verification.');
  }
  return notes;
}

function computeDuration(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.max(0, endMs - startMs);
}
