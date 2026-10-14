export const recalls = [
  { id: 'r1', name: 'Product Name', date: '10/16/2024', risk: 'Class I', match: true, starred: true, status: 'active', price: '$1.94', batch: '7622603190', affected: 'Acetriptin 12/7/10 – 7622603/190', distribution: '05/2029', fdaId: 'FDA-1C0624', note: 'Product description with reasons and description.' },
  { id: 'r2', name: 'Product Name', date: '10/16/2024', risk: 'Class II', match: true, starred: true, status: 'active', price: '$1.94', batch: '1122334455', affected: 'Lot 1122334455', distribution: '03/2029', fdaId: 'FDA-1C0625', note: 'Possible undeclared allergen.' },
  { id: 'r3', name: 'Product Name', date: '10/12/2024', risk: 'Class II', match: false, starred: false, status: 'active', price: '$1.55', batch: '9988776655', affected: 'Lot 9988776655', distribution: '01/2029', fdaId: 'FDA-1C0626', note: 'Labeling error.' },
  { id: 'r4', name: 'Product Name', date: '09/28/2024', risk: 'Class III', match: false, starred: false, status: 'resolved', price: '$3.10', batch: '5544332211', affected: 'Lot 5544332211', distribution: '12/2028', fdaId: 'FDA-1C0590', note: 'Resolved – no items remaining.' },
]

export const receipts = [
  { id: 'rc1', date: '15/11/2024', store: 'Store', items: 100, total: '$.', status: 'safe' },
  { id: 'rc2', date: '15/11/2024', store: 'Store', items: 100, total: '$.', status: 'safe' },
  { id: 'rc3', date: '10/10/2024', store: 'Store', items: 100, total: '$.', status: 'alert' },
  { id: 'rc4', date: '28/10/2024', store: 'Store', items: 100, total: '$.', status: 'safe' },
  { id: 'rc5', date: '15/10/2024', store: 'Store', items: 100, total: '$.', status: 'alert' },
]

export const scannedItems = [
  { id: 'i1', label: 'Item 1', ok: true },
  { id: 'i2', label: 'Item 2', ok: true },
  { id: 'i3', label: 'Item 3', ok: true },
  { id: 'i4', label: 'Item 4', ok: true },
  { id: 'i5', label: 'Item 5', ok: true },
]

export const stores = [
  { id: 's1', name: 'Store 1', connected: false },
  { id: 's2', name: 'Store 2', connected: true },
  { id: 's3', name: 'Store 3', connected: true },
]

export const walkthrough = [
  { icon: '📄', text: 'Stay informed with real-time FDA Recall Alerts.' },
  { icon: '🧾', text: 'Scan receipts to check past purchases for recalled items.' },
  { icon: '▥', text: 'Scan products to verify batch matches and check expiration.' },
]
