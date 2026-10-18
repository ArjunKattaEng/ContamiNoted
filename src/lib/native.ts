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
export function setStatusBar(tone: 'dark' | 'light') {
  if (!isNative) return
  SystemBars.setStyle({ style: tone === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
}

/** True when the user backed out of a camera/scanner/share sheet, which isn't an error worth showing. */
export function isCancel(err: unknown) {
  return /cancel/i.test(err instanceof Error ? err.message : '')
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
 * Scan a product barcode with the iOS app's native scanner UI. The web app doesn't use this: it reads
 * barcodes from its own camera view (`BarcodeCamera`), which handles product barcodes far better than
 * the plugin's web fallback (html5-qrcode, which only reads a small square in the middle of the frame).
 */
export async function scanBarcode() {
  // Lazy: only loaded when the native scanner opens
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner')
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.ALL,
    scanInstructions: 'Point at the product barcode',
  })
  return result.ScanResult
}

/** Fields of a recall needed to build the share text. */
export interface ShareableRecall {
  recallNumber: string
  productDescription: string
  classification: string
  shortSummary?: string
}

/**
 * Share a recall via the native share sheet (iOS) or Web Share API.
 * Falls back to copying to the clipboard on desktop browsers without Web Share.
 */
export async function shareRecall(recall: ShareableRecall): Promise<'shared' | 'copied'> {
  const text = [
    `FDA recall ${recall.recallNumber} (${recall.classification}): ${recall.productDescription}.`,
    recall.shortSummary,
    'Details: https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
  ]
    .filter(Boolean)
    .join('\n\n')
  const { value: canShare } = await Share.canShare()
  if (canShare) {
    await Share.share({ title: 'RecallGuard alert', text, dialogTitle: 'Share recall alert' })
    return 'shared'
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
