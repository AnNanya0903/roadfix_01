import { Link } from 'react-router-dom';
import { CATEGORY_META } from '@/lib/domain';
import type { EnrichedIssue } from '@/lib/enrich';
import { PriorityBadge, StatusBadge } from './Badges';

export default function PriorityList({ issues, limit = 5 }: { issues: EnrichedIssue[]; limit?: number }) {
  return (
    <ol className="divide-y divide-concrete-200" aria-label="Priority queue">
      {issues.slice(0, limit).map((i, idx) => (
        <li key={i.id}>
          <Link to={`/issues/${i.id}`} className="flex items-start gap-3 px-1 py-3 hover:bg-concrete-100">
            <span className="w-7 text-center font-display text-2xl font-bold text-signal-gray">{idx + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs">{i.id}</span><PriorityBadge level={i.priority.level} score={i.priority.score} /><StatusBadge status={i.status} /></span>
              <span className="mt-0.5 block font-semibold">{CATEGORY_META[i.category].label} · {i.roadName}</span>
              <span className="block text-xs text-signal-gray">{i.priority.factors.filter((f) => f.met).map((f) => f.label).join(' · ')}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
