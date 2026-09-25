import { CheckCheck, ClipboardCheck, HardHat, Hammer, MessageSquarePlus, Camera } from 'lucide-react';
import { useState } from 'react';
import { service } from '@/lib/data';
import { AUTHORITY_TRANSITIONS, CATEGORY_META, DEPARTMENTS, STATUS_LABEL, type AppUser, type Issue, type Status } from '@/lib/domain';
import { InlineNotice } from './States';

export default function AuthorityPanel({ issue, user, onDone }: { issue: Issue; user: AppUser; onDone: () => void }) {
  const [dept, setDept] = useState(issue.department ?? CATEGORY_META[issue.category].department);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNote('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action failed.');
    } finally {
      setBusy(false);
    }
  };

  const next = AUTHORITY_TRANSITIONS[issue.status].filter((s) => s !== 'assigned');
  const canAssign = ['reported', 'ai_analyzed', 'verified', 'reopened', 'assigned'].includes(issue.status);
  const icon: Partial<Record<Status, JSX.Element>> = {
    verified: <ClipboardCheck className="h-4 w-4" aria-hidden />,
    acknowledged: <CheckCheck className="h-4 w-4" aria-hidden />,
    work_started: <HardHat className="h-4 w-4" aria-hidden />,
    resolved: <Hammer className="h-4 w-4" aria-hidden />,
  };

  if (next.length === 0 && !canAssign && issue.status !== 'citizen_verified' && issue.status !== 'resolved') return null;

  return (
    <section className="rounded-lg border-2 border-asphalt bg-white p-4" aria-labelledby="auth-h" data-testid="authority-panel">
      <h3 id="auth-h" className="text-xl font-semibold">Manage this incident</h3>
      {issue.status === 'resolved' && <p className="mt-1 text-sm text-signal-gray">Marked resolved. Waiting for citizen verification.</p>}
      {issue.status === 'citizen_verified' && <p className="mt-1 text-sm text-signal-green">Closed and verified by citizens.</p>}

      {canAssign && (
        <div className="mt-3">
          <label htmlFor="dept" className="label">{issue.status === 'assigned' ? 'Re-assign department' : 'Assign department'}</label>
          <div className="flex gap-2">
            <select id="dept" className="field" value={dept} onChange={(e) => setDept(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button type="button" className="btn-dark" disabled={busy} onClick={() => void run(() => service.assign(issue.id, dept, user, note || undefined))} data-testid="assign">Assign</button>
          </div>
        </div>
      )}

      {next.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {next.map((s) => (
            <button key={s} type="button" className={s === 'resolved' ? 'btn-primary' : 'btn-outline'} disabled={busy} onClick={() => void run(() => service.updateStatus(issue.id, s, user, note || undefined))} data-testid={`to-${s}`}>
              {icon[s]} {s === 'verified' ? 'Verify issue' : s === 'work_started' ? 'Mark work started' : s === 'resolved' ? 'Mark resolved' : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <label htmlFor="note" className="label">Note</label>
        <textarea id="note" rows={2} maxLength={600} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to the citizens following this issue" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" disabled={busy || !note.trim()} onClick={() => void run(() => service.addNote(issue.id, note, 'note', user))}><MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> Add note</button>
          <button type="button" className="btn-outline btn-sm" disabled={busy || !note.trim()} onClick={() => void run(() => service.addNote(issue.id, note, 'evidence_request', user))}><Camera className="h-3.5 w-3.5" aria-hidden /> Request more evidence</button>
        </div>
      </div>
      {error && <div className="mt-3"><InlineNotice tone="error">{error}</InlineNotice></div>}
    </section>
  );
}
