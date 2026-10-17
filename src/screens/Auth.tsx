import { forwardRef, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { FormField } from '@/components/FormField'
import { Logo } from '@/components/Logo'
import { PageTitle, Screen } from '@/components/Screen'
import { useCurrentUser, useResetPassword, useSignIn, useSignUp, useSocialSignIn } from '@/hooks/use-auth'
import { features } from '@/lib/features'
import { useProducts } from '@/hooks/use-products'
import { useSavedRecalls } from '@/hooks/use-saved'
import { isNative } from '@/lib/native'
import { markOnboarded } from '@/lib/storage'
import { isApiError } from '@/services/errors'
import type { UserProfile } from '@/types'

const errorMessage = (err: unknown) => (isApiError(err) ? err.message : 'Something went wrong. Please try again.')
/** The user closed the Google window: nothing to say. */
const isCancelled = (err: unknown) => isApiError(err) && err.code === 'cancelled'

// Until accounts are live (features.accounts), these screens are placeholders: forms validate,
// but nothing is created or stored, and submitting explains that accounts are coming soon.
const accountsLive = features.accounts
const COMING_SOON = 'Accounts are coming soon. Sign-up and log-in aren’t available yet.'
const showComingSoon = () => toast(COMING_SOON)

function ComingSoonNotice() {
  if (accountsLive) return null
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-dashed bg-card px-3 py-2 text-center text-[13px] text-muted-foreground"
    >
      <span className="font-bold">Coming soon.</span> Accounts aren’t available yet. Your scans, alerts and saved
      recalls stay on this device for now.
    </p>
  )
}

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Screen insetTop narrow>
      <div className="mt-2 flex justify-center desktop:mt-8">
        <Logo />
      </div>
      <PageTitle>{title}</PageTitle>
      <ComingSoonNotice />
      {children}
      {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
    </Screen>
  )
}

function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
      {message}
    </p>
  )
}

/**
 * The official Google "G" mark, if it has been added (public/brand/google-g.svg, downloaded from Google's
 * sign-in branding guidelines; we don't redraw it). Without the file the button is text-only.
 */
function GoogleMark() {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  return <img src="/brand/google-g.svg" alt="" aria-hidden className="size-5" onError={() => setMissing(true)} />
}

/**
 * Google sign-in, in a popup. Not offered in the iOS app (Google blocks its sign-in page inside app web views;
 * that needs a native plugin, and Sign in with Apple alongside it). Sign in with Apple isn't built yet.
 * `beforeSignIn` can stop it (e.g. the age check on sign-up) by returning false.
 */
function SocialSignIn({
  onSignedIn,
  onError,
  beforeSignIn,
}: {
  onSignedIn: (user: UserProfile) => void
  onError: (message: string) => void
  beforeSignIn?: () => boolean
}) {
  const social = useSocialSignIn()
  if (isNative) return null
  const signIn = () => {
    if (!accountsLive) return showComingSoon()
    if (beforeSignIn && !beforeSignIn()) return
    social.mutate(undefined, {
      onSuccess: onSignedIn,
      onError: (err) => {
        if (!isCancelled(err)) onError(errorMessage(err))
      },
    })
  }
  return (
    <div className="flex flex-col gap-2.5">
      <Button variant="social" disabled={social.isPending} onClick={signIn}>
        {accountsLive && <GoogleMark />}
        {social.isPending ? 'Signing in…' : 'Continue with Google'}
      </Button>
      <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

/**
 * After signing in: go back to the page that sent us here, else Home. `justSignedIn` lets the
 * page skip its "already signed in → Profile" redirect, which would otherwise win the race.
 */
function useAfterAuth() {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/home'
  const justSignedIn = useRef(false)
  const afterAuth = (user: UserProfile, verb: 'Welcome back' | 'Welcome') => {
    justSignedIn.current = true
    markOnboarded()
    toast(`${verb}${user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}`)
    navigate(from, { replace: true })
  }
  return { afterAuth, justSignedIn }
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export function Login() {
  const user = useCurrentUser().data
  const signIn = useSignIn()
  const { afterAuth, justSignedIn } = useAfterAuth()
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState

  if (user && !user.isGuest && !justSignedIn.current) return <Navigate to="/profile" replace />

  const onSubmit = form.handleSubmit((values) => {
    if (!accountsLive) return showComingSoon()
    signIn.mutate(values, {
      onSuccess: (u) => afterAuth(u, 'Welcome back'),
      onError: (err) => form.setError('root', { message: errorMessage(err) }),
    })
  })

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          New to RecallGuard?{' '}
          <Link to="/signup" className="font-bold underline underline-offset-2">
            Create an account
          </Link>
          <div className="mt-3">
            <Link to="/home" className="text-muted-foreground underline underline-offset-2">
              Continue as guest
            </Link>
          </div>
        </>
      }
    >
      <SocialSignIn
        onSignedIn={(u) => afterAuth(u, 'Welcome back')}
        onError={(message) => form.setError('root', { message })}
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Link to="/forgot-password" className="self-end text-xs font-bold underline underline-offset-2">
          Forgot password?
        </Link>
        <FormError message={errors.root?.message} />
        <Button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Logging in…' : 'Log in'}
        </Button>
        {accountsLive && (
          <p className="text-center text-xs text-muted-foreground">
            Anything saved on this device moves into your account when you log in.
          </p>
        )}
      </form>
    </AuthLayout>
  )
}

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name'),
    email: z.string().trim().email('Enter a valid email address'),
    password: z.string().min(6, 'Use at least 6 characters'),
    confirm: z.string(),
    oldEnough: z.boolean().refine((v) => v, 'Accounts are for people 13 and older'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })

