import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; 
import { Upload, Calendar, Clock, Plus, ChevronLeft, ChevronRight, CheckCircle, X } from 'lucide-react';

const WEEKDAYS_LABEL = ['日', '一', '二', '三', '四', '五', '六'];
const HOURS = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${String(i).padStart(2, '0')}:00` }));

// --- 日期 Helper Functions ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); 
const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const AdminManualOrder = ({ screens }) => {
  const [memo, setMemo] = useState('');
  const [orderCategory, setOrderCategory] = useState('offline_paid'); 
  const [manualAmount, setManualAmount] = useState(''); 
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // 改用 Array 確保 React 穩定渲染
  const [selectedScreens, setSelectedScreens] = useState([]);
  
  // --- 前台日曆狀態 ---
  const [mode, setMode] = useState('specific'); 
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [previewDate, setPreviewDate] = useState(new Date()); 
  const [selectedSpecificDates, setSelectedSpecificDates] = useState([]); 
  
  // --- 包週狀態 ---
  const [startDate, setStartDate] = useState('');
  const [weekCount, setWeekCount] = useState(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 2, 3, 4, 5, 6, 0]); 
  
  // --- 時段狀態 ---
  const [selectedHours, setSelectedHours] = useState([]);

  // --- 核心邏輯 ---
  const toggleScreen = (id) => setSelectedScreens(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleHour = (val) => setSelectedHours(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const toggleWeekday = (dayIdx) => setSelectedWeekdays(prev => prev.includes(dayIdx) ? prev.filter(x => x !== dayIdx) : [...prev, dayIdx]);
  
  const toggleDate = (year, month, day) => { 
      const key = formatDateKey(year, month, day); 
      setPreviewDate(new Date(year, month, day)); 
      setSelectedSpecificDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key].sort());
  };

  const handleSelectAllHours = () => setSelectedHours(HOURS.map(h => h.val));
  const handleClearHours = () => setSelectedHours([]);
  
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const generateDates = () => {
    if (mode === 'specific') {
      return [...selectedSpecificDates]; 
    } else {
      if (!startDate) return [];
      const dates = [];
      const [year, month, day] = startDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      for (let i = 0; i < weekCount * 7; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        if (selectedWeekdays.includes(current.getDay())) {
          dates.push(formatDateKey(current.getFullYear(), current.getMonth(), current.getDate()));
        }
      }
      return dates;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("請先上載宣傳片或圖片！");
    if (selectedScreens.length === 0) return alert("請至少選擇一部機！");
    if (selectedHours.length === 0) return alert("請至少選擇一個播放時段！");
    if (mode === 'specific' && selectedSpecificDates.length === 0) return alert("請至少選擇一日！");
    if (mode === 'recurring' && !startDate) return alert("請選擇開始日期！");
    if (mode === 'recurring' && selectedWeekdays.length === 0) return alert("請至少選擇一日 (星期幾)！");

    setUploading(true);
    try {
      const storageRef = ref(storage, `manual_ads/${Date.now()}_${file.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      const dates = generateDates();
      const finalAmount = Number(manualAmount) || 0;
      
      const generatedSlots = [];
      dates.forEach(d => {
          selectedHours.forEach(h => {
              selectedScreens.forEach(sId => {
                  const screen = screens.find(s => String(s.id) === String(sId));
                  generatedSlots.push({
                      date: d,
                      hour: h,
                      screenId: String(sId),
                      screenName: screen ? screen.name : `Screen ${sId}`,
                      bidPrice: dates.length > 0 ? (finalAmount / (dates.length * selectedHours.length * selectedScreens.length)).toFixed(2) : 0, 
                      isBuyout: true,
                      slotStatus: 'winning'
                  });
              });
          });
      });

      await addDoc(collection(db, 'orders'), {
        memo: memo || 'Admin 手動排期',
        type: 'buyout',
        orderType: 'manual',
        paymentStatus: orderCategory,
        status: 'paid', 
        creativeStatus: 'approved', 
        isApproved: true,
        hasVideo: true,
        videoUrl: downloadURL,
        videoName: file.name,
        screenIds: selectedScreens,
        detailedSlots: generatedSlots,
        userEmail: orderCategory === 'internal_promo' ? 'info@doohadv.com' : 'info@doohadv.com',
        userName: orderCategory === 'internal_promo' ? '系統內部宣傳' : '線下客戶',
        amount: finalAmount,
        createdAt: serverTimestamp(),
        adminId: 'admin_dashboard',
        timeSlotSummary: `Admin排期: ${generatedSlots.length} 個時段`
      });

      alert(`✅ 排期成功！共排入 ${generatedSlots.length} 個時段。`);
      
      // 成功後清空表單
      setMemo(''); setManualAmount(''); setFile(null); setSelectedScreens([]); setStartDate(''); 
      setWeekCount(1); setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]); setSelectedHours([]);
      setSelectedSpecificDates([]);
    } catch (error) {
      console.error("Error:", error);
      alert("❌ 發生錯誤：" + error.message);
    }
    setUploading(false);
  };

  // 渲染日曆 Grid
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    return (
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} className="text-slate-600"/></button>
          <span className="font-bold text-slate-800">{year}年 {month + 1}月</span>
          <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20} className="text-slate-600"/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS_LABEL.map(day => <div key={day} className="text-center text-xs font-bold text-slate-400 py-1">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} className="p-2"/>)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const key = formatDateKey(year, month, day);
            const isSelected = selectedSpecificDates.includes(key);
            const isPreview = previewDate && formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate()) === key;
            return (
              <button 
                key={day} 
                type="button"
                onClick={() => toggleDate(year, month, day)}
                className={`
                  h-10 rounded-lg text-sm font-bold flex items-center justify-center transition-all border
                  ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}
                  ${isPreview && !isSelected ? 'ring-2 ring-blue-300' : ''}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-bold">
            已選 {selectedSpecificDates.length} 日
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Plus className="text-blue-600" /> 手動加單 / 內部宣傳排期</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. 基本資料 & 收款 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">訂單性質</label>
                <div className="grid grid-cols-2 gap-2">
                    <div onClick={() => setOrderCategory('offline_paid')} className={`p-3 border-2 rounded-xl cursor-pointer transition-all text-center ${orderCategory === 'offline_paid' ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold' : 'border-slate-200 text-slate-500 hover:border-blue-300'}`}>💰 線下收費單</div>
                    <div onClick={() => setOrderCategory('internal_promo')} className={`p-3 border-2 rounded-xl cursor-pointer transition-all text-center ${orderCategory === 'internal_promo' ? 'border-green-600 bg-green-50 text-green-800 font-bold' : 'border-slate-200 text-slate-500 hover:border-green-300'}`}>📢 內部宣傳 / 造市</div>
                </div>
            </div>
            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">廣告名稱 / 備註</label>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="例如：十二味 3月包月廣告" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required />
            </div>
            <div className="space-y-4 col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700">收款總金額 (HKD)</label>
                <div className="relative w-full md:w-1/2">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
                    <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="輸入實收金額" className="w-full p-3 pl-8 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-mono font-bold text-blue-600 bg-slate-50"/>
                </div>
            </div>
        </div>

        {/* 2. 選擇屏幕 & 檔案 (屏幕已經回歸！) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">選擇屏幕 (可多選)</label>
              <div className="grid grid-cols-2 gap-2">
                {screens?.map(screen => (
                  <div key={screen.id} onClick={() => toggleScreen(String(screen.id))} className={`p-3 border rounded-xl cursor-pointer text-sm font-bold flex items-center justify-between ${selectedScreens.includes(String(screen.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                    {screen.name}
                    {selectedScreens.includes(String(screen.id)) && <CheckCircle size={16} />}
                  </div>
                ))}
              </div>
            </div>
            
            {/* 修正後嘅巨型上載掣，撳邊度都得！ */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">上載影片 / 圖片</label>
              <label htmlFor="admin-file" className="cursor-pointer border-2 border-dashed border-slate-300 p-6 rounded-xl hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px] h-[calc(100%-28px)]">
                <input type="file" onChange={e => setFile(e.target.files[0])} className="hidden" id="admin-file" accept="image/*,video/*" />
                <Upload className={`w-8 h-8 ${file ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`font-bold text-sm text-center ${file ? 'text-blue-600' : 'text-slate-500'}`}>
                  {file ? file.name : '點擊此處任何位置選擇檔案'}
                </span>
              </label>
            </div>
        </div>

        {/* 3. 前台同款雙模式排期系統 */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Calendar className="text-blue-600"/> 詳細排期設定</h3>
               <div className="flex bg-slate-200 rounded-lg p-1">
                  <button type="button" onClick={() => setMode('specific')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>指定日子</button>
                  <button type="button" onClick={() => setMode('recurring')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>包週排期</button>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 左邊：日期選擇區域 */}
                <div className="space-y-6">
                    {mode === 'specific' ? (
                        <div className="animate-in fade-in">
                            <label className="block text-sm font-bold text-slate-700 mb-2">點擊日曆選擇指定日子</label>
                            {renderCalendar()}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">開始日期</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">連續播放 (星期數)</label>
                                <div className="flex items-center gap-2">
                                    <input type="range" min="1" max="52" value={weekCount} onChange={(e) => setWeekCount(Number(e.target.value))} className="flex-1 accent-blue-600" />
                                    <span className="font-bold text-lg w-16 text-right text-blue-600">{weekCount} 星期</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">指定星期幾</label>
                                <div className="flex gap-1 justify-between">
                                    {WEEKDAYS_LABEL.map((label, idx) => {
                                        const dayVal = idx === 0 ? 0 : idx; 
                                        return (
                                        <button key={dayVal} type="button" onClick={() => toggleWeekday(dayVal)} className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${selectedWeekdays.includes(dayVal) ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>
                                            {label}
                                        </button>
                                    )})}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 右邊：前台同款 TimeSlotSelector 介面 */}
                <div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2"><Clock size={16}/> 指定時段</h2>
                            <div className="space-x-2 text-xs">
                                <button type="button" onClick={handleSelectAllHours} className="text-blue-600 font-bold hover:underline">全選</button>
                                <span className="text-slate-300">|</span>
                                <button type="button" onClick={handleClearHours} className="text-slate-500 font-bold hover:underline">清空</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                            {HOURS.map(h => (
                                <button 
                                    key={h.val} 
                                    type="button"
                                    onClick={() => toggleHour(h.val)} 
                                    className={`py-3 text-xs rounded border transition-all font-bold 
                                        ${selectedHours.includes(h.val) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-blue-300'}`
                                    }
                                >
                                    {h.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 提交按鈕 */}
        <button type="submit" disabled={uploading} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-xl hover:bg-slate-800 transition-colors disabled:bg-slate-400 flex justify-center items-center gap-2 shadow-lg">
          {uploading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 系統處理中...</> : '🚀 確認排期並即時生效'}
        </button>
      </form>
    </div>
  );
};

export default AdminManualOrder;