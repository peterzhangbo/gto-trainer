import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import Spinner from '@/components/ui/Spinner'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        </div>
      )
    )
  }

  if (!user) return null

  return <>{children}</>
}
