import { useState, useRef, useEffect, lazy, Suspense } from 'react'
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
const ImpliedOddsPage = lazy(() => import('@/pages/ImpliedOddsPage'))
const EquityDistributionPage = lazy(() => import('@/pages/EquityDistributionPage'))
const BoardTexturePage = lazy(() => import('@/pages/BoardTexturePage'))
const StreetPlanningPage = lazy(() => import('@/pages/StreetPlanningPage'))
const CheckRaisePage = lazy(() => import('@/pages/CheckRaisePage'))

const NAV_GROUPS = [
  {
    key: 'nav.trainingGroup' as const,
    label: { zh: '训练', en: 'Training' },
    items: [
      { to: '/trainer', key: 'nav.training' as const },
      { to: '/ai-opponent', key: 'nav.aiOpponent' as const },
      { to: '/quiz', key: 'nav.quiz' as const },
      { to: '/chain-drill', key: 'nav.chainDrill' as const },
      { to: '/tournament', key: 'nav.tournament' as const },
    ]
  },
  {
    key: 'nav.analysisGroup' as const,
    label: { zh: '分析工具', en: 'Analysis' },
    items: [
      { to: '/ranges', key: 'nav.ranges' as const },
      { to: '/calculator', key: 'nav.calculator' as const },
      { to: '/range-editor', key: 'nav.rangeEditor' as const },
      { to: '/equity-dist', key: 'nav.equityDist' as const },
      { to: '/board-texture', key: 'nav.boardTexture' as const },
    ]
  },
  {
    key: 'nav.strategyGroup' as const,
    label: { zh: '策略学习', en: 'Strategy' },
    items: [
      { to: '/bet-sizing', key: 'nav.betSizing' as const },
      { to: '/exploit', key: 'nav.exploit' as const },
      { to: '/implied-odds', key: 'nav.impliedOdds' as const },
      { to: '/street-planning', key: 'nav.streetPlanning' as const },
      { to: '/check-raise', key: 'nav.checkRaise' as const },
    ]
  },
  {
    key: 'nav.personalGroup' as const,
    label: { zh: '我的', en: 'My' },
    items: [
      { to: '/dashboard', key: 'nav.dashboard' as const },
      { to: '/mistakes', key: 'nav.mistakes' as const },
      { to: '/history', key: 'nav.history' as const },
      { to: '/history-import', key: 'nav.handHistory' as const },
      { to: '/settings', key: 'nav.settings' as const },
    ]
  },
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
              <Route path="/implied-odds" element={<ImpliedOddsPage />} />
              <Route path="/equity-dist" element={<EquityDistributionPage />} />
              <Route path="/board-texture" element={<BoardTexturePage />} />
              <Route path="/street-planning" element={<StreetPlanningPage />} />
              <Route path="/check-raise" element={<CheckRaisePage />} />
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
          {NAV_GROUPS.map((group) => (
            <NavDropdown
              key={group.key}
              group={group}
              isActive={(path) => location.pathname === path}
            />
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
      <div className={`md:hidden border-t border-gray-800 bg-gray-900 overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'}`}>
        <div className="px-4 py-3 space-y-1">
            {NAV_GROUPS.map((group) => (
              <MobileNavGroup key={group.key} group={group} isActive={(path) => location.pathname === path} onNavigate={() => setMenuOpen(false)} />
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

function NavDropdown({ group, isActive }: { group: typeof NAV_GROUPS[0]; isActive: (path: string) => boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasActive = group.items.some((item) => isActive(item.to))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
          hasActive
            ? 'bg-gray-800 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        }`}
      >
        {t(group.key)}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 min-w-[180px] z-50">
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(item.to)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileNavGroup({ group, isActive, onNavigate }: { group: typeof NAV_GROUPS[0]; isActive: (path: string) => boolean; onNavigate: () => void }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(() => group.items.some((item) => isActive(item.to)))

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800/50"
      >
        {t(group.key)}
        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="ml-3 space-y-0.5">
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.to)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
