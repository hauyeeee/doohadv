import React from 'react';
import { Monitor, LogIn, HelpCircle, Globe, Bell } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Header = ({ user, onLoginClick, onProfileClick, onHelpClick }) => {
  const { t, lang, toggleLanguage } = useLanguage();

  return (
    <div className="sticky top-0 z-40 flex flex-col">
      <header className="bg-white border-b px-4 py-3 shadow-sm flex items-center justify-between relative z-20">
        
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-xl shadow-lg" onClick={() => window.location.reload()}>
            <Monitor size={22} />
          </div>
          <div className="flex flex-col cursor-pointer" onClick={() => window.location.reload()}>
            <h1 className="font-extrabold text-xl text-slate-900 tracking-tight leading-none flex items-center gap-1">
              DOOH<span className="text-blue-600">adv</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:block">
              {t('ad_platform')}
            </span>
          </div>

          {/* 玩法說明按鈕 */}
          <button 
            onClick={onHelpClick}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-full transition-colors ml-2"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">{t('play_guide')}</span>
          </button>
        </div>
        
        {/* Right Side: Language + Login */}
        <div className="flex items-center gap-3">
          
          {/* 🔥 語言切換按鈕 */}
          <button 
            onClick={toggleLanguage} 
            className="text-slate-500 hover:text-slate-900 font-bold text-xs flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-full transition-colors"
          >
              <Globe size={14}/> 
              {lang === 'zh' ? 'EN' : '繁'}
          </button>

          {user ? (
            <>
              {/* Notification Bell (Visual Only) */}
              <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full relative hidden sm:block">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>

              {/* User Profile Button */}
              <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-slate-50 p-1 pr-3 rounded-full border border-slate-100 transition-all">
                <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-700 leading-tight">{user.displayName}</p>
                  <p className="text-[9px] text-slate-400">My Credits: $0</p>
                </div>
              </button>
            </>
          ) : (
            /* 🔥 Login Button (原本消失的部分都在這裡) */
            <button 
              onClick={onLoginClick} 
              className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all shadow-md active:scale-95"
            >
              <LogIn size={14} /> {t('login')}
            </button>
          )}
        </div>
      </header>
    </div>
  );
};

export default Header;