import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Placeholder, ScreenHeader, useToast } from '../components/ui.jsx'
import { scannedItems, recalls } from '../data/mock.js'
import { captureReceipt, isCancel, scanBarcode, setStatusBar, tap } from '../lib/native.js'

/**
 * Receipt | Product picker. The shutter opens the platform camera (native on iOS, browser on web)
 * via src/lib/native.js, then hands the photo / barcode to the result screen in router state.
 */
export function Scan() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('receipt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Light status-bar icons while this dark screen is showing
  useEffect(() => {
    setStatusBar('dark')
    return () => setStatusBar('light')
  }, [])

  const resultPath = mode === 'receipt' ? '/scan/receipt-result' : '/scan/barcode-result'

  const capture = async () => {
    tap()
    setError(null)
    setBusy(true)
    try {
      const state = mode === 'receipt' ? { photo: await captureReceipt() } : { barcode: await scanBarcode() }
      navigate(resultPath, { state })
    } catch (err) {
      if (!isCancel(err)) setError(mode === 'receipt' ? 'Couldn’t open the camera.' : 'Couldn’t scan a barcode.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="camera">
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between' }}>
        <button style={{ color: '#fff', background: 'none', border: 0, fontSize: 22, minWidth: 44, minHeight: 44 }} aria-label="Close" onClick={() => navigate(-1)}>✕</button>
      </div>
      <div className="viewfinder">{mode === 'receipt' ? '🧾' : '▥'}</div>
      <div style={{ width: '100%' }}>
        {error ? (
          <p className="camera-error" role="alert">
            {error} <button onClick={() => navigate(resultPath)}>Use sample result</button>
          </p>
        ) : (
          <p className="camera-hint">{mode === 'receipt' ? 'Take a photo of the whole receipt' : 'Scan the barcode on the package'}</p>
        )}
        <div className="seg">
          <button className={mode === 'receipt' ? 'on' : ''} onClick={() => { setMode('receipt'); setError(null) }}>Receipt</button>
          <button className={mode === 'product' ? 'on' : ''} onClick={() => { setMode('product'); setError(null) }}>Product</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 0' }}>
          <button className="shutter" aria-label="Capture" onClick={capture} disabled={busy} />
        </div>
      </div>
    </div>
  )
}

export function ReceiptResult() {
  const navigate = useNavigate()
  const photo = useLocation().state?.photo
  return (
    <>
      <ScreenHeader title="Scan (Receipt) Result" />
      <div className="screen">
        {/* TODO: run OCR on the photo and match line items against recalls; items below are still mock */}
        {photo && <img className="receipt-photo" src={photo} alt="Captured receipt" />}
        <ul className="check-list">
          {scannedItems.map((i) => (
            <li key={i.id}>
              <span>✔</span>
              <span style={{ flex: 1 }}>{i.label}</span>
              <span>✓</span>
            </li>
          ))}
          <li><strong>✔ 5 Items Verified</strong></li>
        </ul>
        <div className="card" style={{ background: 'var(--warn-bg)', marginTop: 12 }} onClick={() => navigate('/scan/barcode-result')}>
          <span>ⓘ</span>
          <div className="meta">
            <strong>1 Potential Recall</strong>
            <small>(Tap to verify batch)</small>
          </div>
        </div>
        <div className="grow" />
        <Button onClick={() => navigate('/home')}>Attach to Account</Button>
      </div>
    </>
  )
}

export function BarcodeResult() {
  const navigate = useNavigate()
  const barcode = useLocation().state?.barcode
  const [tab, setTab] = useState('info')
  const [toast, showToast] = useToast()
  // TODO: look up the scanned barcode against recalls; until then always shows the first mock recall
  const recall = recalls[0]

  return (
    <>
      <ScreenHeader title="Scan (Barcode) Result" />
      <div className="screen">
        <div className="card">
          <Placeholder size={64} />
          <div className="meta">
            <strong>{recall.name}</strong>
            <small>{barcode ? `Barcode ${barcode}` : 'Size/Variant'}</small>
            <div style={{ marginTop: 6 }}><Badge kind="warn">⚠ Batch found (batch matched)</Badge></div>
            <div style={{ marginTop: 4 }}><Badge kind="safe">● Safe</Badge></div>
          </div>
        </div>

        <div className="tabs">
          <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>Recall Info</button>
          <button className={tab === 'batch' ? 'on' : ''} onClick={() => setTab('batch')}>Batch Match</button>
        </div>

        {tab === 'info' ? (
          <p>{recall.note}</p>
        ) : (
          <p>Batch <strong>{recall.batch}</strong> matches this recall.</p>
        )}
        <p><strong>Expiration Date</strong><br />EXP: 12/2024</p>

        <div className="grow" />
        <div className="stack">
          <Button onClick={() => navigate(`/recalls/${recall.id}`)}>View Recall Details</Button>
          <Button onClick={() => showToast('Refund flow coming soon')}>Find Refund</Button>
        </div>
      </div>
      {toast}
    </>
  )
}
