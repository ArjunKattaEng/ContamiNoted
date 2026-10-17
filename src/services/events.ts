// Tells the app (useAuthSync) that the signed-in account's data changed outside a query or mutation, e.g. a
// device's data merged in by a sign-in that finished in the background. Kept free of Firebase imports.
type Listener = () => void
const listeners = new Set<Listener>()

export function onAccountDataChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function accountDataChanged(): void {
  for (const listener of listeners) listener()
}
