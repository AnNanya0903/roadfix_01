export default function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'red' | 'green' | 'amber' }) {
  const bar = tone === 'red' ? 'bg-signal-red' : tone === 'green' ? 'bg-signal-green' : tone === 'amber' ? 'bg-lane' : 'bg-asphalt';
  return (
    <div className="panel relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} aria-hidden />
      <dt className="text-sm text-signal-gray">{label}</dt>
      <dd className="font-display text-4xl font-bold leading-tight">{value}</dd>
      {sub && <p className="text-xs text-signal-gray">{sub}</p>}
    </div>
  );
}
