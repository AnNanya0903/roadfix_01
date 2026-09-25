import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppMode } from './domain';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const requested = (import.meta.env.VITE_ROADFIX_MODE as string | undefined)?.toLowerCase();

export const SUPABASE_CONFIGURED = Boolean(url && key);

/**
 * Live mode needs BOTH VITE_ROADFIX_MODE=live and Supabase credentials. Anything else runs
 * in demo mode, which uses deterministic seeded data stored in the browser and never
 * pretends to be real.
 */
export const MODE: AppMode = requested === 'live' && SUPABASE_CONFIGURED ? 'live' : 'demo';

export const MODE_NOTE: string | null =
  requested === 'live' && !SUPABASE_CONFIGURED
    ? 'Live mode was requested but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing, so RoadFix is running in demo mode.'
    : null;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_CONFIGURED) throw new Error('Supabase is not configured.');
  if (!client) client = createClient(url as string, key as string, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export const EVIDENCE_BUCKET = 'roadfix-evidence';
export const FUNCTIONS_URL = url ? `${url}/functions/v1` : '';
export const ANON_KEY = key ?? '';
