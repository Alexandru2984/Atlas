import { createClient, type User } from '@supabase/supabase-js';
import { mythNodes as seedNodes, mythEdges as seedEdges } from '../data/mythSeed';
import type { MythEdge, MythNode } from '../data/mythSeed';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Supabase auth.getSession error:', error.message);
    return null;
  }
  return data.session?.user ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) return { error: new Error('Supabase is not configured') };
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOutUser() {
  if (!supabase) return { error: new Error('Supabase is not configured') };
  return await supabase.auth.signOut();
}

export async function fetchNodes(): Promise<MythNode[]> {
  if (!supabase) return seedNodes;
  const { data, error } = await supabase.from('myth_nodes').select('*').order('created_at');
  if (error) {
    console.warn('Supabase fetchNodes error:', error.message);
    return seedNodes;
  }
  return (data ?? []) as MythNode[];
}

export async function fetchEdges(): Promise<MythEdge[]> {
  if (!supabase) return seedEdges;
  const { data, error } = await supabase.from('myth_edges').select('*').order('created_at');
  if (error) {
    console.warn('Supabase fetchEdges error:', error.message);
    return seedEdges;
  }
  return (data ?? []) as MythEdge[];
}