import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { PaintProvider } from './context/PaintContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PaintProvider>
          <AuthProvider>
            <StoreProvider>
              <App />
            </StoreProvider>
          </AuthProvider>
        </PaintProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
