import React from 'react';
import { MapPin, Info, Search } from 'lucide-react'; // 🔥 加回 Search Icon
import { useLanguage } from '../context/LanguageContext';

const ScreenSelector = ({ 
  selectedScreens, 
  screenSearchTerm, 
  setScreenSearchTerm, 
  isScreensLoading, 
  filteredScreens, 
  toggleScreen, 
  setViewingScreen 
}) => {
  const { t, lang } = useLanguage();

  // 🔥 安全翻譯函數：如果 t() 返回 key 本身 (代表無翻譯)，就用預設值
  const safeT = (key, defaultText) => {
      const text = t(key);
      return text === key ? defaultText : text;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 🔥 搜尋欄 (如果你需要的話，這裡加回去了) */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <Search size={16} className="text-slate-400"/>
          <input 
            type="text" 
            placeholder={lang === 'en' ? "Search screens..." : "搜尋屏幕..."}
            value={screenSearchTerm}
            onChange={(e) => setScreenSearchTerm(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder-slate-400"
          />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="p-4 w-16 text-center">{safeT('filter_selected', lang==='en'?'Selected':'已選')}</th>
              <th className="p-4">{safeT('screen_name', lang==='en'?'Screen Name':'屏幕名稱')}</th> 
              <th className="p-4 text-right"></th> 
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isScreensLoading ? (
               <tr><td colSpan="3" className="p-8 text-center text-slate-400">{safeT('loading', 'Loading...')}</td></tr>
            ) : filteredScreens.length === 0 ? (
               <tr><td colSpan="3" className="p-8 text-center text-slate-400">No screens found</td></tr>
            ) : (
              filteredScreens.map(screen => (
                <tr 
                  key={screen.id} 
                  className={`transition-colors cursor-pointer hover:bg-slate-50 ${selectedScreens.has(screen.id) ? 'bg-blue-50/60' : ''}`}
                  onClick={() => toggleScreen(screen.id)}
                >
                  <td className="p-4 text-center">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition-all ${selectedScreens.has(screen.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                      {selectedScreens.has(screen.id) && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="font-bold text-slate-800 text-base">{screen.name}</div>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                      <MapPin size={12} /> 
                      {screen.location} {screen.district ? `(${screen.district})` : ''}
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewingScreen(screen); }} 
                      className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors flex items-center justify-end gap-1 ml-auto font-bold text-xs whitespace-nowrap"
                    >
                      <Info size={16}/> {lang === 'en' ? 'Details' : '詳情'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScreenSelector;