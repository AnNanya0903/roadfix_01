import type { AppUser, Role } from '../domain';
import { getSupabase } from '../mode';
import type { AuthAPI } from './service';

async function toUser(id: string, email: string | undefined | null): Promise<AppUser> {
  const { data } = await getSupabase().from('profiles').select('display_name, role, department').eq('id', id).maybeSingle();
  const row = data as { display_name?: string; role?: Role; department?: string | null } | null;
  return { id, email: email ?? null, name: row?.display_name ?? email?.split('@')[0] ?? 'Citizen', role: row?.role ?? 'citizen', department: row?.department ?? null };
}

export const supabaseAuth: AuthAPI = {
  async current() {
    const { data } = await getSupabase().auth.getSession();
    const u = data.session?.user;
    return u ? toUser(u.id, u.email) : null;
  },
  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Sign in failed.');
    return toUser(data.user.id, data.user.email);
  },
  async signUp(email, password, name) {
    const { data, error } = await getSupabase().auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw new Error(error.message);
    if (!data.session || !data.user) return null; // email confirmation required
    return toUser(data.user.id, data.user.email);
  },
  async signOut() {
    await getSupabase().auth.signOut();
  },
  onChange(cb) {
    const { data } = getSupabase().auth.onAuthStateChange((_e, session) => {
      if (!session?.user) cb(null);
      else void toUser(session.user.id, session.user.email).then(cb);
    });
    return () => data.subscription.unsubscribe();
  },
};
