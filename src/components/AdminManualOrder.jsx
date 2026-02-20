import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; // 請確保呢個路徑正確指去你嘅 firebase.js
import { Upload, Calendar, Clock, MonitorPlay, CheckCircle, Plus } from 'lucide-react';

const AdminManualOrder = ({ screens }) => {
  const [memo, setMemo] = useState('');
  const [orderCategory, setOrderCategory] = useState('offline_paid'); // 'offline_paid' 或 'internal_promo'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [selectedScreens, setSelectedScreens] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectAllHours, setSelectAllHours] = useState(true);

  // 產生日期 Array ('YYYY-MM-DD')
  const getDatesInRange = (start, end) => {
    const dates = [];
    let current = new Date(start);
    const last = new Date(end);
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const handleToggleScreen = (id) => {
    setSelectedScreens(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("請先上載宣傳片或圖片！");
    if (selectedScreens.length === 0) return alert("請至少選擇一部機！");
    if (!startDate || !endDate) return alert("請選擇日期範圍！");

    setUploading(true);
    try {
      // 1. 上載檔案到 Firebase Storage
      const storageRef = ref(storage, `manual_ads/${Date.now()}_${file.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      // 2. 準備排期數據
      const dates = getDatesInRange(startDate, endDate);
      const hours = selectAllHours ? Array.from({length: 24}, (_, i) => i) : [12,13,18,19]; // 預設全日，你可以自己改 UI 加揀鐘數
      
      // 3. 模擬網上訂單嘅 detailedSlots (為咗等 Calendar 識得顯示)
      const generatedSlots = [];
      dates.forEach(d => {
          hours.forEach(h => {
              selectedScreens.forEach(sId => {
                  const screen = screens.find(s => String(s.id) === String(sId));
                  generatedSlots.push({
                      date: d,
                      hour: h,
                      screenId: String(sId),
                      screenName: screen ? screen.name : `Screen ${sId}`,
                      bidPrice: 'Buyout', // 當作最高優先級
                      isBuyout: true,
                      slotStatus: 'winning'
                  });
              });
          });
      });

      // 4. 寫入 Firestore
      await addDoc(collection(db, 'orders'), {
        memo: memo || 'Admin 手動排期',
        type: 'buyout',
        orderType: 'manual',
        paymentStatus: orderCategory,
        status: 'paid', // 🔥 必須係 paid，日曆同播放器先會認
        creativeStatus: 'approved', // 🔥 自動批核
        isApproved: true,
        hasVideo: true,
        videoUrl: downloadURL,
        videoName: file.name,
        screenIds: selectedScreens,
        detailedSlots: generatedSlots,
        userEmail: orderCategory === 'internal_promo' ? 'admin@doohadv.com' : 'offline_client@doohadv.com',
        userName: orderCategory === 'internal_promo' ? '系統內部宣傳' : '線下客戶',
        amount: 0,
        createdAt: serverTimestamp(),
        adminId: 'admin_dashboard'
      });

      alert("✅ 排期成功！時間一到屏幕會自動播放，並已加入日曆！");
      
      // 清空表單
      setMemo(''); setFile(null); setSelectedScreens([]); setStartDate(''); setEndDate('');
    } catch (error) {
      console.error("Error adding manual order: ", error);
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
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. 訂單性質 */}
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => setOrderCategory('offline_paid')} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${orderCategory === 'offline_paid' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
            <h3 className="font-bold text-slate-800 text-lg">💰 線下收費單</h3>
            <p className="text-sm text-slate-500">客戶已入數，代客排期上片</p>
          </div>
          <div onClick={() => setOrderCategory('internal_promo')} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${orderCategory === 'internal_promo' ? 'border-green-600 bg-green-50' : 'border-slate-200 hover:border-green-300'}`}>
            <h3 className="font-bold text-slate-800 text-lg">📢 內部免費宣傳 / 造市</h3>
            <p className="text-sm text-slate-500">自家廣告、合作宣傳</p>
          </div>
        </div>

        {/* 2. 基本資料 & 檔案 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">廣告名稱 / 備註</label>
              <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="例如：十二味 3月包月廣告" className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">上載影片 / 圖片</label>
              <div className="border-2 border-dashed border-slate-300 p-2.5 rounded-lg text-center hover:bg-slate-50 transition-colors">
                <input type="file" onChange={e => setFile(e.target.files[0])} className="hidden" id="admin-file" accept="image/*,video/*" />
                <label htmlFor="admin-file" className="cursor-pointer flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="font-bold text-blue-600 text-sm">{file ? file.name : '點擊選擇檔案'}</span>
                </label>
              </div>
            </div>
        </div>

        {/* 3. 選擇屏幕 */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">選擇屏幕 (可多選)</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {screens?.map(screen => (
              <div key={screen.id} onClick={() => handleToggleScreen(screen.id)} className={`p-3 border rounded-lg cursor-pointer text-sm font-bold flex items-center justify-between ${selectedScreens.includes(screen.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                {screen.name}
                {selectedScreens.includes(screen.id) && <CheckCircle size={16} />}
              </div>
            ))}
          </div>
        </div>

        {/* 4. 日期與時間 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Calendar size={16}/> 播放日期範圍</label>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" required />
              <span className="text-slate-400">至</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Clock size={16}/> 播放時段</label>
            <div className="flex items-center gap-4 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input type="checkbox" checked={selectAllHours} onChange={(e) => setSelectAllHours(e.target.checked)} className="w-5 h-5 accent-blue-600 rounded" />
                全天 24 小時瘋狂輪播 (預設)
              </label>
            </div>
          </div>
        </div>

        {/* 提交按鈕 */}
        <button type="submit" disabled={uploading} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:bg-slate-400 flex justify-center items-center gap-2 shadow-lg">
          {uploading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 正在上載及寫入系統...</> : '確認排期並即時生效'}
        </button>
      </form>
    </div>
  );
};

export default AdminManualOrder;