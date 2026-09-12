import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '@ai-campaign-builder/ui-kit'
import App from './App'
import { AuthProvider } from './lib/auth'
import './index.css'
import { JOIN_SLUG_STORAGE_KEY } from './lib/auth'

// Open Item 13, Step B: capture ?join=<slug> here, before React ever mounts.
// An unauthenticated visit to "/" immediately triggers ProtectedRoute's
// client-side <Navigate to="/login"> after mount, which drops the query
// string -- capturing this in a useEffect further down the tree risks
// running after that redirect already happened. sessionStorage (not
// localStorage) since this only needs to survive the phone -> OTP step of
// one signup, not persist across future sessions.
const joinSlugFromUrl = new URLSearchParams(window.location.search).get('join')
if (joinSlugFromUrl) {
  sessionStorage.setItem(JOIN_SLUG_STORAGE_KEY, joinSlugFromUrl)
}

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
