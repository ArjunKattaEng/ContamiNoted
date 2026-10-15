import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { isNative, platform, setStatusBar } from './lib/native'
import { queryClient } from './lib/queryClient'
import './index.css'

// Lets CSS tell native shells apart from the browser (`native:` / `web:` Tailwind variants).
document.documentElement.classList.add(`platform-${platform}`)
if (isNative) document.documentElement.classList.add('native')
setStatusBar('light')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
