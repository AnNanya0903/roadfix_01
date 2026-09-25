import { Check } from 'lucide-react';
import { LIFECYCLE, STATUS_LABEL, type Status } from '@/lib/domain';

export default function StatusStepper({ status }: { status: Status }) {
  const idx = status === 'reopened' ? LIFECYCLE.indexOf('resolved') : LIFECYCLE.indexOf(status);
  return (
    <div>
      <ol className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-8" aria-label="Report lifecycle">
        {LIFECYCLE.map((s, i) => {
          const done = i < idx || (i === idx && status !== 'reopened');
          const current = i === idx;
          return (
            <li key={s} className="flex flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  status === 'reopened' && current ? 'bg-signal-red text-white' : done ? 'bg-signal-green text-white' : current ? 'bg-lane text-asphalt' : 'bg-concrete text-signal-gray'
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={`mt-1 text-[11px] leading-tight ${current ? 'font-semibold' : 'text-signal-gray'}`}>{STATUS_LABEL[s]}</span>
            </li>
          );
        })}
      </ol>
      {status === 'reopened' && <p className="mt-2 text-sm font-semibold text-signal-red">Reopened: a citizen reports the problem still exists.</p>}
    </div>
  );
}
