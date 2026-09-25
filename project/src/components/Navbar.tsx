import { Bell, ChevronDown, Menu, UserCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/appContext';
import { ModePill } from './Badges';

const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/report', label: 'Report Issue' },
  { to: '/map', label: 'Road Map' },
  { to: '/how-it-works', label: 'How It Works' },
];

const authorityLinks = [
  { to: '/authority', label: 'Overview', end: true },
  { to: '/authority/incidents', label: 'Incidents' },
  { to: '/authority/map', label: 'Map' },
  { to: '/authority/queue', label: 'Priority Queue' },
  { to: '/authority/analytics', label: 'Analytics' },
  { to: '/authority/resolution', label: 'Resolution' },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-lane text-asphalt' : 'text-concrete-200 hover:bg-asphalt-700 hover:text-white'}`;

export default function Navbar() {
  const { mode, user, unread, signOut, switchPersona } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const staff = user?.role === 'authority' || user?.role === 'admin';
  const links = staff ? authorityLinks : [...publicLinks, ...(user ? [{ to: '/app', label: 'My Reports' }] : [])];

  return (
    <header className="sticky top-0 z-[1000] bg-asphalt text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to={staff ? '/authority' : '/'} className="flex items-center gap-2" aria-label="RoadFix AI home">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><rect width="32" height="32" rx="7" fill="#F5B700" /><path d="M11 29 15 3h2l4 26" fill="none" stroke="#1C2732" strokeWidth="2" /><path d="M16 6v4M16 13v5M16 21v6" stroke="#1C2732" strokeWidth="2.4" strokeLinecap="round" /></svg>
          <span className="font-display text-2xl font-bold leading-none tracking-tight">RoadFix <span className="text-lane">AI</span></span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => <NavLink key={l.to} to={l.to} end={'end' in l ? l.end : false} className={linkCls}>{l.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <span className="hidden sm:block"><ModePill mode={mode} /></span>
          {user && (
            <Link to="/notifications" className="relative rounded-md p-2 hover:bg-asphalt-700" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-red px-1 text-[10px] font-bold">{unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="relative">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-asphalt-700">
                  <UserCircle className="h-5 w-5 sm:hidden" aria-label={user.name} /><span className="hidden max-w-[7rem] truncate sm:inline">{user.name}</span> <ChevronDown className="h-4 w-4" aria-hidden />
                </summary>
                <div className="absolute right-0 mt-1 w-56 rounded-lg bg-white p-2 text-ink shadow-lg">
                  <p className="px-2 py-1 text-xs text-signal-gray">Signed in as {user.role}</p>
                  <Link to={staff ? '/authority' : '/app'} className="block rounded px-2 py-1.5 text-sm hover:bg-concrete">{staff ? 'Command center' : 'My dashboard'}</Link>
                  <Link to="/profile" className="block rounded px-2 py-1.5 text-sm hover:bg-concrete">Profile</Link>
                  {mode === 'demo' && (
                    <div className="mt-1 border-t border-concrete-200 pt-1">
                      <p className="px-2 py-1 text-xs font-semibold text-lane-700">Demo persona</p>
                      {(['citizen', 'authority', 'admin'] as const).map((r) => (
                        <button key={r} type="button" onClick={() => { switchPersona(r); nav(r === 'citizen' ? '/app' : '/authority'); }} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-concrete ${user.role === r ? 'font-bold' : ''}`}>
                          {r === 'citizen' ? 'Citizen' : r === 'authority' ? 'Authority officer' : 'Admin'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => { void signOut().then(() => nav('/')); }} className="mt-1 block w-full rounded border-t border-concrete-200 px-2 py-1.5 text-left text-sm hover:bg-concrete">Sign out</button>
                </div>
              </details>
            </div>
          ) : (
            <Link to="/login" className="btn-primary btn-sm">Sign in</Link>
          )}
          <button type="button" className="rounded-md p-2 hover:bg-asphalt-700 lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-asphalt-700 px-4 pb-3 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1 pt-2" onClick={() => setOpen(false)}>
            {links.map((l) => <NavLink key={l.to} to={l.to} end={'end' in l ? l.end : false} className={linkCls}>{l.label}</NavLink>)}
          </div>
        </nav>
      )}
    </header>
  );
}
