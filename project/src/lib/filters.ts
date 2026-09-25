import type { Category, Severity, Status } from './domain';
import { isClosed } from './domain';
import type { EnrichedIssue } from './enrich';

export interface Filters {
  category: Category | 'all';
  severity: Severity | 'all';
  status: Status | 'open' | 'closed' | 'all';
  days: 7 | 30 | 90 | 0;
  area: string | 'all';
  query: string;
}

export const DEFAULT_FILTERS: Filters = { category: 'all', severity: 'all', status: 'all', days: 0, area: 'all', query: '' };

export function applyFilters(issues: EnrichedIssue[], f: Filters, now = Date.now()): EnrichedIssue[] {
  const q = f.query.trim().toLowerCase();
  return issues.filter((i) => {
    if (f.category !== 'all' && i.category !== f.category) return false;
    if (f.severity !== 'all' && i.severity !== f.severity) return false;
    if (f.status === 'open' && isClosed(i.status)) return false;
    if (f.status === 'closed' && !isClosed(i.status)) return false;
    if (f.status !== 'all' && f.status !== 'open' && f.status !== 'closed' && i.status !== f.status) return false;
    if (f.days && now - new Date(i.createdAt).getTime() > f.days * 86400000) return false;
    if (f.area !== 'all' && i.area !== f.area) return false;
    if (q && !`${i.id} ${i.roadName} ${i.area} ${i.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
