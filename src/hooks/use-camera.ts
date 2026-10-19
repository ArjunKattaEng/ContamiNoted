import { type RefObject, useCallback, useEffect, useState } from 'react'

export type CameraError = 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'failed'

export type CameraState =
  | { status: 'starting' }
  | { status: 'ready'; torch: boolean | null } // null: this camera has no torch
  | { status: 'error'; error: CameraError }

// Torch and focus aren't in TypeScript's DOM types yet
interface ExtraCapabilities {
  torch?: boolean
  focusMode?: string[]
}
type ExtraConstraintSet = MediaTrackConstraintSet & { torch?: boolean; focusMode?: string }

/** Back camera, as sharp as the device offers up to 1080p: thin bars need pixels. */
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
}

export function cameraError(err: unknown): CameraError {
  const name = err instanceof Error || err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  if (name === 'NotReadableError' || name === 'AbortError') return 'in-use'
  return 'failed'
}

function capabilities(track: MediaStreamTrack): ExtraCapabilities {
  return (track.getCapabilities?.() ?? {}) as ExtraCapabilities
}

/**
 * Shows the back camera in `video` while `active`. Stops the camera when inactive or unmounted, and
 * restarts it when the page comes back after the system stopped it (iOS does when the app is hidden).
 */
export function useCamera(video: RefObject<HTMLVideoElement>, active: boolean) {
  const [state, setState] = useState<CameraState>({ status: 'starting' })
  const [track, setTrack] = useState<MediaStreamTrack | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return
    const element = video.current
    let cancelled = false
    let stream: MediaStream | null = null
    setState({ status: 'starting' })

    const start = async () => {
      // No camera API: an old browser, or the site opened over plain http (cameras need HTTPS)
      if (!navigator.mediaDevices?.getUserMedia) return setState({ status: 'error', error: 'unsupported' })
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
        if (cancelled) return
        const [videoTrack] = stream.getVideoTracks()
        // Keep refocusing as the product moves closer (where the camera supports choosing)
        if (capabilities(videoTrack).focusMode?.includes('continuous')) {
          await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as ExtraConstraintSet] }).catch(() => {})
        }
        if (!element) return
        element.srcObject = stream
        await element.play()
        if (cancelled) return
        setTrack(videoTrack)
        setState({ status: 'ready', torch: capabilities(videoTrack).torch ? false : null })
        // Ended by the system (another app took the camera, or the page was hidden): start again when visible
        videoTrack.addEventListener('ended', () => {
          if (!cancelled && document.visibilityState === 'visible') setAttempt((n) => n + 1)
        })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', error: cameraError(err) })
      }
    }
    start()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      if (element) element.srcObject = null
      setTrack(null)
    }
  }, [active, attempt, video])

  // iOS ends the camera when the app or tab is hidden; start it again on return
  useEffect(() => {
    if (!active) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && track?.readyState === 'ended') setAttempt((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [active, track])

  const setTorch = useCallback(
    async (on: boolean) => {
      if (!track) return
      try {
        await track.applyConstraints({ advanced: [{ torch: on } as ExtraConstraintSet] })
        setState({ status: 'ready', torch: on })
      } catch {
        setState({ status: 'ready', torch: null }) // claimed a torch it can't switch: hide the button
      }
    },
    [track],
  )

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { state, setTorch, retry }
}
