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

// Signs out THIS device only. Used to default to Supabase's own
// scope:'global' (signs out every device silently) before device
// sessions existed to make that distinction meaningful — now that a
// leader can see and manage their other devices individually, the plain
// "Sign out" button should only ever mean "sign me out of here", same as
// tapping it during a session-expiry or pending/denied redirect
// shouldn't quietly log them out of their phone too.
export async function signOut() {
  if (!supabase) return;
  clearSessionStart();
  clearDeviceSessionId();
  await supabase.auth.signOut({ scope: 'local' });
}

// The explicit "sign out of every device" action — a real, immediate
// Supabase-side revocation of every session on this account.
export async function signOutEverywhere() {
  if (!supabase) return;
  clearSessionStart();
  clearDeviceSessionId();
  await supabase.auth.signOut({ scope: 'global' });
}

// ------------------------------------------------------------------
// Device sessions — see supabase/device_sessions_schema.sql for why this
// exists instead of just using Supabase's own session list (there isn't
// one exposed to the client). One row per device/browser this account
// has signed into; this device's own row id lives in localStorage so it
// can tell itself apart from the others in the list.
const DEVICE_SESSION_ID_KEY = 'ws_device_session_id';

export type DeviceSession = {
  id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
};

function getDeviceSessionId(): string | null {
  try { return localStorage.getItem(DEVICE_SESSION_ID_KEY); } catch { return null; }
}
function setDeviceSessionId(id: string) {
  try { localStorage.setItem(DEVICE_SESSION_ID_KEY, id); } catch { /* private mode etc. */ }
}
function clearDeviceSessionId() {
  try { localStorage.removeItem(DEVICE_SESSION_ID_KEY); } catch { /* private mode etc. */ }
}

// A short, friendly "Chrome on Mac" style label — good enough to tell
// devices apart in a list, not meant to fingerprint anyone.
function detectDeviceLabel(): string {
  const ua = navigator.userAgent || '';
  let browser = 'a browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/CriOS/.test(ua) || (/Chrome\//.test(ua) && !/Chromium/.test(ua))) browser = 'Chrome';
  else if (/FxiOS/.test(ua) || /Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  let os = 'an unknown device';
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'Mac';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

// Called once per sign-in (and once on a resumed session that predates
// this feature, so existing signed-in leaders still show up in their own
// list eventually). Reuses this device's existing row if it still has
// one, rather than piling up a fresh row on every page load.
export async function registerDeviceSession(): Promise<void> {
  if (!supabase) return;
  const existing = getDeviceSessionId();
  if (existing) {
    const { data, error } = await supabase
      .from('device_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (!error && data) return; // still a live row — done
    clearDeviceSessionId(); // revoked or gone — fall through and re-register
  }
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  const { data, error } = await supabase
    .from('device_sessions')
    .insert({ user_id: user.id, device_label: detectDeviceLabel() })
    .select('id')
    .single();
  if (!error && data) setDeviceSessionId(data.id);
}

// Explicitly scoped to the caller's own user_id, not just left to RLS —
// device_sessions' SELECT policy also grants admins read access to
// EVERY row (device_sessions_select_admin, for Admin's own People >
// Activity Log subtab, see that table's schema file), so without this
// filter an admin calling this would get back every leader's device
// sessions mixed into what's supposed to be "my own devices" here in
// the Account menu — sign-out policy is still correctly own-row-only,
// so those foreign rows would just silently fail to revoke on top of
// showing up in the first place. Never rely on RLS alone to scope a
// "give me my own stuff" query when the table might also grant broader
// read access for an unrelated reason elsewhere.
export async function listMyDeviceSessions(): Promise<DeviceSession[]> {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('device_sessions')
    .select('id, device_label, created_at, last_seen_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false });
  if (error) { console.error('listMyDeviceSessions failed', error); return []; }
  return data as DeviceSession[];
}

export function currentDeviceSessionId(): string | null {
  return getDeviceSessionId();
}

// Sign out one specific device from the list. Kicking THIS device signs
// it out for real, immediately. Kicking another device just marks its
// row revoked — that device notices on its own next background check,
// usually within about a minute, and signs itself out then.
export async function signOutDevice(sessionId: string): Promise<void> {
  if (!supabase) return;
  const isThisDevice = sessionId === getDeviceSessionId();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  // .eq('user_id', ...) here too — belt-and-suspenders alongside the
  // update-own RLS policy, same reasoning as listMyDeviceSessions()
  // above. Logged (not just silently ignored) since a blocked update
  // here means 0 rows changed and no error — the same failure mode
  // that made this look broken in the first place.
  const { error } = await supabase.from('device_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId).eq('user_id', user.id);
  if (error) console.error('signOutDevice failed', error);
  if (isThisDevice) await signOut();
}

// Every device but this one, revoked immediately and for real — this one
// doesn't wait on the polling fallback, it calls Supabase's own
// scope:'others' sign-out on top of marking the rows revoked.
export async function signOutOtherDevices(): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  const id = getDeviceSessionId();
  let query = supabase.from('device_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id).is('revoked_at', null);
  if (id) query = query.neq('id', id);
  const { error } = await query;
  if (error) console.error('signOutOtherDevices failed', error);
  await supabase.auth.signOut({ scope: 'others' });
}

// Background check for THIS device having been kicked from elsewhere.
// Returns false (and signs this device out locally) if its row was
// revoked or deleted since the last check; a network hiccup never signs
// anyone out. Call every 30-60s while the app is open, and on tab focus.
export async function checkThisDeviceStillActive(): Promise<boolean> {
  if (!supabase) return true;
  const id = getDeviceSessionId();
  if (!id) return true; // not registered yet — nothing to check
  const { data, error } = await supabase.from('device_sessions').select('revoked_at').eq('id', id).maybeSingle();
  if (error) return true;
  if (!data || data.revoked_at) {
    clearSessionStart();
    clearDeviceSessionId();
    await supabase.auth.signOut({ scope: 'local' });
    return false;
  }
  supabase.from('device_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', id).then(() => {});
  return true;
}

// "3 minutes ago" / "Yesterday" style — short enough for a menu row.
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
