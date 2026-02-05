import React from 'react';
import { Monitor, LogIn, HelpCircle, User } from 'lucide-react';

// 接收 onHelpClick 屬性
const Header = ({ user, onLoginClick, onProfileClick, onHelpClick }) => (
  <header className="bg-white border-b sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between">
    
    <div className="flex items-center gap-4">
      {/* Logo Area */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
        <div className="bg-blue-600 text-white p-1.5 rounded-lg"><Monitor size={20} /></div>
        <div className="flex flex-col">
          <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">DOOHadv</h1>
          <span className="text-[10px] text-slate-500 font-bold hidden sm:block">Ad Trading Platform</span>
        </div>
      </div>

      {/* 🔥 [新功能] 左上角的玩法按鈕 */}
      <button 
        onClick={onHelpClick}
        className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-full transition-colors ml-2"
      >
        <HelpCircle size={14} />
        <span className="hidden sm:inline">玩法說明</span>
      </button>
    </div>
    
    {/* Right Side Actions */}
    <div className="flex items-center gap-3">
      {user ? (
        <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-slate-50 p-1 pr-3 rounded-full border border-slate-200 transition-all">
          <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-white shadow-sm" />
          <span className="text-xs font-bold text-slate-700 hidden sm:block">{user.displayName}</span>
        </button>
      ) : (
        <button onClick={onLoginClick} className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">
          <LogIn size={16} /> 登入
        </button>
      )}
    </div>
  </header>
);

export default Header;