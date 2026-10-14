import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { isNative, platform, setStatusBar } from './lib/native.js'
import './styles.css'

// Lets CSS tell native shells apart from the browser (e.g. no desktop phone frame on iPad).
document.documentElement.classList.add(`platform-${platform}`)
if (isNative) document.documentElement.classList.add('native')
setStatusBar('light')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
