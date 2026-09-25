import type { Issue } from './domain';
import { isClosed, isVerifiedStatus } from './domain';
import { distanceMeters } from './geo';
import { scoreIssue, type Priority } from './priority';

export interface EnrichedIssue extends Issue {
  priority: Priority;
  /** Map marker semantics: red high, orange medium, yellow low, green resolved, grey unverified. */
  marker: 'high' | 'medium' | 'low' | 'resolved' | 'unverified';
  ageDays: number;
}

const DAY = 86400000;

export function isTrustedReport(issue: Issue): boolean {
  return isVerifiedStatus(issue.status) || isClosed(issue.status) || issue.supporters >= 3;
}

export function enrichIssues(issues: Issue[], now = new Date()): EnrichedIssue[] {
  return issues.map((issue) => {
    let recurrence = 0;
    for (const other of issues) {
      if (other.id === issue.id || other.category !== issue.category) continue;
      if (new Date(other.createdAt) >= new Date(issue.createdAt)) continue;
      if (now.getTime() - new Date(other.createdAt).getTime() > 180 * DAY) continue;
      if (!isClosed(other.status)) continue;
      if (distanceMeters(issue.latitude, issue.longitude, other.latitude, other.longitude) <= 100) recurrence += 1;
    }
    const priority = scoreIssue(issue, { now, recurrence });
    let marker: EnrichedIssue['marker'];
    if (isClosed(issue.status)) marker = 'resolved';
    else if (!isTrustedReport(issue)) marker = 'unverified';
    else marker = priority.level === 'closed' ? 'resolved' : priority.level;
    return { ...issue, priority, marker, ageDays: Math.max(0, Math.floor((now.getTime() - new Date(issue.createdAt).getTime()) / DAY)) };
  });
}

export const MARKER_COLOR: Record<EnrichedIssue['marker'], string> = {
  high: '#C8392F',
  medium: '#E58A00',
  low: '#F5B700',
  resolved: '#23784A',
  unverified: '#FFFFFF',
};

export const MARKER_LABEL: Record<EnrichedIssue['marker'], string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
  resolved: 'Resolved',
  unverified: 'Unverified',
};
