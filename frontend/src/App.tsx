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
import AuctionCatalog from '@/views/AuctionCatalog'
import AuctionDetail from '@/views/AuctionDetail'
import CreateListing from '@/views/CreateListing'
import SellerDashboard from '@/views/SellerDashboard'
import BuyerDashboard from '@/views/BuyerDashboard'
import VettingQueue from '@/views/admin/VettingQueue'
import BidderApproval from '@/views/admin/BidderApproval'
import Import from '@/views/Import'
import ImportHistory from '@/views/ImportHistory'

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
      {/* Public auction routes — no auth required */}
      {/* /auctions/create MUST be before /auctions/:id */}
      <Route
        path="/auctions/create"
        element={
          <ProtectedRoute>
            <Layout>
              <CreateListing />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auctions/:id"
        element={
          <Layout>
            <AuctionDetail />
          </Layout>
        }
      />
      <Route
        path="/auctions"
        element={
          <Layout>
            <AuctionCatalog />
          </Layout>
        }
      />
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
                <Route path="/my-listings" element={<SellerDashboard />} />
                <Route path="/my-bids" element={<BuyerDashboard />} />
                <Route path="/admin/vetting" element={<VettingQueue />} />
                <Route path="/admin/bidders" element={<BidderApproval />} />
                <Route path="/import" element={<Import />} />
                <Route path="/import/history" element={<ImportHistory />} />
                <Route path="/import/history/:id" element={<ImportHistory />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
