import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from '../../firebase';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Monitor, CheckCircle, AlertCircle, Clock, UploadCloud, User
} from 'lucide-react';

const AdminMasterCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Screens (按 ID 排序)
        const screenSnap = await getDocs(collection(db, "screens"));
        const screenList = screenSnap.docs
          .map(d => ({id: d.data().id, name: d.data().name}))
          .sort((a,b) => a.id - b.id);
        setScreens(screenList);

        // Fetch Orders
        // 為了效能，這裡只 Fetch 相關狀態的單
        const q = query(collection(db, "orders"), where("status", "in", ["paid", "won", "paid_pending_selection"]));
        const orderSnap = await getDocs(q);
        const orderData = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(orderData);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentDate]);

  // --- 2. Data Mapping (Hour x Screen) ---
  const calendarGrid = useMemo(() => {
    const grid = {}; // Key: "HOUR-SCREEN_ID"
    
    // 格式化當前選中的日期字串 YYYY-MM-DD
    const targetDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;

    orders.forEach(order => {
      if (!order.detailedSlots) return;
      
      order.detailedSlots.forEach(slot => {
        // 只處理當前日期的 Slot
        if (slot.date !== targetDateStr) return;

        const key = `${slot.hour}-${slot.screenId}`;
        
        let status = 'normal';
        // 優先級邏輯
        if (order.status === 'paid_pending_selection') status = 'bidding';
        else if (order.creativeStatus === 'pending_review') status = 'review_needed';
        else if (order.isScheduled) status = 'scheduled';
        else if (order.status === 'won' || order.status === 'paid') status = 'action_needed';

        // 如果同一個格有多個單 (例如 Bidding)，這裡簡單起見顯示最後一個，或者標記 "Multiple"
        // 這裡假設已 Sold 的時段只有一個 Winner
        grid[key] = {
          ...slot,
          orderId: order.id,
          userEmail: order.userEmail,
          videoUrl: order.videoUrl,
          status: order.status,
          creativeStatus: order.creativeStatus,
          isScheduled: order.isScheduled,
          displayStatus: status,
          price: order.type === 'bid' ? slot.bidPrice : 'Buyout'
        };
      });
    });
    return grid;
  }, [orders, currentDate]);

  // --- 3. Handlers ---
  const handleMarkAsScheduled = async (orderId) => {
    if (!confirm("確認已將影片編排至播放系統？")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        isScheduled: true,
        scheduledAt: Timestamp.now(),
        scheduledBy: 'Admin'
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isScheduled: true } : o));
      setSelectedSlot(prev => ({ ...prev, isScheduled: true, displayStatus: 'scheduled' }));
    } catch (e) { alert("更新失敗"); }
  };

  const handleApproveVideo = async (orderId) => {
      if(!confirm("確認通過審核？")) return;
      try {
          await updateDoc(doc(db, "orders", orderId), { creativeStatus: 'approved' });
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, creativeStatus: 'approved' } : o));
          setSelectedSlot(prev => ({ ...prev, creativeStatus: 'approved', displayStatus: 'action_needed' }));
      } catch(e) { alert("Error"); }
  };

  // --- Helpers ---
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  
  const getCellColor = (slot) => {
    if (!slot) return 'bg-white';
    switch (slot.displayStatus) {
      case 'scheduled': return 'bg-emerald-100 text-emerald-700 border-emerald-200'; // 🟢 OK
      case 'action_needed': return 'bg-blue-100 text-blue-700 border-blue-200'; // 🔵 Approved, Not Scheduled
      case 'review_needed': return 'bg-red-100 text-red-700 border-red-200 font-bold'; // 🔴 Needs Review
      case 'bidding': return 'bg-yellow-50 text-yellow-600 border-yellow-200'; // 🟡 Bidding
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto h-screen flex flex-col">
      {/* 1. Header */}
      <div className="flex justify-between items-center mb-4 shrink-0 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Monitor className="text-blue-600"/> 
            多屏幕排程總覽 (Master Schedule)
          </h1>
          <p className="text-xs text-slate-500">檢視單日所有屏幕狀況</p>
        </div>

        <div className="flex items-center gap-4">
            {/* Status Legend */}
            <div className="flex gap-3 text-[10px] font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-400 rounded-full"></div> 競價中</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 待審核</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> 待排片</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 已完成</span>
            </div>

            {/* Date Control */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="p-1.5 hover:bg-white rounded shadow-sm"><ChevronLeft size={16}/></button>
                <span className="px-3 font-mono font-bold text-slate-700 w-32 text-center text-sm">
                    {currentDate.toLocaleDateString()}
                </span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="p-1.5 hover:bg-white rounded shadow-sm"><ChevronRight size={16}/></button>
            </div>
        </div>
      </div>

      {/* 2. Compact Grid (Scrollable) */}
      <div className="flex-1 bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col min-h-0">
        {/* Header Row (Screens) */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-y-scroll scrollbar-hide">
            <div className="w-12 shrink-0 border-r border-slate-200 p-2 text-center text-[10px] text-slate-400 font-bold sticky left-0 bg-slate-50 z-10">
                時間
            </div>
            {screens.map(s => (
                <div key={s.id} className="flex-1 min-w-[100px] border-r border-slate-200 p-2 text-center text-xs font-bold text-slate-700 truncate">
                    {s.name}
                </div>
            ))}
        </div>

        {/* Body (Hours) */}
        <div className="flex-1 overflow-y-auto">
            {HOURS.map(h => (
                <div key={h} className="flex h-10 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    {/* Time Label */}
                    <div className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-400 bg-slate-50">
                        {String(h).padStart(2,'0')}:00
                    </div>
                    {/* Screen Slots */}
                    {screens.map(s => {
                        const key = `${h}-${s.id}`;
                        const slot = calendarGrid[key];
                        return (
                            <div 
                                key={key} 
                                className={`flex-1 min-w-[100px] border-r border-slate-100 p-1 cursor-pointer transition-all relative group
                                    ${getCellColor(slot)}`}
                                onClick={() => slot && setSelectedSlot(slot)}
                            >
                                {slot && (
                                    <div className="w-full h-full rounded flex items-center justify-between px-2 text-[10px]">
                                        <span className="truncate font-bold max-w-[70%]">
                                            {slot.price === 'Buyout' ? 'Buyout' : `$${slot.price}`}
                                        </span>
                                        {slot.displayStatus === 'review_needed' && <AlertCircle size={12} className="shrink-0"/>}
                                        {slot.displayStatus === 'action_needed' && <UploadCloud size={12} className="shrink-0"/>}
                                        {slot.displayStatus === 'scheduled' && <CheckCircle size={12} className="shrink-0"/>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
      </div>

      {/* 3. Detail Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-sm"><Clock size={16}/> 時段詳情 #{selectedSlot.orderId.slice(0,6)}</h3>
              <button onClick={() => setSelectedSlot(null)} className="hover:bg-slate-700 p-1 rounded"><span className="text-xl">&times;</span></button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded border">
                <div><span className="text-slate-400 block mb-0.5">日期</span> <span className="font-bold">{selectedSlot.date}</span></div>
                <div><span className="text-slate-400 block mb-0.5">時間</span> <span className="font-bold">{selectedSlot.hour}:00 - {selectedSlot.hour+1}:00</span></div>
                <div className="col-span-2"><span className="text-slate-400 block mb-0.5">客戶</span> <span className="font-bold flex items-center gap-1"><User size={12}/> {selectedSlot.userEmail}</span></div>
              </div>

              {/* Video Player */}
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden relative group">
                {selectedSlot.videoUrl ? (
                  <video src={selectedSlot.videoUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-500 text-xs">尚無影片</div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t space-y-2">
                {selectedSlot.displayStatus === 'review_needed' && (
                   <button onClick={() => handleApproveVideo(selectedSlot.orderId)} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                     <CheckCircle size={16}/> 通過審核 (Approve)
                   </button>
                )}

                {(selectedSlot.displayStatus === 'action_needed') && (
                  <button 
                    onClick={() => handleMarkAsScheduled(selectedSlot.orderId)} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-100"
                  >
                    <UploadCloud size={16}/> 確認已編排 (Mark as Scheduled)
                  </button>
                )}

                {selectedSlot.displayStatus === 'scheduled' && (
                  <div className="text-center py-2 text-green-600 text-sm font-bold flex items-center justify-center gap-1 bg-green-50 rounded">
                    <CheckCircle size={16}/> 準備播放 (Ready)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMasterCalendar;