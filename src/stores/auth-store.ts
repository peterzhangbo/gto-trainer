import { create } from 'zustand'
import { supabase } from '@/config/supabase'

interface User {
  id: string
  email: string
  displayName: string
}

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

/**
 * Map a Supabase auth user to our app-level User shape.
 * Falls back to email prefix when no display_name is present.
 */
function mapUser(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const displayName =
    (authUser.user_metadata?.display_name as string | undefined) ??
    authUser.email?.split('@')[0] ??
    'Player'

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)

    const user = mapUser(data.user)
    set({ user, loading: false })
  },

  signUp: async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Signup succeeded but no user was returned')

    const user = mapUser(data.user)
    set({ user, loading: false })
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    set({ user: null, loading: false })
  },

  initialize: async () => {
    // Retrieve the current session (if any)
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      set({ user: mapUser(session.user), loading: false })
    } else {
      set({ user: null, loading: false })
    }

    // Listen for future auth state changes (token refresh, sign-out in another tab, etc.)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({ user: mapUser(session.user), loading: false })
      } else {
        set({ user: null, loading: false })
      }
    })
  },
}))
