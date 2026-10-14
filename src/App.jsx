import { Routes, Route, Navigate } from 'react-router-dom'
import { WithNav } from './components/ui.jsx'
import { Splash, Walkthrough } from './screens/Onboarding.jsx'
import { Login, SignUp } from './screens/Auth.jsx'
import Home from './screens/Home.jsx'
import { Scan, ReceiptResult, BarcodeResult } from './screens/Scan.jsx'
import { ReceiptHistory, ScannedProducts } from './screens/History.jsx'
import { ActiveRecalls, RecallDetail } from './screens/Recalls.jsx'
import { Profile, IntegratedPOS, FDASync, Notifications } from './screens/Settings.jsx'

export default function App() {
  return (
    <div className="phone">
      <Routes>
        {/* Onboarding & auth */}
        <Route path="/" element={<Splash />} />
        <Route path="/walkthrough/:step" element={<Walkthrough />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Tabbed app */}
        <Route element={<WithNav />}>
          <Route path="/home" element={<Home />} />
          <Route path="/receipts" element={<ReceiptHistory />} />
          <Route path="/products" element={<ScannedProducts />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Full-screen flows */}
        <Route path="/scan" element={<Scan />} />
        <Route path="/scan/receipt-result" element={<ReceiptResult />} />
        <Route path="/scan/barcode-result" element={<BarcodeResult />} />
        <Route path="/recalls" element={<ActiveRecalls />} />
        <Route path="/recalls/:id" element={<RecallDetail />} />
        <Route path="/profile/pos" element={<IntegratedPOS />} />
        <Route path="/profile/fda-sync" element={<FDASync />} />
        <Route path="/profile/notifications" element={<Notifications />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
