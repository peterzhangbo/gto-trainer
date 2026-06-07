import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { ErrorBoundary, ToastContainer, Spinner } from '@/components/ui'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const TrainerPage = lazy(() => import('@/pages/TrainerPage'))
const RangeViewerPage = lazy(() => import('@/pages/RangeViewerPage'))
const EVCalculatorPage = lazy(() => import('@/pages/EVCalculatorPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const MistakeBookPage = lazy(() => import('@/pages/MistakeBookPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const HandHistoryPage = lazy(() => import('@/pages/HandHistoryPage'))
const RangeEditorPage = lazy(() => import('@/pages/RangeEditorPage'))
const TournamentPage = lazy(() => import('@/pages/TournamentPage'))
const AIOpponentPage = lazy(() => import('@/pages/AIOpponentPage'))
const QuizPage = lazy(() => import('@/pages/QuizPage'))
const BetSizingPage = lazy(() => import('@/pages/BetSizingPage'))
const ExploitPage = lazy(() => import('@/pages/ExploitPage'))
const ChainDrillPage = lazy(() => import('@/pages/ChainDrillPage'))

const NAV_LINK_KEYS = [
  { to: '/trainer', key: 'nav.training' as const },
  { to: '/ranges', key: 'nav.ranges' as const },
  { to: '/calculator', key: 'nav.calculator' as const },
  { to: '/dashboard', key: 'nav.dashboard' as const },
  { to: '/mistakes', key: 'nav.mistakes' as const },
  { to: '/history', key: 'nav.history' as const },
  { to: '/history-import', key: 'nav.handHistory' as const },
  { to: '/range-editor', key: 'nav.rangeEditor' as const },
  { to: '/tournament', key: 'nav.tournament' as const },
  { to: '/ai-opponent', key: 'nav.aiOpponent' as const },
  { to: '/quiz', key: 'nav.quiz' as const },
  { to: '/bet-sizing', key: 'nav.betSizing' as const },
  { to: '/exploit', key: 'nav.exploit' as const },
  { to: '/chain-drill', key: 'nav.chainDrill' as const },
]

export default function App() {
  const location = useLocation()
  const showNav = !['/login', '/signup'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <ToastContainer />
      {showNav && <Navbar />}
      <div className="page-enter" key={location.pathname}>
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Spinner size="xl" /></div>}>
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/trainer" element={<TrainerPage />} />
              <Route path="/ranges" element={<RangeViewerPage />} />
              <Route path="/calculator" element={<EVCalculatorPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/mistakes" element={<MistakeBookPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history-import" element={<HandHistoryPage />} />
              <Route path="/range-editor" element={<RangeEditorPage />} />
              <Route path="/tournament" element={<TournamentPage />} />
              <Route path="/ai-opponent" element={<AIOpponentPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/bet-sizing" element={<BetSizingPage />} />
              <Route path="/chain-drill" element={<ChainDrillPage />} />
              <Route path="/exploit" element={<ExploitPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

function Navbar() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="bg-gray-900/80 backdrop-blur-navbar border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold text-white flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-red-500">♠</span> GTO Trainer
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-1">
          {NAV_LINK_KEYS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {t(link.key)}
              {location.pathname === link.to && (
                <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-5 h-0.5 bg-red-500 rounded-full" />
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
          >
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          <button
            onClick={toggleTheme}
            className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/settings" className="text-gray-500 hover:text-gray-300 text-sm">⚙</Link>
          {user ? (
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-gray-400">{user.displayName}</span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:block px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('nav.login')}
            </Link>
          )}

          {/* Hamburger button (mobile) */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-gray-300 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-300 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-300 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden border-t border-gray-800 bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 border-t-transparent'}`}>
        <div className="px-4 py-3 space-y-1">
            {NAV_LINK_KEYS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {t(link.key)}
              </Link>
            ))}
            {user ? (
              <div className="pt-2 border-t border-gray-800 mt-2 space-y-2 sm:hidden">
                <span className="block text-sm text-gray-400 px-3">{user.displayName}</span>
                <button
                  onClick={() => { signOut(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="sm:hidden block text-center mt-2 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                {t('nav.login')}
              </Link>
            )}
        </div>
      </div>
    </nav>
  )
}
