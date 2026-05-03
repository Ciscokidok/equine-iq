import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import Login from '@/views/Login'
import Dashboard from '@/views/Dashboard'
import MareProfile from '@/views/MareProfile'
import MareForm from '@/views/MareForm'
import MatingAdvisor from '@/views/MatingAdvisor'
import Pairings from '@/views/Pairings'
import StallionCatalog from '@/views/StallionCatalog'
import PedigreeView from '@/views/PedigreeView'
import StallionDetail from '@/views/StallionDetail'
import StallionCompare from '@/views/StallionCompare'
import FoalTracker from '@/views/FoalTracker'
import HeatCycleView from '@/views/HeatCycleView'
import Pricing from '@/views/Pricing'
import ClaimAccount from '@/views/ClaimAccount'
import AccountSettings from '@/views/AccountSettings'

function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  useEffect(() => {
    const sync = () => setToken(localStorage.getItem('auth_token'))
    window.addEventListener('auth_change', sync)
    return () => window.removeEventListener('auth_change', sync)
  }, [])
  return !!token
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authed = useAuth()
  if (!authed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/account/claim" element={<ClaimAccount />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<AccountSettings />} />
                <Route path="/mares/new" element={<MareForm />} />
                <Route path="/mares/:id" element={<MareProfile />} />
                <Route path="/mares/:id/edit" element={<MareForm />} />
                <Route path="/advisor" element={<MatingAdvisor />} />
                <Route path="/mares/:id/advisor" element={<MatingAdvisor />} />
                <Route path="/mares/:id/heat-cycles" element={<HeatCycleView />} />
                <Route path="/pairings" element={<Pairings />} />
                {/* /stallions/compare MUST be before /stallions/:id */}
                <Route path="/stallions/compare" element={<StallionCompare />} />
                <Route path="/stallions/:id" element={<StallionDetail />} />
                <Route path="/stallions" element={<StallionCatalog />} />
                <Route path="/horses/:id/pedigree" element={<PedigreeView />} />
                <Route path="/foals" element={<FoalTracker />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
