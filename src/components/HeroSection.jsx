import React from 'react';
import { TrendingUp, Clock, Smartphone, ChevronDown, ArrowRight } from 'lucide-react';

const HeroSection = () => {
  return (
    <div className="relative bg-slate-50 border-b border-slate-200 overflow-hidden">
      
      {/* 背景裝飾 (Optional: Grid Pattern) */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50"></div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center text-center">
        
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 mb-6 shadow-sm animate-in slide-in-from-bottom-4 duration-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Live Ad Exchange V5.0</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-4 animate-in slide-in-from-bottom-6 duration-700">
          自己廣告，<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">自己投。</span>
        </h1>
        
        <p className="text-slate-500 text-sm md:text-lg max-w-xl mx-auto mb-10 font-medium animate-in slide-in-from-bottom-8 duration-700 delay-100">
          全港地標屏幕，由你掌控。無需經 Agency，價格透明，即時上架。
        </p>

        {/* 三大賣點 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl animate-in slide-in-from-bottom-10 duration-700 delay-200">
          
          {/* Card 1: 低門檻 */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all group cursor-default">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
              <TrendingUp size={20} className="text-green-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">低門檻</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <span className="text-green-600 font-bold bg-green-50 px-1 rounded">HK$50 起</span> 登上城市地標。<br/>小預算也能做大廣告。
            </p>
          </div>

          {/* Card 2: 高彈性 */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all group cursor-default">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
              <Clock size={20} className="text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">高彈性</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              按<span className="text-blue-600 font-bold bg-blue-50 px-1 rounded">小時</span>購買時段。<br/>隨時 Bid，隨時播。
            </p>
          </div>

          {/* Card 3: 全掌控 */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all group cursor-default">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-600 transition-colors">
              <Smartphone size={20} className="text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">全掌控</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              手機一按，全港聯播。<br/>成效數據一目了然。
            </p>
          </div>

        </div>

        <div className="mt-8 animate-bounce text-slate-300">
            <ChevronDown size={24} />
        </div>

      </div>
    </div>
  );
};

export default HeroSection;