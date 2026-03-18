import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Info, Search, Map } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// 計算兩個 GPS 坐標之間嘅直線距離 (單位：米)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
  const [isLocating, setIsLocating] = useState(false);

  const safeT = (key, defaultText) => {
      const text = t(key);
      return text === key ? defaultText : text;
  };

  // 尋找最近屏幕嘅核心邏輯
  const handleFindNearestScreen = (isAutoTrigger = false) => {
    if (!navigator.geolocation) {
      if (!isAutoTrigger) alert(lang === 'en' ? "Your browser does not support GPS." : "你的瀏覽器不支援 GPS 定位功能！");
      return;
    }

    setIsLocating(true);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        let closestScreen = null;
        let minDistance = Infinity;

        filteredScreens.forEach((screen) => {
          if (screen.lat && screen.lng) {
            const distance = calculateDistance(userLat, userLng, screen.lat, screen.lng);
            if (distance < minDistance) {
              minDistance = distance;
              closestScreen = screen;
            }
          }
        });

        if (window.gtag && closestScreen) {
          window.gtag('event', 'location_matched', {
            'event_category': 'Offline_Tracking',
            'screen_name': closestScreen.name,
            'distance_meters': Math.round(minDistance),
            'is_within_range': minDistance <= 10 ? 'yes' : 'no'
          });
        }

        if (closestScreen && minDistance <= 10) {
          if (!selectedScreens.has(closestScreen.id)) {
             toggleScreen(closestScreen.id); 
          }
          if (!isAutoTrigger) {
             alert(lang === 'en' 
                ? `📍 Found the nearest screen: ${closestScreen.name} (${Math.round(minDistance)}m away)`
                : `📍 已為你定位到最近的屏幕：${closestScreen.name} (相距 ${Math.round(minDistance)} 米)`
             );
          }
        } else {
          if (!isAutoTrigger) {
             alert(lang === 'en' ? "No screens found within 10 meters. Please select from the list." : "你附近 10 米內暫時未有屏幕，請在列表自行選擇！");
          }
        }
      },
      (error) => {
        setIsLocating(false);
        if (!isAutoTrigger) {
           if (error.code === 1) alert(lang === 'en' ? "Location permission denied." : "你拒絕了提供位置權限，無法使用自動定位功能。");
           else alert(lang === 'en' ? "Failed to get location. Is GPS turned on?" : "無法獲取你的位置，請確保手機 GPS 功能已開啟。");
        }
      },
      options
    );
  };

  useEffect(() => {
    if (!isScreensLoading && filteredScreens.length > 0) {
      const hasAutoLocated = sessionStorage.getItem('hasAutoLocated');
      if (!hasAutoLocated) {
        sessionStorage.setItem('hasAutoLocated', 'true'); 
        handleFindNearestScreen(true); 
      }
    }
  }, [isScreensLoading, filteredScreens]);

  // 🔥 新增：智能分區邏輯 (Group screens by District)
  const groupedScreens = useMemo(() => {
    if (!filteredScreens || filteredScreens.length === 0) return {};
    
    return filteredScreens.reduce((acc, screen) => {
      // 如果冇填 District，就放入「未分類區域」
      const districtName = screen.district?.trim() || (lang === 'en' ? 'Other Districts' : '未分類區域');
      if (!acc[districtName]) {
        acc[districtName] = [];
      }
      acc[districtName].push(screen);
      return acc;
    }, {});
  }, [filteredScreens, lang]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[600px]">
      
      {/* 頂部固定按鈕區 */}
      <div className="p-4 border-b border-slate-100 bg-white shrink-0">
        <button 
            onClick={() => handleFindNearestScreen(false)}
            disabled={isLocating}
            className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm border
                ${isLocating 
                    ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:shadow-md'
                }
            `}
        >
            {isLocating ? (
                <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    {lang === 'en' ? 'Locating...' : '正在精準定位中...'}
                </>
            ) : (
                <>
                    <span className="text-lg">📍</span> 
                    {lang === 'en' ? 'Find Screens Near Me' : '尋找我身邊的屏幕'}
                </>
            )}
        </button>
      </div>

      {/* 搜尋列 */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 shrink-0">
          <Search size={16} className="text-slate-400"/>
          <input 
            type="text" 
            placeholder={lang === 'en' ? "Search screens..." : "搜尋屏幕..."}
            value={screenSearchTerm}
            onChange={(e) => setScreenSearchTerm(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder-slate-400 font-medium"
          />
      </div>

      {/* 列表標題列 */}
      <div className="grid grid-cols-12 gap-2 bg-slate-100 text-slate-500 font-bold border-b border-slate-200 p-3 text-xs uppercase tracking-wider shrink-0 pr-4">
          <div className="col-span-2 text-center">{safeT('filter_selected', lang==='en'?'Selected':'已選')}</div>
          <div className="col-span-8">{safeT('screen_name', lang==='en'?'Screen Name':'屏幕名稱')}</div>
          <div className="col-span-2 text-right"></div>
      </div>

      {/* 🔥 Scrollable 內容區 (分區顯示) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 pb-4">
        {isScreensLoading ? (
            <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                {safeT('loading', 'Loading...')}
            </div>
        ) : Object.keys(groupedScreens).length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-medium">
                {lang === 'en' ? 'No screens found.' : '找不到符合條件的屏幕。'}
            </div>
        ) : (
            Object.entries(groupedScreens).map(([district, districtScreens]) => (
                <div key={district} className="mb-4 bg-white border-y border-slate-100 first:border-t-0 shadow-sm">
                    {/* 區域 Header */}
                    <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 tracking-wide sticky top-0 z-10 shadow-sm">
                        <Map size={14} className="text-blue-400"/>
                        {district}
                        <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] ml-auto">
                            {districtScreens.length}
                        </span>
                    </div>

                    {/* 該區域的屏幕列表 */}
                    <div className="divide-y divide-slate-50">
                        {districtScreens.map(screen => {
                            const isSelected = selectedScreens.has(screen.id);
                            return (
                                <div 
                                  key={screen.id} 
                                  className={`grid grid-cols-12 gap-2 items-center p-3 transition-colors cursor-pointer group hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'}`}
                                  onClick={() => {
                                     toggleScreen(screen.id);
                                     if (window.gtag && !isSelected) {
                                        window.gtag('event', 'select_screen', {
                                            'event_category': 'Interaction',
                                            'screen_name': screen.name
                                        });
                                     }
                                  }}
                                >
                                  {/* Checkbox */}
                                  <div className="col-span-2 flex justify-center">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-sm transform scale-110' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                                      {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                  </div>
                                  
                                  {/* 屏幕資料 */}
                                  <div className="col-span-8">
                                    <div className={`font-bold text-sm transition-colors ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                                        {screen.name}
                                    </div>
                                    <div className="flex items-start gap-1 text-slate-500 text-[11px] mt-1 leading-tight pr-2">
                                      <MapPin size={12} className="shrink-0 mt-0.5" /> 
                                      <span className="truncate">{screen.location}</span>
                                    </div>
                                  </div>

                                  {/* Info 掣 */}
                                  <div className="col-span-2 flex justify-end">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setViewingScreen(screen); }} 
                                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-100 p-2 rounded-full transition-all"
                                      title={lang === 'en' ? 'Details' : '詳情'}
                                    >
                                      <Info size={18}/>
                                    </button>
                                  </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ScreenSelector;