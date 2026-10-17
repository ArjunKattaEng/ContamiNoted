// Tests that need the Firebase emulators (tests/firebase). Run through the npm scripts, which start them:
//   npm run test:auth      Auth emulator only (no Java needed)
//   npm run test:rules     Firestore emulator: firestore.rules
//   npm run test:firebase  everything (Auth + Firestore emulators)
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    include: ['tests/firebase/**/*.test.ts'],
    fileParallelism: false, // the files share one emulator and clear it between tests
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: { VITE_ACCOUNTS: 'true', VITE_USE_FIREBASE_EMULATORS: 'true' },
  },
})
