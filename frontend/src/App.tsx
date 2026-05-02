import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import Layout from '@/components/Layout'
import Dashboard from '@/views/Dashboard'
import MareProfile from '@/views/MareProfile'
import MareForm from '@/views/MareForm'
import MatingAdvisor from '@/views/MatingAdvisor'
import Pairings from '@/views/Pairings'
import StallionCatalog from '@/views/StallionCatalog'

function ProtectedRoutes() {
  return (
    <>
      <SignedIn>
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
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

export default function App() {
  return <ProtectedRoutes />
}
