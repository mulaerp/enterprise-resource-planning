import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { branding } from './branding'

// index.html keeps a static <title> as a no-JS fallback; this is the
// white-label source of truth once the app has booted.
document.title = branding.appName

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
