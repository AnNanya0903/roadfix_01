import { Link } from 'react-router-dom';
import { CATEGORY_META } from '@/lib/domain';
import type { EnrichedIssue } from '@/lib/enrich';
import { timeAgo } from '@/lib/format';
import { photoUrl } from '@/lib/photos';
import { PriorityBadge, StatusBadge } from './Badges';

export default function IssueCard({ issue, rank }: { issue: EnrichedIssue; rank?: number }) {
  const img = photoUrl(issue.photo);
  return (
    <Link to={`/issues/${issue.id}`} className="panel flex gap-3 p-3 transition-shadow hover:shadow-md">
      {rank !== undefined && <span className="w-6 pt-1 text-center font-display text-2xl font-bold text-signal-gray">{rank}</span>}
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded bg-concrete">
        {img && <img src={img} alt={`${CATEGORY_META[issue.category].label} at ${issue.roadName}`} className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-signal-gray">{issue.id}</span>
          <PriorityBadge level={issue.priority.level} />
          <StatusBadge status={issue.status} />
        </div>
        <p className="mt-1 truncate font-semibold">{CATEGORY_META[issue.category].label} · {issue.roadName}</p>
        <p className="truncate text-xs text-signal-gray">{issue.supporters} report{issue.supporters > 1 ? 's' : ''} · {timeAgo(issue.createdAt)} · {issue.area}</p>
      </div>
    </Link>
  );
}
