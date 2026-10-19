import { useCallback, useEffect, useState } from 'react'
import { getExpiryDate, setExpiryDate } from '@/lib/expiry'

export function useExpiryDate(productId: string | undefined) {
  const [expiryDate, setLocal] = useState<string | undefined>(() =>
    productId ? getExpiryDate(productId) : undefined,
  )

  useEffect(() => {
    setLocal(productId ? getExpiryDate(productId) : undefined)
  }, [productId])

  const update = useCallback(
    (date: string | null) => {
      if (!productId) return
      setExpiryDate(productId, date)
      setLocal(date ?? undefined)
    },
    [productId],
  )

  return [expiryDate, update] as const
}
