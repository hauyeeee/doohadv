import React from 'react';
// 🔥 將 Map 改名為 MapIcon，解決 "Constructor Map requires 'new'" 錯誤
import { Monitor, MapPin, X, Info, Map as MapIcon } from 'lucide-react';

const ScreenDetailModal = ({ screen, onClose }) => {
  if (!screen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-white shrink-0 z-10">
          <div>
            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
              <Monitor className="text-blue-600"/> {screen.name}
            </h3>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin size={14}/> {screen.location} 
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-2">{screen.district}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-500"/>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
            {/* Gallery */}
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 h-[400px] bg-black">
                <div className="md:col-span-2 md:row-span-2 relative group">
                    {screen.photo1 ? <img src={screen.photo1} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Main"/> : <div className="flex items-center justify-center w-full h-full text-slate-500">暫無圖片</div>}
                </div>
                <div className="relative group">
                    {screen.photo2 ? <img src={screen.photo2} className="w-full h-full object-cover" alt="View 2"/> : <div className="flex items-center justify-center w-full h-full text-slate-500 bg-slate-900">暫無圖片</div>}
                </div>
                <div className="relative group">
                    {screen.photo3 ? <img src={screen.photo3} className="w-full h-full object-cover" alt="View 3"/> : <div className="flex items-center justify-center w-full h-full text-slate-500 bg-slate-900">暫無圖片</div>}
                </div>
                <div className="hidden md:block bg-slate-900"></div>
                <div className="hidden md:block bg-slate-900"></div>
            </div>

            {/* Map & Specs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                <div className="lg:col-span-2 h-[350px] bg-slate-100 rounded-2xl relative overflow-hidden group shadow-sm">
                   {/* 🔥 使用 MapIcon */}
                   {screen.mapEmbedUrl && screen.mapEmbedUrl.includes("google") ? 
                      <iframe src={screen.mapEmbedUrl} width="100%" height="100%" className="absolute inset-0 border-0 grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"></iframe> : 
                      <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400">
                         <MapIcon size={48} className="opacity-20 mb-2"/>
                         <span>⚠️ 地圖設定錯誤</span>
                      </div>
                   }
                </div>
                <div className="lg:col-span-1 bg-white p-5 border rounded-2xl h-full flex flex-col justify-center">
                    <h4 className="font-bold mb-4 flex items-center gap-2"><Info size={18}/> 規格</h4>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">尺寸</span><span className="font-bold">{screen.size || '32"'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">方向</span><span className="font-bold">{screen.orientation || 'Portrait'}</span></div>
                        <div className="border-t my-2"></div>
                        <div className="flex justify-between"><span className="text-slate-500">底價</span><span className="font-bold text-blue-600 text-lg">HK$ {screen.basePrice || 50}</span></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenDetailModal;