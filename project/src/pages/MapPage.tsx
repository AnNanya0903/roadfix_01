import { List, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import IncidentMap from '@/components/IncidentMap';
import IssueCard from '@/components/IssueCard';
import IssueFilters from '@/components/IssueFilters';
import MapLegend from '@/components/MapLegend';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { CATEGORY_META } from '@/lib/domain';
import { timeAgo } from '@/lib/format';
import { applyFilters, DEFAULT_FILTERS, type Filters } from '@/lib/filters';
import { photoUrl } from '@/lib/photos';

export default function MapPage({ authority = false }: { authority?: boolean }) {
  const { issues, loading, error, reload, mode } = useApp();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const areas = useMemo(() => Array.from(new Set(issues.map((i) => i.area))).sort(), [issues]);
  const shown = useMemo(() => applyFilters(issues, filters), [issues, filters]);
  const selected = shown.find((i) => i.id === selectedId) ?? null;

  if (loading) return <Loading label="Loading the map…" />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-4xl font-bold">{authority ? 'Incident map' : 'Road safety map'}</h1>
          <p className="text-signal-gray">{shown.length} of {issues.length} incidents shown{mode === 'demo' && ' · Demo data'}</p>
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={() => setShowList((v) => !v)} aria-pressed={showList}><List className="h-4 w-4" aria-hidden /> {showList ? 'Hide list' : 'Show as list'}</button>
      </div>
      <div className="panel mb-4 p-3"><IssueFilters value={filters} onChange={setFilters} areas={areas} /></div>
      <div className="mb-2"><MapLegend /></div>

      {shown.length === 0 ? (
        <div className="panel"><EmptyState title="No incidents match these filters" body="Widen the date range or clear a filter to see more of the map." action={<button type="button" className="btn-dark" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>} /></div>
      ) : (
        <div className="relative panel overflow-hidden">
          <div className="h-[62vh] min-h-[22rem]"><IncidentMap issues={shown} selectedId={selectedId} onSelect={setSelectedId} /></div>
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-white p-3 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80" role="dialog" aria-label={`Incident ${selected.id}`} data-testid="incident-card">
              <button type="button" onClick={() => setSelectedId(null)} className="absolute right-2 top-2 rounded p-1 hover:bg-concrete" aria-label="Close incident card"><X className="h-4 w-4" aria-hidden /></button>
              <div className="flex gap-3">
                {photoUrl(selected.photo) && <img src={photoUrl(selected.photo) ?? ''} alt="" className="h-16 w-20 rounded object-cover" />}
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold">{selected.id}</p>
                  <p className="font-semibold">{CATEGORY_META[selected.category].label}</p>
                  <p className="truncate text-xs text-signal-gray">{selected.roadName}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5"><PriorityBadge level={selected.priority.level} score={selected.priority.score} /><StatusBadge status={selected.status} /></div>
              <p className="mt-2 text-sm">{selected.supporters} reports · Reported {timeAgo(selected.createdAt)}</p>
              <Link to={`/issues/${selected.id}`} className="btn-dark btn-sm mt-2 w-full" data-testid="open-issue">{authority ? 'Open and manage' : 'Open issue'}</Link>
            </div>
          )}
        </div>
      )}

      {showList && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Incident list">
          {shown.slice(0, 40).map((i) => <li key={i.id}><IssueCard issue={i} /></li>)}
          {shown.length > 40 && <li className="text-sm text-signal-gray">Showing the first 40. Narrow the filters to see the rest.</li>}
        </ul>
      )}
    </div>
  );
}
