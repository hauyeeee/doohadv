import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 🔥 2. 最外層必須包 HelmetProvider，否則會白屏報錯 'add' undefined */}
    
      <LanguageProvider>
        <BrowserRouter>
          {/* 🔥 3. 這裡只需要放 <App /> 
             因為你在 App.jsx 裡面已經設定好了 <Routes> 和所有頁面路徑 
             如果在這邊再寫 Route，會導致路由重複或混亂 
          */}
          <App />
        </BrowserRouter>
      </LanguageProvider>
  </React.StrictMode>,
);