import type { ReactNode } from 'react'
import { Screen, SectionTitle } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { features } from '@/lib/features'

/** Shown at the bottom; update it whenever this page changes. */
const LAST_UPDATED = 'October 2026'

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  )
}

/**
 * What RecallGuard stores and where, in plain words (linked from Profile and sign-up). Keep it true to the
 * code: the device stores (src/services/local), the account store (src/services/firebase), and what the
 * backend logs and caches (api/).
 */
export function Privacy() {
  return (
    <>
      <ScreenHeader title="What we store" backOnDesktop backTo="/profile" />
      <Screen narrow>
        <Part title={features.accounts ? 'Without an account' : 'On this device'}>
          <p>
            Your scanned products, alerts, saved recalls and settings stay in this browser or app only. To remove your
            products, alerts and saved recalls, use Profile →{' '}
            {features.accounts ? 'Clear my data' : 'Clear saved recalls and Clear scan history and alerts'}; clearing
            this site’s data removes everything.
          </p>
          <p>
            When you check a product, and when the app re-checks your products for new recalls, their barcodes, names
            and brands are sent to our server. It looks them up with Open Food Facts and the FDA’s openFDA service. Our
            server doesn’t store them: it keeps a product’s result in memory for up to 15 minutes to answer repeat checks
            faster, and barcodes can appear for a short time in its activity logs.
          </p>
        </Part>
        {features.accounts && (
          <Part title="With an account">
            <p>
              Your name, email address, scanned products, alerts, saved recalls and settings are stored in your account
              with Google Firebase, so they’re on every device you log in on. Other RecallGuard users can’t see them.
            </p>
            <p>
              If you continue with Google, Google shares your name, email address and profile picture with us. We don’t
              get your Google password or anything else from your Google account.
            </p>
            <p>
              Anything you saved on a device before logging in moves into your account. Profile → Delete account
              deletes your account and everything in it, permanently.
            </p>
            <p>Accounts are for people 13 and older.</p>
          </Part>
        )}
        <Part title="What we don’t do">
          <p>No ads and no tracking. We never sell your data or share it with advertisers.</p>
        </Part>
        <p className="mt-6 text-xs text-muted-foreground">Last updated {LAST_UPDATED}.</p>
      </Screen>
    </>
  )
}
