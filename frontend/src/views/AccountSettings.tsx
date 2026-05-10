import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOpenAIKey, saveOpenAIKey, deleteOpenAIKey } from '@/api/settings'
import { createPortal } from '@/api/billing'
import client from '@/api/client'
import type { ImportProvider } from '@/api/import'

export default function AccountSettings() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const isNew = params.get('new') === '1'
  const isUpgraded = params.get('upgraded') === '1'

  const [newKey, setNewKey] = useState('')
  const [keyError, setKeyError] = useState('')
  const [keySuccess, setKeySuccess] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)

  const [providers, setProviders] = useState<ImportProvider[]>([])
  const [providerInputs, setProviderInputs] = useState<Record<string, string>>({})
  const [providerTestResults, setProviderTestResults] = useState<Record<string, string>>({})

  useEffect(() => {
    client.get('/api/settings/providers').then((r) => setProviders(r.data.providers)).catch(() => {})
  }, [])

  const USER_PROVIDERS = ['sporthorse_data', 'equibase'] as const

  async function handleProviderSave(provider: string) {
    const credential = providerInputs[provider]
    if (!credential) return
    await client.post(`/api/settings/providers/${provider}`, { credential })
    const r = await client.get('/api/settings/providers')
    setProviders(r.data.providers)
    setProviderInputs((p) => ({ ...p, [provider]: '' }))
  }

  async function handleProviderTest(provider: string) {
    try {
      const r = await client.post(`/api/settings/providers/${provider}/test`)
      setProviderTestResults((p) => ({ ...p, [provider]: r.data.ok ? 'Connected ✓' : `Failed: ${r.data.message}` }))
    } catch {
      setProviderTestResults((p) => ({ ...p, [provider]: 'Test failed' }))
    }
  }

  async function handleProviderRemove(provider: string) {
    await client.delete(`/api/settings/providers/${provider}`)
    const r = await client.get('/api/settings/providers')
    setProviders(r.data.providers)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['openai-key'],
    queryFn: getOpenAIKey,
  })

  const saveMutation = useMutation({
    mutationFn: saveOpenAIKey,
    onSuccess: (res) => {
      setKeySuccess(`Key saved: ${res.maskedKey}`)
      setNewKey('')
      setKeyError('')
      qc.invalidateQueries({ queryKey: ['openai-key'] })
    },
    onError: (e: any) => {
      setKeyError(e?.response?.data?.error || 'Failed to save key')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOpenAIKey,
    onSuccess: () => {
      setKeySuccess('')
      qc.invalidateQueries({ queryKey: ['openai-key'] })
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setKeyError('')
    setKeySuccess('')
    if (!newKey.startsWith('sk-')) {
      setKeyError('OpenAI keys start with sk-')
      return
    }
    saveMutation.mutate(newKey)
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const { url } = await createPortal()
      window.location.href = url!
    } catch {
      // no-op
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Account Settings</h1>

      {isNew && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          Your account is active! Add your OpenAI API key below to start running breeding analyses.
        </div>
      )}
      {isUpgraded && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          Subscription updated successfully.
        </div>
      )}

      {/* OpenAI API Key */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-stone-900">OpenAI API Key</h2>
          <p className="text-xs text-stone-500 mt-1">
            EquineIQ uses your own OpenAI key for AI breeding analysis. Your key is encrypted at rest.
            Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a>.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : (
          <>
            {data?.hasKey && (
              <div className="flex items-center justify-between bg-stone-50 rounded p-3">
                <div>
                  <p className="text-xs text-stone-500">Current key</p>
                  <p className="font-mono text-sm text-stone-700">{data.maskedKey}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <input
                type="password"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder={data?.hasKey ? 'Enter new key to replace' : 'sk-…'}
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-700"
              />
              {keyError && <p className="text-xs text-red-500">{keyError}</p>}
              {keySuccess && <p className="text-xs text-green-600">{keySuccess}</p>}
              <button
                type="submit"
                disabled={saveMutation.isPending || !newKey}
                className="bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-900 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : data?.hasKey ? 'Update key' : 'Save key'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Data Sources */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-stone-900">Data Sources</h2>
          <p className="text-xs text-stone-500 mt-1">Connect external data providers to import horse sale data.</p>
        </div>
        {USER_PROVIDERS.map((provider) => {
          const saved = providers.find((p) => p.provider === provider && !p.platformManaged)
          const displayName = provider === 'sporthorse_data' ? 'SporthorseData' : 'Equibase'
          return (
            <div key={provider} className="border border-stone-100 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-800 text-sm">{displayName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${saved ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                  {saved ? 'Connected ✓' : 'Not configured'}
                </span>
              </div>
              {saved && (
                <p className="font-mono text-xs text-stone-500">{saved.maskedCredential}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={providerInputs[provider] ?? ''}
                  onChange={(e) => setProviderInputs((p) => ({ ...p, [provider]: e.target.value }))}
                  placeholder="API key or token"
                  className="flex-1 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                />
                <button onClick={() => handleProviderSave(provider)} disabled={!providerInputs[provider]} className="text-xs bg-brand-700 text-white px-3 py-1 rounded disabled:opacity-40">Save</button>
                {saved && <button onClick={() => handleProviderTest(provider)} className="text-xs border border-stone-200 px-3 py-1 rounded">Test</button>}
                {saved && <button onClick={() => handleProviderRemove(provider)} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
              </div>
              {providerTestResults[provider] && (
                <p className={`text-xs ${providerTestResults[provider].startsWith('Connected') ? 'text-green-600' : 'text-red-500'}`}>
                  {providerTestResults[provider]}
                </p>
              )}
            </div>
          )
        })}
        {/* TJCIS / Equineline — platform-managed, read-only */}
        {(() => {
          const tjcis = providers.find((p) => p.provider === 'tjcis')
          return (
            <div className="border border-stone-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-800 text-sm">Equineline (Platform)</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${tjcis?.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                  {tjcis?.active ? 'Connected — Platform' : 'Pending partnership agreement'}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1">Managed by EquineIQ — no action required.</p>
            </div>
          )
        })()}
      </div>

      {/* Subscription */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-stone-900">Subscription</h2>
          {data && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                data.plan === 'free' ? 'bg-stone-100 text-stone-600' :
                data.plan === 'breeder' ? 'bg-blue-100 text-blue-800' :
                data.plan === 'professional' ? 'bg-purple-100 text-purple-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} plan
              </span>
              {data.subscriptionStatus && data.subscriptionStatus !== 'active' && (
                <span className="text-xs text-amber-600">{data.subscriptionStatus}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {data?.plan === 'free' ? (
            <a href="/pricing" className="bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-900">
              Upgrade plan →
            </a>
          ) : (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50 disabled:opacity-50"
            >
              {portalLoading ? 'Loading…' : 'Manage billing →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
