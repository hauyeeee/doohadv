import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const Player = () => {
  const { screenId } = useParams(); 
  const [screenData, setScreenData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  
  // 🔥 全新：播放清單狀態
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 1. 監聽專屬這部屏幕的設定
  useEffect(() => {
    if (!screenId) return;
    const q = query(
      collection(db, "screens"),
      where("id", "in", [screenId, Number(screenId), String(screenId)])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setScreenData(snapshot.docs[0].data());
      else console.error(`❌ 找不到 ID 為 ${screenId} 的屏幕資料`);
    });
    return () => unsubscribe();
  }, [screenId]);

  // 2. 監聽已付款/已中標的訂單
  useEffect(() => {
    const q = query(
      collection(db, "orders"), 
      where("status", "in", ["won", "paid", "completed", "partially_won"])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveOrders(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, []);

  // 3. 核心：智能輪播引擎 (每 10 秒檢查一次是否有新單加入)
  useEffect(() => {
    if (!screenData) return;

    const checkSchedule = () => {
      // 🚨 頂層：緊急插播 (強制只播呢條)
      if (screenData.emergencyOverride && screenData.emergencyOverride.trim() !== "") {
        const overrideUrl = screenData.emergencyOverride;
        if (JSON.stringify(playlist) !== JSON.stringify([overrideUrl])) {
            setPlaylist([overrideUrl]);
            setCurrentIndex(0);
        }
        return; 
      }

      // 🤖 中層：自動收集該小時內【所有】應播放的影片
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const dateStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const currentHour = now.getHours();

      let currentHourVideos = [];

      // 掃描所有有效訂單，找出當前小時的影片
      for (const order of activeOrders) {
        if (!order.hasVideo || !order.videoUrl) continue;
        
        const matchedSlot = order.detailedSlots?.find(slot => 
          slot.date === dateStr && 
          parseInt(slot.hour) === currentHour && 
          String(slot.screenId) === String(screenId) &&
          (slot.slotStatus === 'won' || order.status === 'paid' || order.status === 'completed')
        );

        if (matchedSlot) {
            // 🔥 不再用 break 彈出，而是將所有符合的影片塞入 Playlist
            currentHourVideos.push(order.videoUrl);
        }
      }

      // 📺 底層：如果完全冇人買，先放入預設影片
      if (currentHourVideos.length === 0) {
          const defaultVid = screenData.defaultVideo || ""; 
          if (defaultVid) currentHourVideos.push(defaultVid);
      }

      // 如果播放清單有變動（例如突然多咗客買），就更新 Playlist
      if (JSON.stringify(currentHourVideos) !== JSON.stringify(playlist)) {
          console.log("🔄 播放清單已更新，目前共有影片數:", currentHourVideos.length);
          setPlaylist(currentHourVideos);
          setCurrentIndex(0); // 更新後從第一條片開始播
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);

  }, [screenData, activeOrders, screenId, playlist]);

  // 🔥 魔法所在：當前影片播完時，自動跳下一條
  const handleVideoEnded = () => {
      if (playlist.length > 1) {
          // (目前 Index + 1) 除以 總數量 取餘數，做到無限 Loop
          setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
      }
  };

  // 取得當前應該播的影片 URL
  const currentMediaUrl = playlist[currentIndex] || '';

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

  // UI 渲染：正式播放器
  return (
    <div className="w-screen h-screen bg-black overflow-hidden fixed inset-0">
      <video 
        key={currentMediaUrl} // 確保每次 URL 改變都重新載入影片
        src={currentMediaUrl} 
        autoPlay 
        muted 
        playsInline
        loop={playlist.length <= 1} // 只有當 Playlist 得 1 條片時，先用原生 loop 功能
        onEnded={handleVideoEnded}  // 播完觸發跳下一條片
        className="w-full h-full object-cover" 
        onError={(e) => {
            console.error("❌ 影片載入失敗，嘗試重新載入...", e);
            setTimeout(() => window.location.reload(), 5000);
        }}
      />
    </div>
  );
};

export default Player;