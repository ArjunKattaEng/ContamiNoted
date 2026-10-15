import type { SavedService } from '../types'
import { notImplemented } from './notImplemented'

// TODO(backend): Firestore users/{uid}/savedRecalls/{recallNumber}.
export const httpSaved: SavedService = {
  list: () => notImplemented('Firestore users/{uid}/savedRecalls'),
  /** set or delete users/{uid}/savedRecalls/{recallNumber}; resolves to the new saved state */
  toggle: () => notImplemented('Firestore users/{uid}/savedRecalls/{recallNumber}'),
}
