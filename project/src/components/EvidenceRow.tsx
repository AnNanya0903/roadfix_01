import { Camera, Clock, MapPin, Users } from 'lucide-react';
import type { Issue } from '@/lib/domain';
import { formatDate } from '@/lib/format';

export default function EvidenceRow({ issue }: { issue: Issue }) {
  const items = [
    { icon: Camera, ok: Boolean(issue.photo), label: issue.photo ? 'Photo attached' : 'No photo' },
    { icon: MapPin, ok: true, label: `GPS ${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}` },
    { icon: Clock, ok: true, label: `Reported ${formatDate(issue.createdAt)}` },
    { icon: Users, ok: issue.supporters > 1, label: `${issue.supporters} citizen${issue.supporters > 1 ? 's' : ''} reported or confirmed` },
  ];
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Evidence on record">
      {items.map(({ icon: Icon, ok, label }) => (
        <li key={label} className="flex items-center gap-2 text-sm">
          <Icon className={`h-4 w-4 shrink-0 ${ok ? 'text-signal-green' : 'text-concrete-400'}`} aria-hidden />
          <span className={ok ? '' : 'text-signal-gray'}>{label}</span>
        </li>
      ))}
    </ul>
  );
}
