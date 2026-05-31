import { Routes, Route, Link, useLocation } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import TrainerPage from '@/pages/TrainerPage'
import RangeViewerPage from '@/pages/RangeViewerPage'
import EVCalculatorPage from '@/pages/EVCalculatorPage'
import DashboardPage from '@/pages/DashboardPage'
import SettingsPage from '@/pages/SettingsPage'

const NAV_LINKS = [
  { to: '/trainer', label: '训练' },
  { to: '/ranges', label: '范围' },
  { to: '/calculator', label: 'EV计算' },
  { to: '/dashboard', label: '仪表板' },
]

export default function App() {
  const location = useLocation()
  const showNav = !['/', '/login', '/signup'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {showNav && <Navbar />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/trainer" element={<TrainerPage />} />
        <Route path="/ranges" element={<RangeViewerPage />} />
        <Route path="/calculator" element={<EVCalculatorPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}

function Navbar() {
  const location = useLocation()

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-red-500">♠</span> GTO Trainer
        </Link>

        <div className="flex gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ⚙
          </Link>
          <Link
            to="/login"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            登录
          </Link>
        </div>
      </div>
    </nav>
  )
}
