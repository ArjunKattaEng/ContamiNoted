import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services, type SignUpInput } from '@/services'
import type { UserPrefs, UserProfile } from '@/types'
import { queryKeys, userScopedKeys } from './queryKeys'

/** The current user. There is always one: a guest session starts automatically. */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => services.auth.current(),
    staleTime: Infinity,
  })
}

/** After any account change: store the new user and drop the previous account's cached data. */
function useAccountSwitch() {
  const queryClient = useQueryClient()
  return (user: UserProfile) => {
    queryClient.setQueryData(queryKeys.user, user)
    for (const queryKey of userScopedKeys) queryClient.resetQueries({ queryKey })
  }
}

export function useSignIn() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => services.auth.signIn(email, password),
    onSuccess: onSwitch,
  })
}

/** Upgrades the guest in place, so their scans and saved recalls are kept. */
export function useSignUp() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationFn: (input: SignUpInput) => services.auth.signUp(input),
    onSuccess: onSwitch,
  })
}

export function useSocialSignIn() {
  const onSwitch = useAccountSwitch()
  return useMutation({
    mutationFn: (provider: 'apple' | 'google') =>
      provider === 'apple' ? services.auth.signInWithApple() : services.auth.signInWithGoogle(),
    onSuccess: onSwitch,
  })
}

export function useResetPassword() {
  return useMutation({ mutationFn: (email: string) => services.auth.resetPassword(email) })
}

export function useSignOut() {
  const onSwitch = useAccountSwitch()
  return useMutation({ mutationFn: () => services.auth.signOut(), onSuccess: onSwitch })
}

export function useDeleteAccount() {
  const onSwitch = useAccountSwitch()
  return useMutation({ mutationFn: () => services.auth.deleteAccount(), onSuccess: onSwitch })
}

export function useUpdatePrefs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (prefs: Partial<UserPrefs>) => services.auth.updatePrefs(prefs),
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
