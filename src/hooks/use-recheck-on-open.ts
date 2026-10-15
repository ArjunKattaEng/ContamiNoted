import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/components/ui/sonner'
import { isNative } from '@/lib/native'
import type { RecheckResult } from '@/types'
import { useRecheck } from './use-alerts'
import { useCurrentUser } from './use-auth'

const MIN_INTERVAL_MS = 5 * 60_000

function announce(result: RecheckResult, view: () => void) {
  const count = result.newAlerts.length
  if (count === 0) return
  const message =
    count === 1 ? `New recall: ${result.newAlerts[0].itemName} may be affected` : `${count} new recalls affect your items`
  toast(message, { duration: 8000, action: { label: 'View', onClick: view } })
}

/**
 * Re-check the user's saved items for new recalls when the app opens and whenever it comes back
 * to the foreground (if the user's "re-check on open" preference is on). Mounted once in AppShell.
 */
export function useRecheckOnOpen() {
  const user = useCurrentUser().data
  const { mutate } = useRecheck()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const lastRun = useRef<{ uid: string; at: number } | null>(null)

  const uid = user?.uid
  const enabled = user?.prefs.recheckOnOpen ?? false

  useEffect(() => {
    if (!uid || !enabled) return

    const run = () => {
      const now = Date.now()
      if (lastRun.current?.uid === uid && now - lastRun.current.at < MIN_INTERVAL_MS) return
      lastRun.current = { uid, at: now }
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
