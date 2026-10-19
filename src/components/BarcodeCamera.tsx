import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Flashlight, FlashlightOff, Loader2 } from 'lucide-react'
import { type CameraError, useCamera } from '@/hooks/use-camera'
import { tap } from '@/lib/native'
import { type Detection, createReadConfirmer, drawToCanvas, readCanvas } from '@/lib/scanner'
import { videoToView, visibleVideoRect } from '@/lib/scanner/geometry'
import type { Point } from '@/lib/scanner/pixels'

/** Live frames are read at up to 1280 px (≈ 10 ms each in ZXing); a photo of the frame at full size */
const FRAME_MAX_EDGE = 1280
const PHOTO_MAX_EDGE = 3000
/** Pause between reads, so the phone doesn't heat up */
const FRAME_GAP_MS = 60
/** The outline stays this long after the last read, so it doesn't flicker */
const OUTLINE_MS = 400
/** The same code isn't reported again this soon (e.g. while its result is showing an error) */
const REPEAT_MS = 4000

export interface BarcodeCameraHandle {
  /** Read the current frame at full resolution, as a photo. Null if no barcode is in it. */
  capture(): Promise<Detection | null>
}

interface BarcodeCameraProps {
  /** Stop reading frames (the camera keeps showing), e.g. while a code is being checked */
  paused: boolean
  onCode(code: string): void
  onError(error: CameraError): void
}

/**
 * Live camera view that reads product barcodes as soon as they're in view: every frame goes to the
 * barcode reader, a code is accepted once two frames agree, and an outline shows where it was found.
 */
export const BarcodeCamera = forwardRef<BarcodeCameraHandle, BarcodeCameraProps>(function BarcodeCamera(
  { paused, onCode, onError },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null)
  const { state, setTorch } = useCamera(video, true)
  const [outline, setOutline] = useState<Point[] | null>(null)
  // The latest callback without restarting the read loop when the parent re-renders
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  // When each code was last reported; kept across pauses so a code whose check failed isn't resent at once
  const reported = useRef(new Map<string, number>())

  useEffect(() => {
    if (state.status === 'error') onError(state.error)
  }, [state, onError])

  const ready = state.status === 'ready'

  useEffect(() => {
    const element = video.current
    if (!ready || paused || !element) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let lastSeen = 0
    const canvas = document.createElement('canvas')
    const confirmer = createReadConfirmer()

    const readFrame = async () => {
      const frame = { width: element.videoWidth, height: element.videoHeight }
      const view = { width: element.clientWidth, height: element.clientHeight }
      if (!frame.width || !view.width || document.hidden) return
      // Read what the user sees (the video is cropped to fill its box)
      const crop = visibleVideoRect(frame, view)
      drawToCanvas(element, frame, FRAME_MAX_EDGE, crop, canvas)
      const found = await readCanvas(canvas)
      if (stopped) return
      const now = performance.now()
      if (!found) {
        if (now - lastSeen > OUTLINE_MS) setOutline(null)
        return
      }
      lastSeen = now
      const scale = canvas.width / crop.width
      setOutline(found.corners.map((p) => videoToView(frame, view, { x: crop.x + p.x / scale, y: crop.y + p.y / scale })))
      const last = reported.current.get(found.code)
      if (!confirmer.add(found.code, now) || (last !== undefined && now - last < REPEAT_MS)) return
      reported.current.set(found.code, now)
      confirmer.reset()
      tap()
      onCodeRef.current(found.code)
    }

    const loop = async () => {
      try {
        await readFrame()
      } catch {
        // A failed frame (the reader restarting, a frame the browser couldn't draw): try the next one
      }
      if (!stopped) timer = setTimeout(loop, FRAME_GAP_MS)
    }
    loop()
    return () => {
      stopped = true
      clearTimeout(timer)
      setOutline(null)
    }
  }, [ready, paused])

  useImperativeHandle(
    ref,
    () => ({
      async capture() {
        const element = video.current
        if (!element?.videoWidth) return null
        const frame = { width: element.videoWidth, height: element.videoHeight }
        const view = { width: element.clientWidth, height: element.clientHeight }
        return readCanvas(drawToCanvas(element, frame, PHOTO_MAX_EDGE, visibleVideoRect(frame, view)))
      },
    }),
    [],
  )

  const torch = state.status === 'ready' ? state.torch : null

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={video} muted playsInline aria-hidden className="absolute inset-0 size-full object-cover" />

      {/* Where to hold the barcode. Reading isn't limited to this box; it just helps aim. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[46%] -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
      />

      {outline && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
          <polygon
            points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
            className="fill-[hsl(var(--success)/0.25)] stroke-success"
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </svg>
      )}

      {state.status === 'starting' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/85" role="status">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Starting camera…
          </span>
        </div>
      )}

      {torch !== null && (
        <button
          type="button"
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-black/45 text-white"
          aria-label={torch ? 'Turn off flashlight' : 'Turn on flashlight'}
          aria-pressed={torch}
          onClick={() => setTorch(!torch)}
        >
          {torch ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
        </button>
      )}
    </div>
  )
})
