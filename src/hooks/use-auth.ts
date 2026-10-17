import { useEffect } from 'react'
import { hashKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { features } from '@/lib/features'
import { services, setShownUser, type SignUpInput } from '@/services'
import { onAccountDataChanged } from '@/services/events'
import type { UserPrefs, UserProfile } from '@/types'
import { queryKeys, userScopedKeys } from './queryKeys'

/** The current user (a guest session starts automatically). Undefined while accounts are "Coming soon". */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: async ({ signal }) => {
      const user = await services.auth.current()
      // A start-up answer cancelled by a sign-in here (useAccountSwitch) must not overwrite it
      if (!signal.aborted) setShownUser(user.uid)
      return user
    },
    staleTime: Infinity,
    enabled: features.accounts,
  })
}

/** Every mutation that signs in or out or deletes the account (useAuthSync waits for them). */
const AUTH_MUTATION = ['auth'] as const

/**
 * Follows sign-in changes made outside this screen (another tab, a session that ended): reloads the user and
 * drops the previous account's cached data. Changes made here go through useAccountSwitch instead, so this
 * waits while one of those is in progress or the user is loading, and compares again afterwards (a change
 * is reported only once). Mounted once, in App.
 */
export function useAuthSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!features.accounts) return
    let signedIn: string | null = null // the uid Firebase last reported
    let reloadedFor: string | null = null // reload once per change (a reload that still disagrees, e.g. a
    // start-up that fell back to the guest, isn't retried in a loop)
    const userHash = hashKey(queryKeys.user)
    const check = () => {
      const shown = queryClient.getQueryData<UserProfile>(queryKeys.user)
      if (signedIn === null || !shown || shown.uid === signedIn || reloadedFor === signedIn) return
      if (queryClient.isMutating({ mutationKey: AUTH_MUTATION }) > 0) return
      if (queryClient.isFetching({ queryKey: queryKeys.user }) > 0) return
      reloadedFor = signedIn
      // Until the reloaded user arrives, data follows whoever Firebase says is signed in now
      setShownUser(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.user })
      for (const queryKey of userScopedKeys) void queryClient.resetQueries({ queryKey })
    }
    const stopAuth = services.auth.onChange((uid) => {
      if (uid !== signedIn) reloadedFor = null
      signedIn = uid
      check()
    })
    const stopQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryHash === userHash) check()
    })
    const stopMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation.options.mutationKey?.[0] === AUTH_MUTATION[0]) check()
    })
    // A device's data merged into the account in the background: show it
    const stopData = onAccountDataChanged(() => {
      for (const queryKey of userScopedKeys) void queryClient.invalidateQueries({ queryKey })
    })
    return () => {
      stopAuth()
      stopQueries()
      stopMutations()
      stopData()
    }
  }, [queryClient])
}

/** After any account change: store the new user and drop the previous account's cached data. */
function useAccountSwitch() {
  const queryClient = useQueryClient()
  return (user: UserProfile) => {
    // A slow start-up current() still in flight must not overwrite the account just signed into
    void queryClient.cancelQueries({ queryKey: queryKeys.user })
    setShownUser(user.uid)
    queryClient.setQueryData(queryKeys.user, user)
    for (const queryKey of userScopedKeys) queryClient.resetQueries({ queryKey })
  }
}

export function useSignIn() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationKey: AUTH_MUTATION,
    mutationFn: ({ email, password }: { email: string; password: string }) => services.auth.signIn(email, password),
    onSuccess: onSwitch,
  })
}

/** Creates the account; this device's scans, alerts and saved recalls move into it. */
export function useSignUp() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationKey: AUTH_MUTATION,
    mutationFn: (input: SignUpInput) => services.auth.signUp(input),
    onSuccess: onSwitch,
  })
}

export function useSocialSignIn() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationKey: AUTH_MUTATION,
    // Sign in with Apple isn't built yet (and must be offered alongside Google in the iOS app)
    mutationFn: () => services.auth.signInWithGoogle(),
    onSuccess: onSwitch,
  })
}

export function useResetPassword() {
  return useMutation({ mutationFn: (email: string) => services.auth.resetPassword(email) })
}

export function useSignOut() {
  const onSwitch = useAccountSwitch()
  return useMutation({ mutationKey: AUTH_MUTATION, mutationFn: () => services.auth.signOut(), onSuccess: onSwitch })
}

export function useDeleteAccount() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationKey: AUTH_MUTATION,
    /** `uid` is the user the screen shows (see AuthService.deleteAccount). */
    mutationFn: (confirm: { uid: string; password?: string }) => services.auth.deleteAccount(confirm),
    onSuccess: onSwitch,
  })
}

export function useUpdatePrefs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (prefs: Partial<UserPrefs>) => {
      const shown = queryClient.getQueryData<UserProfile>(queryKeys.user)
      if (!shown) throw new Error('The user is still loading')
      return services.auth.updatePrefs(prefs, shown.uid)
    },
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.user })
      const previous = queryClient.getQueryData<UserProfile>(queryKeys.user)
      if (previous) queryClient.setQueryData(queryKeys.user, { ...previous, prefs: { ...previous.prefs, ...prefs } })
      return { previous }
    },
    onError: (_err, _prefs, context) => queryClient.setQueryData(queryKeys.user, context?.previous),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.user, user),
  })
}
