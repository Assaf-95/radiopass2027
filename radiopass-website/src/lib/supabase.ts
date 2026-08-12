/**
 * The Supabase client — one instance, shared across the app.
 *
 * The two env vars are read at build time by Vite. VITE_SUPABASE_ANON_KEY is
 * the public "anon" key: it is designed to be embedded in client code (the
 * security boundary is the Row Level Security policies on each table, not
 * the secrecy of this key) — see supabase/schema.sql.
 *
 * Until both vars are set, `supabase` is null and every call site falls back
 * to local-only behaviour, so the site keeps working before the backend is
 * wired up.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const supabaseConfigured = supabase !== null
