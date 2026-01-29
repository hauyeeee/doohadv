import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom'; // 🔥 引入路由工具

// 引入你的頁面
import App from './App';
import AdminPanel from './pages/AdminPanel'; // ⚠️ 確保路徑正確，如果你檔案放在 src/pages/ 下

// 引入 CSS (保留你原本的)
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* 🔥 用 BrowserRouter 包住整個 App */}
      <Routes>
        
        {/* 🏠 主頁路徑 */}
        <Route path="/" element={<App />} />
        
        {/* 👑 Admin 後台路徑 */}
        <Route path="/admin" element={<AdminPanel />} />
        
        {/* (可選) 404 頁面：如果亂打網址，跳回主頁 */}
        <Route path="*" element={<App />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);