import { useMemo } from 'react';
import { useApp } from '@/lib/appContext';
import { buildSegments } from '@/lib/segments';
import { computeStats } from '@/lib/stats';
import StatCard from './StatCard';

export default function ImpactMetrics() {
  const { issues, mode } = useApp();
  const stats = useMemo(() => computeStats(issues), [issues]);
  const segments = useMemo(() => buildSegments(issues).length, [issues]);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Reports processed" value={stats.total} />
        <StatCard label="Issues resolved" value={stats.resolved} tone="green" />
        <StatCard label="Repairs verified by citizens" value={stats.citizenVerified} tone="green" />
        <StatCard label="Average resolution time" value={stats.avgResolutionDays === null ? 'n/a' : `${stats.avgResolutionDays.toFixed(1)} days`} />
        <StatCard label="Community confirmations" value={stats.communityConfirmations} tone="amber" />
        <StatCard label="Road segments monitored" value={segments} />
      </dl>
      {mode === 'demo' && <p className="hint mt-2">Demo data: these numbers come from 64 fictional incidents seeded for the presentation and are not real-world statistics.</p>}
    </div>
  );
}
