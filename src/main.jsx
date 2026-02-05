import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import AdminPanel from './pages/AdminPanel';
import './index.css';
// 🔥 引入 LanguageProvider
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 🔥 1. 開始 LanguageProvider */}
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* 一般用戶頁面 */}
          <Route path="/" element={<App />} />
          
          {/* 管理員後台 */}
          <Route path="/admin" element={<AdminPanel />} />
          
          {/* 處理其他路徑 (Optional: Redirect to Home) */}
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider> 
    {/* 🔥 2. 記得要在這裡關閉 LanguageProvider，不能漏！ */}
  </React.StrictMode>,
);