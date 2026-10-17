import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/sonner'
import { features } from '@/lib/features'
import { devicePrefs, setDevicePrefs } from '@/services/local/alerts'
import { useCurrentUser, useUpdatePrefs } from './use-auth'
import { queryKeys } from './queryKeys'

/**
 * The "re-check my items when I open the app" preference: the account's once accounts exist, otherwise
 * this device's (on by default). `value` is undefined while it loads.
 */
export function useRecheckOnOpenPref(): { value: boolean | undefined; set: (value: boolean) => void } {
  const queryClient = useQueryClient()
  const user = useCurrentUser().data
  const updatePrefs = useUpdatePrefs()
  const device = useQuery({
    queryKey: queryKeys.devicePrefs,
    queryFn: async () => devicePrefs(),
    enabled: !features.accounts,
    staleTime: Infinity,
  })
  if (features.accounts) {
    return {
      value: user?.prefs.recheckOnOpen,
      set: (recheckOnOpen) =>
        user &&
        updatePrefs.mutate({ recheckOnOpen }, { onError: () => toast('Couldn’t save that setting. Check your connection.') }),
    }
  }
  return {
    value: device.data?.recheckOnOpen,
    set: (recheckOnOpen) => queryClient.setQueryData(queryKeys.devicePrefs, setDevicePrefs({ recheckOnOpen })),
  }
}
