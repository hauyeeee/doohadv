import React from 'react';
import { Monitor, LogIn, TrendingUp, Bell } from 'lucide-react';

const Header = ({ user, onLoginClick, onProfileClick }) => (
  <div className="sticky top-0 z-40 flex flex-col">
    {/* --- Main Header --- */}
    <header className="bg-white border-b px-4 py-3 shadow-sm flex items-center justify-between relative z-20">
      <div className="flex items-center gap-3">
        <div className="bg-slate-900 text-white p-2 rounded-xl shadow-lg">
          <Monitor size={22} />
        </div>
        <div className="flex flex-col">
          <h1 className="font-extrabold text-xl text-slate-900 tracking-tight leading-none flex items-center gap-1">
            DOOH<span className="text-blue-600">adv</span>
          </h1>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Ad Trading Platform
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* Notification Bell (Visual Only) */}
            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-slate-50 p-1 pr-3 rounded-full border border-slate-100 transition-all">
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-700 leading-tight">{user.displayName}</p>
                <p className="text-[9px] text-slate-400">My Credits: $0</p>
              </div>
            </button>
          </>
        ) : (
          <button onClick={onLoginClick} className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">
            <LogIn size={14} /> 登入 / 註冊
          </button>
        )}
      </div>
    </header>

    {/* --- Live Market Ticker (跑馬燈) --- */}
    <div className="bg-slate-900 text-white py-1.5 overflow-hidden relative z-10 border-b border-slate-800">
      <div className="whitespace-nowrap animate-marquee flex items-center gap-8 text-[10px] font-mono font-bold tracking-wide">
        {/* 重複內容以確保滾動流暢 */}
        <span className="text-green-400 flex items-center gap-1">🚀 中環旗艦店: $200 (Winning)</span>
        <span className="text-slate-400">|</span>
        <span className="text-blue-400 flex items-center gap-1">💎 銅鑼灣SOGO: $350 (New Bid)</span>
        <span className="text-slate-400">|</span>
        <span className="text-purple-400 flex items-center gap-1">🔥 旺角朗豪坊: $180 (Hot)</span>
        <span className="text-slate-400">|</span>
        <span className="text-orange-400 flex items-center gap-1">⚡️ 尖沙咀海防道: $500 (Buyout!)</span>
        <span className="text-slate-400">|</span>
        <span className="text-green-400 flex items-center gap-1">🚀 中環旗艦店: $200 (Winning)</span>
        <span className="text-slate-400">|</span>
        <span className="text-blue-400 flex items-center gap-1">💎 銅鑼灣SOGO: $350 (New Bid)</span>
      </div>
    </div>
    
    {/* 為了讓跑馬燈動起來，需要在 index.css 加動畫，或者直接用 Tailwind config */}
    <style jsx>{`
      @keyframes marquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
      .animate-marquee {
        animation: marquee 20s linear infinite;
      }
    `}</style>
  </div>
);

export default Header;