import { CloudRain, FlaskConical } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HealthBadge, PriorityBadge, StatusBadge } from '@/components/Badges';
import { BarList, Meter, StackedBars, WeeklyChart } from '@/components/Charts';
import IssueFilters from '@/components/IssueFilters';
import PriorityList from '@/components/PriorityList';
import StatCard from '@/components/StatCard';
import { EmptyState, ErrorState, InlineNotice, Loading } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { CATEGORY_META, DEPARTMENTS, isClosed } from '@/lib/domain';
import { applyFilters, DEFAULT_FILTERS, type Filters } from '@/lib/filters';
import { timeAgo } from '@/lib/format';
import { forecastAreaRisk, rainConcerns } from '@/lib/forecast';
import { photoUrl } from '@/lib/photos';
import { buildSegments, segmentSummary } from '@/lib/segments';
import { computeStats } from '@/lib/stats';
import { getWeather, type WeatherSnapshot } from '@/lib/weather';
import { computeSLA } from '@/lib/sla';

function useData() {
  const app = useApp();
  const stats = useMemo(() => computeStats(app.issues), [app.issues]);
  const queue = useMemo(() => app.issues.filter((i) => !isClosed(i.status)).sort((a, b) => b.priority.score - a.priority.score || b.ageDays - a.ageDays), [app.issues]);
  return { ...app, stats, queue };
}

function Gate({ children }: { children: (d: ReturnType<typeof useData>) => JSX.Element }) {
  const d = useData();
  if (d.loading) return <Loading />;
  if (d.error) return <ErrorState message={d.error} onRetry={() => void d.reload()} />;
  return children(d);
}

export function AuthorityOverview() {
  return (
    <Gate>
      {({ stats, queue, mode, notifications }) => (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
          <div><h1 className="text-4xl font-bold">Command center</h1><p className="text-signal-gray">{mode === 'demo' ? 'Demo data: fictional incidents for the presentation.' : 'Live incidents from citizens.'}</p></div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total reports" value={stats.total} />
            <StatCard label="Verified issues" value={stats.verified} tone="green" />
            <StatCard label="Pending review" value={stats.pending} tone="amber" />
            <StatCard label="Assigned or in progress" value={stats.assigned} />
            <StatCard label="Resolved" value={stats.resolved} tone="green" sub={`${stats.citizenVerified} citizen verified`} />
            <StatCard label="Avg resolution time" value={stats.avgResolutionDays === null ? 'n/a' : `${stats.avgResolutionDays.toFixed(1)} d`} />
          </dl>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <section className="panel p-4" aria-labelledby="pq-h">
              <div className="mb-1 flex items-baseline justify-between"><h2 id="pq-h" className="text-2xl font-semibold">Priority queue</h2><Link to="/authority/queue" className="text-sm font-semibold underline">See all</Link></div>
              {queue.length === 0 ? <EmptyState title="Nothing open" body="No open incidents right now." /> : <PriorityList issues={queue} limit={6} />}
            </section>
            <div className="space-y-6">
              <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Reports over time</h2><WeeklyChart data={stats.weekly} /></section>
              <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Recent alerts</h2>
                {notifications.length === 0 ? <p className="text-sm text-signal-gray">No alerts.</p> : <ul className="space-y-2">{notifications.slice(0, 4).map((n) => <li key={n.id} className="text-sm"><Link to={n.issueId ? `/issues/${n.issueId}` : '#'} className="font-semibold underline">{n.title}</Link><br /><span className="text-signal-gray">{n.body} · {timeAgo(n.at)}</span></li>)}</ul>}
              </section>
            </div>
          </div>
        </div>
      )}
    </Gate>
  );
}

