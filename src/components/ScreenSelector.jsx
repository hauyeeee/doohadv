// src/components/ScreenSelector.jsx

import React from 'react';
import { MapPin, Info } from 'lucide-react';

const ScreenSelector = ({ 
  selectedScreens, 
  screenSearchTerm, 
  setScreenSearchTerm, 
  isScreensLoading, 
  filteredScreens, 
  toggleScreen, 
  setViewingScreen 
}) => {

  // ... (保留原本的 Header / Search Bar 部分)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ... Search Input ... */}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="p-4 w-16 text-center">選取</th>
              <th className="p-4">屏幕資料</th>
              {/* 🔥 刪除了「區域」和「規格」的 TH */}
              <th className="p-4 text-right">詳情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isScreensLoading ? (
               <tr><td colSpan="3" className="p-8 text-center text-slate-400">Loading...</td></tr>
            ) : filteredScreens.length === 0 ? (
               <tr><td colSpan="3" className="p-8 text-center text-slate-400">沒有找到屏幕</td></tr>
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
                      {/* 將地點和區域合併顯示在這裡，比較美觀 */}
                      {screen.location} {screen.district ? `(${screen.district})` : ''}
                    </div>
                  </td>

                  {/* 🔥 刪除了顯示規格和區域的 TD */}

                  <td className="p-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewingScreen(screen); }} // 防止點擊按鈕時觸發選取
                      className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors flex items-center justify-end gap-1 ml-auto font-bold text-xs"
                    >
                      <Info size={16}/> 詳情
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