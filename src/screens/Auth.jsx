import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Logo } from '../components/ui.jsx'

export function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    // TODO: call your auth API here
    navigate('/home')
  }

  return (
    <form className="screen stack" onSubmit={submit}>
      <h1 className="page-title">Login</h1>
      <input className="input" type="email" placeholder="Email" autoComplete="email" autoCapitalize="none" autoCorrect="off" inputMode="email" value={form.email} onChange={set('email')} required />
      <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={form.password} onChange={set('password')} required />
      <Link to="/login" className="link-small">Forgot password?</Link>
      <Button type="submit">Login</Button>
      <p className="or-line">
        OR <Link to="/signup">SIGN UP</Link>
      </p>
    </form>
  )
}

export function SignUp() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Passwords do not match')
    // TODO: call your sign-up API here
    navigate('/home')
  }

  return (
    <form className="screen stack" onSubmit={submit}>
      <Logo />
      <h1 className="page-title">Sign Up</h1>
      <input className="input" placeholder="Name" autoComplete="name" value={form.name} onChange={set('name')} required />
      <input className="input" type="email" placeholder="Email" autoComplete="email" autoCapitalize="none" autoCorrect="off" inputMode="email" value={form.email} onChange={set('email')} required />
      <input className="input" type="password" placeholder="Password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
      <input className="input" type="password" placeholder="Confirm Password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
      {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{error}</p>}
      <Button type="button" variant="secondary" onClick={() => navigate('/login')}>
        Log in / Sign up
      </Button>
      <Button type="submit">Create Account</Button>
    </form>
  )
}
