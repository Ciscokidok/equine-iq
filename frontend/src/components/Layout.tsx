import { Link, useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/pairings', label: 'Saved Pairings' },
  { to: '/stallions', label: 'Stallion Catalog' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

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
        <button
          onClick={logout}
          className="text-xs text-brand-300 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
