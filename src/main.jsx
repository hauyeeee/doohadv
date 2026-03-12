import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CorporateBooking from './CorporateBooking.jsx'
import './index.css' // 確保你有引入 Tailwind 嘅 CSS
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async' // 🔥 必須：為 SEO.jsx 提供 Context
import { LanguageProvider } from './context/LanguageContext' // 🔥 必須：為翻譯功能提供 Context

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <LanguageProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageProvider>
    </HelmetProvider>
  </React.StrictMode>,
)