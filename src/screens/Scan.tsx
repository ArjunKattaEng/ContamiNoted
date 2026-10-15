import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImageUp, Keyboard, Loader2, Receipt, ScanBarcode, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useGoBack } from '@/hooks/use-go-back'
import { useScanBarcode, useScanReceipt } from '@/hooks/use-scans'
import { canonicalBarcode, isValidGtin } from '@/lib/barcode'
import { blobFromUrl, prepareReceiptImage } from '@/lib/image'
import { captureReceipt, isCancel, scanBarcode, setStatusBar, tap } from '@/lib/native'
import { scanPath } from '@/lib/scan'
import { cn } from '@/lib/utils'
import { features } from '@/lib/features'
import { isApiError } from '@/services/errors'
import type { Scan as ScanResult } from '@/types'

type ScanMode = 'receipt' | 'product'

const availableModes = (): ScanMode[] => [
  ...(features.receiptScan ? (['receipt'] as const) : []),
  ...(features.barcodeScan ? (['product'] as const) : []),
]

const progressSteps: Record<ScanMode, string[]> = {
  receipt: ['Reading your receipt…', 'Finding the products…', 'Checking FDA recalls…', 'Writing your summary…'],
  product: ['Looking up the product…', 'Checking FDA recalls…'],
}

/** Cycles through progress messages while a scan is processing. */
function ProcessingOverlay({ mode }: { mode: ScanMode }) {
  const [step, setStep] = useState(0)
  const steps = progressSteps[mode]
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 900)
    return () => clearInterval(id)
  }, [steps.length])
  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center bg-black/75 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin" aria-hidden />
        <p className="text-base font-bold">{steps[step]}</p>
      </div>
    </div>
  )
}

const sideButton = 'flex flex-col items-center gap-1 text-xs text-white/85 disabled:opacity-40'

/**
 * Scan screen (full-screen, dark). Receipt mode photographs or uploads a receipt; product mode scans
 * or types a barcode. Results open on their own page (replacing this one in history).
 */
export function Scan() {
  const navigate = useNavigate()
  useDocumentTitle('Scan')
  const close = useGoBack('/home')
  const [params] = useSearchParams()
  const modes = availableModes()
  const requested: ScanMode = params.get('mode') === 'product' ? 'product' : 'receipt'
  const [mode, setMode] = useState<ScanMode>(modes.includes(requested) ? requested : modes[0])
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [code, setCode] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const barcodeScan = useScanBarcode()
  const receiptScan = useScanReceipt()
  const busy = barcodeScan.isPending || receiptScan.isPending

  // Light status-bar icons while this dark screen is showing
  useEffect(() => {
    setStatusBar('dark')
    return () => setStatusBar('light')
  }, [])

  const switchMode = (next: ScanMode) => {
    setMode(next)
    setError(null)
    setTyping(false)
  }

  const showResult = (scan: ScanResult) => navigate(scanPath(scan), { replace: true })
  const showError = (err: unknown) =>
    setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.')

  const checkBarcode = (raw: string) => {
    setError(null)
    barcodeScan.mutate(raw, { onSuccess: showResult, onError: showError })
  }

  const checkReceipt = async (image: Blob) => {
    setError(null)
    receiptScan.mutate({ image: await prepareReceiptImage(image) }, { onSuccess: showResult, onError: showError })
  }

  const capture = async () => {
    tap()
    setError(null)
    try {
      if (mode === 'receipt') {
        const path = await captureReceipt()
        if (path) await checkReceipt(await blobFromUrl(path))
      } else {
        const scanned = await scanBarcode()
        if (scanned) checkBarcode(scanned)
      }
    } catch (err) {
      if (isCancel(err)) return
      setError(
        mode === 'receipt'
          ? 'Couldn’t open the camera. You can upload a photo instead.'
          : 'Couldn’t open the barcode scanner. You can type the barcode instead.',
      )
      if (mode === 'product') setTyping(true)
    }
  }

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    const normalized = canonicalBarcode(code)
    if (!isValidGtin(normalized)) {
      setError('That doesn’t look like a valid barcode. Check the 8, 12 or 13 digits under the bars.')
      return
    }
    checkBarcode(normalized)
  }

  const Viewfinder = mode === 'receipt' ? Receipt : ScanBarcode

  return (
    <div className="relative flex flex-1 flex-col items-center justify-between overflow-y-auto bg-[radial-gradient(circle_at_center,#666,#111)] px-6 pb-[calc(24px+var(--safe-bottom))] pt-[calc(16px+var(--safe-top))] text-white">
      <div className="flex self-stretch">
        <button className="grid size-11 place-items-center" aria-label="Close" onClick={close}>
          <X className="size-6" />
        </button>
      </div>

      <div className="my-6 grid size-[220px] flex-none place-items-center rounded-2xl border-[3px] border-dashed border-white/65">
        <Viewfinder className="size-16" strokeWidth={1.25} aria-hidden />
      </div>

      <div className="w-full max-w-md">
        {typing && mode === 'product' && (
          <form onSubmit={submitCode} className="mb-3 flex gap-2">
            <Input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Barcode number, e.g. 0 12345 67890 5"
              aria-label="Barcode number"
              className="border-white/40 bg-white/10 text-white placeholder:text-white/55"
            />
            <Button type="submit" variant="secondary" className="h-12 w-auto px-4" disabled={busy || !code.trim()}>
              Check
            </Button>
          </form>
        )}

        {error ? (
          <p className="mb-1 text-center text-[13px] text-[#ffd2cc]" role="alert">
            {error}
          </p>
        ) : (
          <p className="mb-1 text-center text-[13px] text-white/80">
            {mode === 'receipt' ? 'Take a photo of the whole receipt' : 'Scan the barcode on the package'}
          </p>
        )}

        <div className={cn('my-2 flex gap-1.5', modes.length < 2 && 'hidden')} role="radiogroup" aria-label="Scan type">
          {modes.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 rounded-full border-[1.5px] border-white/55 p-2 capitalize',
                mode === m && 'bg-white text-[#111]',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 items-center">
          {mode === 'receipt' ? (
            <button className={sideButton} onClick={() => fileInput.current?.click()} disabled={busy}>
              <ImageUp className="size-6" aria-hidden />
              Upload
            </button>
          ) : (
            <button className={sideButton} onClick={() => setTyping((t) => !t)} disabled={busy} aria-pressed={typing}>
              <Keyboard className="size-6" aria-hidden />
              Type code
            </button>
          )}
          <button
            className="mx-auto size-[68px] rounded-full border-4 border-white bg-white/25 disabled:opacity-50"
            aria-label={mode === 'receipt' ? 'Take receipt photo' : 'Scan barcode'}
            onClick={capture}
            disabled={busy}
          />
          <span />
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) checkReceipt(file)
        }}
      />

      {busy && <ProcessingOverlay mode={mode} />}
    </div>
  )
}
