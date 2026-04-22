import { createClient } from '@supabase/supabase-js';
import { mythNodes as seedNodes, mythEdges as seedEdges } from '../data/mythSeed';
import type { MythEdge, MythNode } from '../data/mythSeed';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function fetchNodes(): Promise<MythNode[]> {
  if (!supabase) return seedNodes;
  const { data, error } = await supabase.from('myth_nodes').select('*').order('created_at');
  if (error || !data?.length) return seedNodes;
  return data as MythNode[];
}

export async function fetchEdges(): Promise<MythEdge[]> {
  if (!supabase) return seedEdges;
  const { data, error } = await supabase.from('myth_edges').select('*').order('created_at');
  if (error || !data?.length) return seedEdges;
  return data as MythEdge[];
}