import React, { useState } from 'react'; // 🔥 加咗 useState
import { MapPin, Info, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// 計算兩個 GPS 坐標之間嘅直線距離 (單位：米)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // 地球半徑 (米)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 傳回距離 (米)
};

const ScreenSelector = ({ 
  selectedScreens, 
  screenSearchTerm, 
  setScreenSearchTerm, 
  isScreensLoading, 
  filteredScreens, // 👉 呢個就係屏幕列表
  toggleScreen,    // 👉 呢個就係揀屏幕嘅 Function
  setViewingScreen 
}) => {
  const { t, lang } = useLanguage();
  
  // 🔥 1. 加個 State 記住係咪 Load 緊 GPS
  const [isLocating, setIsLocating] = useState(false);

  // 安全翻譯函數
  const safeT = (key, defaultText) => {
      const text = t(key);
      return text === key ? defaultText : text;
  };

  // 🔥 2. 尋找最近屏幕嘅核心邏輯
  const handleFindNearestScreen = () => {
    if (!navigator.geolocation) {
      alert(lang === 'en' ? "Your browser does not support GPS." : "你的瀏覽器不支援 GPS 定位功能！");
      return;
    }

    setIsLocating(true); // 轉圈圈動畫開始

    // 強制開啟高精度模式 (要求精準到幾米內)
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false); // 轉圈圈動畫完結
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        let closestScreen = null;
        let minDistance = Infinity;

        // 逐部機對比距離 (用你傳入嚟嘅 filteredScreens)
        filteredScreens.forEach((screen) => {
          if (screen.lat && screen.lng) {
            const distance = calculateDistance(userLat, userLng, screen.lat, screen.lng);
            if (distance < minDistance) {
              minDistance = distance;
              closestScreen = screen;
            }
          }
        });

        // 判斷：設定 50 米內先算係「喺現場」(你可以自己調較呢個數字)
        if (closestScreen && minDistance <= 50) {
          
          // 👉 動作 1：自動幫客揀定呢部機！(如果未揀嘅話)
          if (!selectedScreens.has(closestScreen.id)) {
             toggleScreen(closestScreen.id); 
          }
          
          alert(lang === 'en' 
            ? `📍 Found the nearest screen: ${closestScreen.name} (${Math.round(minDistance)}m away)`
            : `📍 已為你定位到最近的屏幕：${closestScreen.name} (相距 ${Math.round(minDistance)} 米)`
          );

          // 👉 動作 2：靜靜雞射個 Event 上 GA4
          if (window.gtag) {
            window.gtag('event', 'location_matched', {
              'event_category': 'Offline_Tracking',
              'screen_name': closestScreen.name,
              'distance_meters': Math.round(minDistance)
            });
            console.log(`✅ 成功射上 GA4：${closestScreen.name}`);
          }
          
        } else {
          alert(lang === 'en'
            ? "No screens found within 50 meters. Please select from the list."
            : "你附近 50 米內暫時未有屏幕，請在列表自行選擇！"
          );
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("定位失敗", error);
        if (error.code === 1) {
          alert(lang === 'en' ? "Location permission denied." : "你拒絕了提供位置權限，無法使用自動定位功能。");
        } else {
          alert(lang === 'en' ? "Failed to get location. Is GPS turned on?" : "無法獲取你的位置，請確保手機 GPS 功能已開啟。");
        }
      },
      options
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 🔥 3. 新增的自動定位按鈕 */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <button 
            onClick={handleFindNearestScreen}
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

      {/* 原本的搜尋欄 */}
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