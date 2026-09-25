import { AlertTriangle, Camera, Check, FlaskConical, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { aiProvider, AIUnavailableError } from '@/lib/ai';
import { service } from '@/lib/data';
import type { AppUser, Issue, ResolutionComparison } from '@/lib/domain';
import { demoPhotoUrl, photoUrl, prepareImage, type PreparedImage } from '@/lib/photos';
import { MODE } from '@/lib/mode';
import PhotoInput from './PhotoInput';
import { InlineNotice } from './States';

export function BeforeAfter({ before, after, comparison }: { before: string | null; after: string | null; comparison: ResolutionComparison | null }) {
  return (
    <section aria-label="Resolution evidence">
      <div className="grid grid-cols-2 gap-3">
        {[{ t: 'Before', src: before, s: comparison?.beforeSummary }, { t: 'After', src: after, s: comparison?.afterSummary }].map(({ t, src, s }) => (
          <figure key={t} className="overflow-hidden rounded-lg border border-concrete-300 bg-white">
            <div className="aspect-[4/3] bg-concrete">{src ? <img src={src} alt={`${t} repair`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-center text-xs text-signal-gray">No {t.toLowerCase()} photo yet</div>}</div>
            <figcaption className="p-2"><p className="text-sm font-semibold">{t}</p>{s && <p className="text-xs text-signal-gray">{s}</p>}</figcaption>
          </figure>
        ))}
      </div>
      {comparison && (
        <div className={`mt-3 rounded-md p-3 text-sm ${comparison.verdict === 'improved' ? 'bg-signal-greenbg text-signal-green' : comparison.verdict === 'not_improved' ? 'bg-signal-redbg text-signal-red' : 'bg-lane-100 text-lane-700'}`}>
          <p className="font-semibold">{comparison.note}</p>
          <p className="mt-0.5 text-xs opacity-80">{comparison.mode === 'demo' ? 'Demo comparison of dark-area share, not a trained model. ' : ''}Confidence {Math.round(comparison.confidence * 100)}%. AI-assisted, not proof.</p>
        </div>
      )}
    </section>
  );
}

interface Props {
  issue: Issue;
  user: AppUser;
  isSupporter: boolean;
  onDone: () => void;
}

export default function ResolutionPanel({ issue, user, isSupporter, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [sampleAfter, setSampleAfter] = useState(false);
  const [comparison, setComparison] = useState<ResolutionComparison | null>(issue.resolution?.comparison ?? null);
  const [busy, setBusy] = useState<'compare' | 'vote' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const beforeUrl = photoUrl(issue.photo);
  const savedAfter = photoUrl(issue.resolution?.afterPhoto);
  const afterUrl = sampleAfter ? demoPhotoUrl('repaired', 7) : prepared?.dataUrl ?? savedAfter;

  if (!isSupporter) {
    return <InlineNotice tone="info">Only citizens who reported or confirmed this issue can verify the repair. Confirm the issue while it is open to take part.</InlineNotice>;
  }

  const pick = async (f: File) => {
    setError(null);
    setSampleAfter(false);
    try {
      setFile(f);
      setPrepared(await prepareImage(f));
      setComparison(null);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : 'That photo could not be read.');
    }
  };

  const compare = async () => {
    if (!beforeUrl || !afterUrl) return;
    setBusy('compare');
    setError(null);
    try {
      const c = await aiProvider.compareResolution({ url: beforeUrl }, { url: afterUrl });
      setComparison(c);
    } catch (e) {
      setError(e instanceof AIUnavailableError || e instanceof Error ? `${e.message} You can still confirm by yourself.` : 'Comparison failed.');
    } finally {
      setBusy(null);
    }
  };

  const vote = async (kind: 'fixed' | 'still_exists') => {
    setBusy('vote');
    setError(null);
    try {
      const photo = sampleAfter ? ({ kind: 'demo', scene: 'repaired', seed: 7 } as const) : prepared ? (MODE === 'demo' ? ({ kind: 'upload', url: prepared.dataUrl } as const) : null) : null;
      await service.confirm(issue.id, kind, user, { photo, photoBlob: MODE === 'live' ? prepared?.blob ?? null : null, comparison });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.');
    } finally {
      setBusy(null);
    }
  };


  return (
    <section className="rounded-lg border-2 border-signal-green/40 bg-white p-4" aria-labelledby="res-h" data-testid="resolution-panel">
      <h3 id="res-h" className="text-xl font-semibold">Has this issue actually been fixed?</h3>
      <p className="mt-1 text-sm text-signal-gray">The authority marked it resolved. Add an after-repair photo from the same spot to compare.</p>
      <div className="mt-3">
        <PhotoInput id="after" label="After-repair photo" file={file} previewUrl={sampleAfter || prepared ? afterUrl : null} onFile={(f) => void pick(f)} onClear={() => { setFile(null); setPrepared(null); setSampleAfter(false); setComparison(null); }} />
        {MODE === 'demo' && !afterUrl && (
          <button type="button" className="btn-outline btn-sm mt-2" onClick={() => { setSampleAfter(true); setComparison(null); }} data-testid="use-sample-after"><FlaskConical className="h-3.5 w-3.5" aria-hidden /> Use sample repaired photo (demo)</button>
        )}
      </div>
      {afterUrl && !comparison && (
        <button type="button" className="btn-dark btn-sm mt-3" disabled={busy !== null || !beforeUrl} onClick={() => void compare()} data-testid="compare">
          {busy === 'compare' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />} Compare before and after
        </button>
      )}
      {!beforeUrl && afterUrl && <p className="hint mt-1">This report has no original photo, so an automatic comparison is not possible.</p>}
      {(comparison || afterUrl) && <div className="mt-4"><BeforeAfter before={beforeUrl} after={afterUrl} comparison={comparison} /></div>}
      {error && <div className="mt-3"><InlineNotice tone="error">{error}</InlineNotice></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => void vote('fixed')} data-testid="confirm-fixed"><Check className="h-4 w-4" aria-hidden /> Confirm fixed</button>
        <button type="button" className="btn-outline" disabled={busy !== null} onClick={() => void vote('still_exists')} data-testid="still-exists"><AlertTriangle className="h-4 w-4" aria-hidden /> Still exists</button>
      </div>
      <p className="hint mt-2">One confirmation with a photo, or two confirmations without, closes the loop as “Citizen verified”. Fixed votes so far: {issue.resolution?.fixedVotes ?? 0}.</p>
    </section>
  );
}
