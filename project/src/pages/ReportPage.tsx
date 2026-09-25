import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, FlaskConical, Loader2, Mic, RefreshCw, Send, Sparkles, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PriorityBadge, SeverityBadge, StatusBadge } from '@/components/Badges';
import LocationPicker from '@/components/LocationPicker';
import PhotoInput from '@/components/PhotoInput';
import { EmptyState, InlineNotice } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { AIUnavailableError, aiProvider } from '@/lib/ai';
import { service } from '@/lib/data';
import { RateLimitError } from '@/lib/data/service';
import { SAMPLE_LOCATION, SAMPLE_POTHOLE } from '@/lib/demoData';
import { CATEGORIES, CATEGORY_META, type AIAnalysis, type Category, type Facility, type Severity } from '@/lib/domain';
import { computeImageHash, findDuplicates, type DuplicateMatch } from '@/lib/duplicates';
import { findNearbyFacilities } from '@/lib/facilities';
import { formatDistance } from '@/lib/geo';
import { buildGrievance, GRIEVANCE_VARIANTS, grievanceTitle } from '@/lib/grievance';
import { timeAgo } from '@/lib/format';
import { describePlace, type PlaceInfo } from '@/lib/place';
import { demoPhotoUrl, prepareImage, type PreparedImage } from '@/lib/photos';
import { scoreIssue } from '@/lib/priority';
import { startVoiceDictation, voiceSupported, VOICE_LANGUAGES } from '@/lib/voice';

const STEPS = ['Evidence', 'Location', 'AI analysis', 'Review and submit'] as const;

type AnalysisState = { status: 'idle' } | { status: 'running' } | { status: 'done'; analysis: AIAnalysis } | { status: 'error'; message: string };

