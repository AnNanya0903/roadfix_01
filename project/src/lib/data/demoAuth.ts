import type { AppUser } from '../domain';
import { DEMO_USERS } from '../demoData';
import type { AuthAPI } from './service';

const KEY = 'roadfix.demo.persona';
const listeners = new Set<(u: AppUser | null) => void>();

function read(): AppUser | null {
  const v = localStorage.getItem(KEY);
  if (v === 'none') return null;
  if (v === 'authority' || v === 'admin' || v === 'citizen') return DEMO_USERS[v];
  return DEMO_USERS.citizen; // demo mode starts signed in as the demo citizen so the demo needs no login
}

function emit() {
  const u = read();
  listeners.forEach((cb) => cb(u));
}

export const demoAuth: AuthAPI = {
  async current() {
    return read();
  },
  async signIn(email) {
    const e = email.toLowerCase();
    const role = e.includes('admin') ? 'admin' : e.includes('officer') || e.includes('authority') ? 'authority' : 'citizen';
    localStorage.setItem(KEY, role);
    emit();
    return DEMO_USERS[role];
  },
  async signUp() {
    localStorage.setItem(KEY, 'citizen');
    emit();
    return DEMO_USERS.citizen;
  },
  async signOut() {
    localStorage.setItem(KEY, 'none');
    emit();
  },
  onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  switchPersona(role) {
    localStorage.setItem(KEY, role);
    emit();
  },
};
