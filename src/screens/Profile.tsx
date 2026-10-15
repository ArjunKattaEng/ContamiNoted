import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, ExternalLink, LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { MenuRow } from '@/components/MenuRow'
import { PageTitle, Screen, SectionTitle } from '@/components/Screen'
import { ToggleRow } from '@/components/ToggleRow'
import { useRecheck } from '@/hooks/use-alerts'
import { useCurrentUser, useDeleteAccount, useSignOut, useUpdatePrefs } from '@/hooks/use-auth'
import { queryKeys } from '@/hooks/queryKeys'
import { useDataSourceStatus } from '@/hooks/use-meta'
import { useSavedRecalls } from '@/hooks/use-saved'
import { formatDate, formatTimeAgo } from '@/lib/format'
import { features } from '@/lib/features'
import { clearLocalSaved } from '@/services/local/saved'
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
        Create a free account to keep your saved recalls on all your devices.
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

function AlertSettings({ user }: { user: UserProfile }) {
  const updatePrefs = useUpdatePrefs()
  const recheck = useRecheck()
  const status = useDataSourceStatus().data

  const checkNow = () =>
    recheck.mutate(undefined, {
      onSuccess: (result) =>
        toast(
          result.newAlerts.length === 0
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
        checked={user.prefs.recheckOnOpen}
        onChange={(recheckOnOpen) => updatePrefs.mutate({ recheckOnOpen })}
      />
      <div className="flex items-center justify-between gap-3 border-b px-1 py-3">
        <span className="text-sm text-muted-foreground">
          {status?.lastWatchCheckAt ? `Last checked ${formatTimeAgo(status.lastWatchCheckAt)}` : 'Not checked yet'}
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

  const onSignOut = () =>
    signOut.mutate(undefined, {
      onSuccess: () => {
        toast('Logged out')
        navigate('/home')
      },
    })

  const onDelete = () =>
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast(user.isGuest ? 'Your data was cleared' : 'Your account was deleted')
        setConfirmDelete(false)
        navigate('/home')
      },
      onError: () => toast('Couldn’t delete your data. Please try again.'),
    })

  return (
    <section className="mt-6 space-y-3">
      {!user.isGuest && (
        <Button variant="secondary" onClick={onSignOut} disabled={signOut.isPending}>
          Log out
        </Button>
      )}
      {confirmDelete ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive-soft p-4" role="alert">
          <strong className="text-destructive">
            {user.isGuest ? 'Clear all your data?' : 'Delete your account permanently?'}
          </strong>
          <p className="mt-1 text-sm">
            Your scans, watched products, alerts and saved recalls will be deleted. This can’t be undone.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" className="h-10" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-10"
              onClick={onDelete}
              disabled={deleteAccount.isPending}
            >
              {user.isGuest ? 'Clear data' : 'Delete account'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
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

/** Saved recalls live on this device until accounts exist. */
function SavedOnDevice() {
  const queryClient = useQueryClient()
  const saved = useSavedRecalls().data ?? []
  const [confirming, setConfirming] = useState(false)

  const clear = () => {
    clearLocalSaved()
    queryClient.invalidateQueries({ queryKey: queryKeys.saved })
    setConfirming(false)
    toast('Saved recalls cleared')
  }

  return (
    <Section title="Saved on this device">
      <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
        <p>
          {saved.length === 0
            ? 'You haven’t saved any recalls yet. Tap the star on a recall to keep it.'
            : `${saved.length} saved ${saved.length === 1 ? 'recall' : 'recalls'}, stored in this browser or app only.`}
        </p>
        {saved.length > 0 &&
          (confirming ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" className="h-10" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" className="h-10" onClick={clear}>
                Clear saved
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              Clear saved recalls
            </Button>
          ))}
      </div>
    </Section>
  )
}

export function Profile() {
  const user = useCurrentUser().data

  return (
    <Screen insetTop>
      <PageTitle>Profile</PageTitle>
      <div className="desktop:max-w-2xl">
        {user && !user.isGuest ? <AccountCard user={user} /> : <GuestCard />}
        {features.alerts && user && <AlertSettings user={user} />}
        <SavedOnDevice />
        <DataSources />
        {user && <AccountActions user={user} />}
        <p className="mt-6 text-center text-xs text-muted-foreground">RecallGuard {__APP_VERSION__}</p>
      </div>
    </Screen>
  )
}
