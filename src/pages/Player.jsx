import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const Player = () => {
  const { screenId } = useParams(); // 從網址獲取當前屏幕 ID (字串)
  const [currentMediaUrl, setCurrentMediaUrl] = useState('');
  const [screenData, setScreenData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);

  // 1. 監聽專屬這部屏幕的設定 (Priority 1 & Priority 3)
  useEffect(() => {
    if (!screenId) return;

    // 🔥 修正：使用 query 搜尋「欄位 id」等於 screenId 的資料
    // 同時兼容 Firebase 內儲存的是數字 (Number) 還是字串 (String)
    const q = query(
      collection(db, "screens"),
      where("id", "in", [screenId, Number(screenId), String(screenId)])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // 找到符合的屏幕資料，存入 state
        setScreenData(snapshot.docs[0].data());
      } else {
        console.error(`❌ 找不到 ID 為 ${screenId} 的屏幕資料`);
      }
    });

    return () => unsubscribe();
  }, [screenId]);

  // 2. 監聽已付款/已中標的訂單 (Priority 2)
  useEffect(() => {
    const q = query(
      collection(db, "orders"), 
      where("status", "in", ["won", "paid", "completed", "partially_won"])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data());
      setActiveOrders(orders);
    });
    return () => unsubscribe();
  }, []);

  // 3. 核心：三層優先級邏輯 (每 10 秒檢查一次當前時間)
  useEffect(() => {
    if (!screenData) return; // 如果還沒抓到設定，先不要做任何事

    const checkSchedule = () => {
      // 🚨 頂層 (Priority 1)：緊急插播 (Manual Override)
      if (screenData.emergencyOverride && screenData.emergencyOverride.trim() !== "") {
        if (currentMediaUrl !== screenData.emergencyOverride) {
          setCurrentMediaUrl(screenData.emergencyOverride);
          console.log("🚨 觸發緊急插播模式");
        }
        return; // 截斷下方邏輯
      }

      // 🤖 中層 (Priority 2)：全自動排程
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const dateStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const currentHour = now.getHours();

      let scheduledVideo = null;

      for (const order of activeOrders) {
        if (!order.hasVideo || !order.videoUrl) continue;
        
        const matchedSlot = order.detailedSlots?.find(slot => 
          slot.date === dateStr && 
          parseInt(slot.hour) === currentHour && 
          String(slot.screenId) === String(screenId) &&
          (slot.slotStatus === 'won' || order.status === 'paid' || order.status === 'completed')
        );

        if (matchedSlot) {
          scheduledVideo = order.videoUrl;
          break; 
        }
      }

      if (scheduledVideo) {
        if (currentMediaUrl !== scheduledVideo) {
          setCurrentMediaUrl(scheduledVideo);
          console.log(`🤖 自動排程：正在播放客人的廣告`);
        }
        return; // 截斷下方邏輯
      }

      // 📺 底層 (Priority 3)：預設影片 (Default Video)
      const defaultVid = screenData.defaultVideo || ""; 
      if (currentMediaUrl !== defaultVid) {
        setCurrentMediaUrl(defaultVid);
        console.log("📺 無人買廣告，播放預設宣傳片");
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);

  }, [screenData, activeOrders, screenId, currentMediaUrl]);

  
  // ... (上面所有 useEffect 邏輯保留不變) ...

  // UI 渲染：載入中畫面
  if (!currentMediaUrl) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white/50 text-sm font-mono fixed inset-0">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
        Waiting for Signal...
        {!screenData && <span className="text-[10px] text-red-400 mt-2">Connecting to DB...</span>}
      </div>
    );
  }

  // UI 渲染：正式播放器 (加入防彈機制)
  return (
    <div className="w-screen h-screen bg-black overflow-hidden fixed inset-0">
      <video 
        key={currentMediaUrl} // 🔥 保險 1：強迫 React 每次轉 URL 都重新建構 Video 元件
        src={currentMediaUrl} 
        autoPlay 
        loop 
        muted // ⚠️ 充電寶屏幕多數無聲，muted 可確保突破瀏覽器自動播放限制
        playsInline
        className="w-full h-full object-cover" 
        onError={(e) => {
            // 🔥 保險 2：萬一條片死 Link 或斷網，自動 Refresh 網頁自救
            console.error("❌ 影片載入失敗，嘗試重新載入...", e);
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        }}
      />
    </div>
  );
};

export default Player;