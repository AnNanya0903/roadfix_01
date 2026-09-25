import { MARKER_COLOR, MARKER_LABEL, type EnrichedIssue } from '@/lib/enrich';

export default function MapLegend() {
  const keys: EnrichedIssue['marker'][] = ['high', 'medium', 'low', 'resolved', 'unverified'];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Map legend">
      {keys.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: MARKER_COLOR[k], outline: k === 'unverified' ? '1px solid #5B6771' : undefined }} aria-hidden />
          {MARKER_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}
