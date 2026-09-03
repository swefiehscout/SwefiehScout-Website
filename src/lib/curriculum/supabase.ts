// Client for the Curriculum Maker's shared database. Browser-only module —
// PUBLIC_ vars are inlined at build time by Vite, and the anon/publishable
// key is designed to be exposed client-side: access is actually governed
// by the `curriculum_meetings` table's Row Level Security policy, not by
// keeping this key secret. Same posture as the portal password gate in
// leader-portal-config.ts — keeps casual visitors out, isn't a hard
// boundary against anyone determined.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

export type Activity = {
  id: string;
  type: string;
  en: string;
  ar: string;
  duration?: number | null;
  notes?: string | null;
};

export type Meeting = {
  id?: string;
  group_key: string;
  date: string; // YYYY-MM-DD
  theme?: string | null;
  notes?: string | null;
  activities: Activity[];
  created_by?: string | null;
  updated_by?: string | null;
  updated_at?: string;
};
