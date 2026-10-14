import { useNavigate, useParams } from 'react-router-dom'
import { Button, Logo } from '../components/ui.jsx'
import { walkthrough } from '../data/mock.js'

export function Splash() {
  const navigate = useNavigate()
  return (
    <div className="screen center">
      <div className="grow" style={{ display: 'grid', placeItems: 'center' }}>
        <Logo large />
      </div>
      <Button onClick={() => navigate('/walkthrough/1')}>Get Started</Button>
    </div>
  )
}

export function Walkthrough() {
  const navigate = useNavigate()
  const step = Number(useParams().step)
  const slide = walkthrough[step - 1] ?? walkthrough[0]
  const last = step >= walkthrough.length

  return (
    <div className="screen center">
      <div className="grow" style={{ display: 'grid', placeItems: 'center', alignContent: 'center' }}>
        <div className="illustration">{slide.icon}</div>
        <p className="walk-text">{slide.text}</p>
        <div className="dots">
          {walkthrough.map((_, i) => (
            <span key={i} className={i === step - 1 ? 'on' : ''} />
          ))}
        </div>
      </div>
      <div className="stack" style={{ width: '100%' }}>
        <Button onClick={() => navigate(last ? '/login' : `/walkthrough/${step + 1}`)}>Next</Button>
        {last && (
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Sign Up / Log In
          </Button>
        )}
      </div>
    </div>
  )
}
