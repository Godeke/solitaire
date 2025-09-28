import { UIActionEvent, UIActionEventType } from '../../types/UIActionLogging';
import {
  UIActionInteractionSequence,
  UIActionLogAnalysisReport,
  UIActionTimelineEntry,
  analyzeUIActionEvents
} from './UIActionLogAnalyzer';

export interface TimelinePoint {
  timestamp: string;
  eventId: string;
  type: UIActionEventType;
  durationMs?: number;
  label: string;
}

export interface TimelineSeries {
  component: string;
  points: TimelinePoint[];
}

export interface InteractionGraphNode {
  id: string;
  component: string;
  type: UIActionEventType;
  count: number;
  averageDuration: number;
}

export interface InteractionGraphLink {
  id: string;
  source: string;
  target: string;
  transitions: number;
  averageDuration: number;
}

export interface InteractionGraph {
  nodes: InteractionGraphNode[];
  links: InteractionGraphLink[];
}

export interface ComponentPerformanceHeatmapEntry {
  component: string;
  totalEvents: number;
  slowEvents: number;
  averageDuration: number;
  maxDuration: number;
}

export interface VisualizationPreparedData {
  analysis: UIActionLogAnalysisReport;
  timeline: TimelineSeries[];
  interactionGraph: InteractionGraph;
  componentPerformance: ComponentPerformanceHeatmapEntry[];
}

/**
 * Run analysis and return data structures ready for visualization layers.
 */
export function prepareVisualizationData(events: UIActionEvent[]): VisualizationPreparedData {
  const analysis = analyzeUIActionEvents(events);
  const timeline = buildTimelineSeries(analysis.timeline);
  const interactionGraph = buildInteractionGraph(analysis.interactions);
  const componentPerformance = buildComponentPerformanceHeatmap(analysis);

  return {
    analysis,
    timeline,
    interactionGraph,
    componentPerformance
  };
}

/**
 * Convert timeline entries into per-component series.
 */
export function buildTimelineSeries(entries: UIActionTimelineEntry[]): TimelineSeries[] {
  const byComponent = new Map<string, TimelineSeries>();

  for (const entry of entries) {
    const existing = byComponent.get(entry.component);
    const point: TimelinePoint = {
      timestamp: entry.timestamp,
      eventId: entry.eventId,
      type: entry.type,
      durationMs: entry.durationMs,
      label: entry.description
    };

    if (existing) {
      existing.points.push(point);
    } else {
      byComponent.set(entry.component, {
        component: entry.component,
        points: [point]
      });
    }
  }

  return Array.from(byComponent.values()).map(series => ({
    component: series.component,
    points: series.points.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }));
}

/**
 * Create a graph representation of interaction flows between event types.
 */
export function buildInteractionGraph(sequences: UIActionInteractionSequence[]): InteractionGraph {
  const nodeMap = new Map<string, { node: InteractionGraphNode; durations: number[] }>();
  const linkMap = new Map<string, { link: InteractionGraphLink; durations: number[] }>();

  for (const sequence of sequences) {
    const orderedEvents = sequence.events.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let previousNodeId: string | null = null;

    for (const event of orderedEvents) {
      const nodeId = createNodeId(sequence.component, event.type);
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, {
          node: {
            id: nodeId,
            component: sequence.component,
            type: event.type,
            count: 0,
            averageDuration: 0
          },
          durations: []
        });
      }

      const bucket = nodeMap.get(nodeId)!;
      bucket.node.count += 1;
      if (typeof event.performance?.operationDuration === 'number') {
        bucket.durations.push(event.performance.operationDuration);
      }

      if (previousNodeId) {
        const linkId = `${previousNodeId}->${nodeId}`;
        if (!linkMap.has(linkId)) {
          linkMap.set(linkId, {
            link: {
              id: linkId,
              source: previousNodeId,
              target: nodeId,
              transitions: 0,
              averageDuration: 0
            },
            durations: []
          });
        }

        const linkBucket = linkMap.get(linkId)!;
        linkBucket.link.transitions += 1;
        if (typeof event.performance?.operationDuration === 'number') {
          linkBucket.durations.push(event.performance.operationDuration);
        }
      }

      previousNodeId = nodeId;
    }
  }

  const nodes: InteractionGraphNode[] = Array.from(nodeMap.values()).map(({ node, durations }) => ({
    ...node,
    averageDuration: durations.length > 0 ? average(durations) : 0
  }));

  const links: InteractionGraphLink[] = Array.from(linkMap.values()).map(({ link, durations }) => ({
    ...link,
    averageDuration: durations.length > 0 ? average(durations) : 0
  }));

  return {
    nodes: nodes.sort((a, b) => b.count - a.count),
    links: links.sort((a, b) => b.transitions - a.transitions)
  };
}

/**
 * Build a per-component performance summary suitable for heatmap views.
 */
export function buildComponentPerformanceHeatmap(
  report: UIActionLogAnalysisReport
): ComponentPerformanceHeatmapEntry[] {
  const slowEventIds = new Set(report.performance.slowEvents.map(item => item.event.id));
  const byComponent = new Map<string, { events: number; slow: number; durations: number[] }>();

  for (const entry of report.timeline) {
    const bucket = byComponent.get(entry.component) ?? {
      events: 0,
      slow: 0,
      durations: [] as number[]
    };

    bucket.events += 1;
    if (slowEventIds.has(entry.eventId)) {
      bucket.slow += 1;
    }

    if (typeof entry.durationMs === 'number') {
      bucket.durations.push(entry.durationMs);
    }

    byComponent.set(entry.component, bucket);
  }

  return Array.from(byComponent.entries()).map(([component, { events, slow, durations }]) => ({
    component,
    totalEvents: events,
    slowEvents: slow,
    averageDuration: durations.length > 0 ? average(durations) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations) : 0
  }));
}

function createNodeId(component: string, type: UIActionEventType): string {
  return `${component}:${type}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}
