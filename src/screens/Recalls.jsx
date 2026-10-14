import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Placeholder, ScreenHeader, useToast } from '../components/ui.jsx'
import { recalls as seed } from '../data/mock.js'
import { isCancel, shareRecall, tap } from '../lib/native.js'

/** Active / Past recalls list (tabs match the two wireframe variants). */
export function ActiveRecalls() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')
  const [items, setItems] = useState(seed)
  const shown = items.filter((r) => (tab === 'active' ? r.status === 'active' : r.status === 'resolved'))
  const toggleStar = (id) => {
    tap()
    setItems(items.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r)))
  }

  return (
    <>
      <ScreenHeader title="Active Recalls" />
      <div className="screen">
        <div className="tabs">
          <button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>Active</button>
          <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>Resolved</button>
        </div>
        <div className="stack">
          {shown.length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No items remaining.</p>}
          {shown.map((r) => (
            <div key={r.id} className="card" onClick={() => navigate(`/recalls/${r.id}`)}>
              <Placeholder size={48} />
              <div className="meta">
                <strong>{r.name}</strong>
                <small>Date: {r.date}</small><br />
                <small>Risk Level: {r.risk}</small>
              </div>
              <div className="right">
                <button
                  style={{ background: 'none', border: 0, fontSize: 18 }}
                  onClick={(e) => { e.stopPropagation(); toggleStar(r.id) }}
                  aria-label="Star"
                >
                  {r.starred ? '★' : '☆'}
                </button>
                <Badge kind={r.match ? 'alert' : 'safe'}>{r.match ? 'Match' : 'No match'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function RecallDetail() {
  const { id } = useParams()
  const recall = seed.find((r) => r.id === id) ?? seed[0]
  const [tab, setTab] = useState('info')
  const [toast, showToast] = useToast()

  const share = async () => {
    try {
      if ((await shareRecall(recall)) === 'copied') showToast('Alert copied to clipboard')
    } catch (err) {
      if (!isCancel(err)) showToast('Couldn’t share this alert')
    }
  }

  return (
    <>
      <ScreenHeader title="Recall Details" />
      <div className="screen">
        <div className="alert-banner">⚠ Active Alerts (3)</div>
        <small><strong>{recall.fdaId}</strong></small>
        <div style={{ margin: '6px 0' }}><Badge kind="warn">⚠ Batch found (batch matched)</Badge></div>

        <div className="tabs">
          <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>Recall Info</button>
          <button className={tab === 'batch' ? 'on' : ''} onClick={() => setTab('batch')}>Batch Match</button>
        </div>

        {tab === 'info' ? (
          <>
            <div className="card">
              <Placeholder size={72} />
              <div className="meta">
                <strong>{recall.name} with Premium Description</strong>
                <small>{recall.note}</small>
              </div>
            </div>
            <dl className="detail-grid">
              <dt>Date:</dt><dd>{recall.date}</dd>
              <dt>FDA Classification:</dt><dd>{recall.risk}</dd>
              <dt>Affected Batch:</dt><dd>{recall.affected}</dd>
              <dt>Distribution Date:</dt><dd>{recall.distribution}</dd>
            </dl>
          </>
        ) : (
          <p>Your scanned batch <strong>{recall.batch}</strong> {recall.match ? 'matches' : 'does not match'} this recall.</p>
        )}

        <div className="grow" />
        <div className="stack">
          <Button onClick={() => showToast('Refund flow coming soon')}>Find Refund</Button>
          <Button onClick={share}>Share Alert</Button>
        </div>
      </div>
      {toast}
    </>
  )
}
