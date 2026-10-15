import { useRef, useState, type ReactNode } from 'react'
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
import { useProducts } from '@/hooks/use-products'
import { markOnboarded } from '@/lib/storage'
import { isApiError } from '@/services/errors'
import type { UserProfile } from '@/types'

const errorMessage = (err: unknown) => (isApiError(err) ? err.message : 'Something went wrong. Please try again.')

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Screen insetTop narrow>
      <div className="mt-2 flex justify-center desktop:mt-8">
        <Logo />
      </div>
      <PageTitle>{title}</PageTitle>
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

/** Apple / Google. Text-only for now: real buttons must follow Apple's and Google's brand guidelines. */
function SocialSignIn({ onSignedIn }: { onSignedIn: (user: UserProfile) => void }) {
  const social = useSocialSignIn()
  const signIn = (provider: 'apple' | 'google') =>
    social.mutate(provider, { onSuccess: onSignedIn, onError: (err) => toast(errorMessage(err)) })
  const base = 'h-12 w-full border-[1.5px] text-[15px] font-semibold normal-case tracking-normal'
  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="ghost"
        className={`${base} border-black bg-black text-white hover:bg-black/85 hover:text-white`}
        disabled={social.isPending}
        onClick={() => signIn('apple')}
      >
        Continue with Apple
      </Button>
      <Button
        variant="ghost"
        className={`${base} border-input bg-card`}
        disabled={social.isPending}
        onClick={() => signIn('google')}
      >
        Continue with Google
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

  const onSubmit = form.handleSubmit((values) =>
    signIn.mutate(values, {
      onSuccess: (u) => afterAuth(u, 'Welcome back'),
      onError: (err) => form.setError('root', { message: errorMessage(err) }),
    }),
  )

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
      <SocialSignIn onSignedIn={(u) => afterAuth(u, 'Welcome back')} />
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
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })

export function SignUp() {
  const user = useCurrentUser().data
  const guestItems = useProducts().data?.length ?? 0
  const signUp = useSignUp()
  const { afterAuth, justSignedIn } = useAfterAuth()
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  })
  const { errors } = form.formState

  if (user && !user.isGuest && !justSignedIn.current) return <Navigate to="/profile" replace />

  const onSubmit = form.handleSubmit(({ name, email, password }) =>
    signUp.mutate(
      { name, email, password },
      {
        onSuccess: (u) => afterAuth(u, 'Welcome'),
        onError: (err) => form.setError('root', { message: errorMessage(err) }),
      },
    ),
  )

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
      <SocialSignIn onSignedIn={(u) => afterAuth(u, 'Welcome')} />
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
        <FormError message={errors.root?.message} />
        <Button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {guestItems > 0
            ? 'Your scans, alerts and saved recalls from this device will be kept.'
            : 'An account keeps your scans and alerts across devices.'}
        </p>
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

  const onSubmit = form.handleSubmit(({ email }) =>
    reset.mutate(email, {
      onSuccess: () => setSentTo(email),
      onError: (err) => form.setError('root', { message: errorMessage(err) }),
    }),
  )

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
