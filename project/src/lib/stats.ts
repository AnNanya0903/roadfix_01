import type { Category, Severity } from './domain';
import { CATEGORY_META, isClosed, isVerifiedStatus } from './domain';
import type { EnrichedIssue } from './enrich';

const DAY = 86400000;

export interface Stats {
  total: number;
  verified: number;
  pending: number;
  assigned: number;
  resolved: number;
  citizenVerified: number;
  open: number;
  openHigh: number;
  avgResolutionDays: number | null;
  communityConfirmations: number;
  byCategory: Array<{ key: Category; label: string; count: number; color: string }>;
  bySeverity: Array<{ key: Severity; label: string; count: number }>;
  byArea: Array<{ area: string; open: number; resolved: number }>;
  weekly: Array<{ label: string; created: number; resolved: number }>;
  openVsResolved: { open: number; resolved: number };
}

export function computeStats(issues: EnrichedIssue[], now = new Date()): Stats {
  const closed = issues.filter((i) => isClosed(i.status));
  const durations = closed.filter((i) => i.resolvedAt).map((i) => (new Date(i.resolvedAt as string).getTime() - new Date(i.createdAt).getTime()) / DAY);
  const catCount = new Map<Category, number>();
  const areas = new Map<string, { open: number; resolved: number }>();
  for (const i of issues) {
    catCount.set(i.category, (catCount.get(i.category) ?? 0) + 1);
    const a = areas.get(i.area) ?? { open: 0, resolved: 0 };
    if (isClosed(i.status)) a.resolved += 1;
    else a.open += 1;
    areas.set(i.area, a);
  }
  const weekly: Stats['weekly'] = [];
  for (let w = 7; w >= 0; w--) {
    const end = now.getTime() - w * 7 * DAY;
    const start = end - 7 * DAY;
    weekly.push({
      label: new Date(end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      created: issues.filter((i) => { const t = new Date(i.createdAt).getTime(); return t > start && t <= end; }).length,
      resolved: closed.filter((i) => { const t = i.resolvedAt ? new Date(i.resolvedAt).getTime() : 0; return t > start && t <= end; }).length,
    });
  }
  return {
    total: issues.length,
    verified: issues.filter((i) => isVerifiedStatus(i.status) || isClosed(i.status)).length,
    pending: issues.filter((i) => i.status === 'reported' || i.status === 'ai_analyzed').length,
    assigned: issues.filter((i) => ['assigned', 'acknowledged', 'work_started'].includes(i.status)).length,
    resolved: closed.length,
    citizenVerified: issues.filter((i) => i.status === 'citizen_verified').length,
    open: issues.length - closed.length,
    openHigh: issues.filter((i) => !isClosed(i.status) && i.priority.level === 'high').length,
    avgResolutionDays: durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    communityConfirmations: issues.reduce((s, i) => s + Math.max(0, i.supporters - 1), 0),
    byCategory: [...catCount.entries()].map(([key, count]) => ({ key, label: CATEGORY_META[key].label, count, color: CATEGORY_META[key].color })).sort((a, b) => b.count - a.count),
    bySeverity: (['high', 'medium', 'low'] as Severity[]).map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: issues.filter((i) => i.severity === s).length })),
    byArea: [...areas.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.open + b.resolved - (a.open + a.resolved)),
    weekly,
    openVsResolved: { open: issues.length - closed.length, resolved: closed.length },
  };
}
