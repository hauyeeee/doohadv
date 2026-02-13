import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 1. 引入 Context Provider (確保路徑正確，根據你的 AdminPanel 引用，應該是在 context 資料夾)
import { LanguageProvider } from './context/LanguageContext';

// 2. 引入你的頁面組件
// 注意：這裡假設你已經將原本的 App.jsx 改名為 Home.jsx
import DOOHBiddingSystem from './Home'; 
import AdminPanel from './AdminPanel';
import Privacy from './Privacy';
import Terms from './Terms';

const App = () => {
  return (
    // 最外層包住 LanguageProvider，這樣裡面的 AdminPanel 才能使用 useLanguage
    <LanguageProvider>
      
      {/* 包住 BrowserRouter 以啟用路由功能 */}
      <BrowserRouter>
        <Routes>
          
          {/* === 主頁面 (一般用戶競價介面) === */}
          <Route path="/" element={<DOOHBiddingSystem />} />

          {/* === 管理員後台 === */}
          <Route path="/admin" element={<AdminPanel />} />

          {/* === 法律條款頁面 === */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* === 404 處理 === */}
          {/* 如果用戶輸入亂碼網址 (例如 /abcde)，自動跳轉回主頁 */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </BrowserRouter>
      
    </LanguageProvider>
  );
};

export default App;