import { FlaskConical, Loader2, MapPin, Scan, Video } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InlineNotice } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { aiProvider } from '@/lib/ai';
import { CATEGORY_META, type Category } from '@/lib/domain';
import { getCurrentPosition } from '@/lib/geo';
import { UploadError, validateVideoFile } from '@/lib/photos';
import { analyzeFrames, demoScanFrames, extractFrames, type ScanFrame } from '@/lib/scan';

export default function ScanPage() {
  const { mode } = useApp();
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'analyzing' | 'done'>('idle');
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [frames, setFrames] = useState<ScanFrame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [where, setWhere] = useState<string | null>(null);

  const run = async (source: File | 'demo') => {
    setError(null);
    setFrames([]);
    try {
      let raw: Array<{ timeSec: number; dataUrl: string }>;
      if (source === 'demo') {
        raw = demoScanFrames();
        setPhase('analyzing');
        setProgress([0, raw.length]);
        const hints = demoScanFrames().map((f) => f.hint);
        const out: ScanFrame[] = [];
        for (let i = 0; i < raw.length; i++) {
          const analysis = await aiProvider.analyzeImage({ url: raw[i].dataUrl, sampleHint: hints[i] as Category });
          out.push({ ...raw[i], analysis });
          setProgress([i + 1, raw.length]);
        }
        setFrames(out);
        setPhase('done');
        return;
      }
      validateVideoFile(source);
      setPhase('extracting');
      raw = await extractFrames(source, 8, (d, t) => setProgress([d, t]));
      setPhase('analyzing');
      setProgress([0, raw.length]);
      setFrames(await analyzeFrames(raw, (d, t) => setProgress([d, t])));
      setPhase('done');
    } catch (e) {
      setPhase('idle');
      setError(e instanceof UploadError || e instanceof Error ? e.message : 'The scan failed.');
    }
  };

  const attachLocation = async () => {
    try {
      const p = await getCurrentPosition();
      setWhere(`${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`);
    } catch (e) {
      setWhere(null);
      setError(e instanceof Error ? e.message : 'Location unavailable.');
    }
  };

  const flagged = frames.filter((f) => f.analysis && f.analysis.category !== 'other');
  const counts = flagged.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.analysis!.category]: (acc[f.analysis!.category] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-4xl font-bold"><Scan className="h-8 w-8" aria-hidden /> RoadFix Scan</h1>
      <p className="mt-1 text-signal-gray">Record a short road video. RoadFix pulls frames and flags possible issues along the way. <span className="font-semibold">Prototype.</span></p>

      <div className="panel mt-5 space-y-4 p-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-dark" disabled={phase === 'extracting' || phase === 'analyzing'} onClick={() => input.current?.click()}><Video className="h-4 w-4" aria-hidden /> Choose or record a video</button>
          <button type="button" className="btn-outline" onClick={() => void attachLocation()}><MapPin className="h-4 w-4" aria-hidden /> {where ? `Location: ${where}` : 'Attach my location'}</button>
          {mode === 'demo' && <button type="button" className="btn-outline" disabled={phase === 'extracting' || phase === 'analyzing'} onClick={() => void run('demo')} data-testid="scan-demo"><FlaskConical className="h-4 w-4" aria-hidden /> Run demo scan</button>}
        </div>
        <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" className="sr-only" tabIndex={-1} aria-label="Road video" data-testid="scan-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} />
        <p className="hint">MP4, WebM or MOV up to 60 MB. Frames are pulled in your browser. Video is not uploaded.{mode === 'demo' && ' Demo mode analyzes frames with the rule-based demo analyzer, and the demo scan uses bundled illustrated frames.'}</p>
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        {(phase === 'extracting' || phase === 'analyzing') && (
          <div role="status" aria-live="polite"><p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{phase === 'extracting' ? 'Extracting frames' : 'Analyzing frames'} ({progress[0]}/{progress[1]})</p><div className="mt-2 h-2 rounded bg-concrete"><div className="h-2 rounded bg-lane" style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%` }} /></div></div>
        )}
      </div>

      {phase === 'done' && (
        <>
          <section className="panel mt-5 p-5" aria-labelledby="scan-h" data-testid="scan-result">
            <h2 id="scan-h" className="text-2xl font-semibold">Scan completed</h2>
            {frames[0]?.analysis?.mode === 'demo' && <p className="mt-1 inline-flex rounded-full bg-lane-100 px-2 py-0.5 text-xs font-semibold text-lane-700">Demo analysis</p>}
            {flagged.length === 0 ? <p className="mt-2 text-sm">No possible issues were flagged in {frames.length} frames.</p> : (
              <>
                <p className="mt-2 text-sm">Possible issues seen in {flagged.length} of {frames.length} frames:</p>
                <ul className="mt-2 flex flex-wrap gap-2">{Object.entries(counts).map(([c, n]) => <li key={c} className="rounded-full bg-concrete px-3 py-1 text-sm font-semibold">{n} × {CATEGORY_META[c as Category].label}</li>)}</ul>
                <p className="hint mt-2">Counts are frames, not distinct defects: the same defect can appear in neighbouring frames.</p>
              </>
            )}
          </section>
          <section className="mt-5" aria-labelledby="tl-h">
            <h2 id="tl-h" className="mb-2 text-2xl font-semibold">Frame timeline</h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {frames.map((f) => (
                <li key={f.timeSec} className="panel flex gap-3 p-3">
                  <img src={f.dataUrl} alt={`Video frame at ${f.timeSec.toFixed(0)} seconds`} className="h-20 w-28 rounded object-cover" />
                  <div className="min-w-0 text-sm">
                    <p className="font-mono text-xs text-signal-gray">{Math.floor(f.timeSec / 60)}:{String(Math.floor(f.timeSec % 60)).padStart(2, '0')}</p>
                    {f.analysis ? <p className="font-semibold">Possible {CATEGORY_META[f.analysis.category].label.toLowerCase()} <span className="font-normal text-signal-gray">({Math.round(f.analysis.confidence * 100)}%, {f.analysis.severity})</span></p> : <p className="text-signal-red">{f.error ?? 'Not analyzed'}</p>}
                    {f.analysis && f.analysis.category !== 'other' && <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => nav('/report', { state: { prefill: { dataUrl: f.dataUrl, category: f.analysis!.category } } })}>Report this</button>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
