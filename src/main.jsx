import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom'; // 🔥 引入路由工具

// 引入你的頁面
import App from './App';
// 請確保你的 AdminPanel 檔案路徑正確，如果是在 src/pages/ 就用下面這句
import AdminPanel from './pages/AdminPanel'; 
// 🔥 引入剛剛建立的新日曆組件 (請確保檔案路徑正確)
import AdminMasterCalendar from './components/admin/AdminMasterCalendar';

// 引入 CSS
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* 🔥 用 BrowserRouter 包住整個 App */}
      <Routes>
        
        {/* 🏠 主頁路徑 (前台) */}
        <Route path="/" element={<App />} />
        
        {/* 👑 Admin 後台主頁 */}
        <Route path="/admin" element={<AdminPanel />} />

        {/* 🗓️ Admin 排程日曆 (這是新加的一行) */}
        <Route path="/admin/calendar" element={<AdminMasterCalendar />} />
        
        {/* (可選) 404 頁面：如果亂打網址，跳回主頁 */}
        <Route path="*" element={<App />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);