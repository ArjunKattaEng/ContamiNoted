import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import path from 'path'

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  server: {
    // Local backend: `npm run dev` starts uvicorn on :8000 (api/index.py)
    proxy: { '/api': 'http://localhost:8000' },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate them
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]node_modules[\\/](react-markdown|rehype-|remark-|unified|micromark|mdast-|hast-|unist-|vfile|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|html-url-attributes|devlop|bail|trough|is-plain-obj|zwitch|longest-streak|ccount|trim-lines|estree-util-is-identifier-name|style-to-js|style-to-object|inline-style-parser|hast-util-)/.test(id)) return 'markdown'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
