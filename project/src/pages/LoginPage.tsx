import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InlineNotice } from '@/components/States';
import { useApp } from '@/lib/appContext';
import { auth } from '@/lib/data';

export default function LoginPage() {
  const { mode, modeNote, switchPersona } = useApp();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const next = sp.get('next') || '/app';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    if (tab === 'up' && name.trim().length < 2) return setError('Enter your name.');
    setBusy(true);
    try {
      if (tab === 'in') {
        const u = await auth.signIn(email, password);
        nav(u.role === 'citizen' ? next : '/authority');
      } else {
        const u = await auth.signUp(email, password, name.trim());
        if (u) nav(next);
        else setInfo('Check your email to confirm your account, then sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-4xl font-bold">{tab === 'in' ? 'Sign in' : 'Create an account'}</h1>
      {modeNote && <div className="mt-3"><InlineNotice tone="warn">{modeNote}</InlineNotice></div>}

      {mode === 'demo' && (
        <section className="mt-5 rounded-lg border border-lane bg-lane-100 p-4" aria-labelledby="demo-h">
          <h2 id="demo-h" className="flex items-center gap-2 text-xl font-semibold"><FlaskConical className="h-4 w-4" aria-hidden /> Demo mode: choose a persona</h2>
          <p className="mt-1 text-sm">There are no real accounts in demo mode. Pick who you want to be.</p>
          <div className="mt-3 grid gap-2">
            <button type="button" className="btn-dark" data-testid="persona-citizen" onClick={() => { switchPersona('citizen'); nav(next); }}>Continue as demo citizen</button>
            <button type="button" className="btn-outline" data-testid="persona-authority" onClick={() => { switchPersona('authority'); nav('/authority'); }}>Continue as authority officer</button>
            <button type="button" className="btn-outline" data-testid="persona-admin" onClick={() => { switchPersona('admin'); nav('/authority'); }}>Continue as admin</button>
          </div>
        </section>
      )}

      {mode === 'live' && (
        <form className="mt-5 space-y-4" onSubmit={(e) => void submit(e)} noValidate>
          <div role="tablist" className="grid grid-cols-2 rounded-md bg-concrete p-1">
            {(['in', 'up'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded py-1.5 text-sm font-semibold ${tab === t ? 'bg-white shadow' : 'text-signal-gray'}`}>{t === 'in' ? 'Sign in' : 'Register'}</button>)}
          </div>
          {tab === 'up' && <div><label htmlFor="nm" className="label">Your name</label><input id="nm" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
          <div><label htmlFor="em" className="label">Email</label><input id="em" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div><label htmlFor="pw" className="label">Password</label><input id="pw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} /></div>
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
          {info && <InlineNotice tone="ok">{info}</InlineNotice>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : tab === 'in' ? 'Sign in' : 'Create account'}</button>
          <p className="hint">New accounts are always citizens. Authority access is granted by an administrator.</p>
        </form>
      )}
    </div>
  );
}
