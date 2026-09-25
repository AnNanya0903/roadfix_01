interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export function BarList({ items, unit = '' }: { items: BarItem[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate" title={i.label}>{i.label}</span>
          <span className="h-3 rounded-sm bg-concrete" aria-hidden>
            <span className="block h-3 rounded-sm" style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? '#33444F' }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{i.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

export function StackedBars({ rows }: { rows: Array<{ label: string; a: number; b: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.a + r.b));
  return (
    <div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-sm">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="flex h-3 rounded-sm bg-concrete" aria-hidden>
              <span className="block h-3 rounded-l-sm bg-signal-red" style={{ width: `${(r.a / max) * 100}%` }} />
              <span className="block h-3 bg-signal-green" style={{ width: `${(r.b / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{r.a}/{r.b}</span>
          </li>
        ))}
      </ul>
      <p className="hint mt-2 flex gap-3"><span><span className="mr-1 inline-block h-2 w-2 bg-signal-red" />Open</span><span><span className="mr-1 inline-block h-2 w-2 bg-signal-green" />Resolved</span></p>
    </div>
  );
}

export function WeeklyChart({ data }: { data: Array<{ label: string; created: number; resolved: number }> }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const H = 120;
  const W = 360;
  const step = W / data.length;
  const y = (v: number) => H - (v / max) * (H - 8);
  const line = (key: 'created' | 'resolved') => data.map((d, i) => `${i ? 'L' : 'M'}${(i * step + step / 2).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Reports created and resolved per week">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={H - g * (H - 8)} y2={H - g * (H - 8)} stroke="#DDE1E4" />
        ))}
        <path d={line('created')} fill="none" stroke="#C8392F" strokeWidth="2.5" />
        <path d={line('resolved')} fill="none" stroke="#23784A" strokeWidth="2.5" />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={i * step + step / 2} cy={y(d.created)} r="3" fill="#C8392F" />
            <circle cx={i * step + step / 2} cy={y(d.resolved)} r="3" fill="#23784A" />
            <text x={i * step + step / 2} y={H + 16} textAnchor="middle" fontSize="9" fill="#5B6771">{d.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="hint flex gap-3"><span><span className="mr-1 inline-block h-2 w-2 bg-signal-red" />Reported</span><span><span className="mr-1 inline-block h-2 w-2 bg-signal-green" />Resolved</span></figcaption>
    </figure>
  );
}

export function Meter({ value, tone }: { value: number; tone: 'red' | 'amber' | 'green' }) {
  const bg = tone === 'red' ? 'bg-signal-red' : tone === 'amber' ? 'bg-lane' : 'bg-signal-green';
  return (
    <div className="h-2 rounded-full bg-concrete" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-2 rounded-full ${bg}`} style={{ width: `${Math.max(3, value)}%` }} />
    </div>
  );
}
