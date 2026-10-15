import { useSyncExternalStore } from 'react'

/** Same condition as the Tailwind `desktop:` screen in tailwind.config.ts. */
export const DESKTOP_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True for the desktop layout (wide screen with a mouse/trackpad). */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
