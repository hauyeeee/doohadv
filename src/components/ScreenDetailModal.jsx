import React from 'react';
import { Monitor, MapPin, X, Info, Map as MapIcon, AlertTriangle } from 'lucide-react';

const ScreenDetailModal = ({ screen, onClose }) => {
  if (!screen) return null;

  // 🔥🔥🔥 核心修復：兼容圖片讀取邏輯 🔥🔥🔥
  // 優先嘗試讀取 images 陣列 (Admin Panel 新格式)
  // 如果失敗，則讀取 photo1/photo2 (舊格式)
  const getImg = (index, legacyKey) => {
      // 1. 檢查是否存在 images 陣列且該 index 有值
      if (screen.images && Array.isArray(screen.images) && screen.images[index]) {
          return screen.images[index];
      }
      // 2. 如果沒有，嘗試讀取舊的單一欄位
      return screen[legacyKey];
  };

  // 預先獲取圖片 URL
  const img1 = getImg(0, 'photo1');
  const img2 = getImg(1, 'photo2');
  const img3 = getImg(2, 'photo3');

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
            
            {/* 警告條 (如有 restrictions) */}
            {screen.restrictions && (
                <div className="bg-red-50 border-b border-red-100 p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20}/>
                    <div>
                        <h4 className="text-sm font-bold text-red-700 mb-1">⚠️ 注意事項 / 限制條款 (Important Notes)</h4>
                        <p className="text-sm text-red-600 leading-relaxed whitespace-pre-wrap">{screen.restrictions}</p>
                    </div>
                </div>
            )}

            {/* Gallery (已修復圖片來源) */}
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 h-[400px] bg-black">
                {/* 主圖 (左側大圖) */}
                <div className="md:col-span-2 md:row-span-2 relative group">
                    {img1 ? (
                        <img src={img1} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Main View"/>
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-500 bg-slate-900 flex-col gap-2">
                            <Monitor size={48} className="opacity-20"/>
                            <span className="text-xs opacity-50">暫無圖片</span>
                        </div>
                    )}
                </div>

                {/* 右上小圖 */}
                <div className="relative group">
                    {img2 ? (
                        <img src={img2} className="w-full h-full object-cover" alt="View 2"/>
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-500 bg-slate-900 border-l border-b border-black/50">
                            <span className="text-xs opacity-30">No Image</span>
                        </div>
                    )}
                </div>

                {/* 右下小圖 */}
                <div className="relative group">
                    {img3 ? (
                        <img src={img3} className="w-full h-full object-cover" alt="View 3"/>
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-500 bg-slate-900 border-l border-black/50">
                            <span className="text-xs opacity-30">No Image</span>
                        </div>
                    )}
                </div>

                {/* 裝飾用黑塊 (當螢幕變寬時填充佈局) */}
                <div className="hidden md:block bg-slate-900"></div>
                <div className="hidden md:block bg-slate-900"></div>
            </div>

            {/* Map & Specs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                <div className="lg:col-span-2 h-[350px] bg-slate-100 rounded-2xl relative overflow-hidden group shadow-sm">
                   {screen.mapEmbedUrl && screen.mapEmbedUrl.includes("google") ? 
                      <iframe src={screen.mapEmbedUrl} width="100%" height="100%" className="absolute inset-0 border-0 grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"></iframe> : 
                      <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400">
                         <MapIcon size={48} className="opacity-20 mb-2"/>
                         <span>⚠️ 地圖設定錯誤或未設定</span>
                      </div>
                   }
                </div>
                <div className="lg:col-span-1 bg-white p-5 border rounded-2xl h-full flex flex-col justify-center shadow-sm">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-lg text-slate-700"><Info size={20}/> 屏幕規格</h4>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-slate-500">尺寸 (Size)</span>
                            <span className="font-bold text-slate-800">{screen.size || '32"'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-slate-500">方向 (Orientation)</span>
                            <span className="font-bold text-slate-800">{screen.orientation || 'Portrait (直向)'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-slate-500">解析度 (Resolution)</span>
                            <span className="font-bold text-slate-800">{screen.resolution || '1080x1920'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-slate-500">競價起標價</span>
                            <span className="font-bold text-blue-600 text-xl">HK$ {screen.basePrice || 50}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenDetailModal;