import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, where, getDocs, updateDoc, doc, Timestamp 
} from "firebase/firestore";
import { db } from '../../firebase';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Filter, CheckCircle, AlertCircle, Clock, Monitor, Play, UploadCloud 
} from 'lucide-react';

const AdminMasterCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [selectedScreenId, setSelectedScreenId] = useState("1"); // 預設 Screen 1
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null); // 用於 Modal

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Screens
        const screenSnap = await getDocs(collection(db, "screens"));
        const screenList = screenSnap.docs.map(d => ({id: d.data().id, name: d.data().name}));
        setScreens(screenList);

        // Fetch Orders (這裡簡單起見 Fetch 所有 active 的，實際可根據日期範圍 Filter)
        const q = query(collection(db, "orders"), where("status", "in", ["paid", "won", "paid_pending_selection"]));
        const orderSnap = await getDocs(q);
        const orderData = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(orderData);
      } catch (err) {
        console.error("Error fetching calendar data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentDate]); // 當轉月份時可以重新 Fetch 優化效能

  // --- 2. Data Processing (Map Orders to Slots) ---
  const calendarData = useMemo(() => {
    const map = {}; // Key: "YYYY-MM-DD-HOUR"
    
    orders.forEach(order => {
      if (!order.detailedSlots) return;
      
      order.detailedSlots.forEach(slot => {
        // 只顯示當前選中 Screen 的數據
        if (String(slot.screenId) !== String(selectedScreenId)) return;

        const key = `${slot.date}-${slot.hour}`;
        
        // 決定顯示的優先級狀態
        let status = 'normal';
        if (order.status === 'paid_pending_selection') status = 'bidding';
        else if (order.creativeStatus === 'pending_review') status = 'review_needed';
        else if (order.isScheduled) status = 'scheduled'; // 🔥 已編排
        else if (order.status === 'won' || order.status === 'paid') status = 'action_needed'; // 已付款待編排

        map[key] = {
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
    return map;
  }, [orders, selectedScreenId]);

  // --- 3. Handlers ---
  const handleMarkAsScheduled = async (orderId) => {
    if (!confirm("確認已將影片編排至播放系統？")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        isScheduled: true,
        scheduledAt: Timestamp.now(),
        scheduledBy: 'Admin' // 可以放 Admin ID
      });
      
      // Update local state to reflect change immediately
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isScheduled: true } : o));
      setSelectedSlot(prev => ({ ...prev, isScheduled: true, displayStatus: 'scheduled' }));
      alert("✅ 狀態已更新：準備播放");
    } catch (e) {
      console.error("Update failed", e);
      alert("更新失敗");
    }
  };

  const handleApproveVideo = async (orderId) => {
      // 這裡可以重用你之前的 approve 邏輯
      try {
          await updateDoc(doc(db, "orders", orderId), { creativeStatus: 'approved' });
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, creativeStatus: 'approved' } : o));
          setSelectedSlot(prev => ({ ...prev, creativeStatus: 'approved', displayStatus: 'action_needed' }));
      } catch(e) { alert("Error"); }
  };

  // --- 4. Render Helpers ---
  const getWeekDates = () => {
    const curr = new Date(currentDate);
    const week = [];
    // 設定到該週的星期日
    curr.setDate(curr.getDate() - curr.getDay());
    for (let i = 0; i < 7; i++) {
      week.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return week;
  };

  const weekDates = getWeekDates();
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  const getCellColor = (slot) => {
    if (!slot) return 'bg-white hover:bg-slate-50'; // Empty
    switch (slot.displayStatus) {
      case 'scheduled': return 'bg-green-100 border-green-200 text-green-700'; // ✅ 搞掂
      case 'action_needed': return 'bg-blue-100 border-blue-200 text-blue-700'; // ⚠️ 待編排
      case 'review_needed': return 'bg-red-100 border-red-200 text-red-700 font-bold'; // 🚨 待審核
      case 'bidding': return 'bg-yellow-50 border-yellow-200 text-yellow-600'; // ⏳ 競價中
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon /> 廣告排程總表 (Master Schedule)
          </h1>
          <p className="text-slate-500 text-sm">管理所有時段佔用與影片狀態</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
          <Monitor size={18} className="text-slate-400"/>
          <select 
            value={selectedScreenId} 
            onChange={(e) => setSelectedScreenId(e.target.value)}
            className="outline-none text-sm font-bold text-slate-700 bg-transparent"
          >
            {screens.map(s => <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-2 hover:bg-white rounded shadow-sm"><ChevronLeft size={16}/></button>
          <span className="px-4 font-mono font-bold text-slate-600">
            {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
          </span>
          <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-2 hover:bg-white rounded shadow-sm"><ChevronRight size={16}/></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span> 待審核 (優先)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span> 已審核 / 待編排</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span> ✅ 已編排 (Ready)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-50 border border-yellow-300 rounded"></span> 競價中</span>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-3 border-b border-r bg-slate-50 w-16 sticky left-0 z-10">時間</th>
              {weekDates.map(d => (
                <th key={d.toISOString()} className="p-3 border-b min-w-[140px] bg-slate-50 text-slate-700">
                  {d.toLocaleDateString('zh-HK', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(h => (
              <tr key={h}>
                <td className="p-2 border-b border-r bg-slate-50 text-center text-xs font-mono text-slate-500 sticky left-0 z-10">
                  {String(h).padStart(2, '0')}:00
                </td>
                {weekDates.map(d => {
                  const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${h}`;
                  const slot = calendarData[dateKey];
                  
                  return (
                    <td 
                      key={dateKey} 
                      className={`border-b border-r p-1 relative h-16 transition-colors cursor-pointer ${getCellColor(slot)}`}
                      onClick={() => slot && setSelectedSlot(slot)}
                    >
                      {slot && (
                        <div className="h-full flex flex-col justify-between p-1">
                          <div className="font-bold text-xs truncate">{slot.userEmail}</div>
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] opacity-70">{slot.price === 'Buyout' ? 'Buyout' : `$${slot.price}`}</span>
                            {/* Icons based on status */}
                            {slot.displayStatus === 'review_needed' && <AlertCircle size={14} className="text-red-600 animate-pulse"/>}
                            {slot.displayStatus === 'scheduled' && <CheckCircle size={14} className="text-green-600"/>}
                            {slot.displayStatus === 'action_needed' && <UploadCloud size={14} className="text-blue-600"/>}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Clock size={18}/> 時段詳情</h3>
              <button onClick={() => setSelectedSlot(null)} className="hover:bg-slate-700 p-1 rounded"><span className="text-xl">&times;</span></button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><label className="text-slate-400 text-xs">日期/時間</label><div className="font-bold">{selectedSlot.date} {selectedSlot.hour}:00</div></div>
                <div><label className="text-slate-400 text-xs">屏幕</label><div className="font-bold">ID: {selectedScreenId}</div></div>
                <div className="col-span-2"><label className="text-slate-400 text-xs">客戶 Email</label><div className="font-bold text-blue-600">{selectedSlot.userEmail}</div></div>
                <div><label className="text-slate-400 text-xs">狀態</label>
                  <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold 
                    ${selectedSlot.displayStatus === 'scheduled' ? 'bg-green-100 text-green-700' : 
                      selectedSlot.displayStatus === 'review_needed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedSlot.displayStatus.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Video Player */}
              <div className="bg-slate-100 rounded-lg p-2 flex items-center justify-center min-h-[150px] border border-slate-200">
                {selectedSlot.videoUrl ? (
                  <video src={selectedSlot.videoUrl} controls className="max-h-[200px] rounded" />
                ) : (
                  <div className="text-slate-400 text-xs">尚未上傳影片</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t">
                {selectedSlot.creativeStatus === 'pending_review' && (
                   <button onClick={() => handleApproveVideo(selectedSlot.orderId)} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2">
                     <CheckCircle size={16}/> 通過審核 (Approve)
                   </button>
                )}

                {/* 🔥 這是你要求的重點功能 🔥 */}
                {(selectedSlot.creativeStatus === 'approved' || selectedSlot.creativeStatus === 'pending_review') && !selectedSlot.isScheduled && (
                  <button 
                    onClick={() => handleMarkAsScheduled(selectedSlot.orderId)} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                  >
                    <UploadCloud size={20}/> 影片已編排 (Mark as Scheduled)
                  </button>
                )}

                {selectedSlot.isScheduled && (
                  <div className="bg-green-50 text-green-700 text-center py-3 rounded-lg font-bold border border-green-200 flex items-center justify-center gap-2">
                    <CheckCircle size={18}/> 此影片已在播放列表中
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