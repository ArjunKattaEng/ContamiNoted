// Shared helpers for tests that run against the Firebase emulators (see vitest.firebase.config.ts).
import { AUTH_EMULATOR_PORT, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT } from '@/lib/firebase'

const host = '127.0.0.1'

/** Deletes every emulator user and Firestore document (ignores an emulator that isn't running). */
export async function clearEmulators(): Promise<void> {
  await Promise.allSettled([
    fetch(`http://${host}:${AUTH_EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`, { method: 'DELETE' }),
    fetch(
      `http://${host}:${FIRESTORE_EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
  ])
}

/** A Firestore document as an admin sees it (rules bypassed), or null if it doesn't exist. */
export async function adminGetDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `http://${host}:${FIRESTORE_EMULATOR_PORT}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Emulator read failed: ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

let counter = 0
/** A fresh email address for each test. */
export const newEmail = () => `user${Date.now()}${counter++}@example.com`
export const PASSWORD = 'correct-horse-9'
