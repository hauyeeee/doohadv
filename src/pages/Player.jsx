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
      if (!snapshot.empty) {
          setScreenData(snapshot.docs[0].data());
      }
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

  useEffect(() => {
    if (!screenData) return;

    const checkSchedule = () => {
      if (screenData.emergencyOverride && screenData.emergencyOverride.trim() !== "") {
        const overrideUrl = screenData.emergencyOverride;
        if (JSON.stringify(playlist) !== JSON.stringify([overrideUrl])) {
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

      for (let i = finalPlaylist.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalPlaylist[i], finalPlaylist[j]] = [finalPlaylist[j], finalPlaylist[i]];
      }

      if (JSON.stringify(finalPlaylist) !== JSON.stringify(playlist)) {
          setPlaylist(finalPlaylist); 
          setCurrentIndex(0); 
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);
  }, [screenData, activeOrders, screenId, playlist]);

  const handleMediaEnded = () => {
      if (playlist.length > 1) {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
      }
  };

  const currentMediaUrl = playlist[currentIndex] || '';
  
  // 🔥 核心：判斷當前媒體是否為圖片
  const isImage = /\.(jpeg|jpg|gif|png|webp|avif)(\?.*)?$/i.test(currentMediaUrl);

  // 🔥 核心：如果是圖片，啟動 10 秒倒數計時器
  useEffect(() => {
      if (isImage && currentMediaUrl && playlist.length > 1) {
          const timer = setTimeout(() => {
              handleMediaEnded();
          }, 10000); // 10000 毫秒 = 10 秒
          return () => clearTimeout(timer); // 清除計時器防止記憶體洩漏
      }
  }, [currentIndex, currentMediaUrl, isImage, playlist.length]);

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
      {isImage ? (
          <img 
            key={currentMediaUrl}
            src={currentMediaUrl} 
            alt="Ad"
            className="w-full h-full object-cover animate-in fade-in duration-500" 
            onError={(e) => setTimeout(() => window.location.reload(), 5000)}
          />
      ) : (
          <video 
            key={currentMediaUrl} 
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