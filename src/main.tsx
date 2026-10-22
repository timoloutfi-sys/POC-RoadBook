import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import './index.css'
import './ui/device.css'
import './ui/theme.css'
import App from './App.tsx'
import { requestPersist } from './library/db'
import { startLibrary } from './library/session'
import { startPlanSync } from './strategy/sync'

startPlanSync()
void requestPersist()
void startLibrary()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
