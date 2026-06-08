import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/config/supabase'

interface User {
  id: string
  email: string
  displayName: string
  passwordHash?: string // only used in localStorage mode
}

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

// --- localStorage fallback (when Supabase is not configured) ---

const STORAGE_KEY = 'gto-trainer-user'

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function setStoredUser(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  else localStorage.removeItem(STORAGE_KEY)
}

// --- Supabase helpers ---

function mapUser(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const displayName =
    (authUser.user_metadata?.display_name as string | undefined) ??
    authUser.email?.split('@')[0] ??
    'Player'
  return { id: authUser.id, email: authUser.email ?? '', displayName }
}

// --- Store ---

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      set({ user: mapUser(data.user), loading: false })
    } else {
      // localStorage fallback
      const users: User[] = JSON.parse(localStorage.getItem('gto-users') ?? '[]')
      const existing = users.find((u) => u.email === email)
      if (!existing) throw new Error('用户不存在，请先注册')
      const hash = await hashPassword(password)
      if (existing.passwordHash !== hash) throw new Error('密码错误')
      const { passwordHash: _, ...safeUser } = existing
      setStoredUser(safeUser)
      set({ user: safeUser, loading: false })
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('注册失败')
      set({ user: mapUser(data.user), loading: false })
    } else {
      // localStorage fallback
      const users: User[] = JSON.parse(localStorage.getItem('gto-users') ?? '[]')
      if (users.some((u) => u.email === email)) throw new Error('该邮箱已注册')
      const hash = await hashPassword(password)
      const newUser: User = { id: crypto.randomUUID(), email, displayName, passwordHash: hash }
      users.push(newUser)
      localStorage.setItem('gto-users', JSON.stringify(users))
      const { passwordHash: _, ...safeUser } = newUser
      setStoredUser(safeUser)
      set({ user: safeUser, loading: false })
    }
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setStoredUser(null)
    set({ user: null, loading: false })
  },

  initialize: async () => {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user ? mapUser(session.user) : null, loading: false })
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ? mapUser(session.user) : null, loading: false })
      })
    } else {
      // localStorage fallback
      set({ user: getStoredUser(), loading: false })
    }
  },
}))
