/**
 * Thin wrappers around Capacitor plugins so screens don't branch on platform.
 * Every function works on both iOS (native plugin) and web (browser fallback).
 */
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Share } from '@capacitor/share'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'web'

/** Light tap feedback. No-op on web. */
export function tap() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** 'dark' = light icons for dark screens (camera), 'light' = dark icons. No-op on web. */
export function setStatusBar(tone) {
  if (!isNative) return
  SystemBars.setStyle({ style: tone === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
}

/** True when the user backed out of a camera/scanner/share sheet, which isn't an error worth showing. */
export function isCancel(err) {
  return /cancel/i.test(err?.message ?? '')
}

/**
 * Photograph a receipt. iOS opens the native camera; web opens a file input
 * (which offers the camera on mobile browsers). Returns a URL usable as <img src>.
 */
export async function captureReceipt() {
  const { Camera } = await import('@capacitor/camera')
  const photo = await Camera.takePhoto({ quality: 80, correctOrientation: true, webUseInput: true })
  return photo.webPath
}

/**
 * Scan a product barcode. iOS uses the native Vision-based scanner UI;
 * web shows the plugin's html5-qrcode overlay using the browser camera.
 */
export async function scanBarcode() {
  // Lazy: the web fallback pulls in html5-qrcode (~350 kB), only needed once the user scans
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner')
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.ALL,
    scanInstructions: 'Point at the product barcode',
  })
  return result.ScanResult
}

/**
 * Share a recall via the native share sheet (iOS) or Web Share API.
 * Falls back to copying to the clipboard on desktop browsers without Web Share.
 * Resolves to 'shared' or 'copied'.
 */
export async function shareRecall(recall) {
  const text = `FDA recall ${recall.fdaId}: ${recall.name} (${recall.risk}). Affected batch: ${recall.affected}.`
  const { value: canShare } = await Share.canShare()
  if (canShare) {
    await Share.share({ title: 'RecallGuard alert', text, dialogTitle: 'Share recall alert' })
    return 'shared'
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
