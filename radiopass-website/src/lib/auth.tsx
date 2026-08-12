/**
 * Account state, shared across the app.
 *
 * Wraps Supabase's own session handling: on mount, read whatever session is
 * already on disk (Supabase persists it in localStorage itself), then stay
 * subscribed for sign-in/sign-out/token-refresh events for as long as the
 * app is open. Every consumer just reads `user` — nobody else touches the
 * Supabase auth API directly.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'

type AuthResult = { error: string | null }
type SignUpResult = AuthResult & { needsEmailConfirmation: boolean }

type AuthContextValue = {
  user: User | null
  loading: boolean
  /** False until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. */
  configured: boolean
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) return { error: 'Accounts are not set up on this deployment yet.', needsEmailConfirmation: false }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    // A fresh Supabase project requires email confirmation by default — no
    // session comes back until the link is clicked, even though sign-up itself
    // succeeded.
    return { error: null, needsEmailConfirmation: !data.session }
  }

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Accounts are not set up on this deployment yet.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    loading,
    configured: supabaseConfigured,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
