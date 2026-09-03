// Shared auth/session helpers for the Leaders Workspace. Reuses the single
// Supabase client from curriculum/supabase.ts — creating a second
// `createClient()` call anywhere else in the app would spin up a second
// GoTrueClient and cause auth state to fall out of sync between them.
import { supabase, supabaseConfigured } from '../curriculum/supabase';

export { supabase, supabaseConfigured };

export type Role = 'pending' | 'leader' | 'admin';

export type Profile = {
  id: string;
  name: string;
  role: Role;
  groups: string[];
};

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ------------------------------------------------------------------
// Hard session-lifetime cap. Supabase's own refresh token would happily
// keep a leader signed in for weeks on a shared/left-open device — this
// forces a real sign-out and back-to-login screen after a fixed window
// since they last authenticated, independent of that refresh token.
// Same idea as the old shared-password gate's PORTAL_TTL_HOURS, just
// per-account now instead of per-password.
const SESSION_TTL_HOURS = 3;
const SESSION_STARTED_KEY = 'ws_session_started';

function markSessionStart() {
  try { localStorage.setItem(SESSION_STARTED_KEY, String(Date.now())); } catch { /* private mode etc. */ }
}
function clearSessionStart() {
  try { localStorage.removeItem(SESSION_STARTED_KEY); } catch { /* private mode etc. */ }
}
// True once SESSION_TTL_HOURS have passed since sign-in. A missing start
// time (e.g. a browser session that predates this feature) is treated as
// starting now rather than expiring existing sessions immediately.
export function isSessionExpired(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_STARTED_KEY);
    if (!raw) { markSessionStart(); return false; }
    return Date.now() - Number(raw) > SESSION_TTL_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
// How long until the hard cap kicks in — used to schedule a proactive
// sign-out so a tab left open gets kicked at the 3-hour mark instead of
// only being caught on the next reload.
export function msUntilSessionExpiry(): number {
  const ttlMs = SESSION_TTL_HOURS * 60 * 60 * 1000;
  try {
    const raw = localStorage.getItem(SESSION_STARTED_KEY);
    if (!raw) return ttlMs;
    return Math.max(0, ttlMs - (Date.now() - Number(raw)));
  } catch {
    return ttlMs;
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) { console.error('getProfile failed', error); return null; }
  return data as Profile;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error) markSessionStart();
  return result;
}

export async function signUp(name: string, email: string, password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  const emailRedirectTo = window.location.origin + '/leaders';
  const result = await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo } });
  if (!result.error && result.data.session) markSessionStart();
  return result;
}

export async function signOut() {
  if (!supabase) return;
  clearSessionStart();
  await supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  const redirectTo = window.location.origin + '/leaders';
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  const result = await supabase.auth.updateUser({ password });
  if (!result.error) markSessionStart();
  return result;
}
