import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getOpenAIKey } from '@/api/settings'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/pairings', label: 'Saved Pairings' },
  { to: '/stallions', label: 'Stallion Catalog' },
  { to: '/foals', label: 'Foal Tracker' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [missingKey, setMissingKey] = useState(false)

  useEffect(() => {
    getOpenAIKey().then(d => setMissingKey(!d.hasKey)).catch(() => {})
  }, [pathname])

  function logout() {
    localStorage.removeItem('auth_token')
    window.dispatchEvent(new Event('auth_change'))
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-bold tracking-tight text-brand-100">EquineIQ</Link>
          <nav className="hidden sm:flex gap-1">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-brand-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className={`text-xs px-2 py-1 rounded transition-colors ${
              pathname === '/settings'
                ? 'bg-white/20 text-white'
                : 'text-brand-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Settings
          </Link>
          <button
            onClick={logout}
            className="text-xs text-brand-300 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {missingKey && pathname !== '/settings' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
          Add your OpenAI API key in{' '}
          <Link to="/settings" className="font-medium underline">Account Settings</Link>{' '}
          to enable AI breeding analysis.
        </div>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
