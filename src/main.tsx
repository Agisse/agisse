import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/posthog'
import './styles/base.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
