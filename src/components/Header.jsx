import React from 'react';
import { Monitor, LogIn } from 'lucide-react';

const Header = ({ user, onLoginClick, onProfileClick }) => (
  <header className="bg-white border-b sticky top-8 z-30 px-4 py-3 shadow-sm flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="bg-blue-600 text-white p-1.5 rounded-lg"><Monitor size={20} /></div>
      <div className="flex flex-col">
        <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">DOOHadv</h1>
        <span className="text-[10px] text-slate-500 font-bold">自己廣告自己投 Bid your own adv here!</span>
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      {user ? (
        <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-lg transition-colors">
          <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
        </button>
      ) : (
        <button onClick={onLoginClick} className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors">
          <LogIn size={16} /> 登入
        </button>
      )}
    </div>
  </header>
);

export default Header;