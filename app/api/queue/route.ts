import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { QueueRow } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  // Only query sanitized public fields. Never expose patients or tutor records.
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from('visits').select('id,public_label,priority,status,arrived_at').eq('status', 'WAITING');
  if (error) return NextResponse.json({ error: 'Queue unavailable' }, { status: 503 });
  const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const items = (data as QueueRow[]).sort((a, b) => order[a.priority] - order[b.priority] || a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
  return NextResponse.json({ items, refreshedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
