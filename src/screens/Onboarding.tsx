import { BellRing, Receipt, ScanBarcode, type LucideIcon } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { Screen } from '@/components/Screen'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { hasOnboarded, markOnboarded } from '@/lib/storage'
import { cn } from '@/lib/utils'

const walkthrough: { icon: LucideIcon; text: string }[] = [
  { icon: BellRing, text: 'Stay informed with real-time FDA Recall Alerts.' },
  { icon: Receipt, text: 'Scan receipts to check past purchases for recalled items.' },
  { icon: ScanBarcode, text: 'Scan products to check them against recall notices, and get alerted about new ones.' },
]

/** First launch only; afterwards "/" goes straight to Home. */
export function Splash() {
  useDocumentTitle()
  const navigate = useNavigate()
  if (hasOnboarded()) return <Navigate to="/home" replace />
  return (
    <Screen center insetTop narrow>
      <div className="grid flex-1 place-items-center">
        <Logo large />
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button onClick={() => navigate('/walkthrough/1')}>Get Started</Button>
        <Button
          variant="ghost"
          onClick={() => {
            markOnboarded()
            navigate('/login')
          }}
        >
          I already have an account
        </Button>
      </div>
    </Screen>
  )
}

export function Walkthrough() {
  useDocumentTitle('Welcome')
  const navigate = useNavigate()
  const step = Number(useParams().step)
  const slide = walkthrough[step - 1] ?? walkthrough[0]
  const last = step >= walkthrough.length
  const Icon = slide.icon

  const finish = (to: string) => {
    markOnboarded()
    navigate(to, { replace: true })
  }

  return (
    <Screen center insetTop narrow>
      <div className="flex w-full justify-end">
        {!last && (
          <Button variant="ghost" size="sm" onClick={() => finish('/home')}>
            Skip
          </Button>
        )}
      </div>
      <div className="grid flex-1 place-items-center content-center">
        <Icon className="mb-6 size-24" strokeWidth={1.25} aria-hidden />
        <p className="max-w-[260px] font-bold leading-snug">{slide.text}</p>
        <div className="my-6 flex justify-center gap-1.5" aria-label={`Step ${step} of ${walkthrough.length}`}>
          {walkthrough.map((_, i) => (
            <span key={i} className={cn('size-1.5 rounded-full bg-border', i === step - 1 && 'bg-primary')} />
          ))}
        </div>
      </div>
      <div className="flex w-full flex-col gap-3">
        {last ? (
          <>
            <Button onClick={() => finish('/home')}>Start checking</Button>
            <Button variant="secondary" onClick={() => finish('/signup')}>
              Create an account
            </Button>
            <p className="text-xs text-muted-foreground">
              No account needed to start. You can sign up later to keep your history.
            </p>
          </>
        ) : (
          <Button onClick={() => navigate(`/walkthrough/${step + 1}`)}>Next</Button>
        )}
      </div>
    </Screen>
  )
}
