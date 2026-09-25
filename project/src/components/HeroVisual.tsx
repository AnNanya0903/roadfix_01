import { Check } from 'lucide-react';

const MARKERS = [
  { x: 118, y: 150, c: '#C8392F' }, { x: 205, y: 118, c: '#E58A00' }, { x: 300, y: 205, c: '#C8392F', big: true },
  { x: 372, y: 96, c: '#23784A' }, { x: 84, y: 250, c: '#F5B700' }, { x: 250, y: 288, c: '#FFFFFF' },
  { x: 410, y: 232, c: '#E58A00' }, { x: 160, y: 70, c: '#23784A' }, { x: 336, y: 300, c: '#23784A' },
];

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden={false}>
      <svg viewBox="0 0 480 340" className="w-full rounded-lg bg-asphalt-700 shadow-xl" role="img" aria-label="Illustrated road map with colour-coded incident markers">
        <defs><pattern id="blk" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#2B3A46" /><rect x="1" y="1" width="58" height="58" fill="#26343F" /></pattern></defs>
        <rect width="480" height="340" fill="url(#blk)" />
        <path d="M-10 230 C 120 210, 190 120, 300 205 S 430 250, 500 160" fill="none" stroke="#4B5C68" strokeWidth="26" strokeLinecap="round" />
        <path d="M-10 230 C 120 210, 190 120, 300 205 S 430 250, 500 160" fill="none" stroke="#F5B700" strokeWidth="2.5" strokeDasharray="14 12" />
        <path d="M60 -10 C 90 80, 60 180, 130 350" fill="none" stroke="#4B5C68" strokeWidth="16" strokeLinecap="round" />
        <path d="M250 -10 L 240 350" fill="none" stroke="#4B5C68" strokeWidth="14" />
        <path d="M-10 90 C 150 100, 300 60, 500 100" fill="none" stroke="#4B5C68" strokeWidth="12" />
        {MARKERS.map((m, i) => (
          <g key={i}>
            {m.big && <circle cx={m.x} cy={m.y} r="16" fill="#C8392F" className="rf-ping" style={{ transformOrigin: `${m.x}px ${m.y}px` }} />}
            <circle cx={m.x} cy={m.y} r={m.big ? 9 : 7} fill={m.c} stroke="#fff" strokeWidth="2.5" />
          </g>
        ))}
      </svg>
      <div className="absolute -bottom-6 left-3 right-3 rounded-lg bg-white p-4 shadow-xl sm:left-auto sm:right-[-1rem] sm:w-72">
        <p className="font-mono text-xs text-signal-gray">RF-1024 · Sample from demo data</p>
        <p className="font-display text-2xl font-semibold leading-tight">Pothole: <span className="text-signal-red">High priority</span></p>
        <ul className="mt-1 space-y-1 text-sm">
          {['High severity', '23 independent reports', 'Near a school, about 120 m', 'Unresolved for 6 days'].map((t) => <li key={t} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-signal-green" aria-hidden />{t}</li>)}
        </ul>
      </div>
    </div>
  );
}