export function IncidentsPage() {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, status: 'open' });
  const [page, setPage] = useState(0);
  return (
    <Gate>
      {({ issues }) => {
        const areas = Array.from(new Set(issues.map((i) => i.area))).sort();
        const rows = applyFilters(issues, filters).sort((a, b) => b.priority.score - a.priority.score);
        const size = 20;
        const pages = Math.max(1, Math.ceil(rows.length / size));
        const cur = Math.min(page, pages - 1);
        return (
          <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
            <h1 className="text-4xl font-bold">Incident management</h1>
            <div className="panel p-3"><IssueFilters value={filters} onChange={(f) => { setFilters(f); setPage(0); }} areas={areas} showSearch /></div>
            {rows.length === 0 ? <div className="panel"><EmptyState title="No incidents match" body="Change the filters to widen the list." /></div> : (
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <caption className="sr-only">Incidents sorted by priority</caption>
                  <thead className="bg-concrete-100 text-xs text-signal-gray"><tr><th className="p-3">ID</th><th>Issue</th><th>Priority</th><th>Status</th><th>Department</th><th>Reports</th><th>Age</th></tr></thead>
                  <tbody>
                    {rows.slice(cur * size, cur * size + size).map((i) => (
                      <tr key={i.id} className="border-t border-concrete-200 hover:bg-concrete-100">
                        <td className="p-3 font-mono"><Link to={`/issues/${i.id}`} className="font-bold underline">{i.id}</Link></td>
                        <td><span className="font-semibold">{CATEGORY_META[i.category].label}</span><br /><span className="text-xs text-signal-gray">{i.roadName}</span></td>
                        <td><PriorityBadge level={i.priority.level} score={i.priority.score} /></td>
                        <td><StatusBadge status={i.status} /></td>
                        <td className="text-xs">{i.department ?? 'Unassigned'}</td>
                        <td className="tabular-nums">{i.supporters}</td>
                        <td className="text-xs">{timeAgo(i.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span>{rows.length} incidents · page {cur + 1} of {pages}</span>
              <span className="flex gap-2"><button type="button" className="btn-outline btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button><button type="button" className="btn-outline btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button></span>
            </div>
          </div>
        );
      }}
    </Gate>
  );
}

export function PriorityQueuePage() {
  return (
    <Gate>
      {({ queue }) => (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <h1 className="text-4xl font-bold">Priority queue</h1>
          <p className="mb-4 text-signal-gray">Open incidents ranked by an explainable score. Open one to see every factor.</p>
          <div className="panel p-3">{queue.length === 0 ? <EmptyState title="Queue is empty" body="No open incidents." /> : <PriorityList issues={queue} limit={25} />}</div>
        </div>
      )}
    </Gate>
  );
}

export function AssignmentsPage() {
  return (
    <Gate>
      {({ issues, queue }) => {
        const unassigned = queue.filter((i) => ['verified', 'reopened'].includes(i.status));
        return (
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <h1 className="text-4xl font-bold">Assignments</h1>
            <section className="panel p-4"><h2 className="mb-2 text-2xl font-semibold">Waiting for a department ({unassigned.length})</h2>{unassigned.length === 0 ? <p className="text-sm text-signal-gray">Everything verified has been assigned.</p> : <PriorityList issues={unassigned} limit={10} />}</section>
            <div className="grid gap-4 md:grid-cols-2">
              {DEPARTMENTS.map((d) => {
                const list = issues.filter((i) => i.department === d && !isClosed(i.status));
                return (
                  <section key={d} className="panel p-4"><h2 className="text-xl font-semibold">{d}</h2><p className="text-sm text-signal-gray">{list.length} active</p>
                    <ul className="mt-2 space-y-1 text-sm">{list.slice(0, 5).map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><Link to={`/issues/${i.id}`} className="underline">{i.id} · {CATEGORY_META[i.category].label}</Link><StatusBadge status={i.status} /></li>)}{list.length === 0 && <li className="text-signal-gray">No active assignments</li>}</ul>
                  </section>
                );
              })}
            </div>
          </div>
        );
      }}
    </Gate>
  );
}

export function ResolutionQueuePage() {
  return (
    <Gate>
      {({ issues }) => {
        const waiting = issues.filter((i) => i.status === 'resolved');
        const reopened = issues.filter((i) => i.status === 'reopened');
        const verified = issues.filter((i) => i.status === 'citizen_verified').slice(0, 6);
        const row = (i: (typeof issues)[number]) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <div className="flex gap-1">{[photoUrl(i.photo), photoUrl(i.resolution?.afterPhoto)].map((src, k) => <div key={k} className="h-12 w-16 overflow-hidden rounded bg-concrete">{src && <img src={src} alt={k ? 'After repair' : 'Before repair'} className="h-full w-full object-cover" loading="lazy" />}</div>)}</div>
            <div className="min-w-0 flex-1"><Link to={`/issues/${i.id}`} className="font-semibold underline">{i.id}</Link> <StatusBadge status={i.status} /><p className="truncate text-xs text-signal-gray">{CATEGORY_META[i.category].label} · {i.roadName} · resolved {i.resolvedAt ? timeAgo(i.resolvedAt) : ''} · fixed votes {i.resolution?.fixedVotes ?? 0}</p></div>
          </li>
        );
        return (
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
            <h1 className="text-4xl font-bold">Resolution verification</h1>
            <section className="panel p-4"><h2 className="text-2xl font-semibold">Reopened by citizens ({reopened.length})</h2>{reopened.length ? <ul className="divide-y divide-concrete-200">{reopened.map(row)}</ul> : <p className="text-sm text-signal-gray">No repairs are disputed.</p>}</section>
            <section className="panel p-4"><h2 className="text-2xl font-semibold">Waiting for citizen verification ({waiting.length})</h2>{waiting.length ? <ul className="divide-y divide-concrete-200">{waiting.map(row)}</ul> : <p className="text-sm text-signal-gray">Nothing is waiting.</p>}</section>
            <section className="panel p-4"><h2 className="text-2xl font-semibold">Recently verified</h2>{verified.length ? <ul className="divide-y divide-concrete-200">{verified.map(row)}</ul> : <p className="text-sm text-signal-gray">None yet.</p>}</section>
          </div>
        );
      }}
    </Gate>
  );
}

export function AnalyticsPage() {
  const { issues, stats, mode, loading, error, reload } = useData();
  const [weather, setWeather] = useState<WeatherSnapshot | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const first = issues[0];
    void getWeather(first?.latitude ?? 12.9716, first?.longitude ?? 77.5946).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [issues.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const segments = useMemo(() => buildSegments(issues), [issues]);
  const risks = useMemo(() => forecastAreaRisk(issues, weather ?? null), [issues, weather]);
  const rain = useMemo(() => rainConcerns(issues, weather ?? null), [issues, weather]);
  const overdue = useMemo(() => issues.filter((i) => !isClosed(i.status) && computeSLA(i.createdAt).status !== 'ok').length, [issues]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  const tone = (l: string) => (l === 'high' ? 'bg-signal-redbg text-signal-red' : l === 'medium' ? 'bg-lane-100 text-lane-700' : 'bg-signal-greenbg text-signal-green');

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div><h1 className="text-4xl font-bold">Analytics</h1>{mode === 'demo' && <p className="text-signal-gray">Demo data: fictional incidents. Statistics are illustrative, not real-world figures.</p>}</div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Issues by category</h2><BarList items={stats.byCategory.map((c) => ({ label: c.label, value: c.count, color: c.color }))} /></section>
        <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Issues by severity</h2><BarList items={stats.bySeverity.map((s) => ({ label: s.label, value: s.count, color: s.key === 'high' ? '#C8392F' : s.key === 'medium' ? '#E58A00' : '#23784A' }))} />
          <h2 className="mb-2 mt-5 text-2xl font-semibold">Open vs resolved</h2><BarList items={[{ label: 'Open', value: stats.openVsResolved.open, color: '#C8392F' }, { label: 'Resolved', value: stats.openVsResolved.resolved, color: '#23784A' }]} />
          <p className="hint mt-3">{overdue} open incident{overdue === 1 ? '' : 's'} past or near the 30-day SLA.</p></section>
        <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Issues by area</h2><StackedBars rows={stats.byArea.map((a) => ({ label: a.area, a: a.open, b: a.resolved }))} /></section>
        <section className="panel p-4 md:col-span-2"><h2 className="mb-3 text-2xl font-semibold">Reports and resolutions, last 8 weeks</h2><WeeklyChart data={stats.weekly} /></section>
        <section className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Resolution</h2><dl className="grid grid-cols-2 gap-3"><StatCard label="Average time" value={stats.avgResolutionDays === null ? 'n/a' : `${stats.avgResolutionDays.toFixed(1)} d`} /><StatCard label="Citizen verified" value={stats.citizenVerified} tone="green" /></dl></section>
      </div>

      <section className="panel p-4" aria-labelledby="seg-h">
        <h2 id="seg-h" className="text-2xl font-semibold">Road segment health</h2>
        <p className="mb-3 text-sm text-signal-gray">Nearby incidents grouped by road. Health falls as open, severe damage builds up.</p>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((s) => (
            <li key={s.id} className="rounded-md border border-concrete-200 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{s.roadName}</p><p className="text-xs text-signal-gray">{s.area}</p></div><HealthBadge health={s.health} /></div>
              <div className="mt-2"><Meter value={s.score} tone={s.health === 'attention' ? 'red' : s.health === 'watch' ? 'amber' : 'green'} /></div>
              <p className="mt-1 text-xs">Health {s.score}/100 · {s.open} open</p>
              <p className="text-xs text-signal-gray">{segmentSummary(s)}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4" aria-labelledby="rain-h">
          <h2 id="rain-h" className="flex items-center gap-2 text-2xl font-semibold"><CloudRain className="h-5 w-5" aria-hidden /> Weather and road risk</h2>
          {weather === undefined ? <Loading label="Checking weather…" /> : weather === null ? <div className="mt-3"><InlineNotice tone="warn">Weather data is unavailable right now. Try again later.</InlineNotice></div> : (
            <>
              {weather.source === 'demo' && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-lane-100 px-2 py-0.5 text-xs font-semibold text-lane-700"><FlaskConical className="h-3 w-3" aria-hidden /> Demo weather sample</p>}
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded bg-concrete-100 p-2"><dd className="font-semibold">{weather.condition}</dd><dt className="text-xs text-signal-gray">{weather.tempC !== null ? `${weather.tempC}°C now` : 'Now'}</dt></div>
                <div className="rounded bg-concrete-100 p-2"><dd className="font-semibold">{weather.rainNext24hMm} mm</dd><dt className="text-xs text-signal-gray">Rain forecast, 24 h</dt></div>
                <div className="rounded bg-concrete-100 p-2"><dd className="font-semibold">{weather.rainLast72hMm} mm</dd><dt className="text-xs text-signal-gray">Rain, last 72 h</dt></div>
              </dl>
              {weather.rainNext24hMm >= 30 && <div className="mt-3"><InlineNotice tone="warn"><strong>Rain risk alert.</strong> Heavy rainfall is forecast. Areas with past waterlogging reports may deserve attention. Weather does not guarantee a road failure.</InlineNotice></div>}
              <ul className="mt-3 space-y-1.5">{rain.map((r) => <li key={r.area} className="flex items-center justify-between gap-2 text-sm"><span>{r.area}<span className="block text-xs text-signal-gray">{r.reason}</span></span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(r.level)}`}>{r.level === 'high' ? 'High' : r.level === 'medium' ? 'Moderate' : 'Low'} concern</span></li>)}</ul>
            </>
          )}
        </section>

        <section className="panel p-4" aria-labelledby="fc-h">
          <h2 id="fc-h" className="text-2xl font-semibold">Road risk forecast</h2>
          <p className="mt-1 inline-flex rounded-full bg-lane-100 px-2 py-0.5 text-xs font-semibold text-lane-700">Experimental risk estimate</p>
          <p className="mt-2 text-sm text-signal-gray">A transparent heuristic over past incidents. It estimates where attention may be needed. It does not predict failures.</p>
          <ul className="mt-3 space-y-2">{risks.map((r) => <li key={r.area} className="flex items-start justify-between gap-2 text-sm"><span><span className="font-semibold">{r.area}</span><span className="block text-xs text-signal-gray">{r.reasons.join(' · ')}</span></span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone(r.level)}`}>{r.level === 'high' ? 'High' : r.level === 'medium' ? 'Medium' : 'Low'} risk</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}

import MapPage from './MapPage';

export default function AuthorityPages({ page }: { page: 'overview' | 'incidents' | 'queue' | 'analytics' | 'assignments' | 'resolution' | 'map' }) {
  switch (page) {
    case 'incidents': return <IncidentsPage />;
    case 'queue': return <PriorityQueuePage />;
    case 'analytics': return <AnalyticsPage />;
    case 'assignments': return <AssignmentsPage />;
    case 'resolution': return <ResolutionQueuePage />;
    case 'map': return <MapPage authority />;
    default: return <AuthorityOverview />;
  }
}
