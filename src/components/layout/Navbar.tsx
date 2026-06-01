import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/auth-store'
import { useI18n } from '@/lib/i18n'

const NAV_LINKS_KEYS = [
  { to: '/training', labelKey: 'nav.training' as const },
  { to: '/ranges', labelKey: 'nav.ranges' as const },
  { to: '/calculator', labelKey: 'nav.calculator' as const },
  { to: '/dashboard', labelKey: 'nav.dashboard' as const },
] as const

export default function Navbar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-red-500">GTO</span>
            <span className="text-xl font-bold text-gray-100">Trainer</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS_KEYS.map((link) => {
              const isActive = location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <span className="text-sm font-medium text-gray-200">
                  {user.displayName}
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={() => void signOut()}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
              >
                {t('navbar.signOut')}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              {t('navbar.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
