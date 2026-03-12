import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const Player = () => {
  const { screenId } = useParams(); 
  const [screenData, setScreenData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!screenId) return;
    const q = query(
      collection(db, "screens"),
      where("id", "in", [screenId, Number(screenId), String(screenId)])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setScreenData(snapshot.docs[0].data());
    });
    return () => unsubscribe();
  }, [screenId]);

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

  // 🔥 核心：支援 SOV 權重分配嘅播放引擎
  useEffect(() => {
    if (!screenData) return;

    const checkSchedule = () => {
      // 1. 緊急插播 (強制)
      if (screenData.emergencyOverride && screenData.emergencyOverride.trim() !== "") {
        const overrideUrl = screenData.emergencyOverride;
        if (JSON.stringify(playlist) !== JSON.stringify([overrideUrl])) {
            setPlaylist([overrideUrl]);
            setCurrentIndex(0);
        }
        return; 
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const dateStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const currentHour = now.getHours();

      let currentHourVideos = [];

      for (const order of activeOrders) {
        if (!order.hasVideo || !order.videoUrl) continue;
        
        const matchedSlot = order.detailedSlots?.find(slot => 
          slot.date === dateStr && 
          parseInt(slot.hour) === currentHour && 
          String(slot.screenId) === String(screenId) &&
          (slot.slotStatus === 'won' || order.status === 'paid' || order.status === 'completed')
        );

        if (matchedSlot) {
            // 🔥 計算 SOV 權重：如果係企業客 (有 sov)，10% = 1 次，50% = 5 次。一般客預設 1 次。
            let playCount = 1;
            if (order.orderType === 'corporate' || matchedSlot.isCorporate) {
                const targetSov = matchedSlot.sov || order.sov || 10;
                playCount = Math.max(1, Math.round(targetSov / 10)); // 轉換成播放次數
            }
            
            for (let i = 0; i < playCount; i++) {
                currentHourVideos.push(order.videoUrl);
            }
        }
      }

      // 如果無人買，播 Default
      if (currentHourVideos.length === 0) {
          const defaultVid = screenData.defaultVideo || ""; 
          if (defaultVid) currentHourVideos.push(defaultVid);
      }

      // 洗牌 (Shuffle)，等啲企業廣告平均分佈，唔會連續播 5 次同一樣
      for (let i = currentHourVideos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentHourVideos[i], currentHourVideos[j]] = [currentHourVideos[j], currentHourVideos[i]];
      }

      if (JSON.stringify(currentHourVideos) !== JSON.stringify(playlist)) {
          setPlaylist(currentHourVideos);
          setCurrentIndex(0); 
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);
  }, [screenData, activeOrders, screenId, playlist]);

  const handleVideoEnded = () => {
      if (playlist.length > 1) {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
      }
  };

  const currentMediaUrl = playlist[currentIndex] || '';

  if (!currentMediaUrl) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white/50 text-sm font-mono fixed inset-0">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
        Waiting for Signal...
        {!screenData && <span className="text-[10px] text-red-400 mt-2">Connecting to DB...</span>}
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden fixed inset-0">
      <video 
        key={currentMediaUrl} 
        src={currentMediaUrl} 
        autoPlay 
        muted 
        playsInline
        loop={playlist.length <= 1} 
        onEnded={handleVideoEnded}  
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