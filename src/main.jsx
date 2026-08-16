import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { PaintProvider } from './context/PaintContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { initSentry } from './lib/sentry.js'
import './index.css'

initSentry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <PaintProvider>
              <AuthProvider>
                <StoreProvider>
                  <App />
                  <Analytics />
                </StoreProvider>
              </AuthProvider>
            </PaintProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
