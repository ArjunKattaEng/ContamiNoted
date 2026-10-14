import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ScreenHeader, Toggle } from '../components/ui.jsx'

export function Profile() {
  const navigate = useNavigate()
  return (
    <>
      <h1 className="page-title">Profile</h1>
      <Link to="/profile/pos" className="menu-row">Integrated POS <span>›</span></Link>
      <Link to="/profile/fda-sync" className="menu-row">FDA Sync Status <span>›</span></Link>
      <Link to="/profile/notifications" className="menu-row">Notifications <span>›</span></Link>
      <div style={{ marginTop: 24 }}>
        <Button variant="secondary" onClick={() => navigate('/login')}>Log out</Button>
      </div>
    </>
  )
}

export function IntegratedPOS() {
  const [sync, setSync] = useState(true)
  return (
    <>
      <ScreenHeader title="Integrated POS" />
      <div className="screen">
        <Toggle label="Settings" description="Manage linked loyalty cards" checked={sync} onChange={setSync} />
        <Link to="/profile/pos" className="menu-row">Linked Loyalty Cards <span>›</span></Link>
        <Link to="/profile/pos" className="menu-row">View POS Integration Details <span>›</span></Link>
        <p className="status-line">POS Sync: {sync ? 'Active' : 'Paused'}</p>
      </div>
    </>
  )
}

export function FDASync() {
  const [auto, setAuto] = useState(true)
  return (
    <>
      <ScreenHeader title="FDA Sync Status" />
      <div className="screen">
        <Toggle label="Settings" description="Manage frequency of FDA updates" checked={auto} onChange={setAuto} />
        <p className="status-line">FDA Data: Up-to-date</p>
      </div>
    </>
  )
}

export function Notifications() {
  const [prefs, setPrefs] = useState({ recall: true, batch: false, expiry: false })
  const set = (k) => (v) => setPrefs({ ...prefs, [k]: v })
  return (
    <>
      <ScreenHeader title="Notifications" />
      <div className="screen">
        <Toggle label="Recall Matches" checked={prefs.recall} onChange={set('recall')} />
        <Toggle label="Batch Match confirmations" checked={prefs.batch} onChange={set('batch')} />
        <Toggle label="Expiration Alerts" checked={prefs.expiry} onChange={set('expiry')} />
      </div>
    </>
  )
}
