import { AppWindow, Copy, ExternalLink, Landmark, Mail, MessageCircle, Phone, AtSign, Check } from 'lucide-react';
import { useState } from 'react';
import { service } from '@/lib/data';
import { AUTHORITIES, channelHref, localSearchHref, resolveAuthorities, type Channel } from '@/lib/authorities';
import type { AppUser, Issue } from '@/lib/domain';
import { timeAgo } from '@/lib/format';
import { MODE } from '@/lib/mode';
import { InlineNotice } from './States';

const ICON = { web: ExternalLink, phone: Phone, app: AppWindow, x: AtSign, whatsapp: MessageCircle, email: Mail } as const;

export default function RouteToAuthority({ issue, user, canRecord, onDone }: { issue: Issue; user: AppUser | null; canRecord: boolean; onDone: () => void }) {
  const routing = resolveAuthorities(issue);
  const demo = MODE === 'demo';
  const [copied, setCopied] = useState(false);
  const [ref, setRef] = useState('');
  const [chan, setChan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issue.grievance ?? issue.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy was blocked by the browser. Open “Grievance draft” below and copy it manually.');
    }
  };

  const record = async (opts: Array<{ id: string; name: string; label: string }>) => {
    if (!user) return;
    const pick = opts.find((o) => `${o.id}|${o.label}` === chan) ?? opts[0];
    setBusy(true);
    setError(null);
    try {
      await service.addExternalRef(issue.id, { authorityId: pick.id, authorityName: pick.name, channel: pick.label, reference: ref }, user);
      setRef('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the reference.');
    } finally {
      setBusy(false);
    }
  };

  const options = routing.matches.flatMap((m) => m.channels.map((c) => ({ id: m.authority.id, name: m.authority.name, label: c.label })));

  return (
    <section className="panel p-4" aria-labelledby="route-h" data-testid="route-panel">
      <h2 id="route-h" className="flex items-center gap-2 text-2xl font-semibold"><Landmark className="h-5 w-5" aria-hidden /> Send to the responsible office</h2>
      <p className="mt-1 text-sm text-signal-gray">Based on the pin. RoadFix prepares the complaint and opens the official channel. You send it, and nothing is filed on your behalf.</p>
      {demo && <div className="mt-2"><InlineNotice tone="warn">Demo mode: this incident is fictional, so links to real offices are switched off and only previewed. Live mode enables them.</InlineNotice></div>}

      <button type="button" className="btn-outline btn-sm mt-3" onClick={() => void copy()}>{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? 'Copied' : 'Copy complaint text'}</button>

      {routing.noLocalOffice && (
        <div className="mt-3"><InlineNotice tone="info">No local office is set up for this location yet. Find your municipal corporation or panchayat, or use the national portal below. <a className="font-semibold underline" href={demo ? undefined : localSearchHref(issue)} target="_blank" rel="noreferrer">Search for it</a>.</InlineNotice></div>
      )}

      <ul className="mt-3 space-y-4">
        {routing.matches.map(({ authority, channels }) => (
          <li key={authority.id}>
            <p className="font-semibold">{authority.name} <span className="text-xs font-normal text-signal-gray">{authority.role === 'escalation' ? '(escalation)' : authority.role === 'traffic' ? '(traffic)' : ''}</span></p>
            <p className="text-xs text-signal-gray">{authority.scope}</p>
            <ul className="mt-1.5 space-y-1.5">
              {channels.map((c: Channel) => {
                const Icon = ICON[c.type];
                const href = channelHref(c, issue);
                return (
                  <li key={c.label} className="text-sm">
                    <a
                      href={demo ? undefined : href}
                      target={c.type === 'phone' ? undefined : '_blank'}
                      rel="noreferrer"
                      aria-disabled={demo}
                      className={`inline-flex items-center gap-2 rounded-md border border-concrete-300 px-3 py-1.5 font-semibold ${demo ? 'cursor-not-allowed opacity-60' : 'hover:bg-concrete'}`}
                      onClick={(e) => demo && e.preventDefault()}
                    >
                      <Icon className="h-4 w-4" aria-hidden /> {c.label}
                    </a>
                    {c.confidence === 'secondary' && <span className="ml-2 text-xs text-lane-700">Confirm on the official site first</span>}
                    {demo && <span className="mt-0.5 block break-all text-xs text-signal-gray">Would open: {href.slice(0, 110)}</span>}
                  </li>
                );
              })}
            </ul>
            {authority.note && <p className="hint mt-1">{authority.note}</p>}
            <p className="hint">Details checked {authority.checkedOn}. Sources are listed in the app’s directory file.</p>
          </li>
        ))}
      </ul>

      {issue.externalRefs.length > 0 && (
        <div className="mt-4 border-t border-concrete-200 pt-3">
          <h3 className="text-lg font-semibold">Filed with government channels</h3>
          <ul className="mt-1 space-y-1 text-sm">{issue.externalRefs.map((r) => <li key={r.id}><span className="font-mono font-semibold">{r.reference}</span> · {r.channel} <span className="text-xs text-signal-gray">by {r.by}, {timeAgo(r.at)}</span></li>)}</ul>
        </div>
      )}

      {canRecord && user && (
        <div className="mt-4 border-t border-concrete-200 pt-3">
          <h3 className="text-lg font-semibold">Filed it? Save the reference number</h3>
          <p className="hint">Linking the office’s ticket lets the community and authorities follow the same complaint.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><label htmlFor="xref-chan" className="label !text-xs">Where you filed</label><select id="xref-chan" className="field" value={chan} onChange={(e) => setChan(e.target.value)}>{options.map((o) => <option key={`${o.id}|${o.label}`} value={`${o.id}|${o.label}`}>{o.label}</option>)}</select></div>
            <div><label htmlFor="xref" className="label !text-xs">Reference / ticket number</label><input id="xref" className="field" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} /></div>
          </div>
          <button type="button" className="btn-dark btn-sm mt-2" disabled={busy || ref.trim().length < 3} onClick={() => void record(options)} data-testid="save-ref">Save reference</button>
          {error && <div className="mt-2"><InlineNotice tone="error">{error}</InlineNotice></div>}
        </div>
      )}
      <p className="hint mt-3">{AUTHORITIES.length} offices are configured. Add more in <code>src/lib/authorities.ts</code>.</p>
    </section>
  );
}
