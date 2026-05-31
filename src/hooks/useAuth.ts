import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: user !== null,
  }
}
