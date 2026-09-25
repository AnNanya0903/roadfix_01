import { CATEGORIES, CATEGORY_META, LIFECYCLE, STATUS_LABEL, type Category, type Severity } from '@/lib/domain';
import type { Filters } from '@/lib/filters';

export default function IssueFilters({ value, onChange, areas, showSearch = false }: { value: Filters; onChange: (f: Filters) => void; areas: string[]; showSearch?: boolean }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const sel = 'field !py-1.5';
  return (
    <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filter incidents" onSubmit={(e) => e.preventDefault()}>
      {showSearch && (
        <div className="col-span-2 lg:col-span-2">
          <label htmlFor="f-q" className="label !text-xs">Search</label>
          <input id="f-q" className={sel} value={value.query} onChange={(e) => set('query', e.target.value)} placeholder="ID, road or area" />
        </div>
      )}
      <div>
        <label htmlFor="f-cat" className="label !text-xs">Issue type</label>
        <select id="f-cat" className={sel} value={value.category} onChange={(e) => set('category', e.target.value as Category | 'all')}>
          <option value="all">All types</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-sev" className="label !text-xs">Severity</label>
        <select id="f-sev" className={sel} value={value.severity} onChange={(e) => set('severity', e.target.value as Severity | 'all')}>
          <option value="all">Any severity</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-st" className="label !text-xs">Status</label>
        <select id="f-st" className={sel} value={value.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
          <option value="all">Any status</option><option value="open">Open</option><option value="closed">Resolved</option>
          {[...LIFECYCLE, 'reopened' as const].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-days" className="label !text-xs">Date</label>
        <select id="f-days" className={sel} value={value.days} onChange={(e) => set('days', Number(e.target.value) as Filters['days'])}>
          <option value={0}>Any time</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-area" className="label !text-xs">Area</label>
        <select id="f-area" className={sel} value={value.area} onChange={(e) => set('area', e.target.value)}>
          <option value="all">All areas</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
    </form>
  );
}
