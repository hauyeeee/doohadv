import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; 
// 🔥 確保引入咗 X icon
import { Upload, Calendar, Clock, CheckCircle, Plus, X } from 'lucide-react';

const WEEKDAYS = [
  { val: 1, label: '一' }, { val: 2, label: '二' }, { val: 3, label: '三' },
  { val: 4, label: '四' }, { val: 5, label: '五' }, { val: 6, label: '六' }, { val: 0, label: '日' }
];

const AdminManualOrder = ({ screens }) => {
  const [memo, setMemo] = useState('');
  const [orderCategory, setOrderCategory] = useState('offline_paid'); 
  const [manualAmount, setManualAmount] = useState(''); // 收錢金額
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [selectedScreens, setSelectedScreens] = useState([]);
  
  // --- 🚀 全新雙模式排期狀態 ---
  const [mode, setMode] = useState('specific'); // 'specific' = 指定日子, 'recurring' = 包週
  const [selectedSpecificDates, setSelectedSpecificDates] = useState([]); // 裝指定日子嘅 Array
  
  const [startDate, setStartDate] = useState('');
  const [weekCount, setWeekCount] = useState(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 2, 3, 4, 5, 6, 0]); 
  
  const [selectedHours, setSelectedHours] = useState(Array.from({length: 24}, (_, i) => i));

  // 🚀 全新 Dates 產生邏輯 (完美複製前台)
  const generateDates = () => {
    if (mode === 'specific') {
      return [...selectedSpecificDates].sort(); // 模式一：直接回傳你揀咗嘅散日
    } else {
      // 模式二：包週邏輯
      if (!startDate) return [];
      const dates = [];
      const [year, month, day] = startDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      const totalDaysToScan = weekCount * 7;
      
      for (let i = 0; i < totalDaysToScan; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        if (selectedWeekdays.includes(current.getDay())) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
        }
      }
      return dates;
    }
  };

  const handleToggleScreen = (id) => setSelectedScreens(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const handleToggleWeekday = (day) => setSelectedWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const handleToggleHour = (hour) => setSelectedHours(prev => prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour]);
  const handleSelectAllHours = () => setSelectedHours(Array.from({length: 24}, (_, i) => i));
  const handleClearHours = () => setSelectedHours([]);

  // 加入/移除指定日子
  const handleAddSpecificDate = (e) => {
      const dateStr = e.target.value;
      if (dateStr && !selectedSpecificDates.includes(dateStr)) {
          setSelectedSpecificDates(prev => [...prev, dateStr].sort());
      }
  };
  const handleRemoveSpecificDate = (dateStr) => setSelectedSpecificDates(prev => prev.filter(d => d !== dateStr));

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
        userEmail: orderCategory === 'internal_promo' ? 'admin@doohadv.com' : 'offline_client@doohadv.com',
        userName: orderCategory === 'internal_promo' ? '系統內部宣傳' : '線下客戶',
        amount: finalAmount,
        createdAt: serverTimestamp(),
        adminId: 'admin_dashboard',
        timeSlotSummary: `Admin排期: ${generatedSlots.length} 個時段`
      });

      alert(`✅ 排期成功！共排入 ${generatedSlots.length} 個時段。`);
      
      setMemo(''); setManualAmount(''); setFile(null); setSelectedScreens([]); setStartDate(''); 
      setWeekCount(1); setSelectedWeekdays([1, 2, 3, 4, 5, 6, 0]); setSelectedHours(Array.from({length: 24}, (_, i) => i));
      setSelectedSpecificDates([]);
    } catch (error) {
      console.error("Error:", error);
      alert("❌ 發生錯誤：" + error.message);
    }
    setUploading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="text-blue-600" /> 手動加單 / 內部宣傳排期
          </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. 訂單性質 & 基本資料 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">訂單性質</label>
                <div className="grid grid-cols-2 gap-2">
                    <div onClick={() => setOrderCategory('offline_paid')} className={`p-3 border-2 rounded-xl cursor-pointer transition-all text-center ${orderCategory === 'offline_paid' ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold' : 'border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                        💰 線下收費單
                    </div>
                    <div onClick={() => setOrderCategory('internal_promo')} className={`p-3 border-2 rounded-xl cursor-pointer transition-all text-center ${orderCategory === 'internal_promo' ? 'border-green-600 bg-green-50 text-green-800 font-bold' : 'border-slate-200 text-slate-500 hover:border-green-300'}`}>
                        📢 內部宣傳 / 造市
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">廣告名稱 / 備註</label>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="例如：十二味 3月包月廣告" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required />
            </div>

            {/* 收款金額欄位 */}
            <div className="space-y-4 col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700">收款總金額 (HKD)</label>
                <div className="relative w-full md:w-1/2">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
                    <input 
                        type="number" 
                        value={manualAmount} 
                        onChange={e => setManualAmount(e.target.value)} 
                        placeholder="輸入實收金額" 
                        className="w-full p-3 pl-8 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-mono font-bold text-blue-600 bg-slate-50"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">* 必須輸入金額，Dashboard 收益表先會識加數</p>
            </div>
        </div>

        {/* 2. 選擇屏幕 & 檔案 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">選擇屏幕 (可多選)</label>
              <div className="grid grid-cols-2 gap-2">
                {screens?.map(screen => (
                  <div key={screen.id} onClick={() => handleToggleScreen(screen.id)} className={`p-3 border rounded-xl cursor-pointer text-sm font-bold flex items-center justify-between ${selectedScreens.includes(screen.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                    {screen.name}
                    {selectedScreens.includes(screen.id) && <CheckCircle size={16} />}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">上載影片 / 圖片</label>
              <div className="border-2 border-dashed border-slate-300 p-6 rounded-xl text-center hover:bg-slate-50 transition-colors h-[calc(100%-28px)] flex flex-col justify-center">
                <input type="file" onChange={e => setFile(e.target.files[0])} className="hidden" id="admin-file" accept="image/*,video/*" />
                <label htmlFor="admin-file" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className={`w-8 h-8 ${file ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-bold text-sm ${file ? 'text-blue-600' : 'text-slate-500'}`}>{file ? file.name : '點擊選擇檔案'}</span>
                </label>
              </div>
            </div>
        </div>

        {/* 3. 雙模式排期系統 */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Calendar className="text-blue-600"/> 詳細排期設定</h3>
               
               {/* 🚀 模式切換 Tabs */}
               <div className="flex bg-slate-200 rounded-lg p-1">
                  <button type="button" onClick={() => setMode('specific')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>指定日子</button>
                  <button type="button" onClick={() => setMode('recurring')} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>包週排期</button>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 左邊：日期選擇區域 (根據 Mode 切換) */}
                <div className="space-y-6">
                    {mode === 'specific' ? (
                        <div className="space-y-4 animate-in fade-in">
                            <label className="block text-sm font-bold text-slate-700">加入指定日子 (可選多日)</label>
                            <input type="date" onChange={handleAddSpecificDate} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500" />
                            
                            <div className="bg-white p-4 rounded-xl border border-slate-200 min-h-[100px]">
                                <p className="text-xs text-slate-400 mb-2">已選日子 ({selectedSpecificDates.length}日)：</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedSpecificDates.map(d => (
                                        <span key={d} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-blue-200">
                                            {d} 
                                            <button type="button" onClick={() => handleRemoveSpecificDate(d)} className="text-blue-400 hover:text-blue-800 bg-white rounded-full p-0.5"><X size={12}/></button>
                                        </span>
                                    ))}
                                    {selectedSpecificDates.length === 0 && <span className="text-slate-400 text-sm">請從上方選擇日期...</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in">
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
                                    {WEEKDAYS.map(day => (
                                        <button key={day.val} type="button" onClick={() => handleToggleWeekday(day.val)} className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${selectedWeekdays.includes(day.val) ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 右邊：鐘數 */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700 flex items-center gap-1"><Clock size={16}/> 指定時段</label>
                        <div className="space-x-2 text-xs">
                            <button type="button" onClick={handleSelectAllHours} className="text-blue-600 font-bold hover:underline">全選</button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={handleClearHours} className="text-slate-500 font-bold hover:underline">清空</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {Array.from({length: 24}, (_, i) => i).map(hour => (
                            <button key={hour} type="button" onClick={() => handleToggleHour(hour)} className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedHours.includes(hour) ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>
                                {hour.toString().padStart(2, '0')}:00
                            </button>
                        ))}
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