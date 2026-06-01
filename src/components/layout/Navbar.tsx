import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/auth-store'
import { useI18n } from '@/lib/i18n'

const NAV_LINKS_KEYS = [
  { to: '/training', labelKey: 'nav.training' as const },
  { to: '/ranges', labelKey: 'nav.ranges' as const },
  { to: '/calculator', labelKey: 'nav.calculator' as const },
  { to: '/dashboard', labelKey: 'nav.dashboard' as const },
  { to: '/mistakes', labelKey: 'nav.mistakes' as const },
  { to: '/history', labelKey: 'nav.history' as const },
] as const

export default function Navbar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { t } = useI18n()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Hamburger button - mobile only */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-300">
                <path d="M5 5L15 15M15 5L5 15" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-300">
                <path d="M3 6H17M3 10H17M3 14H17" />
              </svg>
            )}
          </button>

          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
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

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <span className="text-sm font-medium text-gray-200">
                  {user.displayName}
                </span>
              </div>
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={() => void signOut()}
                className="hidden sm:block rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
              >
                {t('navbar.signOut')}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {t('navbar.signIn')}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS_KEYS.map((link) => {
              const isActive = location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block rounded-lg px-4 py-3 text-sm font-medium transition-colors min-h-[44px] flex items-center',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              )
            })}
            {user && (
              <>
                <div className="border-t border-gray-800 pt-2 mt-2">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-200">{user.displayName}</span>
                  </div>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 min-h-[44px] flex items-center"
                >
                  {t('nav.settings')}
                </Link>
                <button
                  onClick={() => { void signOut(); setMobileOpen(false) }}
                  className="block w-full text-left rounded-lg px-4 py-3 text-sm font-medium text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 min-h-[44px]"
                >
                  {t('navbar.signOut')}
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
