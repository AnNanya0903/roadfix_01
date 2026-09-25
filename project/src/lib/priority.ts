import type { Issue } from './domain';
import { isClosed } from './domain';

export interface PriorityFactor {
  key: 'severity' | 'reports' | 'time' | 'location' | 'recurrence' | 'hazard';
  label: string;
  points: number;
  max: number;
  met: boolean;
  /** true when we could not evaluate the factor because reliable data is missing */
  unavailable?: boolean;
}

export type PriorityLevel = 'high' | 'medium' | 'low' | 'closed';

export interface Priority {
  level: PriorityLevel;
  score: number;
  factors: PriorityFactor[];
}

export interface PriorityContext {
  now: Date;
  /** Earlier issues (any status) of the same category within 100 m in the last 180 days. */
  recurrence: number;
}

export const PRIORITY_THRESHOLDS = { high: 55, medium: 30 } as const;

const DAY = 86400000;

/**
 * Transparent, rule-based priority. Every point is attributable to a factor the
 * user can see. There is no learned or hidden component.
 * Road importance is deliberately not scored: we have no reliable road-class data.
 */
export function scoreIssue(issue: Issue, ctx: PriorityContext): Priority {
  if (isClosed(issue.status)) return { level: 'closed', score: 0, factors: [] };

  const factors: PriorityFactor[] = [];

  const sevPts = issue.severity === 'high' ? 30 : issue.severity === 'medium' ? 18 : 8;
  factors.push({
    key: 'severity',
    label: issue.severity === 'high' ? 'High severity damage' : issue.severity === 'medium' ? 'Medium severity damage' : 'Low severity damage',
    points: sevPts,
    max: 30,
    met: issue.severity !== 'low',
  });

  const n = issue.supporters;
  const repPts = n >= 20 ? 25 : n >= 10 ? 18 : n >= 5 ? 12 : n >= 2 ? 6 : 0;
  factors.push({
    key: 'reports',
    label: n >= 2 ? `${n} independent reports` : 'Single report so far',
    points: repPts,
    max: 25,
    met: repPts > 0,
  });

  const days = Math.max(0, Math.floor((ctx.now.getTime() - new Date(issue.createdAt).getTime()) / DAY));
  const timePts = days >= 14 ? 15 : days >= 7 ? 10 : days >= 3 ? 5 : 0;
  factors.push({
    key: 'time',
    label: days >= 3 ? `Unresolved for ${days} days` : 'Reported recently',
    points: timePts,
    max: 15,
    met: timePts > 0,
  });

  if (issue.facilities === null) {
    factors.push({ key: 'location', label: 'Nearby facility information unavailable', points: 0, max: 15, met: false, unavailable: true });
  } else {
    const critical = issue.facilities.filter((f) => (f.kind === 'school' || f.kind === 'hospital') && f.distanceM <= 200).sort((a, b) => a.distanceM - b.distanceM)[0];
    const transit = issue.facilities
      .filter((f) => (f.kind === 'bus_stop' || f.kind === 'railway_station' || f.kind === 'junction' || f.kind === 'public_facility') && f.distanceM <= 150)
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    if (critical) {
      factors.push({ key: 'location', label: `Near a ${critical.kind === 'school' ? 'school' : 'hospital'} (about ${Math.round(critical.distanceM / 10) * 10} m)`, points: 15, max: 15, met: true });
    } else if (transit) {
      factors.push({ key: 'location', label: `Near a ${transit.kind.replace(/_/g, ' ')} (about ${Math.round(transit.distanceM / 10) * 10} m)`, points: 8, max: 15, met: true });
    } else {
      factors.push({ key: 'location', label: 'No sensitive location found nearby', points: 0, max: 15, met: false });
    }
  }

  if (ctx.recurrence > 0) {
    factors.push({
      key: 'recurrence',
      label: `Repeat location: ${ctx.recurrence} earlier report${ctx.recurrence > 1 ? 's' : ''} here`,
      points: Math.min(8, ctx.recurrence * 4),
      max: 8,
      met: true,
    });
  }

  const hazard: Partial<Record<Issue['category'], { pts: number; label: string }>> = {
    open_manhole: { pts: 8, label: 'Open manhole is a fall hazard' },
    fallen_tree: { pts: 6, label: 'Fallen tree may block the carriageway' },
    obstruction: { pts: 5, label: 'Obstruction on the carriageway' },
  };
  const h = hazard[issue.category];
  if (h) factors.push({ key: 'hazard', label: h.label, points: h.pts, max: 8, met: true });

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const level: PriorityLevel = score >= PRIORITY_THRESHOLDS.high ? 'high' : score >= PRIORITY_THRESHOLDS.medium ? 'medium' : 'low';
  return { level, score, factors };
}

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  closed: 'Resolved',
};
