import { describe, it, expect, afterEach } from 'vitest';
import {
  filterUIActionEvents,
  searchUIActionEvents,
  filterLogFileEntries,
  UIActionLogFilterCriteria
} from '../utils/debugging/UIActionLogFilter';
import { UIActionEvent, UIActionEventType } from '../types/UIActionLogging';
import * as fs from 'node:fs';
import * as path from 'node:path';

const baseEvent = (overrides: Partial<UIActionEvent>): UIActionEvent => ({
  id: 'event-id',
  timestamp: '2025-01-01T00:00:00.000Z',
  type: UIActionEventType.CARD_CLICK,
  component: 'GameControls',
  data: {},
  ...overrides
});

const tempLogPath = path.join(process.cwd(), 'tmp-ui-log.log');

afterEach(() => {
  if (fs.existsSync(tempLogPath)) {
    fs.unlinkSync(tempLogPath);
  }
});

describe('UIActionLogFilter', () => {
  it('filters events via structured criteria', () => {
    const events: UIActionEvent[] = [
      baseEvent({ id: '1', type: UIActionEventType.CARD_CLICK, component: 'GameControls' }),
      baseEvent({ id: '2', type: UIActionEventType.MOVE_EXECUTED, component: 'GameManager', timestamp: '2025-01-01T00:00:05.000Z', data: { moveSuccess: false } }),
      baseEvent({ id: '3', type: UIActionEventType.DRAG_DROP, component: 'CardRenderer', timestamp: '2025-01-01T00:00:10.000Z', data: { validationResult: { isValid: false, reason: 'invalid', validationTime: 1 } } })
    ];

    const criteria: UIActionLogFilterCriteria = {
      eventTypes: [UIActionEventType.DRAG_DROP, UIActionEventType.MOVE_EXECUTED],
      timeRange: { start: '2025-01-01T00:00:03.000Z', end: '2025-01-01T00:00:12.000Z' },
      predicate: event => event.data?.moveSuccess === false || event.data?.validationResult?.isValid === false
    };

    const filtered = filterUIActionEvents(events, criteria);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(event => event.id)).toEqual(['2', '3']);
  });

  it('supports free text searches', () => {
    const events: UIActionEvent[] = [
      baseEvent({ id: 'alpha', component: 'ReplayControls', data: { note: 'fast path' } }),
      baseEvent({ id: 'bravo', component: 'CardRenderer', data: { note: 'slow interaction' } })
    ];

    const result = searchUIActionEvents(events, 'slow');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bravo');
  });

  it('filters on-disk log files lazily', async () => {
    const logLines = [
      '[2025-01-01T00:00:00.000Z] INFO RENDERER: App ready',
      '[2025-01-01T00:00:01.000Z] WARN LOGGER: Memory threshold exceeded | Data: {"approximateBytes":1048576}',
      '[2025-01-01T00:00:02.000Z] ERROR UI: Drag failed'
    ];
    fs.writeFileSync(tempLogPath, logLines.join('\n'), 'utf8');

    const entries = await filterLogFileEntries(tempLogPath, {
      levels: ['WARN', 'ERROR'],
      text: 'threshold'
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('WARN');
    expect(entries[0].category).toBe('LOGGER');
    expect(entries[0].data?.approximateBytes).toBe(1048576);
  });
});
