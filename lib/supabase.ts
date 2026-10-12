import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let instance: SupabaseClient | undefined;
export function supabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return (instance ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }));
}
