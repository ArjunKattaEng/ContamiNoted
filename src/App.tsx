import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/PageLoader'
import { WithNav } from '@/components/WithNav'
import { canScan, features } from '@/lib/features'
import { FeatureGate } from '@/screens/ComingSoon'
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
            {/* Onboarding & auth. Features without a backend yet render "Coming soon" (src/lib/features.ts) */}
            <Route path="/" element={<Splash />} />
            <Route path="/walkthrough/:step" element={<Walkthrough />} />
            <Route
              path="/login"
              element={
                <FeatureGate on={features.accounts} feature="accounts">
                  <Login />
                </FeatureGate>
              }
            />
            <Route
              path="/signup"
              element={
                <FeatureGate on={features.accounts} feature="accounts">
                  <SignUp />
                </FeatureGate>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <FeatureGate on={features.accounts} feature="accounts">
                  <ForgotPassword />
                </FeatureGate>
              }
            />

            {/* Camera: full-screen everywhere */}
            <Route
              path="/scan"
              element={
                <FeatureGate on={canScan} feature="scan">
                  <Scan />
                </FeatureGate>
              }
            />

            {/* App: desktop sidebar on every page */}
            <Route element={<AppShell />}>
              {/* Tab screens: bottom tab bar on phones/tablets */}
              <Route element={<WithNav />}>
                <Route path="/home" element={<Home />} />
                <Route path="/recalls" element={<Recalls />} />
                <Route
                  path="/receipts"
                  element={
                    <FeatureGate on={features.history} feature="receipts">
                      <ReceiptHistory />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <FeatureGate on={features.history} feature="products">
                      <ScannedProducts />
                    </FeatureGate>
                  }
                />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Full-screen on phones/tablets (back button, no tab bar) */}
              <Route
                path="/alerts"
                element={
                  <FeatureGate on={features.alerts} feature="alerts">
                    <Alerts />
                  </FeatureGate>
                }
              />
              <Route path="/recalls/:recallNumber" element={<RecallDetail />} />
              <Route
                path="/scan/receipt/:scanId"
                element={
                  <FeatureGate on={features.receiptScan} feature="scan">
                    <ReceiptResult />
                  </FeatureGate>
                }
              />
              <Route
                path="/scan/barcode/:scanId"
                element={
                  <FeatureGate on={features.barcodeScan} feature="scan">
                    <BarcodeResult />
                  </FeatureGate>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </div>
  )
}
