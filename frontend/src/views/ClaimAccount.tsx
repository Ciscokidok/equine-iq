import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '@/api/client'

export default function ClaimAccount() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [farmName, setFarmName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-stone-800">Invalid link</h1>
          <p className="text-stone-500 text-sm">This account setup link is missing or invalid. Check your email for the correct link.</p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    setError('')

    try {
      const { data } = await client.post('/api/auth/claim', { token, password, farmName: farmName || undefined })
      localStorage.setItem('auth_token', data.token)
      window.dispatchEvent(new Event('auth_change'))
      navigate('/settings?new=1')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to set up account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <div className="max-w-sm w-full bg-white rounded-xl border border-stone-200 p-8 shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Welcome to EquineIQ</h1>
          <p className="text-stone-500 text-sm mt-1">Set your password to activate your account.</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-500 bg-red-50 rounded p-2">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Farm / Stable name (optional)</label>
            <input
              type="text"
              value={farmName}
              onChange={e => setFarmName(e.target.value)}
              placeholder="Sunny Acres Farm"
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 text-white py-2 rounded font-medium text-sm hover:bg-brand-900 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Setting up…' : 'Activate account →'}
          </button>
        </form>
      </div>
    </div>
  )
}
