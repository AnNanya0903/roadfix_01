import { CheckCircle2, ImagePlus, MapPin, ThumbsUp, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import AuthorityPanel from '@/components/AuthorityPanel';
import { HealthBadge, PriorityBadge, SeverityBadge, StatusBadge } from '@/components/Badges';
import EvidenceRow from '@/components/EvidenceRow';
import IncidentMap from '@/components/IncidentMap';
import PhotoInput from '@/components/PhotoInput';
import RouteToAuthority from '@/components/RouteToAuthority';
import ResolutionPanel, { BeforeAfter } from '@/components/ResolutionPanel';
import StatusStepper from '@/components/StatusStepper';
import { EmptyState, ErrorState, InlineNotice, Loading } from '@/components/States';
import WhyPriority from '@/components/WhyPriority';
import { useApp } from '@/lib/appContext';
import { service } from '@/lib/data';
import type { Confirmation, Issue, StatusEvent } from '@/lib/domain';
import { CATEGORY_META, STATUS_LABEL, isClosed } from '@/lib/domain';
import { formatDate, timeAgo } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { MODE } from '@/lib/mode';
import { photoUrl, prepareImage, type PreparedImage } from '@/lib/photos';
import { buildSegments, segmentSummary } from '@/lib/segments';

export default function IssueDetailPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const loc = useLocation();
  const { issues, loading, error, reload, user } = useApp();
  const base = issues.find((i) => i.id === id);
  const [detail, setDetail] = useState<Issue | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [confs, setConfs] = useState<Confirmation[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evFile, setEvFile] = useState<File | null>(null);
  const [evPrepared, setEvPrepared] = useState<PreparedImage | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetailError(null);
      const [i, h, c] = await Promise.all([service.getIssue(id), service.getHistory(id), service.getConfirmations(id)]);
      setDetail(i);
      setHistory(h);
      setConfs(c);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Could not load this report.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, base?.updatedAt, base?.supporters]);

  const segment = useMemo(() => (base ? buildSegments(issues).find((s) => s.roadName === base.roadName && s.area === base.area) : undefined), [issues, base]);
  const nearbyOthers = useMemo(() => (base ? issues.filter((i) => i.roadName === base.roadName && i.area === base.area) : []), [issues, base]);

  if (loading) return <Loading label="Loading report…" />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!base) return <EmptyState page title={`No report called ${id}`} body="It may have been removed, or the link is wrong." action={<Link to="/map" className="btn-dark">Open the road map</Link>} />;

  const issue = detail ?? base;
  const enriched = { ...base, notes: issue.notes, resolution: issue.resolution ?? base.resolution };
  const img = photoUrl(issue.photo);
  const isReporter = Boolean(user && issue.reporterId === user.id);
  const myKinds = confs.filter((c) => c.userId === user?.id).map((c) => c.kind);
  const isSupporter = isReporter || myKinds.some((k) => k === 'confirm' || k === 'add_evidence' || k === 'still_exists');
  const staff = user?.role === 'authority' || user?.role === 'admin';
  const closed = isClosed(issue.status);
  const warnings = (loc.state as { warnings?: string[] } | null)?.warnings ?? [];

  const act = async (label: string, fn: () => Promise<unknown>, okMsg: string) => {
    if (!user) return;
    setBusy(label);
    setActionError(null);
    try {
      await fn();
      await reload();
      await load();
      setToast(okMsg);
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  const afterRefresh = async () => {
    await reload();
    await load();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-signal-gray"><Link to={staff ? '/authority/incidents' : '/map'} className="underline">{staff ? 'Incidents' : 'Road map'}</Link> / {issue.id}</nav>

      {sp.get('new') && (
        <div className="mb-4 space-y-2">
          <InlineNotice tone="ok"><CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />Report {issue.id} submitted. Authorities can now verify and prioritise it.</InlineNotice>
          {warnings.map((w) => <InlineNotice key={w} tone="warn">{w}</InlineNotice>)}
        </div>
      )}
      {sp.get('supported') && <div className="mb-4"><InlineNotice tone="ok">Thanks. You are now supporting {issue.id}, and will be notified as it progresses.</InlineNotice></div>}
      {toast && <div className="mb-4"><InlineNotice tone="ok">{toast}</InlineNotice></div>}
      {detailError && <div className="mb-4"><InlineNotice tone="warn">Some details could not be loaded: {detailError}</InlineNotice></div>}
      {issue.isDemo && <div className="mb-4"><InlineNotice tone="warn">Demo data: this incident is fictional and seeded for the presentation.</InlineNotice></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">{issue.id}</span>
              <StatusBadge status={issue.status} />
              <SeverityBadge severity={issue.severity} />
              <PriorityBadge level={base.priority.level} score={base.priority.score} />
            </div>
            <h1 className="mt-2 text-4xl font-bold">{CATEGORY_META[issue.category].label}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-signal-gray"><MapPin className="h-4 w-4" aria-hidden />{issue.address}</p>
            <p className="mt-1 text-sm text-signal-gray">Reported {timeAgo(issue.createdAt)} · {issue.supporters} citizen{issue.supporters > 1 ? 's' : ''} reported or confirmed this location</p>
          </header>

          <div className="panel p-4"><StatusStepper status={issue.status} /></div>

          {issue.resolution && (closed || issue.status === 'reopened') && (issue.resolution.afterPhoto || issue.resolution.comparison) && (
            <div className="panel p-4"><h2 className="mb-3 text-2xl font-semibold">Resolution evidence</h2><BeforeAfter before={img} after={photoUrl(issue.resolution.afterPhoto)} comparison={issue.resolution.comparison} /></div>
          )}

          <div className="panel overflow-hidden">
            {img ? <img src={img} alt={`Evidence photo of ${CATEGORY_META[issue.category].label.toLowerCase()} at ${issue.roadName}`} className="max-h-[26rem] w-full object-cover" /> : <div className="p-6 text-sm text-signal-gray">No photo was attached to this report.</div>}
            <div className="space-y-4 p-4">
              <p>{issue.description}</p>
              <div>
                <h2 className="mb-2 text-xl font-semibold">Evidence on record</h2>
                <EvidenceRow issue={issue} />
              </div>
              {issue.analysis && (
                <div className="rounded-md bg-concrete-100 p-3 text-sm">
                  <p className="font-semibold">AI-assisted first check {issue.analysis.mode === 'demo' && <span className="ml-1 rounded-full bg-lane-100 px-2 py-0.5 text-xs text-lane-700">{issue.isDemo ? 'Demo record' : 'Demo analysis'}</span>}</p>
                  <p className="mt-1">Possible {CATEGORY_META[issue.analysis.category].label.toLowerCase()}, {Math.round(issue.analysis.confidence * 100)}% confidence, {issue.analysis.severity} severity.</p>
                  <ul className="mt-1 list-disc pl-5 text-signal-gray">{issue.analysis.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                  <p className="hint mt-1">A suggestion only. Authorities and neighbours verify it.</p>
                </div>
              )}
              <div>
                <h2 className="mb-1 text-xl font-semibold">Nearby places</h2>
                {issue.facilities === null ? <p className="text-sm text-signal-gray">Nearby facility information unavailable.</p> : issue.facilities.length === 0 ? <p className="text-sm text-signal-gray">No school, hospital or transit stop within 300 m.</p> : (
                  <ul className="text-sm">{issue.facilities.slice(0, 5).map((f) => <li key={f.name}>{f.name} <span className="text-signal-gray">({f.kind.replace(/_/g, ' ')}, about {formatDistance(f.distanceM)})</span></li>)}</ul>
                )}
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 text-2xl font-semibold">Timeline</h2>
            {history.length === 0 ? <p className="text-sm text-signal-gray">No history yet.</p> : (
              <ol className="space-y-3 border-l-2 border-concrete-300 pl-4">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-asphalt" aria-hidden />
                    <p className="text-sm font-semibold">{STATUS_LABEL[h.to]}</p>
                    <p className="text-xs text-signal-gray">{formatDate(h.at)} · {h.by}{h.note ? ` · ${h.note}` : ''}</p>
                  </li>
                ))}
              </ol>
            )}
            {issue.notes.length > 0 && (
              <div className="mt-4 border-t border-concrete-200 pt-3">
                <h3 className="text-lg font-semibold">Authority notes</h3>
                <ul className="mt-1 space-y-2">{issue.notes.map((n) => <li key={n.id} className="text-sm"><span className="font-semibold">{n.by}</span> <span className="text-xs text-signal-gray">{timeAgo(n.at)}{n.kind === 'evidence_request' ? ' · asks for more evidence' : ''}</span><br />{n.text}</li>)}</ul>
              </div>
            )}
          </div>

          {issue.grievance && (
            <details className="panel p-4">
              <summary className="cursor-pointer text-xl font-semibold">Grievance draft</summary>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-xs">{issue.grievance}</pre>
            </details>
          )}
        </div>

        <aside className="space-y-5" aria-label="Priority and actions">
          <div className="panel p-4"><WhyPriority issue={enriched} /></div>

          {staff && user && <AuthorityPanel issue={issue} user={user} onDone={() => void afterRefresh()} />}

          {issue.status === 'resolved' && user && <ResolutionPanel issue={issue} user={user} isSupporter={isSupporter} onDone={() => void afterRefresh()} />}

          {!staff && (
            <section className="panel p-4" aria-labelledby="comm-h">
              <h2 id="comm-h" className="text-2xl font-semibold">Community confirmation</h2>
              <p className="mt-1 text-sm">{issue.supporters} citizen{issue.supporters > 1 ? 's' : ''} reported/confirmed this location.</p>
              {issue.needsEvidence && <div className="mt-2"><InlineNotice tone="warn"><TriangleAlert className="mr-1 inline h-4 w-4" aria-hidden />An authority asked for more evidence. A fresh photo helps.</InlineNotice></div>}
              {!user ? (
                <p className="mt-3 text-sm"><Link className="font-semibold underline" to={`/login?next=/issues/${issue.id}`}>Sign in</Link> to confirm this issue.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-dark btn-sm" disabled={busy !== null || closed || isSupporter} onClick={() => void act('confirm', () => service.confirm(issue.id, 'confirm', user), 'Thanks. Your confirmation was added.')} data-testid="confirm-issue"><ThumbsUp className="h-3.5 w-3.5" aria-hidden />{isSupporter ? 'You support this' : 'Confirm issue'}</button>
                  <button type="button" className="btn-outline btn-sm" disabled={busy !== null || myKinds.includes('still_exists')} onClick={() => void act('still', () => service.confirm(issue.id, 'still_exists', user), closed ? 'Thanks. The authority was told it still exists.' : 'Thanks. We recorded that it still exists.')} data-testid="still-exists-btn">Still exists</button>
                  <button type="button" className="btn-outline btn-sm" disabled={issue.status !== 'resolved' || !isSupporter || myKinds.includes('fixed')} title={issue.status === 'resolved' ? '' : 'Opens once the authority marks it resolved'} onClick={() => document.querySelector('[data-testid="resolution-panel"]')?.scrollIntoView({ behavior: 'smooth' })}>Fixed</button>
                  <button type="button" className="btn-outline btn-sm" disabled={busy !== null || closed} onClick={() => setShowEvidence((v) => !v)}><ImagePlus className="h-3.5 w-3.5" aria-hidden />Add evidence</button>
                </div>
              )}
              {showEvidence && user && (
                <div className="mt-3 space-y-2">
                  <PhotoInput id="more-ev" label="New photo" file={evFile} previewUrl={evPrepared?.dataUrl ?? null} onFile={(f) => { setEvFile(f); void prepareImage(f).then(setEvPrepared).catch(() => setActionError('That photo could not be read.')); }} onClear={() => { setEvFile(null); setEvPrepared(null); }} />
                  <button type="button" className="btn-primary btn-sm" disabled={!evPrepared || busy !== null} onClick={() => void act('evidence', async () => { await service.confirm(issue.id, 'add_evidence', user, { photo: MODE === 'demo' && evPrepared ? { kind: 'upload', url: evPrepared.dataUrl } : null, photoBlob: MODE === 'live' ? evPrepared?.blob ?? null : null }); setShowEvidence(false); setEvFile(null); setEvPrepared(null); }, 'Evidence added. Thank you.')}>Send evidence</button>
                </div>
              )}
              {actionError && <div className="mt-3"><InlineNotice tone="error">{actionError}</InlineNotice></div>}
              <p className="hint mt-3">Each citizen counts once per issue. Spam and repeat reports are limited.</p>
            </section>
          )}

          {!closed && <RouteToAuthority issue={issue} user={user} canRecord={Boolean(user) && (isSupporter || staff)} onDone={() => void afterRefresh()} />}

          <div className="panel overflow-hidden">
            <div className="h-56"><IncidentMap issues={nearbyOthers.length ? nearbyOthers : [base]} selectedId={issue.id} zoom={16} center={[issue.latitude, issue.longitude]} fitToIssues={false} /></div>
          </div>

          {segment && (
            <div className="panel p-4">
              <h2 className="text-xl font-semibold">{segment.roadName}</h2>
              <p className="text-sm text-signal-gray">{segment.area}</p>
              <div className="mt-2 flex items-center gap-2"><HealthBadge health={segment.health} /><span className="text-sm">Health {segment.score}/100</span></div>
              <p className="mt-1 text-sm">{segment.open} open: {segmentSummary(segment)}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
