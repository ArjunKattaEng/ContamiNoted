import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { tap } from '../lib/native.js'

export function Button({ variant = 'primary', children, ...props }) {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  )
}

export function Logo({ large = false }) {
  return (
    <div className={`brand ${large ? 'brand-lg' : ''}`}>
      <span className="logo-mark">🛡</span>
      <span>RecallGuard</span>
    </div>
  )
}

export function TopBar() {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      <Logo />
      <div className="topbar-actions">
        <button aria-label="Search" onClick={() => navigate('/recalls')}>🔍</button>
        <button aria-label="Profile" onClick={() => navigate('/profile')}>👤</button>
      </div>
    </header>
  )
}

export function ScreenHeader({ title, right }) {
  const navigate = useNavigate()
  return (
    <header className="screen-header">
      <button aria-label="Back" onClick={() => navigate(-1)}>‹</button>
      <h1>{title}</h1>
      <div className="screen-header-right">{right}</div>
    </header>
  )
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => { tap(); onChange(e.target.checked) }} />
      <span className="toggle" aria-hidden="true" />
    </label>
  )
}

export function Badge({ kind = 'safe', children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>
}

export function AlertBanner({ count, dark = false }) {
  return (
    <Link to="/recalls" className={`alert-banner ${dark ? 'dark' : ''}`}>
      ⚠ Active Alerts ({count})
    </Link>
  )
}

/** Non-blocking status message (replaces window.alert, which looks out of place in the iOS app). */
export function useToast() {
  const [message, setMessage] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = (text) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), 2200)
  }
  const toast = message && <div className="toast" role="status">{message}</div>
  return [toast, show]
}

export function Placeholder({ size = 56 }) {
  return <div className="placeholder" style={{ width: size, height: size }} />
}

const navItems = [
  { to: '/home', label: 'Home', icon: '⌂' },
  { to: '/receipts', label: 'Receipts', icon: '🧾' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span>{n.icon}</span>
          <small>{n.label}</small>
        </NavLink>
      ))}
    </nav>
  )
}

/** Layout for screens that show the bottom tab bar. */
export function WithNav() {
  return (
    <>
      <main className="content">
        <Outlet />
      </main>
      <BottomNav />
    </>
  )
}
