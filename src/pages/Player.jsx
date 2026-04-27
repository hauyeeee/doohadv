import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const Player = () => {
  const { screenId } = useParams(); 
  const [screenData, setScreenData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 🔥 核心修復 1：使用 Ref 記錄基礎名單，防止隨機洗牌導致無限重繪
  const basePlaylistRef = useRef("");

  // 監聽屏幕資料
  useEffect(() => {
    if (!screenId) return;
    const q = query(
      collection(db, "screens"), 
      where("id", "in", [screenId, Number(screenId), String(screenId)])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
          setScreenData(snapshot.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, [screenId]);

  // 監聽有效訂單
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

  // 🔥 核心修復 2：排程邏輯優化（移除了 playlist 依賴項，徹底截斷當機循環）
  useEffect(() => {
    if (!screenData) return;

    const checkSchedule = () => {
      // 1. 處理緊急插播
      if (screenData.emergencyOverride && screenData.emergencyOverride.trim() !== "") {
        const overrideUrl = screenData.emergencyOverride;
        if (basePlaylistRef.current !== `override-${overrideUrl}`) {
            basePlaylistRef.current = `override-${overrideUrl}`;
            setPlaylist([overrideUrl]); 
            setCurrentIndex(0);
        }
        return; 
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHour = now.getHours();

      let paidVideos = [];
      let totalPaidSlots = 0;
      const MAX_SLOTS_PER_LOOP = 10; 

      // 2. 篩選目前時段應播廣告
      for (const order of activeOrders) {
        if (!order.hasVideo || !order.videoUrl) continue;
        const matchedSlot = order.detailedSlots?.find(slot => 
            slot.date === dateStr && 
            parseInt(slot.hour) === currentHour && 
            String(slot.screenId) === String(screenId) && 
            (slot.slotStatus === 'won' || order.status === 'paid' || order.status === 'completed')
        );

        if (matchedSlot) {
            const targetSov = matchedSlot.sov || order.sov || 10;
            const playCount = Math.max(1, Math.round(targetSov / 10)); 
            totalPaidSlots += playCount;
            for (let i = 0; i < playCount; i++) {
                paidVideos.push(order.videoUrl);
            }
        }
      }

      // 3. 填充內部宣傳片 (House Ads)
      const houseAds = screenData.houseAds || []; 
      let finalPlaylist = [...paidVideos];
      const remainingSlots = MAX_SLOTS_PER_LOOP - totalPaidSlots;

      if (remainingSlots > 0 && houseAds.length > 0) {
          let houseAdIndex = 0;
          for (let i = 0; i < remainingSlots; i++) {
              finalPlaylist.push(houseAds[houseAdIndex]);
              houseAdIndex = (houseAdIndex + 1) % houseAds.length;
          }
      } else if (finalPlaylist.length === 0 && houseAds.length === 0) {
          const defaultVid = screenData.defaultVideo || ""; 
          if (defaultVid) finalPlaylist.push(defaultVid);
      }

      // 🔥 4. 檢查名單是否有實質變動（排序後對比）
      const currentBaseStr = JSON.stringify([...finalPlaylist].sort());
      if (currentBaseStr !== basePlaylistRef.current) {
          basePlaylistRef.current = currentBaseStr;

          // 只有名單變動才執行隨機洗牌
          for (let i = finalPlaylist.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [finalPlaylist[i], finalPlaylist[j]] = [finalPlaylist[j], finalPlaylist[i]];
          }

          setPlaylist(finalPlaylist); 
          setCurrentIndex(0); 
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);
  }, [screenData, activeOrders, screenId]); // 絕對不要在這裡加 playlist

  const handleMediaEnded = () => {
      if (playlist.length > 1) {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
      }
  };

  const currentMediaUrl = playlist[currentIndex] || '';
  const isImage = /\.(jpeg|jpg|gif|png|webp|avif)(\?.*)?$/i.test(currentMediaUrl);

  // 圖片自動切換邏輯
  useEffect(() => {
      if (isImage && currentMediaUrl && playlist.length > 1) {
          const timer = setTimeout(() => {
              handleMediaEnded();
          }, 10000); 
          return () => clearTimeout(timer); 
      }
  }, [currentIndex, currentMediaUrl, isImage, playlist.length]);

  if (!currentMediaUrl) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white/50 text-sm font-mono fixed inset-0">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
        Waiting for Signal...
        {!screenData && <span className="text-[10px] text-red-400 mt-2">Connecting to DB (ID: {screenId})...</span>}
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden fixed inset-0">
      {isImage ? (
          <img 
            // 🔥 核心修復 3：加入 currentIndex 作為 key，確保相同圖片也能觸發重繪
            key={`${currentIndex}-${currentMediaUrl}`}
            src={currentMediaUrl} 
            alt="Ad"
            className="w-full h-full object-cover animate-in fade-in duration-500" 
            onError={(e) => setTimeout(() => window.location.reload(), 5000)}
          />
      ) : (
          <video 
            // 🔥 核心修復 4：加入 currentIndex 作為 key，解決連續播放相同影片時卡住的問題
            key={`${currentIndex}-${currentMediaUrl}`} 
            src={currentMediaUrl} 
            autoPlay 
            muted 
            playsInline
            loop={playlist.length <= 1} 
            onEnded={handleMediaEnded}  
            className="w-full h-full object-cover animate-in fade-in duration-500" 
            onError={(e) => setTimeout(() => window.location.reload(), 5000)}
          />
      )}
    </div>
  );
};

export default Player;