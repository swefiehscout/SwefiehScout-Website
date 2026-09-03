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

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) { console.error('getProfile failed', error); return null; }
  return data as Profile;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(name: string, email: string, password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  return supabase.auth.signUp({ email, password, options: { data: { name } } });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  const redirectTo = window.location.origin + '/leaders';
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error('Not connected to the workspace database.');
  return supabase.auth.updateUser({ password });
}
