import { useNavigate } from 'react-router-dom'

/** navigate(-1) when there is in-app history, otherwise go to `fallback` (e.g. a deep link). */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
