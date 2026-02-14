import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const Player = () => {
  const { screenId } = useParams(); // 從網址獲取當前屏幕 ID
  const [currentMediaUrl, setCurrentMediaUrl] = useState('');
  const [screenData, setScreenData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);

  // 1. 監聽專屬這部屏幕的設定 (Priority 1 & Priority 3)
  useEffect(() => {
    if (!screenId) return;
    const unsubscribe = onSnapshot(doc(db, "screens", screenId), (docSnap) => {
      if (docSnap.exists()) {
        setScreenData(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [screenId]);

  // 2. 監聽已付款/已中標的訂單 (Priority 2)
  useEffect(() => {
    // 抓取所有成功結算的訂單
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
    if (!screenData) return;

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
      // 將時間格式化為 "YYYY-MM-DD" 和當前小時 "H"
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const dateStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const currentHour = now.getHours();

      let scheduledVideo = null;

      // 在有效訂單中尋找符合「今天 + 現在這個小時 + 這個屏幕ID」且「已上傳影片」的訂單
      for (const order of activeOrders) {
        if (!order.hasVideo || !order.videoUrl) continue;
        
        const matchedSlot = order.detailedSlots?.find(slot => 
          slot.date === dateStr && 
          parseInt(slot.hour) === currentHour && 
          String(slot.screenId) === String(screenId) &&
          (slot.slotStatus === 'won' || order.status === 'paid' || order.status === 'completed') // 確保這個特定的 slot 是贏的
        );

        if (matchedSlot) {
          scheduledVideo = order.videoUrl;
          break; // 找到就停止
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
      const defaultVid = screenData.defaultVideo || ""; // Admin 可以在後台設定預設片
      if (currentMediaUrl !== defaultVid) {
        setCurrentMediaUrl(defaultVid);
        console.log("📺 無人買廣告，播放預設宣傳片");
      }
    };

    // 立即執行一次
    checkSchedule();
    // 每 10 秒對時一次，確保跨過小時(例如 14:59 -> 15:00)時會自動切換影片
    const interval = setInterval(checkSchedule, 10000); 
    return () => clearInterval(interval);

  }, [screenData, activeOrders, screenId, currentMediaUrl]);

  // 如果完全沒有影片，顯示全黑畫面
  if (!currentMediaUrl) {
    return <div className="w-screen h-screen bg-black flex items-center justify-center text-white/20 text-xs">Waiting for Signal...</div>;
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden fixed inset-0">
      <video 
        src={currentMediaUrl} 
        autoPlay 
        loop 
        muted 
        playsInline
        className="w-full h-full object-cover" // object-cover 確保影片填滿整個直屏/橫屏
      />
    </div>
  );
};

export default Player;