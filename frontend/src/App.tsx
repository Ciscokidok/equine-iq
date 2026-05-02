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
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/mares/new" element={<MareForm />} />
                <Route path="/mares/:id" element={<MareProfile />} />
                <Route path="/mares/:id/edit" element={<MareForm />} />
                <Route path="/mares/:id/advisor" element={<MatingAdvisor />} />
                <Route path="/pairings" element={<Pairings />} />
                <Route path="/stallions" element={<StallionCatalog />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
