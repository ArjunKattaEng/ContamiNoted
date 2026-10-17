import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, ExternalLink, LogIn, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { FormField } from '@/components/FormField'
import { MenuRow } from '@/components/MenuRow'
import { PageTitle, Screen, SectionTitle } from '@/components/Screen'
import { ToggleRow } from '@/components/ToggleRow'
import { useLastWatchCheck, useRecheck } from '@/hooks/use-alerts'
import { useCurrentUser, useDeleteAccount, useSignOut } from '@/hooks/use-auth'
import { queryKeys } from '@/hooks/queryKeys'
import { useDataSourceStatus } from '@/hooks/use-meta'
import { useRecheckOnOpenPref } from '@/hooks/use-prefs'
import { useProducts } from '@/hooks/use-products'
import { useSavedRecalls } from '@/hooks/use-saved'
import { formatDate, formatTimeAgo } from '@/lib/format'
import { features } from '@/lib/features'
import { clearLocalSaved } from '@/services/local/saved'
import { clearLocalAlerts } from '@/services/local/alerts'
import { clearLocalScans } from '@/services/local/scans'
import { isApiError } from '@/services/errors'
import type { UserProfile } from '@/types'

const initials = (user: UserProfile) =>
  (user.displayName ?? user.email ?? '?')
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}

/** Shown to guests: everyone until accounts are live, then anyone not signed in. */
function GuestCard() {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border bg-card p-4">
      <strong>You’re using RecallGuard as a guest</strong>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a free account to keep your scans, alerts and saved recalls on all your devices.
      </p>
      {!features.accounts && <p className="mt-1 text-xs text-muted-foreground">Accounts are coming soon.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" className="h-10" onClick={() => navigate('/signup')}>
          <UserPlus /> Sign up
        </Button>
        <Button size="sm" variant="secondary" className="h-10" onClick={() => navigate('/login')}>
          <LogIn /> Log in
        </Button>
      </div>
    </div>
  )
}