export default function ReportPage() {
  const { user, mode, issues, reload } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState(0);

  // step 1
  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [sample, setSample] = useState(false);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const runId = useRef(0);

  // step 2
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [facilities, setFacilities] = useState<Facility[] | null | undefined>(undefined);

  // step 3
  const [category, setCategory] = useState<Category>('pothole');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [dupDismissed, setDupDismissed] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const stopVoice = useRef<(() => void) | null>(null);

  // step 4
  const [variantIdx, setVariantIdx] = useState(0);
  const [grievanceText, setGrievanceText] = useState('');
  const [edited, setEdited] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [supporting, setSupporting] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  const previewUrl = sample ? demoPhotoUrl(SAMPLE_POTHOLE.scene, SAMPLE_POTHOLE.seed) : prepared?.dataUrl ?? null;
  const hasPhoto = Boolean(previewUrl);

  const analyze = useCallback(async (input: { blob?: Blob; url?: string; fileName?: string; sampleHint?: Category }) => {
    const id = ++runId.current;
    setAnalysisState({ status: 'running' });
    try {
      const a = await aiProvider.analyzeImage(input);
      if (id !== runId.current) return;
      setAnalysisState({ status: 'done', analysis: a });
      setCategory(a.category);
      setSeverity(a.severity);
      setDescription((d) => d || '');
    } catch (e) {
      if (id !== runId.current) return;
      setAnalysisState({ status: 'error', message: e instanceof AIUnavailableError || e instanceof Error ? e.message : 'The photo analysis failed.' });
    }
  }, []);

  const handleFile = async (f: File) => {
    setPhotoError(null);
    setSample(false);
    setFile(f);
    try {
      const p = await prepareImage(f);
      setPrepared(p);
      setImageHash(await computeImageHash(p.dataUrl));
      void analyze({ blob: p.blob, fileName: f.name });
    } catch (e) {
      setFile(null);
      setPrepared(null);
      setPhotoError(e instanceof Error ? e.message : 'That photo could not be read.');
    }
  };

  const loadSample = async () => {
    setSample(true);
    setFile(null);
    setPrepared(null);
    setPhotoError(null);
    setPos({ ...SAMPLE_LOCATION });
    const url = demoPhotoUrl(SAMPLE_POTHOLE.scene, SAMPLE_POTHOLE.seed);
    setImageHash(await computeImageHash(url));
    void analyze({ url, sampleHint: 'pothole' });
  };

  const clearPhoto = () => {
    runId.current++;
    setFile(null);
    setPrepared(null);
    setSample(false);
    setImageHash(null);
    setAnalysisState({ status: 'idle' });
  };

  // Scan hand-off: a frame chosen in RoadFix Scan arrives as router state.
  useEffect(() => {
    const prefill = (loc.state as { prefill?: { dataUrl: string; category?: Category } } | null)?.prefill;
    if (!prefill) return;
    void (async () => {
      const p = await prepareImage(prefill.dataUrl);
      setPrepared(p);
      setImageHash(await computeImageHash(p.dataUrl));
      void analyze({ blob: p.blob, fileName: prefill.category ?? 'scan-frame.jpg' });
    })();
    window.history.replaceState({}, '');
  }, [loc.state, analyze]);

  // Location side effects
  useEffect(() => {
    if (!pos) return;
    let alive = true;
    setFacilities(undefined);
    void describePlace(pos.latitude, pos.longitude).then((p) => alive && setPlace(p));
    void findNearbyFacilities(pos.latitude, pos.longitude).then((f) => alive && setFacilities(f));
    return () => {
      alive = false;
    };
  }, [pos]);

  const duplicates: DuplicateMatch[] = useMemo(() => {
    if (!pos || step < 2) return [];
    return findDuplicates({ category, latitude: pos.latitude, longitude: pos.longitude, description, imageHash }, issues);
  }, [pos, step, category, description, imageHash, issues]);

  const grievanceInput = useMemo(
    () => ({
      category, severity, address: place?.address ?? '', latitude: pos?.latitude ?? 0, longitude: pos?.longitude ?? 0,
      description, at: new Date(), facilities: facilities === undefined ? null : facilities, hasPhoto, aiAssisted: analysisState.status === 'done',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, severity, place, pos, description, facilities, hasPhoto, analysisState.status, step === 3]
  );

  const generate = useCallback((idx: number) => {
    setGrievanceText(buildGrievance(grievanceInput, GRIEVANCE_VARIANTS[idx % GRIEVANCE_VARIANTS.length]).body);
    setEdited(false);
  }, [grievanceInput]);

  useEffect(() => {
    if (step === 3 && !edited) generate(variantIdx);
  }, [step, edited, variantIdx, generate]);

  const previewPriority = useMemo(() => {
    if (!pos) return null;
    return scoreIssue(
      { id: 'new', category, severity, status: 'reported', title: '', description, grievance: null, latitude: pos.latitude, longitude: pos.longitude, address: '', roadName: '', area: '', reporterId: null, createdAt: new Date().toISOString(), updatedAt: '', lastVerifiedAt: null, supporters: 1, photo: null, imageHash: null, analysis: null, department: null, assignedAt: null, workStartedAt: null, resolvedAt: null, citizenVerifiedAt: null, notes: [], needsEvidence: false, resolution: null, facilities: facilities === undefined ? null : facilities, externalRefs: [], isDemo: false },
      { now: new Date(), recurrence: 0 }
    );
  }, [pos, category, severity, description, facilities]);

  const toggleVoice = () => {
    if (listening) {
      stopVoice.current?.();
      return;
    }
    setVoiceError(null);
    const stop = startVoiceDictation(voiceLang, (t) => setDescription(t), (m) => setVoiceError(m), () => setListening(false));
    if (stop) {
      stopVoice.current = stop;
      setListening(true);
    }
  };

  const canNext = step === 0 ? hasPhoto : step === 1 ? Boolean(pos) : step === 2 ? description.trim().length >= 10 : true;
  const nextHint =
    step === 0 && !hasPhoto ? 'Add a photo to continue.' : step === 1 && !pos ? 'Choose the location to continue.' : step === 2 && description.trim().length < 10 ? 'Add a short description (at least 10 characters).' : null;

  const supportExisting = async (id: string) => {
    if (!user) return;
    setSupporting(id);
    setSupportError(null);
    try {
      await service.confirm(id, 'confirm', user);
      await reload();
      nav(`/issues/${id}?supported=1`);
    } catch (e) {
      setSupportError(e instanceof Error ? e.message : 'Could not add your support.');
    } finally {
      setSupporting(null);
    }
  };

  const submit = async () => {
    if (!user || !pos || !place) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const analysis = analysisState.status === 'done' ? { ...analysisState.analysis, category, severity } : null;
      const { issue, warnings } = await service.createIssue(
        {
          category, severity, title: grievanceTitle({ category, severity, address: place.address }), description: description.trim(), grievance: grievanceText,
          latitude: pos.latitude, longitude: pos.longitude, address: place.address, roadName: place.roadName, area: place.area,
          photo: sample ? SAMPLE_POTHOLE : mode === 'demo' && prepared ? { kind: 'upload', url: prepared.dataUrl } : null,
          photoBlob: mode === 'live' && prepared ? prepared.blob : null,
          imageHash, analysis, facilities: facilities === undefined ? null : facilities,
        },
        user
      );
      await reload();
      nav(`/issues/${issue.id}?new=1`, { state: { warnings } });
    } catch (e) {
      setSubmitError(e instanceof RateLimitError || e instanceof Error ? e.message : 'Could not submit the report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <EmptyState page title="Sign in to report a road issue" body="Reports are tied to an account so authorities can follow up and so spam can be limited." action={<Link className="btn-primary" to="/login?next=/report">Sign in</Link>} />
    );
  }

  const analysis = analysisState.status === 'done' ? analysisState.analysis : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-4xl font-bold">Report a road issue</h1>
      <p className="mt-1 text-signal-gray">A photo, a pin and a short description. Nothing is sent to a government portal without your review.</p>

      <ol className="my-6 grid grid-cols-4 gap-2" aria-label="Report steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`w-full rounded-md border-t-4 px-1 pb-1 pt-2 text-left text-xs font-semibold sm:text-sm ${i === step ? 'border-lane text-ink' : i < step ? 'border-signal-green text-signal-green' : 'border-concrete-300 text-signal-gray'}`}>
              {i < step && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden />}{s}
            </button>
          </li>
        ))}
      </ol>

      <div className="panel p-5 sm:p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Upload evidence</h2>
            <PhotoInput id="evidence" label="Photo of the problem" file={file} previewUrl={previewUrl} onFile={(f) => void handleFile(f)} onClear={clearPhoto} hint="JPG, PNG or WebP up to 10 MB. Photos are resized in your browser before they are sent." />
            {photoError && <InlineNotice tone="error">{photoError}</InlineNotice>}
            {mode === 'demo' && !hasPhoto && (
              <div className="rounded-lg border border-lane bg-lane-100 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4" aria-hidden /> Demo mode shortcut</p>
                <p className="mt-1">No road photo handy? Use the bundled sample. It is a drawn illustration, not a real photo.</p>
                <button type="button" onClick={() => void loadSample()} className="btn-dark btn-sm mt-2" data-testid="use-sample">Use sample road photo</button>
              </div>
            )}
            {analysisState.status === 'running' && <p className="flex items-center gap-2 text-sm text-signal-gray" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the photo…</p>}
            {analysisState.status === 'done' && <p className="text-sm text-signal-green"><Check className="mr-1 inline h-4 w-4" aria-hidden />Photo checked. You will see the result in step 3.</p>}
            {analysisState.status === 'error' && (
              <InlineNotice tone="warn">
                {analysisState.message}{' '}
                <button type="button" className="font-semibold underline" onClick={() => void (sample ? loadSample() : file && handleFile(file))}>Retry</button>. You can also continue and choose the type yourself.
              </InlineNotice>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Where is it?</h2>
            <LocationPicker value={pos} onChange={setPos} nearby={pos ? issues.filter((i) => Math.abs(i.latitude - pos.latitude) < 0.006 && Math.abs(i.longitude - pos.longitude) < 0.006 && i.status !== 'resolved' && i.status !== 'citizen_verified') : undefined} />
            {mode === 'demo' && !pos && (
              <button type="button" className="btn-outline btn-sm" onClick={() => setPos({ ...SAMPLE_LOCATION })} data-testid="use-demo-location">Use demo location (fictional Demo Ring Road)</button>
            )}
            {pos && place && <p className="text-sm"><span className="font-semibold">Place:</span> {place.address}{place.source === 'coordinates' && ' (address lookup unavailable)'}</p>}
            {pos && (
              <p className="text-sm">
                <span className="font-semibold">Nearby facilities:</span>{' '}
                {facilities === undefined ? 'Checking…' : facilities === null ? 'Nearby facility information unavailable.' : facilities.length === 0 ? 'None found within 300 m.' : facilities.slice(0, 3).map((f) => `${f.name} (${formatDistance(f.distanceM)})`).join(', ')}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold">AI analysis</h2>

            {analysisState.status === 'running' && <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analyzing the photo…</p>}
            {analysisState.status === 'error' && (
              <InlineNotice tone="warn">
                The photo could not be analyzed: {analysisState.message}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-outline btn-sm" onClick={() => void (sample ? loadSample() : prepared && analyze({ blob: prepared.blob, fileName: file?.name }))}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry</button>
                  <span className="self-center text-xs">or choose the type below yourself.</span>
                </div>
              </InlineNotice>
            )}
            {analysis && (
              <div className="rounded-lg border border-concrete-300 bg-concrete-100 p-4" data-testid="ai-result">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-5 w-5 text-lane-700" aria-hidden />
                  <h3 className="text-xl font-semibold">AI detected a possible {CATEGORY_META[analysis.category].label.toLowerCase()}</h3>
                  {analysis.mode === 'demo' && <span className="rounded-full bg-lane-100 px-2 py-0.5 text-xs font-semibold text-lane-700">Demo analysis</span>}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-signal-gray">Issue</dt><dd className="font-semibold">{CATEGORY_META[analysis.category].label}</dd></div>
                  <div><dt className="text-signal-gray">Confidence</dt><dd className="font-semibold">{Math.round(analysis.confidence * 100)}%</dd></div>
                  <div><dt className="text-signal-gray">Severity</dt><dd className="font-semibold capitalize">{analysis.severity}</dd></div>
                </dl>
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-signal-gray">{analysis.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                <p className="hint mt-2">{analysis.mode === 'demo' ? 'Demo analyzer: rule-based image statistics, not a trained road-damage model. ' : ''}This is a suggestion. Correct it below if it looks wrong.</p>
              </div>
            )}

            {duplicates.length > 0 && !dupDismissed && (
              <section className="rounded-lg border-2 border-lane bg-lane-100 p-4" aria-labelledby="dup-h" data-testid="duplicate-panel">
                <h3 id="dup-h" className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5" aria-hidden /> Possible existing issue</h3>
                <p className="mt-1 text-sm">This road problem may already have been reported. Supporting it adds your voice without creating a duplicate.</p>
                {duplicates.map((m) => {
                  const mine = m.issue.reporterId === user.id;
                  return (
                    <div key={m.issue.id} className="mt-3 rounded-md bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/issues/${m.issue.id}`} target="_blank" className="font-mono text-sm font-bold underline">{m.issue.id}</Link>
                        <StatusBadge status={m.issue.status} />
                        <span className="text-xs text-signal-gray">Match {m.score}%</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{CATEGORY_META[m.issue.category].label} · {m.issue.roadName}</p>
                      <dl className="mt-1 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-4">
                        <div><dt className="text-xs text-signal-gray">Distance</dt><dd>{formatDistance(m.distanceM)}</dd></div>
                        <div><dt className="text-xs text-signal-gray">Supporting reports</dt><dd>{m.issue.supporters}</dd></div>
                        <div><dt className="text-xs text-signal-gray">Status</dt><dd>{m.issue.status.replace(/_/g, ' ')}</dd></div>
                        <div><dt className="text-xs text-signal-gray">Last verification</dt><dd>{m.issue.lastVerifiedAt ? timeAgo(m.issue.lastVerifiedAt) : 'Not yet'}</dd></div>
                      </dl>
                      <p className="hint mt-1">Why we think so: {m.reasons.join('; ')}.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!mine && <button type="button" className="btn-dark btn-sm" disabled={supporting !== null} onClick={() => void supportExisting(m.issue.id)} data-testid="support-existing">{supporting === m.issue.id ? 'Adding…' : 'Support existing report'}</button>}
                        {mine && <span className="text-sm text-signal-gray">This is your own report.</span>}
                      </div>
                    </div>
                  );
                })}
                {supportError && <p className="mt-2 text-sm font-semibold text-signal-red" role="alert">{supportError}</p>}
                <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setDupDismissed(true)} data-testid="submit-new">Submit new report instead</button>
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cat" className="label">Type of issue</label>
                <select id="cat" className="field" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="sev" className="label">How severe is it?</label>
                <select id="sev" className="field" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                  <option value="low">Low: minor, not urgent</option>
                  <option value="medium">Medium: uncomfortable or risky</option>
                  <option value="high">High: dangerous to road users</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between gap-2">
                <label htmlFor="desc" className="label !mb-0">What should the authority know?</label>
                {voiceSupported() && (
                  <div className="flex items-center gap-1">
                    <label htmlFor="vl" className="sr-only">Dictation language</label>
                    <select id="vl" className="rounded border border-concrete-300 px-1 py-1 text-xs" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}>
                      {VOICE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <button type="button" onClick={toggleVoice} className={`btn-sm ${listening ? 'btn-danger' : 'btn-outline'}`} aria-pressed={listening}><Mic className="h-3.5 w-3.5" aria-hidden />{listening ? 'Stop' : 'Dictate'}</button>
                  </div>
                )}
              </div>
              <textarea id="desc" rows={4} maxLength={1000} className="field mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Example: Deep pothole in the left lane, two-wheelers are swerving to avoid it." />
              {voiceError && <p className="mt-1 text-sm text-signal-red" role="alert">{voiceError}</p>}
              <p className="hint mt-1">{description.length}/1000</p>
            </div>

            {previewPriority && previewPriority.level !== 'closed' && (
              <p className="flex flex-wrap items-center gap-2 text-sm">Expected priority if verified: <PriorityBadge level={previewPriority.level} score={previewPriority.score} /> <span className="text-signal-gray">Shown fully, with reasons, on the issue page.</span></p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Review before submitting</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={severity} />
              <span className="text-sm font-semibold">{CATEGORY_META[category].label}</span>
              <span className="text-sm text-signal-gray">· {place?.address}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="griev" className="label !mb-0">Grievance draft</label>
              <div className="flex gap-2">
                <button type="button" className="btn-outline btn-sm" onClick={() => { const n = variantIdx + 1; setVariantIdx(n); setEdited(false); generate(n); }}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Regenerate ({GRIEVANCE_VARIANTS[(variantIdx + 1) % 3]})</button>
                <button type="button" className="btn-outline btn-sm" onClick={() => { void navigator.clipboard.writeText(grievanceText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => setSubmitError('Copy was blocked by the browser. Select the text and copy it manually.')); }}>
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea id="griev" rows={16} className="field font-mono !text-xs" value={grievanceText} onChange={(e) => { setGrievanceText(e.target.value); setEdited(true); }} />
            <p className="hint">Edit freely. {analysis?.mode === 'demo' ? 'This draft is built from a template in demo mode. ' : ''}RoadFix records your report but does not file anything on CPGRAMS or any government portal for you. Copy the text there yourself.</p>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="confirm-review" />
              <span>I reviewed this report and the details are accurate to the best of my knowledge.</span>
            </label>
            {submitError && <InlineNotice tone="error">{submitError}</InlineNotice>}
            <button type="button" className="btn-primary" disabled={!confirmed || submitting} onClick={() => void submit()} data-testid="submit-report">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" className="btn-outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
        <div className="flex items-center gap-3">
          {nextHint && <span className="flex items-center gap-1 text-xs text-signal-gray"><AlertCircle className="h-3.5 w-3.5" aria-hidden />{nextHint}</span>}
          {step < 3 && <button type="button" className="btn-dark" disabled={!canNext} onClick={() => setStep((s) => s + 1)} data-testid="next">Next <ArrowRight className="h-4 w-4" aria-hidden /></button>}
        </div>
      </div>
    </div>
  );
}
