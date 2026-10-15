import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/PageLoader'
import { WithNav } from '@/components/WithNav'
import Home from '@/screens/Home'

// Home ships in the main bundle (most launches land there); other screens load on demand.
const Splash = lazy(() => import('@/screens/Onboarding').then((m) => ({ default: m.Splash })))
const Walkthrough = lazy(() => import('@/screens/Onboarding').then((m) => ({ default: m.Walkthrough })))
const Login = lazy(() => import('@/screens/Auth').then((m) => ({ default: m.Login })))
const SignUp = lazy(() => import('@/screens/Auth').then((m) => ({ default: m.SignUp })))
const ForgotPassword = lazy(() => import('@/screens/Auth').then((m) => ({ default: m.ForgotPassword })))
const Scan = lazy(() => import('@/screens/Scan').then((m) => ({ default: m.Scan })))
const ReceiptResult = lazy(() => import('@/screens/ScanResults').then((m) => ({ default: m.ReceiptResult })))
const BarcodeResult = lazy(() => import('@/screens/ScanResults').then((m) => ({ default: m.BarcodeResult })))
const ReceiptHistory = lazy(() => import('@/screens/History').then((m) => ({ default: m.ReceiptHistory })))
const ScannedProducts = lazy(() => import('@/screens/History').then((m) => ({ default: m.ScannedProducts })))
const Recalls = lazy(() => import('@/screens/Recalls').then((m) => ({ default: m.Recalls })))
const RecallDetail = lazy(() => import('@/screens/Recalls').then((m) => ({ default: m.RecallDetail })))
const Alerts = lazy(() => import('@/screens/Alerts').then((m) => ({ default: m.Alerts })))
const Profile = lazy(() => import('@/screens/Profile').then((m) => ({ default: m.Profile })))

export default function App() {
  return (
    // Phones/tablets: full-screen pages with a bottom tab bar. Desktop: sidebar layout (see AppShell).
    <div className="app-shell relative flex w-full flex-col overflow-hidden bg-background">
      <ErrorBoundary>
        {/* Layouts have their own Suspense around <Outlet>, so the sidebar / tab bar stay put while a screen loads */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Onboarding & auth */}
            <Route path="/" element={<Splash />} />
            <Route path="/walkthrough/:step" element={<Walkthrough />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Camera: full-screen everywhere */}
            <Route path="/scan" element={<Scan />} />

            {/* App: desktop sidebar on every page */}
            <Route element={<AppShell />}>
              {/* Tab screens: bottom tab bar on phones/tablets */}
              <Route element={<WithNav />}>
                <Route path="/home" element={<Home />} />
                <Route path="/receipts" element={<ReceiptHistory />} />
                <Route path="/products" element={<ScannedProducts />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Full-screen on phones/tablets (back button, no tab bar) */}
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/recalls" element={<Recalls />} />
              <Route path="/recalls/:recallNumber" element={<RecallDetail />} />
              <Route path="/scan/receipt/:scanId" element={<ReceiptResult />} />
              <Route path="/scan/barcode/:scanId" element={<BarcodeResult />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </div>
  )
}
