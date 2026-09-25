import { Bell, CheckCheck, FilePlus2, Scan } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Contribution from '@/components/Contribution';
import IssueCard from '@/components/IssueCard';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { isClosed } from '@/lib/domain';
import { timeAgo } from '@/lib/format';

function useMine() {
  const { issues, user, loading, error, reload } = useApp();
  const mine = useMemo(() => issues.filter((i) => user && i.reporterId === user.id), [issues, user]);
  return { mine, loading, error, reload, user };
}

export function CitizenDashboard() {
  const { mine, loading, error, reload, user } = useMine();
  const { issues } = useApp();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!user) return null;
  const needsAction = mine.filter((i) => i.status === 'resolved');
  const open = mine.filter((i) => !isClosed(i.status));
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-4xl font-bold">Hello, {user.name}</h1><p className="text-signal-gray">Your reports and what needs you next.</p></div>
        <div className="flex gap-2"><Link to="/scan" className="btn-outline"><Scan className="h-4 w-4" aria-hidden /> RoadFix Scan</Link><Link to="/report" className="btn-primary"><FilePlus2 className="h-4 w-4" aria-hidden /> Report an issue</Link></div>
      </div>

      {needsAction.length > 0 && (
        <section className="rounded-lg border-2 border-signal-green/50 bg-signal-greenbg p-4" aria-labelledby="verify-h">
          <h2 id="verify-h" className="flex items-center gap-2 text-2xl font-semibold"><CheckCheck className="h-5 w-5" aria-hidden /> Please verify these repairs</h2>
          <ul className="mt-2 grid gap-3 md:grid-cols-2">{needsAction.map((i) => <li key={i.id}><IssueCard issue={i} /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="open-h">
        <h2 id="open-h" className="mb-2 text-2xl font-semibold">Open reports ({open.length})</h2>
        {open.length === 0 ? <div className="panel"><EmptyState title="No open reports" body="When you report a road issue, you can follow it here from first report to verified repair." action={<Link to="/report" className="btn-dark">Report an issue</Link>} /></div> : <ul className="grid gap-3 md:grid-cols-2">{open.map((i) => <li key={i.id}><IssueCard issue={i} /></li>)}</ul>}
        <p className="mt-2 text-sm"><Link to="/app/reports" className="font-semibold underline">See all my reports</Link> · {issues.length} incidents on the <Link to="/map" className="font-semibold underline">public map</Link></p>
      </section>
      <Contribution user={user} />
    </div>
  );
}

export function MyReportsPage() {
  const { mine, loading, error, reload } = useMine();
  const [show, setShow] = useState<'all' | 'open' | 'closed'>('all');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  const list = mine.filter((i) => (show === 'all' ? true : show === 'open' ? !isClosed(i.status) : isClosed(i.status)));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-4xl font-bold">My reports</h1>
      <div className="my-4 flex gap-2" role="group" aria-label="Filter my reports">
        {(['all', 'open', 'closed'] as const).map((k) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`btn-sm ${show === k ? 'btn-dark' : 'btn-outline'}`}>{k === 'all' ? 'All' : k === 'open' ? 'Open' : 'Resolved'} ({mine.filter((i) => (k === 'all' ? true : k === 'open' ? !isClosed(i.status) : isClosed(i.status))).length})</button>)}
      </div>
      {list.length === 0 ? <div className="panel"><EmptyState title="Nothing here yet" body="Reports you submit will appear here." action={<Link to="/report" className="btn-dark">Report an issue</Link>} /></div> : <ul className="space-y-3">{list.map((i) => <li key={i.id}><IssueCard issue={i} /></li>)}</ul>}
    </div>
  );
}

export function NotificationsPage() {
  const { notifications, markAllRead, unread, user } = useApp();
  const nav = useNavigate();
  if (!user) return <EmptyState page title="Sign in to see notifications" body="Updates about your reports appear here." action={<Link to="/login" className="btn-dark">Sign in</Link>} />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between">
        <h1 className="text-4xl font-bold">Notifications</h1>
        {unread > 0 && <button type="button" className="btn-outline btn-sm" onClick={() => void markAllRead()}>Mark all read</button>}
      </div>
      {notifications.length === 0 ? <div className="panel mt-4"><EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title="You're all caught up" body="You will hear about analysis results, verification, assignments and repairs here." /></div> : (
        <ul className="mt-4 space-y-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => n.issueId && nav(`/issues/${n.issueId}`)} className={`panel flex w-full items-start gap-3 p-3 text-left ${n.read ? '' : 'border-l-4 border-lane'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-concrete-300' : 'bg-signal-red'}`} aria-label={n.read ? 'Read' : 'Unread'} />
                <span><span className="block font-semibold">{n.title}</span><span className="block text-sm">{n.body}</span><span className="text-xs text-signal-gray">{timeAgo(n.at)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, mode, signOut, switchPersona } = useApp();
  const nav = useNavigate();
  if (!user) return <EmptyState page title="You're not signed in" body="Sign in to see your profile." action={<Link to="/login" className="btn-dark">Sign in</Link>} />;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <h1 className="text-4xl font-bold">Profile</h1>
      <dl className="panel grid gap-3 p-4 sm:grid-cols-2">
        <div><dt className="text-xs text-signal-gray">Name</dt><dd className="font-semibold">{user.name}</dd></div>
        <div><dt className="text-xs text-signal-gray">Email</dt><dd className="font-semibold">{user.email ?? 'Not set'}</dd></div>
        <div><dt className="text-xs text-signal-gray">Role</dt><dd className="font-semibold capitalize">{user.role}</dd></div>
        {user.department && <div><dt className="text-xs text-signal-gray">Department</dt><dd className="font-semibold">{user.department}</dd></div>}
      </dl>
      {mode === 'demo' && (
        <div className="panel p-4"><h2 className="text-xl font-semibold">Demo persona</h2><div className="mt-2 flex flex-wrap gap-2">{(['citizen', 'authority', 'admin'] as const).map((r) => <button key={r} type="button" className={user.role === r ? 'btn-dark btn-sm' : 'btn-outline btn-sm'} onClick={() => switchPersona(r)}>{r}</button>)}</div></div>
      )}
      {user.role === 'citizen' && <Contribution user={user} />}
      <button type="button" className="btn-outline" onClick={() => void signOut().then(() => nav('/'))}>Sign out</button>
    </div>
  );
}
