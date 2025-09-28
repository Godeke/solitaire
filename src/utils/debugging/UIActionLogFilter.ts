import { UIActionEvent, UIActionEventType } from '../../types/UIActionLogging';

export interface UIActionLogFilterCriteria {
  eventTypes?: UIActionEventType[];
  components?: string[];
  timeRange?: {
    start?: string;
    end?: string;
  };
  performanceAboveMs?: number;
  includeSnapshots?: 'before' | 'after' | 'both' | 'either' | 'none';
  searchText?: string | string[];
  predicate?: (event: UIActionEvent) => boolean;
}

export interface UIActionLogSearchOptions {
  caseSensitive?: boolean;
  exactMatch?: boolean;
  fields?: Array<'component' | 'message' | 'data' | 'type'>;
}

export interface ParsedLogEntry {
  raw: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  data?: any;
}

export interface LogFileFilterOptions {
  levels?: Array<ParsedLogEntry['level']>;
  categories?: string[];
  text?: string | string[];
  timeRange?: { start?: string; end?: string };
  limit?: number;
  predicate?: (entry: ParsedLogEntry) => boolean;
}

const LOG_LINE_REGEX = /^(?:\[)(?<timestamp>[^\]]+)(?:\])\s+(?<level>DEBUG|INFO|WARN|ERROR)\s+(?<category>[^:]+):\s+(?<message>.*?)(?:\s+\|\s+Data:\s+(?<data>.*))?$/;

/**
 * Filter a collection of UI action events in-memory.
 */
export function filterUIActionEvents(
  events: UIActionEvent[],
  criteria: UIActionLogFilterCriteria = {}
): UIActionEvent[] {
  if (!criteria || Object.keys(criteria).length === 0) {
    return [...events];
  }

  return events.filter(event => matchesEventCriteria(event, criteria));
}

/**
 * Search UI action events by free text query.
 */
export function searchUIActionEvents(
  events: UIActionEvent[],
  query: string,
  options: UIActionLogSearchOptions = {}
): UIActionEvent[] {
  if (!query.trim()) {
    return [...events];
  }

  const fields = options.fields ?? ['component', 'type', 'data'];
  const tokens = splitQuery(query, options.exactMatch === true, options.caseSensitive === true);

  return events.filter(event => {
    const haystacks = buildSearchHaystacks(event, fields, options.caseSensitive === true);
    return tokens.every(token => haystacks.some(haystack => haystack.includes(token)));
  });
}

/**
 * Iterate log file entries lazily to support very large files.
 */
export async function* iterateLogFileEntries(filePath: string): AsyncGenerator<ParsedLogEntry, void> {
  const fs = await import('node:fs');
  const readline = await import('node:readline');

  if (!fs.existsSync(filePath)) {
    return;
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const parsed = parseLogLine(line);
    if (parsed) {
      yield parsed;
    }
  }
}

/**
 * Filter log file entries without loading the entire file into memory.
 */
export async function filterLogFileEntries(
  filePath: string,
  options: LogFileFilterOptions = {}
): Promise<ParsedLogEntry[]> {
  const results: ParsedLogEntry[] = [];
  const iterator = iterateLogFileEntries(filePath);

  for await (const entry of iterator) {
    if (matchesLogEntry(entry, options)) {
      results.push(entry);
      if (options.limit && results.length >= options.limit) {
        break;
      }
    }
  }

  return results;
}

