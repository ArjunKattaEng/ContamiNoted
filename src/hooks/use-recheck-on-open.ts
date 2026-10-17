import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/components/ui/sonner'
import { features } from '@/lib/features'
import { isNative } from '@/lib/native'
import { GUEST_UID } from '@/services/guest'
import type { RecheckResult } from '@/types'
import { useRecheck } from './use-alerts'
import { useCurrentUser } from './use-auth'
import { useRecheckOnOpenPref } from './use-prefs'

const MIN_INTERVAL_MS = 5 * 60_000

// Module-level, not a ref: AppShell unmounts while the full-screen camera is open, and a remount (e.g. the
// scan result page) must not count as a fresh app open.
let lastRun: { uid: string; at: number } | null = null

function announce(result: RecheckResult, view: () => void) {
  const count = result.newAlerts.length
  if (count === 0) return
  const message =
    count === 1 ? `New recall: ${result.newAlerts[0].itemName} may be affected` : `${count} new recalls affect your items`
  toast(message, { duration: 8000, action: { label: 'View', onClick: view } })
}

/**
 * Re-check the user's saved items for new recalls when the app opens and whenever it comes back
 * to the foreground (if the "re-check on open" preference is on). Mounted once in AppShell. Guests (no
 * accounts yet) re-check the products saved on this device.
 */
export function useRecheckOnOpen() {
  const user = useCurrentUser().data
  const pref = useRecheckOnOpenPref().value
  const { mutate } = useRecheck()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Throttled per account; all guests on one device share the device's products
  const uid = features.accounts ? user?.uid : GUEST_UID
  const enabled = features.alerts && (pref ?? false)

  useEffect(() => {
    if (!uid || !enabled) return

    const run = () => {
      const now = Date.now()
      if (lastRun?.uid === uid && now - lastRun.at < MIN_INTERVAL_MS) return
      lastRun = { uid, at: now }
      // Background check: failures are silent; the next open retries
      mutate(undefined, { onSuccess: (result) => announce(result, () => navigateRef.current('/alerts')) })
    }

    run()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisibility)

    let cancelled = false
    let removeResume: (() => void) | undefined
    if (isNative) {
      import('@capacitor/app')
        .then(({ App }) => App.addListener('resume', run))
        .then((handle) => {
          if (cancelled) handle.remove()
          else removeResume = () => handle.remove()
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      removeResume?.()
    }
  }, [uid, enabled, mutate])
}
