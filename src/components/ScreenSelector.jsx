import React from 'react';
import { Monitor, Search, Loader2, MapPin, Map as MapIcon } from 'lucide-react';

const ScreenSelector = ({ 
  selectedScreens, 
  screenSearchTerm, 
  setScreenSearchTerm, 
  isScreensLoading, 
  filteredScreens, 
  toggleScreen, 
  setViewingScreen 
}) => (
  <section className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[350px]">
    <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Monitor size={16} /> 1. 選擇屏幕 ({selectedScreens.size})
      </h2>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>
        <div className="relative flex-1 w-full sm:w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input 
            type="text" 
            placeholder="搜尋地點..." 
            value={screenSearchTerm} 
            onChange={(e) => setScreenSearchTerm(e.target.value)} 
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto min-h-0">
      {isScreensLoading ? (
        <div className="text-center p-10"><Loader2 className="animate-spin inline"/></div>
      ) : (
        <table className="w-full text-left text-sm border-collapse table-fixed">
          <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 font-semibold">
            <tr>
              <th className="p-3 w-[15%] text-center">選取</th>
              <th className="p-3 w-[60%] sm:w-[40%]">屏幕名稱</th>
              <th className="p-3 hidden sm:table-cell sm:w-[15%]">區域</th>
              <th className="p-3 hidden sm:table-cell sm:w-[15%]">規格</th>
              <th className="p-3 w-[25%] sm:w-[15%] text-right">詳情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredScreens.map(s => (
              <tr key={s.id} className={`hover:bg-blue-50/50 ${selectedScreens.has(s.id) ? 'bg-blue-50' : ''}`}>
                <td className="p-3 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedScreens.has(s.id)} 
                    onChange={() => toggleScreen(s.id)} 
                    className="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </td>
                <td className="p-3 overflow-hidden">
                  <div className="font-bold truncate text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0"/> {s.location}
                  </div>
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <span className="bg-slate-100 px-2 py-1 rounded-full text-xs text-slate-600">{s.district}</span>
                </td>
                <td className="p-3 hidden sm:table-cell text-slate-500 text-xs">{s.size}</td>
                <td className="p-3 text-right">
                  <button 
                    onClick={() => setViewingScreen(s)} 
                    className="text-blue-600 text-xs flex items-center justify-end gap-1 ml-auto font-bold hover:underline bg-blue-50 sm:bg-transparent px-2 py-1 sm:p-0 rounded"
                  >
                    <MapIcon size={14}/> 詳情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </section>
);

export default ScreenSelector;