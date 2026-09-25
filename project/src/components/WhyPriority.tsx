import { Check, HelpCircle, Minus } from 'lucide-react';
import type { EnrichedIssue } from '@/lib/enrich';
import { PRIORITY_THRESHOLDS } from '@/lib/priority';
import { PriorityBadge } from './Badges';

export default function WhyPriority({ issue, compact = false }: { issue: EnrichedIssue; compact?: boolean }) {
  const { priority } = issue;
  if (priority.level === 'closed') {
    return <p className="text-sm text-signal-gray">This issue is resolved, so it is no longer prioritised.</p>;
  }
  return (
    <section aria-labelledby={`why-${issue.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`why-${issue.id}`} className="font-display text-2xl font-semibold">
          Priority: {priority.level.toUpperCase()}
        </h3>
        <PriorityBadge level={priority.level} score={priority.score} />
      </div>
      <p className="mt-1 text-sm font-semibold">Why?</p>
      <ul className="mt-1 space-y-1.5">
        {priority.factors.map((f) => (
          <li key={f.key} className="flex items-start gap-2 text-sm">
            {f.unavailable ? (
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-gray" aria-hidden />
            ) : f.met ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-green" aria-hidden />
            ) : (
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-concrete-400" aria-hidden />
            )}
            <span className={f.met ? '' : 'text-signal-gray'}>{f.label}</span>
            <span className="ml-auto tabular-nums text-xs text-signal-gray">+{f.points}</span>
          </li>
        ))}
      </ul>
      {!compact && (
        <p className="hint mt-3">
          Rule-based score out of 100: High from {PRIORITY_THRESHOLDS.high}, Medium from {PRIORITY_THRESHOLDS.medium}. Road importance is not scored because no reliable road-class data is available.
        </p>
      )}
    </section>
  );
}
