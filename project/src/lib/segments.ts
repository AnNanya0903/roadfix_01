import type { Category } from './domain';
import { CATEGORY_META, isClosed } from './domain';
import type { EnrichedIssue } from './enrich';

export type SegmentHealth = 'healthy' | 'watch' | 'attention';

export interface RoadSegment {
  id: string;
  roadName: string;
  area: string;
  center: [number, number];
  issues: EnrichedIssue[];
  open: number;
  counts: Partial<Record<Category, number>>;
  score: number; // 0..100, higher is healthier
  health: SegmentHealth;
}

export const HEALTH_LABEL: Record<SegmentHealth, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  attention: 'Needs attention',
};

/** Group issues that share a road name and area into a segment, then score its health from open damage. */
export function buildSegments(issues: EnrichedIssue[]): RoadSegment[] {
  const map = new Map<string, EnrichedIssue[]>();
  for (const i of issues) {
    const key = `${i.roadName}|${i.area}`;
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  const segments: RoadSegment[] = [];
  for (const [key, list] of map) {
    const open = list.filter((i) => !isClosed(i.status));
    const pressure = open.reduce((s, i) => s + (i.severity === 'high' ? 3 : i.severity === 'medium' ? 2 : 1), 0);
    const score = Math.round(100 * Math.exp(-pressure / 18));
    const counts: Partial<Record<Category, number>> = {};
    for (const i of open) counts[i.category] = (counts[i.category] ?? 0) + 1;
    segments.push({
      id: key,
      roadName: list[0].roadName,
      area: list[0].area,
      center: [list.reduce((s, i) => s + i.latitude, 0) / list.length, list.reduce((s, i) => s + i.longitude, 0) / list.length],
      issues: list,
      open: open.length,
      counts,
      score,
      health: score >= 70 ? 'healthy' : score >= 40 ? 'watch' : 'attention',
    });
  }
  return segments.sort((a, b) => a.score - b.score);
}

export function segmentSummary(seg: RoadSegment): string {
  const parts = (Object.entries(seg.counts) as [Category, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${n} ${CATEGORY_META[c].label.toLowerCase()}${n > 1 ? 's' : ''}`);
  return parts.join(', ') || 'No open issues';
}
