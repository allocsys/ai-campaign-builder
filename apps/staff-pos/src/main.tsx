import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '@ai-campaign-builder/ui-kit'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './lib/auth'
import './index.css'

// Registers the Workbox-generated service worker (see vite.config.ts VitePWA
// config) so the app is installable and usable offline once cached — separate
// from the in-app offline QUEUE (src/lib/mock-data.ts), which is about
// deferring purchase/fulfill actions until reconnect, not about caching assets.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
