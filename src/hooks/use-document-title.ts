import { useEffect } from 'react'

/** Sets the browser tab title: "Recalls · RecallGuard" (or just "RecallGuard"). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ContamiNoted` : 'ContamiNoted'
  }, [title])
}
