import type { Severity, Status } from '@/lib/domain';
import { SEVERITY_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/domain';
import { MARKER_COLOR, MARKER_LABEL, type EnrichedIssue } from '@/lib/enrich';
import type { PriorityLevel } from '@/lib/priority';
import { PRIORITY_LABEL } from '@/lib/priority';
import type { SegmentHealth } from '@/lib/segments';
import { HEALTH_LABEL } from '@/lib/segments';

const TONE = {
  gray: 'bg-signal-graybg text-signal-gray',
  blue: 'bg-signal-bluebg text-signal-blue',
  amber: 'bg-signal-amberbg text-signal-amber',
  green: 'bg-signal-greenbg text-signal-green',
  red: 'bg-signal-redbg text-signal-red',
} as const;

const pill = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`${pill} ${TONE[STATUS_TONE[status]]}`}>{STATUS_LABEL[status]}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone = severity === 'high' ? 'red' : severity === 'medium' ? 'amber' : 'green';
  return <span className={`${pill} ${TONE[tone]}`}>{SEVERITY_LABEL[severity]} severity</span>;
}

export function PriorityBadge({ level, score }: { level: PriorityLevel; score?: number }) {
  const tone = level === 'high' ? 'red' : level === 'medium' ? 'amber' : level === 'closed' ? 'green' : 'gray';
  return (
    <span className={`${pill} ${TONE[tone]}`}>
      {level === 'closed' ? 'Resolved' : `${PRIORITY_LABEL[level]} priority`}
      {score !== undefined && level !== 'closed' && <span className="font-normal opacity-80">{score}/100</span>}
    </span>
  );
}

export function MarkerDot({ marker }: { marker: EnrichedIssue['marker'] }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-asphalt/40"
      style={{ background: MARKER_COLOR[marker] }}
      role="img"
      aria-label={MARKER_LABEL[marker]}
    />
  );
}

export function HealthBadge({ health }: { health: SegmentHealth }) {
  const tone = health === 'attention' ? 'red' : health === 'watch' ? 'amber' : 'green';
  return <span className={`${pill} ${TONE[tone]}`}>{HEALTH_LABEL[health]}</span>;
}

export function ModePill({ mode }: { mode: 'demo' | 'live' }) {
  return (
    <span className={`${pill} ${mode === 'demo' ? 'bg-lane-100 text-lane-700' : 'bg-signal-greenbg text-signal-green'}`}>
      {mode === 'demo' ? 'Demo mode' : 'Live mode'}
    </span>
  );
}