/** Age confirmation for sign-up (accounts are for people 13 and older). */
const AgeCheck = forwardRef<HTMLInputElement, ComponentProps<'input'> & { error?: string }>(({ error, ...props }, ref) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="size-4 accent-primary"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        I’m 13 or older
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})
AgeCheck.displayName = 'AgeCheck'

export function SignUp() {
  const user = useCurrentUser().data
  const guestItems = (useProducts().data?.length ?? 0) + (useSavedRecalls().data?.length ?? 0)
  const signUp = useSignUp()
  const { afterAuth, justSignedIn } = useAfterAuth()
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '', oldEnough: false },
  })
  const { errors } = form.formState

  if (user && !user.isGuest && !justSignedIn.current) return <Navigate to="/profile" replace />

  const onSubmit = form.handleSubmit(({ name, email, password }) => {
    if (!accountsLive) return showComingSoon()
    signUp.mutate(
      { name, email, password },
      {
        onSuccess: (u) => afterAuth(u, 'Welcome'),
        onError: (err) => form.setError('root', { message: errorMessage(err) }),
      },
    )
  })

  return (
    <AuthLayout
      title="Create account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-bold underline underline-offset-2">
            Log in
          </Link>
        </>
      }
    >
      <p className="mb-3 text-center text-xs text-muted-foreground">
        {!accountsLive
          ? 'An account will keep your scans, alerts and saved recalls on all your devices.'
          : guestItems > 0
            ? 'Your scans, alerts and saved recalls from this device will move into your account.'
            : 'An account keeps your scans, alerts and saved recalls on all your devices.'}{' '}
        <Link to="/privacy" className="underline underline-offset-2">
          What we store
        </Link>
      </p>
      <SocialSignIn
        onSignedIn={(u) => afterAuth(u, 'Welcome')}
        onError={(message) => form.setError('root', { message })}
        beforeSignIn={() => {
          // Synchronous, so the Google window still opens from the click
          if (form.getValues('oldEnough')) return true
          form.setError('oldEnough', { message: 'Tick “I’m 13 or older” first: accounts are for people 13 and older' })
          form.setFocus('oldEnough')
          return false
        }}
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <FormField label="Name" autoComplete="name" error={errors.name?.message} {...form.register('name')} />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register('confirm')}
        />
        <AgeCheck
          error={errors.oldEnough?.message}
          {...form.register('oldEnough', { onChange: () => form.clearErrors('oldEnough') })}
        />
        <FormError message={errors.root?.message} />
        <Button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}

const resetSchema = z.object({ email: z.string().trim().email('Enter a valid email address') })

export function ForgotPassword() {
  const reset = useResetPassword()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(({ email }) => {
    if (!accountsLive) return showComingSoon()
    reset.mutate(email, {
      onSuccess: () => setSentTo(email),
      onError: (err) => form.setError('root', { message: errorMessage(err) }),
    })
  })

  return (
    <AuthLayout
      title="Reset password"
      footer={
        <Link to="/login" className="font-bold underline underline-offset-2">
          Back to log in
        </Link>
      }
    >
      {sentTo ? (
        <div className="flex flex-col items-center gap-2 text-center" role="status">
          <MailCheck className="size-10 text-success" strokeWidth={1.5} aria-hidden />
          <strong>Check your email</strong>
          <p className="text-sm text-muted-foreground">
            If an account exists for {sentTo}, we’ve sent a link to reset your password.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <p className="text-sm text-muted-foreground">Enter your account email and we’ll send you a reset link.</p>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            error={errors.email?.message}
            {...form.register('email')}
          />
          <FormError message={errors.root?.message} />
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
