import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from '@/api/billing'
import client from '@/api/client'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Try the basics',
    features: ['1 AI analysis per month', 'Up to 3 mares', 'Top 3 stallion matches', 'Stallion catalog browse'],
    cta: 'Get started free',
    highlight: false,
  },
  {
    id: 'breeder',
    name: 'Breeder',
    price: 29,
    description: 'For serious breeders',
    features: ['5 AI analyses per month', 'Unlimited mares', 'Top 5 stallion matches', 'Full AI analysis + scores', 'Heat cycle tracking', 'Foal tracker'],
    cta: 'Start Breeder',
    highlight: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 79,
    description: 'For stud farm managers',
    features: ['Unlimited AI analyses', 'Top 10 stallion matches', 'Save & share sessions', 'PDF export', 'Priority support'],
    cta: 'Start Professional',
    highlight: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    description: 'For breeding operations',
    features: ['Everything in Professional', 'All stallion matches', 'API access', 'Bulk mare processing', 'Dedicated onboarding'],
    cta: 'Contact us',
    highlight: false,
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [showEmailFor, setShowEmailFor] = useState<string | null>(null)
  const isAuthed = !!localStorage.getItem('auth_token')

  async function startCheckout(planId: string, emailOverride?: string) {
    setLoading(planId)
    setError('')
    try {
      const body = emailOverride ? { email: emailOverride } : {}
      const { data } = await client.post<{ url: string }>(`/api/billing/checkout/${planId}`, body)
      window.location.href = data.url!
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not start checkout')
    } finally {
      setLoading(null)
    }
  }

  async function handleSelect(planId: string) {
    if (planId === 'free') {
      navigate('/login')
      return
    }
    if (planId === 'enterprise') {
      window.location.href = 'mailto:hello@equineiq.com?subject=Enterprise Inquiry'
      return
    }

    if (isAuthed) {
      await startCheckout(planId)
      return
    }

    // New user — collect email first
    setShowEmailFor(planId)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!showEmailFor || !email) return
    await startCheckout(showEmailFor, email)
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const { url } = await createPortal()
      window.location.href = url!
    } catch {
      // no-op
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-stone-900">Simple, transparent pricing</h1>
        <p className="mt-2 text-stone-500">
          Bring your own OpenAI API key — you pay OpenAI directly, we charge only for the platform.
        </p>
      </div>

      {error && <p className="mb-6 text-center text-red-500 text-sm">{error}</p>}

      {showEmailFor && (
        <div className="mb-8 max-w-sm mx-auto bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-stone-900 mb-1">Enter your email</h2>
          <p className="text-xs text-stone-500 mb-4">
            After payment, we'll send you a link to set your password and activate your account.
          </p>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!!loading}
                className="flex-1 bg-brand-700 text-white py-2 rounded text-sm font-medium hover:bg-brand-900 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Continue to payment →'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailFor(null)}
                className="px-3 py-2 border border-stone-200 rounded text-sm text-stone-500 hover:bg-stone-50"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-6 flex flex-col ${plan.highlight ? 'border-brand-700 ring-2 ring-brand-700 bg-brand-50' : 'border-stone-200 bg-white'}`}
          >
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{plan.description}</p>
              <h2 className={`text-xl font-bold mt-1 ${plan.highlight ? 'text-brand-900' : 'text-stone-900'}`}>{plan.name}</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-stone-900">${plan.price}</span>
                {plan.price > 0 && <span className="text-stone-400 text-sm">/mo</span>}
              </div>
            </div>

            <ul className="flex-1 space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect(plan.id)}
              disabled={loading === plan.id}
              className={`w-full py-2 rounded font-medium text-sm transition-colors ${
                plan.highlight
                  ? 'bg-brand-700 text-white hover:bg-brand-900'
                  : 'border border-stone-200 text-stone-700 hover:bg-stone-50'
              } disabled:opacity-50`}
            >
              {loading === plan.id ? 'Loading…' : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {isAuthed && (
        <div className="mt-8 text-center">
          <button
            onClick={handlePortal}
            disabled={loading === 'portal'}
            className="text-sm text-stone-500 hover:text-stone-800 underline"
          >
            {loading === 'portal' ? 'Loading…' : 'Manage existing subscription →'}
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-stone-400">
        All plans require your own OpenAI API key.{' '}
        <a href="/settings" className="underline">Add it in Account Settings</a> after signing up.
      </p>
    </div>
  )
}
