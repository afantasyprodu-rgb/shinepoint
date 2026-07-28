import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { PaintProvider } from './context/PaintContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
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
  </StrictMode>
)
