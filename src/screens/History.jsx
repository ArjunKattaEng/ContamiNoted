import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Placeholder, ScreenHeader } from '../components/ui.jsx'
import { receipts, stores } from '../data/mock.js'

export function ReceiptHistory() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const list = receipts.filter((r) => `${r.date} ${r.store}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <ScreenHeader title="Receipt History" />
      <div className="filters">
        <select><option>Filter</option><option>Safe</option><option>Alert</option></select>
        <Button className="btn btn-primary btn-sm" variant="primary" style={{ width: 'auto' }}>Filter</Button>
      </div>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="stack" style={{ marginTop: 12 }}>
        {list.map((r) => (
          <div key={r.id} className="card" onClick={() => navigate('/scan/receipt-result')}>
            <Placeholder size={40} />
            <div className="meta">
              <strong>{r.date}</strong>
              <small>{r.store} · {r.items} items</small>
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

export function ScannedProducts() {
  const [q, setQ] = useState('')
  return (
    <>
      <ScreenHeader title="Scanned Products List" />
      <div className="filters">
        <select><option>Exp. date</option></select>
        <select><option>Type</option></select>
      </div>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <h2>Products <span style={{ float: 'right' }}>● ● ●</span></h2>
      <div className="stack">
        {stores.map((s) => (
          <div key={s.id} className="card">
            <Placeholder size={48} />
            <div className="meta"><strong>{s.name}</strong></div>
            <Badge kind={s.connected ? 'safe' : 'warn'}>{s.connected ? 'Connected' : 'Connect Account'}</Badge>
          </div>
        ))}
      </div>
    </>
  )
}