function matchesEventCriteria(event: UIActionEvent, criteria: UIActionLogFilterCriteria): boolean {
  if (criteria.eventTypes && criteria.eventTypes.length > 0 && !criteria.eventTypes.includes(event.type)) {
    return false;
  }

  if (criteria.components && criteria.components.length > 0 && !criteria.components.includes(event.component)) {
    return false;
  }

  if (criteria.timeRange) {
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isNaN(timestamp)) {
      if (criteria.timeRange.start) {
        const start = Date.parse(criteria.timeRange.start);
        if (!Number.isNaN(start) && timestamp < start) {
          return false;
        }
      }
      if (criteria.timeRange.end) {
        const end = Date.parse(criteria.timeRange.end);
        if (!Number.isNaN(end) && timestamp > end) {
          return false;
        }
      }
    }
  }

  if (typeof criteria.performanceAboveMs === 'number') {
    const duration = event.performance?.operationDuration ?? 0;
    if (duration < criteria.performanceAboveMs) {
      return false;
    }
  }

  if (criteria.includeSnapshots) {
    const before = Boolean(event.gameStateBefore);
    const after = Boolean(event.gameStateAfter);
    switch (criteria.includeSnapshots) {
      case 'before':
        if (!before) {
          return false;
        }
        break;
      case 'after':
        if (!after) {
          return false;
        }
        break;
      case 'both':
        if (!(before && after)) {
          return false;
        }
        break;
      case 'either':
        if (!(before || after)) {
          return false;
        }
        break;
      case 'none':
        if (before || after) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  if (criteria.searchText && criteria.searchText !== '') {
    const haystacks = buildSearchHaystacks(event, ['component', 'type', 'data'], false);
    const tokens = Array.isArray(criteria.searchText)
      ? criteria.searchText.map(token => token.toLowerCase())
      : splitQuery(criteria.searchText, false, false);
    const matches = tokens.every(token => haystacks.some(haystack => haystack.includes(token)));
    if (!matches) {
      return false;
    }
  }

  if (criteria.predicate && !criteria.predicate(event)) {
    return false;
  }

  return true;
}

function splitQuery(query: string, exact: boolean, caseSensitive: boolean): string[] {
  if (exact) {
    return [caseSensitive ? query : query.toLowerCase()];
  }

  return query
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => (caseSensitive ? token : token.toLowerCase()));
}

function buildSearchHaystacks(
  event: UIActionEvent,
  fields: Array<'component' | 'message' | 'data' | 'type'>,
  caseSensitive: boolean
): string[] {
  const haystacks: string[] = [];

  for (const field of fields) {
    switch (field) {
      case 'component':
        haystacks.push(normalize(event.component, caseSensitive));
        break;
      case 'type':
        haystacks.push(normalize(event.type, caseSensitive));
        break;
      case 'message':
        haystacks.push(normalize(JSON.stringify(event.data ?? {}), caseSensitive));
        break;
      case 'data':
        haystacks.push(normalize(JSON.stringify(event.data ?? {}), caseSensitive));
        break;
      default:
        break;
    }
  }

  return haystacks;
}

function normalize(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function parseLogLine(line: string): ParsedLogEntry | null {
  const match = LOG_LINE_REGEX.exec(line.trim());
  if (!match || !match.groups) {
    return null;
  }

  const { timestamp, level, category, message, data } = match.groups as Record<string, string>;
  let parsedData: any;

  if (data) {
    parsedData = tryParseJson(data.trim());
  }

  return {
    raw: line,
    timestamp,
    level: level as ParsedLogEntry['level'],
    category: category.trim(),
    message: message.trim(),
    data: parsedData
  };
}

function tryParseJson(data: string): any {
  const trimmed = data.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed === '[Circular or non-serializable object]') {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function matchesLogEntry(entry: ParsedLogEntry, options: LogFileFilterOptions): boolean {
  if (options.levels && options.levels.length > 0 && !options.levels.includes(entry.level)) {
    return false;
  }

  if (options.categories && options.categories.length > 0) {
    const category = entry.category.toUpperCase();
    if (!options.categories.some(cat => category.includes(cat.toUpperCase()))) {
      return false;
    }
  }

  if (options.text && options.text.length > 0) {
    const tokens = Array.isArray(options.text) ? options.text : [options.text];
    const haystack = `${entry.timestamp} ${entry.level} ${entry.category} ${entry.message} ${JSON.stringify(entry.data ?? '')}`.toLowerCase();
    const matches = tokens.every(token => haystack.includes(token.toLowerCase()));
    if (!matches) {
      return false;
    }
  }

  if (options.timeRange) {
    const timestamp = Date.parse(entry.timestamp);
    if (!Number.isNaN(timestamp)) {
      if (options.timeRange.start) {
        const start = Date.parse(options.timeRange.start);
        if (!Number.isNaN(start) && timestamp < start) {
          return false;
        }
      }
      if (options.timeRange.end) {
        const end = Date.parse(options.timeRange.end);
        if (!Number.isNaN(end) && timestamp > end) {
          return false;
        }
      }
    }
  }

  if (options.predicate && !options.predicate(entry)) {
    return false;
  }

  return true;
}
