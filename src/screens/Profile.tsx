import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, ExternalLink, LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { toast } from '@/components/ui/sonner'
import { MenuRow } from '@/components/MenuRow'
import { PageTitle, Screen, SectionTitle } from '@/components/Screen'
import { ToggleRow } from '@/components/ToggleRow'
import { useRecheck } from '@/hooks/use-alerts'
import { useCurrentUser, useDeleteAccount, useSignOut, useUpdatePrefs } from '@/hooks/use-auth'
import { useDataSourceStatus } from '@/hooks/use-meta'
import { formatDate, formatTimeAgo } from '@/lib/format'
import {
  getMockConfig,
  receiptScenarioOptions,
  resetDemoData,
  setMockConfig,
  subscribeMockConfig,
  type MockConfig,
  type MockLatency,
  type ReceiptScenario,
} from '@/mocks/demo'
import { isLive, usesDemoData } from '@/services'
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

function AccountCard({ user }: { user: UserProfile }) {
  const navigate = useNavigate()
  if (user.isGuest) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <strong>You’re using RecallGuard as a guest</strong>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a free account to keep your scans, alerts and saved recalls on all your devices.
        </p>
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
        {usesDemoData && (
          <p>
            <Badge variant="warn">Demo data</Badge>{' '}
            <span className="text-muted-foreground">
              {isLive('recalls')
                ? 'Recalls are live from openFDA. Scans, your history and accounts still use synthetic sample data.'
                : 'You’re seeing synthetic sample data. Brands, products and recalls are fictional.'}
            </span>
          </p>
        )}
        <p>
          {isLive('recalls') ? 'Recalls come' : 'When live, recalls come'} from the FDA’s openFDA food enforcement
          reports{status && isLive('meta') && <> (last updated {formatDate(status.openFdaLastUpdated)})</>}. Product
          lookups will use Open Food Facts, and receipts will be read with Google Document AI.
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

/** Mock-backend controls for demos and reviewing loading / empty / error states. */
function DeveloperPanel() {
  const queryClient = useQueryClient()
  const config = useSyncExternalStore(subscribeMockConfig, getMockConfig)

  const update = (patch: Partial<MockConfig>) => {
    setMockConfig(patch)
    queryClient.invalidateQueries()
  }

  const reset = () => {
    resetDemoData()
    queryClient.clear()
    toast('Demo data reset. You’re a new guest.')
  }

  return (
    <Section title="Developer">
      <div className="rounded-lg border border-dashed bg-card px-3">
        <label className="flex items-center justify-between gap-3 border-b py-3">
          <span>
            <strong className="block text-sm">Network speed</strong>
            <small className="text-muted-foreground">Simulated latency of every call</small>
          </span>
          <NativeSelect
            className="max-w-40 flex-none"
            value={config.latency}
            onChange={(e) => update({ latency: e.target.value as MockLatency })}
          >
            <option value="none">Instant</option>
            <option value="normal">Normal</option>
            <option value="slow">Slow (3×)</option>
          </NativeSelect>
        </label>
        <ToggleRow
          label="Force errors"
          description="Every data call fails (sign-in still works)"
          checked={config.forceError}
          onChange={(forceError) => update({ forceError })}
        />
        <ToggleRow
          label="Force empty lists"
          description="Recalls, history and alerts come back empty"
          checked={config.forceEmpty}
          onChange={(forceEmpty) => update({ forceEmpty })}
        />
        <label className="flex items-center justify-between gap-3 border-b py-3">
          <span>
            <strong className="block text-sm">Next receipt scan</strong>
            <small className="text-muted-foreground">Which sample receipt is returned</small>
          </span>
          <NativeSelect
            className="max-w-48 flex-none"
            value={config.receiptScenario}
            onChange={(e) => update({ receiptScenario: e.target.value as ReceiptScenario })}
          >
            {receiptScenarioOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex items-center justify-between gap-3 py-3">
          <span>
            <strong className="block text-sm">Reset demo data</strong>
            <small className="text-muted-foreground">Deletes all mock accounts, scans and alerts</small>
          </span>
          <Button variant="secondary" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
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

export function Profile() {
  const user = useCurrentUser().data

  return (
    <Screen insetTop>
      <PageTitle>Profile</PageTitle>
      {user && (
        <div className="desktop:max-w-2xl">
          <AccountCard user={user} />
          <AlertSettings user={user} />
          <DataSources />
          {usesDemoData && <DeveloperPanel />}
          <AccountActions user={user} />
          <p className="mt-6 text-center text-xs text-muted-foreground">RecallGuard {__APP_VERSION__}</p>
        </div>
      )}
    </Screen>
  )
}