function AccountCard({ user }: { user: UserProfile }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <div
        className="grid size-12 flex-none place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
        aria-hidden
      >
        {initials(user)}
      </div>
      <div className="min-w-0">
        <strong className="block truncate">{user.displayName ?? 'Your account'}</strong>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

function AlertSettings() {
  const recheckOnOpen = useRecheckOnOpenPref()
  const recheck = useRecheck()
  const lastCheck = useLastWatchCheck().data

  const checkNow = () =>
    recheck.mutate(undefined, {
      onSuccess: (result) =>
        toast(
          result.skipped
            ? 'Scan a product first: then we can check it for new recalls'
            : result.newAlerts.length === 0
              ? 'No new recalls for your items'
              : `${result.newAlerts.length} new ${result.newAlerts.length === 1 ? 'alert' : 'alerts'} for your items`,
        ),
      onError: () => toast('Couldn’t check for new recalls'),
    })

  return (
    <Section title="Recall alerts">
      <ToggleRow
        label="Re-check my items when I open the app"
        description="Matches the products you’ve scanned against newly announced FDA recalls."
        checked={recheckOnOpen.value ?? false}
        onChange={recheckOnOpen.set}
      />
      <div className="flex items-center justify-between gap-3 border-b px-1 py-3">
        <span className="text-sm text-muted-foreground">
          {lastCheck ? `Last checked ${formatTimeAgo(lastCheck)}` : 'Not checked yet'}
        </span>
        <Button variant="secondary" size="sm" onClick={checkNow} disabled={recheck.isPending}>
          {recheck.isPending ? 'Checking…' : 'Check now'}
        </Button>
      </div>
      <MenuRow to="/alerts">
        <span className="flex items-center gap-2">
          <Bell className="size-4" aria-hidden /> View alerts
        </span>
      </MenuRow>
    </Section>
  )
}

function DataSources() {
  const status = useDataSourceStatus().data
  return (
    <Section title="Data & sources">
      <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
        <p>
          Recalls come from the FDA’s openFDA food enforcement reports
          {status && <> (last updated {formatDate(status.openFdaLastUpdated)})</>}.
        </p>
        <p className="text-muted-foreground">
          Recall summaries are written by AI. Always compare the codes and dates on your package with the official FDA
          notice.
        </p>
        <Link to="/privacy" className="block font-bold underline underline-offset-2">
          What RecallGuard stores
        </Link>
        <a
          href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold underline underline-offset-2"
        >
          FDA recalls website <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </Section>
  )
}

function AccountActions({ user }: { user: UserProfile }) {
  const navigate = useNavigate()
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const passwordField = useRef<HTMLInputElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  // Firebase needs a recent sign-in to delete an account: password users type theirs again, Google users
  // pick their Google account again in a popup
  const needsPassword = !user.isGuest && user.signInMethod === 'password'

  // Opening the panel replaces the button that had focus: move focus into the panel
  useEffect(() => {
    if (confirmDelete) (passwordField.current ?? cancelButton.current)?.focus()
  }, [confirmDelete])

  const closeConfirm = () => {
    setConfirmDelete(false)
    setPassword('')
    setDeleteError(null)
    requestAnimationFrame(() => openButton.current?.focus())
  }

  const onSignOut = () =>
    signOut.mutate(undefined, {
      onSuccess: () => {
        toast('Logged out. Your data is saved in your account.')
        navigate('/home')
      },
      onError: () => toast('Couldn’t log out. Check your connection and try again.'),
    })

  const onDelete = (e: FormEvent) => {
    e.preventDefault()
    if (needsPassword && !password) {
      setDeleteError('Enter your password to delete your account.')
      passwordField.current?.focus()
      return
    }
    setDeleteError(null)
    deleteAccount.mutate(
      { uid: user.uid, ...(needsPassword && { password }) },
      {
        onSuccess: () => {
          toast(user.isGuest ? 'Your data was cleared' : 'Your account was deleted')
          setConfirmDelete(false)
          navigate('/home')
        },
        onError: (err) => {
          if (isApiError(err) && err.code === 'cancelled') return
          setDeleteError(isApiError(err) ? err.message : 'Couldn’t delete your data. Please try again.')
          if (needsPassword) {
            passwordField.current?.focus()
            passwordField.current?.select()
          }
        },
      },
    )
  }

  return (
    <section className="mt-6 space-y-3">
      {!user.isGuest && (
        <Button variant="secondary" onClick={onSignOut} disabled={signOut.isPending}>
          Log out
        </Button>
      )}
      {confirmDelete ? (
        <form
          onSubmit={onDelete}
          role="group"
          aria-labelledby={headingId}
          className="rounded-lg border border-destructive/40 bg-destructive-soft p-4"
          noValidate
        >
          <strong id={headingId} className="text-destructive">
            {user.isGuest ? 'Clear all your data from this device?' : 'Delete your account permanently?'}
          </strong>
          <p className="mt-1 text-sm">
            Your scanned products, alerts and saved recalls will be deleted. This can’t be undone.
            {!user.isGuest && user.signInMethod === 'google' && ' You’ll confirm with your Google account.'}
          </p>
          {needsPassword ? (
            <div className="mt-3">
              {/* For password managers: which account this password belongs to */}
              <input type="email" name="username" autoComplete="username" value={user.email ?? ''} readOnly hidden />
              <FormField
                ref={passwordField}
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={deleteError ?? undefined}
              />
            </div>
          ) : (
            deleteError && (
              <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
                {deleteError}
              </p>
            )
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button ref={cancelButton} type="button" variant="secondary" size="sm" className="h-10" onClick={closeConfirm}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="sm" className="h-10" disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? 'Deleting…' : user.isGuest ? 'Clear data' : 'Delete account'}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={openButton}
          variant="ghost"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          {user.isGuest ? 'Clear my data' : 'Delete account'}
        </Button>
      )}
    </section>
  )
}

/** Inline "Clear …" button that asks for confirmation first. */
function ClearButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" size="sm" className="h-10" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="h-10"
        onClick={() => {
          setConfirming(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}

/** Signed in: the counts of what the account holds (removed one by one, or with the account). */
function SavedInAccount() {
  const saved = useSavedRecalls().data ?? []
  const products = useProducts().data ?? []
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return (
    <Section title="Saved in your account">
      <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
        <p>
          {count(saved.length, 'saved recall', 'saved recalls')}
          {features.history && <>, {count(products.length, 'scanned product', 'scanned products')}</>}. They’re on
          every device you log in on.
        </p>
        <Link to="/privacy" className="font-bold underline underline-offset-2">
          What we store
        </Link>
      </div>
    </Section>
  )
}

/** A guest's saved recalls and scanned products live on this device. */
function SavedOnDevice() {
  const queryClient = useQueryClient()
  const saved = useSavedRecalls().data ?? []
  const products = useProducts().data ?? []

  const clearSaved = () => {
    clearLocalSaved()
    queryClient.invalidateQueries({ queryKey: queryKeys.saved })
    toast('Saved recalls cleared')
  }

  const clearScans = () => {
    clearLocalScans()
    clearLocalAlerts() // alerts point at scanned products
    queryClient.removeQueries({ queryKey: queryKeys.scans.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.products })
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
    queryClient.invalidateQueries({ queryKey: queryKeys.dataSource })
    queryClient.invalidateQueries({ queryKey: queryKeys.lastWatchCheck })
    toast('Scan history and alerts cleared')
  }

  return (
    <Section title="Saved on this device">
      <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <p>
          {saved.length === 0
            ? 'You haven’t saved any recalls yet. Tap the star on a recall to keep it.'
            : `${saved.length} saved ${saved.length === 1 ? 'recall' : 'recalls'}, stored in this browser or app only.`}
        </p>
        {saved.length > 0 && <ClearButton label="Clear saved recalls" confirmLabel="Clear saved" onConfirm={clearSaved} />}
        {features.history && (
          <>
            <p>
              {products.length === 0
                ? 'You haven’t scanned any products yet.'
                : `${products.length} scanned ${products.length === 1 ? 'product' : 'products'}, stored in this browser or app only.`}
            </p>
            {products.length > 0 && (
              <ClearButton label="Clear scan history and alerts" confirmLabel="Clear scans" onConfirm={clearScans} />
            )}
          </>
        )}
      </div>
    </Section>
  )
}

export function Profile() {
  const userQuery = useCurrentUser()
  const user = userQuery.data

  // With accounts, wait for the user: a signed-in user must never see the guest's controls (which act on the
  // device), even for a moment
  if (features.accounts && userQuery.isPending) {
    return (
      <Screen insetTop>
        <PageTitle>Profile</PageTitle>
        <div className="space-y-3 desktop:max-w-2xl" aria-busy="true" aria-label="Loading your profile">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Screen>
    )
  }

  return (
    <Screen insetTop>
      <PageTitle>Profile</PageTitle>
      <div className="desktop:max-w-2xl">
        {user && !user.isGuest ? <AccountCard user={user} /> : <GuestCard />}
        {features.alerts && <AlertSettings />}
        {user && !user.isGuest ? <SavedInAccount /> : <SavedOnDevice />}
        <DataSources />
        {user && <AccountActions key={user.uid} user={user} />}
        <p className="mt-6 text-center text-xs text-muted-foreground">RecallGuard {__APP_VERSION__}</p>
      </div>
    </Screen>
  )
}
