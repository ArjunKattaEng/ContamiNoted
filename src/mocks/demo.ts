// Demo samples for the scan screen (mock data source only). The only module in src/mocks that
// UI code may import; everything else goes through services.
import type { ReceiptScenario } from './config'
import { sampleBarcodes } from './data/products'
import { receiptFixtures } from './data/receipts'

export const demoBarcodes: { label: string; code: string }[] = [
  { label: 'Recalled product', code: sampleBarcodes.confirmed },
  { label: 'Possible match', code: sampleBarcodes.possible },
  { label: 'No recall', code: sampleBarcodes.clear },
  { label: 'Unknown product', code: sampleBarcodes.unknown },
  { label: 'Invalid code', code: sampleBarcodes.invalid },
]

/** Stand-in "photo" for a sample receipt scan; the mock picks the receipt scenario. */
export const demoReceiptImage = () => new Blob(['demo-receipt'], { type: 'image/jpeg' })

// Developer panel controls (Profile → Developer, mock data source only)
export { getMockConfig, setMockConfig, subscribeMockConfig } from './config'
export type { MockConfig, MockLatency, ReceiptScenario } from './config'
export { resetDb as resetDemoData } from './db'

export const receiptScenarioOptions: { value: ReceiptScenario; label: string }[] = [
  { value: 'cycle', label: 'Cycle A → B → C' },
  ...(['A', 'B', 'C'] as const).map((id) => ({ value: id, label: `${id}: ${receiptFixtures[id].label}` })),
  { value: 'unreadable', label: 'Unreadable receipt (error)' },
]
