import React from 'react';
import { Monitor, LogIn, HelpCircle, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; // 🔥 引入 Hook

const Header = ({ user, onLoginClick, onProfileClick, onHelpClick }) => {
  const { t, lang, toggleLanguage } = useLanguage(); // 🔥 攞野用

  return (
    <header className="bg-white border-b sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between">
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-blue-600 text-white p-1.5 rounded-lg"><Monitor size={20} /></div>
          <div className="flex flex-col">
            <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">DOOHadv</h1>
            {/* 🔥 用 t() 翻譯 */}
            <span className="text-[10px] text-slate-500 font-bold hidden sm:block">{t('ad_platform')}</span>
          </div>
        </div>

        <button 
          onClick={onHelpClick}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-full transition-colors ml-2"
        >
          <HelpCircle size={14} />
          {/* 🔥 用 t() 翻譯 */}
          <span className="hidden sm:inline">{t('play_guide')}</span>
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        {/* 🔥 語言切換按鈕 */}
        <button onClick={toggleLanguage} className="text-slate-400 hover:text-slate-700 font-bold text-xs flex items-center gap-1">
            <Globe size={14}/> {lang === 'zh' ? 'EN' : '繁'}
        </button>

        {user ? (
          <button onClick={onProfileClick} className="...">
             {/* ... User Icon ... */}
          </button>
        ) : (
          <button onClick={onLoginClick} className="...">
            <LogIn size={16} /> {t('login')} {/* 🔥 翻譯 */}
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;