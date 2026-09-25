import { Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import { service } from '@/lib/data';
import type { Activity } from '@/lib/data/service';
import { computeBadges } from '@/lib/badges';
import type { AppUser } from '@/lib/domain';
import { useApp } from '@/lib/appContext';

export default function Contribution({ user }: { user: AppUser }) {
  const [a, setA] = useState<Activity | null>(null);
  const { issues } = useApp();
  useEffect(() => {
    let alive = true;
    void service.getActivity(user).then((r) => alive && setA(r)).catch(() => alive && setA(null));
    return () => {
      alive = false;
    };
  }, [user, issues]);
  if (!a) return null;
  const badges = computeBadges(a);
  return (
    <section className="panel p-4" aria-labelledby="contrib-h">
      <h2 id="contrib-h" className="text-2xl font-semibold">Your contribution</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[['Reports submitted', a.reportsSubmitted], ['Reports verified', a.reportsVerified], ['Issues confirmed', a.confirmationsGiven], ['Repairs verified', a.repairsVerified]].map(([l, v]) => (
          <div key={l} className="rounded-md bg-concrete-100 p-2"><dd className="font-display text-3xl font-bold">{v}</dd><dt className="text-xs text-signal-gray">{l}</dt></div>
        ))}
      </dl>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {badges.map((b) => (
          <li key={b.key} className={`flex items-start gap-2 rounded-md border p-2 text-sm ${b.earned ? 'border-lane bg-lane-100' : 'border-concrete-200 text-signal-gray'}`}>
            <Award className={`mt-0.5 h-5 w-5 shrink-0 ${b.earned ? 'text-lane-700' : 'text-concrete-400'}`} aria-hidden />
            <span><span className="font-semibold text-ink">{b.name}{b.earned ? ' (earned)' : ''}</span><br />{b.earned ? b.description : b.progress}</span>
          </li>
        ))}
      </ul>
      <p className="hint mt-3">Badges count verified activity only. Duplicate or rejected reports earn nothing.</p>
    </section>
  );
}
