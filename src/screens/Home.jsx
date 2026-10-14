import { useNavigate } from 'react-router-dom'
import { AlertBanner, Badge, Placeholder, TopBar } from '../components/ui.jsx'
import { receipts, recalls } from '../data/mock.js'

export default function Home() {
  const navigate = useNavigate()
  const activeCount = recalls.filter((r) => r.status === 'active').length

  return (
    <>
      <TopBar />
      <AlertBanner count={activeCount} dark />

      <h2>Quick Actions</h2>
      <div className="quick-actions">
        <button onClick={() => navigate('/scan')}><span>🧾</span>Scan Receipt</button>
        <button onClick={() => navigate('/scan')}><span>▥</span>Scan Product</button>
        <button onClick={() => navigate('/recalls')}><span>🔍</span>Check Recalls</button>
      </div>

      <h2>Recent Receipts</h2>
      <div className="stack">
        {receipts.slice(0, 3).map((r) => (
          <div key={r.id} className="card" onClick={() => navigate('/scan/receipt-result')}>
            <Placeholder size={40} />
            <div className="meta">
              <strong>Recent Receipt</strong>
              <small>{r.store}</small>
            </div>
            <div className="right">
              <span>{r.total}</span>
              <Badge kind={r.status === 'alert' ? 'alert' : 'safe'}>{r.status === 'alert' ? 'Alert' : 'Safe'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
