import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, Building2, Train, Target, FileText, CheckCircle, 
  ChevronRight, ChevronLeft, AlertTriangle, Users, CalendarRange, 
  Clock, Download, BarChart3, UploadCloud, Info, X, Monitor, Loader2 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🔥 Database 連接
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// 修正 Leaflet Icon 遺失 Bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const CATEGORIES = [
  { id: 'fnb', name: '餐飲美食 (F&B)' },
  { id: 'retail', name: '零售及服裝 (Retail)' },
  { id: 'finance', name: '金融及保險 (Finance)' },
  { id: 'alcohol', name: '酒類飲品 (Alcohol)' },
];

const DAYPARTING_OPTIONS = [
  { id: 'all_day', name: '全日霸屏 ROS (08:00 - 23:00)', hours: 15, multiplier: 1.0 },
  { id: 'rush_hour', name: '黃金通勤 (08:00-10:00, 17:00-20:00)', hours: 5, multiplier: 1.5 },
  { id: 'nightlife', name: '夜間消費 (19:00 - 02:00)', hours: 7, multiplier: 1.2 },
];

const CorporateBooking = ({ screens = [] }) => {
  const [step, setStep] = useState(1);
  
  // --- States ---
  const [campaignName, setCampaignName] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [industry, setIndustry] = useState('');
  const [dayparting, setDayparting] = useState('all_day');
  const [sov, setSov] = useState(10);
  
  const [regionMode, setRegionMode] = useState('district'); 
  const [selectedScreens, setSelectedScreens] = useState(new Set()); 
  const [previewScreen, setPreviewScreen] = useState(null); 
  const [uploadedFile, setUploadedFile] = useState(null); 
  
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 防呆處理數據
  const processedScreens = useMemo(() => {
    if (!screens || !Array.isArray(screens) || screens.length === 0) return [];
    return screens.map((s, index) => {
      let safeBanned = Array.isArray(s.bannedCategories) ? s.bannedCategories : (typeof s.bannedCategories === 'string' && s.bannedCategories.trim() !== '' ? [s.bannedCategories] : []);
      const defaultLat = 22.3193 + (index * 0.005);
      const defaultLng = 114.1694 + (index * 0.005);
      
      return {
        id: String(s.id || Math.random()), 
        name: s.name || '未命名屏幕', 
        group: s.district || s.bundleGroup || '未分類地區', 
        type: 'district', 
        basePrice: Number(s.basePrice) || 50, 
        bannedCategories: safeBanned, 
        footfall: Number(s.footfall) || 100000, 
        specs: s.specifications || s.size || '標準屏幕', 
        image: (s.images && Array.isArray(s.images) && s.images.length > 0) ? s.images[0] : 'https://placehold.co/600x400?text=No+Image',
        lat: Number(s.lat) || defaultLat, 
        lng: Number(s.lng) || defaultLng,
      };
    });
  }, [screens]);

  useEffect(() => { 
      if (processedScreens.length > 0 && selectedScreens.size === 0) { 
          setSelectedScreens(new Set(processedScreens.map(s => s.id))); 
      } 
  }, [processedScreens]);

  const handleGroupToggle = (groupName) => {
      const screensInGroup = processedScreens.filter(s => s.group === groupName);
      const allSelected = screensInGroup.every(s => selectedScreens.has(s.id));
      const newSet = new Set(selectedScreens);
      screensInGroup.forEach(s => { 
          if (allSelected) newSet.delete(s.id); 
          else newSet.add(s.id); 
      });
      setSelectedScreens(newSet);
  };

  const handleToggleScreen = (id) => {
      const newSet = new Set(selectedScreens);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      setSelectedScreens(newSet);
  };

  const currentGroups = useMemo(() => [...new Set(processedScreens.filter(s => s.type === regionMode).map(s => s.group))], [regionMode, processedScreens]);
  const activeScreens = useMemo(() => processedScreens.filter(s => selectedScreens.has(s.id) && (!industry || !s.bannedCategories.includes(industry))), [selectedScreens, industry, processedScreens]);
  const conflicts = useMemo(() => processedScreens.filter(s => selectedScreens.has(s.id) && industry && s.bannedCategories.includes(industry)), [selectedScreens, industry, processedScreens]);

  const metrics = useMemo(() => {
      let days = 30;
      if (dateRange.start && dateRange.end) {
          const diffTime = Math.abs(new Date(dateRange.end) - new Date(dateRange.start));
          days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
      const strategy = DAYPARTING_OPTIONS.find(d => d.id === dayparting) || DAYPARTING_OPTIONS[0];
      const sovMultiplier = sov / 100;
      
      let totalCost = 0;
      let totalImpressions = 0;
      
      activeScreens.forEach(s => {
          totalCost += (s.basePrice * strategy.multiplier * strategy.hours * days * sovMultiplier);
          totalImpressions += (s.footfall * (strategy.hours / 15) * days * sovMultiplier);
      });
      
      return { 
          days, 
          cost: totalCost, 
          impressions: totalImpressions, 
          cpm: totalImpressions > 0 ? (totalCost / (totalImpressions / 1000)) : 0 
      };
  }, [activeScreens, dateRange, dayparting, sov]);

  // 🔥 核心：補回失蹤嘅 Submit Function
  const handleFinalSubmit = async () => {
      if (!campaignName || !dateRange.start || !dateRange.end) {
          alert("請先填寫企劃名稱及廣告檔期");
          setStep(1); 
          return;
      }
      setIsSubmitting(true);
      
      try {
          let videoUrl = '';
          let videoName = '';
          
          // 1. 上載影片 (如果有)
          if (uploadedFile) {
              const storageRef = ref(storage, `corporate_uploads/${Date.now()}_${uploadedFile.name}`);
              const snapshot = await uploadBytesResumable(storageRef, uploadedFile);
              videoUrl = await getDownloadURL(snapshot.ref);
              videoName = uploadedFile.name;
          }

          // 2. 產生所有時段 (Slots)
          const getDates = (start, end) => {
              const arr = []; 
              let cur = new Date(start); 
              const stop = new Date(end);
              while(cur <= stop) {
                  arr.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`);
                  cur.setDate(cur.getDate() + 1);
              }
              return arr;
          };

          const dates = getDates(dateRange.start, dateRange.end);
          const hoursMap = {
              all_day: [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
              rush_hour: [8,9,17,18,19],
              nightlife: [19,20,21,22,23,0,1]
          };
          const targetHours = hoursMap[dayparting] || hoursMap['all_day'];
          const detailedSlots = [];

          dates.forEach(d => {
              targetHours.forEach(h => {
                  activeScreens.forEach(s => {
                      detailedSlots.push({
                          date: d, 
                          hour: h, 
                          screenId: String(s.id), 
                          screenName: s.name,
                          isCorporate: true, // 🔥 標記為大客，等散客無得 Buyout
                          slotStatus: 'won', // 大客直通車
                          bidPrice: s.basePrice * (sov/100)
                      });
                  });
              });
          });

          // 3. 寫入 Orders Collection
          const orderData = {
              type: 'buyout', 
              orderType: 'corporate', 
              campaignName, 
              sov, 
              industry, 
              dayparting,
              detailedSlots, 
              status: 'paid', // 假設大客簽單即 Paid
              createdAt: serverTimestamp(), 
              amount: metrics.cost,
              userEmail: 'corporate_client@doohadv.com', 
              userName: campaignName,
              hasVideo: !!videoUrl, 
              videoUrl: videoUrl, 
              videoName: videoName, 
              creativeStatus: videoUrl ? 'approved' : 'empty'
          };

          await addDoc(collection(db, "orders"), orderData);
          setIsSubmitted(true);
      } catch (e) {
          alert("提交失敗：" + e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Target className="text-blue-600" /> 第一步：廣告企劃設定 (Campaign Strategy)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-slate-700">企劃名稱 (Campaign Name)</label>
              <input 
                  type="text" 
                  placeholder="例如：2024 Q4 節日大促銷" 
                  value={campaignName} 
                  onChange={e => setCampaignName(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold" 
              />
          </div>
          <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-1">
                  <CalendarRange size={16}/> 廣告檔期 (Flight Dates)
              </label>
              <div className="flex items-center gap-2">
                  <input 
                      type="date" 
                      value={dateRange.start} 
                      onChange={e => setDateRange({...dateRange, start: e.target.value})} 
                      className="flex-1 p-3 border border-slate-300 rounded-lg outline-none text-sm" 
                  />
                  <span className="text-slate-400">至</span>
                  <input 
                      type="date" 
                      value={dateRange.end} 
                      onChange={e => setDateRange({...dateRange, end: e.target.value})} 
                      className="flex-1 p-3 border border-slate-300 rounded-lg outline-none text-sm" 
                  />
              </div>
          </div>
          <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">行業類別 (Industry)</label>
              <select 
                  value={industry} 
                  onChange={e => setIndustry(e.target.value)} 
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                  <option value="">請選擇...</option>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
          </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="text-blue-600" /> 第二步：網絡覆蓋與機位選擇
      </h2>
      <div className="flex gap-4">
          <button 
              onClick={() => setRegionMode('district')} 
              className={`flex-1 py-3 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-all ${regionMode === 'district' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
              <Building2 size={20}/> 核心商業區 (Districts)
          </button>
          <button 
              onClick={() => setRegionMode('mtr')} 
              className={`flex-1 py-3 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-all ${regionMode === 'mtr' ? 'border-green-600 bg-green-50 text-green-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
              <Train size={20}/> 港鐵沿線 (MTR Lines)
          </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 一鍵全選 */}
        <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-700">快速選擇群組 (一鍵全選)</h3>
            <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {currentGroups.length === 0 ? (
                    <div className="p-4 bg-slate-50 text-slate-400 text-center text-sm rounded-xl border border-slate-200">
                        無可用群組資料
                    </div>
                ) : (
                    currentGroups.map(group => { 
                        const groupScreens = processedScreens.filter(s => s.group === group); 
                        const allSelected = groupScreens.every(s => selectedScreens.has(s.id)); 
                        return (
                            <div 
                                key={group} 
                                onClick={() => handleGroupToggle(group)} 
                                className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${allSelected ? 'border-blue-500 bg-blue-600 text-white shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                            >
                                <span className="font-bold text-sm">{group}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${allSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {groupScreens.length} 部
                                </span>
                            </div>
                        ); 
                    })
                )}
            </div>

            {/* 機位名單 */}
            <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[300px]">
                <div className="p-3 bg-slate-50 border-b font-bold text-sm text-slate-700 flex justify-between items-center">
                    <span>詳細機位名單</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                        已選 {processedScreens.filter(s => s.type === regionMode && selectedScreens.has(s.id)).length} 部
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {processedScreens.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Monitor size={48} className="mb-2 opacity-50"/>
                            <p>尚未載入任何機位數據</p>
                        </div>
                    ) : (
                        processedScreens.filter(s => s.type === regionMode).map(screen => { 
                            const isBanned = industry && screen.bannedCategories.includes(industry); 
                            return (
                                <div key={screen.id} className={`p-2 rounded-lg border flex justify-between items-center transition-all ${isBanned ? 'bg-slate-50 border-slate-100 opacity-50' : selectedScreens.has(screen.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <div 
                                            onClick={() => !isBanned && handleToggleScreen(screen.id)} 
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isBanned ? 'cursor-not-allowed' : 'cursor-pointer'} ${selectedScreens.has(screen.id) && !isBanned ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                                        >
                                            {selectedScreens.has(screen.id) && !isBanned && <CheckCircle size={12}/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 flex items-center gap-1">
                                                {screen.name}
                                                {isBanned && <AlertTriangle size={12} className="text-orange-500"/>}
                                            </p>
                                            <p className="text-[10px] text-slate-500">人流: {(screen.footfall/1000).toFixed(0)}k</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setPreviewScreen(screen)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                                        <Info size={16}/>
                                    </button>
                                </div>
                            ) 
                        })
                    )}
                </div>
            </div>
        </div>
        
        {/* 真・互動地圖區 (Leaflet) */}
        <div className="lg:col-span-2 bg-slate-200 rounded-xl border border-slate-300 relative overflow-hidden h-[500px] z-0 shadow-inner">
            <MapContainer center={[22.3193, 114.1694]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {processedScreens.filter(s => s.type === regionMode && selectedScreens.has(s.id)).map(screen => (
                    <Marker key={screen.id} position={[screen.lat, screen.lng]}>
                        <Popup>
                            <div className="text-center font-sans">
                                <strong className="text-sm text-blue-700">{screen.name}</strong>
                                <p className="text-xs text-slate-500 mt-1 mb-2">預估日人流: {(screen.footfall/1000).toFixed(0)}k</p>
                                <img src={screen.image} alt={screen.name} className="w-full h-20 object-cover rounded shadow-sm" />
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600" /> 第三步：聲量與預測指標 (SOV & Projections)</h2>
      
      {/* 時段選擇 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Clock size={18}/> 播放時段策略 (Dayparting)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DAYPARTING_OPTIONS.map(opt => (
                  <div 
                      key={opt.id} 
                      onClick={() => setDayparting(opt.id)} 
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${dayparting === opt.id ? 'border-blue-600 bg-white shadow-sm' : 'border-blue-100 bg-blue-50/50 hover:border-blue-300'}`}
                  >
                      <p className={`font-bold text-sm ${dayparting === opt.id ? 'text-blue-700' : 'text-slate-600'}`}>{opt.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">每日 {opt.hours} 小時</p>
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
              <label className="block font-bold text-slate-700 text-lg">選擇 Share of Voice (SOV %)</label>
              <p className="text-sm text-slate-500 mb-4">SOV 決定您的廣告曝光頻率。大客專屬最高 30%。</p>
              <div className="grid grid-cols-3 gap-3">
                  {[10, 20, 30].map(val => (
                      <button 
                          key={val} 
                          onClick={() => setSov(val)} 
                          className={`py-4 rounded-xl border-2 font-black text-2xl transition-all ${sov === val ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-105' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                      >
                          {val}%
                      </button>
                  ))}
              </div>
              {conflicts.length > 0 && (
                  <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                      <AlertTriangle size={16} className="inline mr-1 mb-1"/> 
                      基於您選擇嘅行業 ({CATEGORIES.find(c=>c.id===industry)?.name})，系統已自動剔除 <strong>{conflicts.length}</strong> 部物管受限機位。
                  </div>
              )}
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 opacity-10"><BarChart3 size={150}/></div>
              <h3 className="font-bold text-slate-300 uppercase tracking-wider text-xs mb-6">Estimated Campaign Metrics</h3>
              <div className="space-y-6 relative z-10">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">預估總曝光 (Est. Impressions)</p>
                      <p className="text-4xl font-black text-green-400">
                          {metrics.impressions.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-lg font-normal text-slate-400">次</span>
                      </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-6">
                      <div>
                          <p className="text-slate-400 text-sm mb-1">預計千人成本 (CPM)</p>
                          <p className="text-2xl font-bold text-white">HK$ {metrics.cpm.toFixed(2)}</p>
                      </div>
                      <div>
                          <p className="text-slate-400 text-sm mb-1">企劃日數 (Duration)</p>
                          <p className="text-2xl font-bold text-white">{metrics.days} 日</p>
                      </div>
                  </div>
                  <div className="mt-4 bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                      <span className="text-sm text-slate-300">預計總投資額 (Est. Cost)</span>
                      <span className="text-xl font-bold text-blue-400">HK$ {metrics.cost.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UploadCloud className="text-blue-600" /> 第四步：上載廣告素材 (Creative Assets)</h2>
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
            <p className="text-sm text-slate-600 mb-4">請上載您嘅廣告影片。當 Invoice 獲確認後，系統將自動將影片分發至已選機位。</p>
            <label className="border-2 border-dashed border-blue-300 bg-white hover:bg-blue-50 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer max-w-xl mx-auto">
                <input type="file" accept="video/mp4,video/mov" className="hidden" onChange={(e) => setUploadedFile(e.target.files[0])} />
                <UploadCloud size={48} className="text-blue-500 mb-3"/>
                {uploadedFile ? (
                    <div className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={20}/> {uploadedFile.name} (已準備)</div>
                ) : (
                    <div>
                        <span className="font-bold text-blue-600 text-lg block">點擊或拖曳上載影片</span>
                        <span className="text-xs text-slate-400 mt-1 block">支援 MP4/MOV, 最大 100MB</span>
                    </div>
                )}
            </label>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans relative z-0">
      {previewScreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="relative h-48 bg-slate-200">
                      <img src={previewScreen.image} alt="screen" className="w-full h-full object-cover" />
                      <button onClick={() => setPreviewScreen(null)} className="absolute top-3 right-3 bg-black/50 text-white p-1 rounded-full hover:bg-black"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{previewScreen.group}</div>
                      <h3 className="text-2xl font-black text-slate-800 mb-4">{previewScreen.name}</h3>
                      <div className="space-y-3 text-sm">
                          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">預估日人流</span><span className="font-bold text-slate-800">{previewScreen.footfall.toLocaleString()}</span></div>
                          <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">屏幕規格</span><span className="font-bold text-slate-800">{previewScreen.specs}</span></div>
                          <div className="flex justify-between pb-2"><span className="text-slate-500">物管禁播類別</span><span className="font-bold text-red-600">{previewScreen.bannedCategories.join(', ') || '無限制'}</span></div>
                      </div>
                      <button onClick={() => setPreviewScreen(null)} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">關閉預覽</button>
                  </div>
              </div>
          </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex justify-between items-center border border-slate-200">
            <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2 rounded-lg text-white"><Building2 size={24}/></div>
                <div>
                    <h1 className="font-black text-lg text-slate-900">DOOH Enterprise</h1>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Media Planner Portal</p>
                </div>
            </div>
            <div className="hidden md:flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-blue-600 text-white shadow-md' : step > s ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                        {s < 5 && <div className={`w-6 h-1 mx-1 rounded-full ${step > s ? 'bg-blue-200' : 'bg-slate-100'}`}></div>}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[550px]">
            {processedScreens.length === 0 && step !== 5 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 text-center">
                    <Monitor size={64} className="mb-4 text-slate-300"/>
                    <h2 className="text-xl font-bold text-slate-600 mb-2">尚未載入機位數據</h2>
                    <p className="text-sm">請等待系統從數據庫讀取資料。</p>
                </div>
            ) : (
                <>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                </>
            )}
            
            {step === 5 && (
                <div className="text-center py-10 animate-in zoom-in duration-300">
                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">企劃已提交並自動入單！</h2>
                    <p className="text-slate-600 max-w-md mx-auto mb-6">您嘅企劃已經記錄並寫入系統。系統已經自動將 {activeScreens.length} 部機位嘅訂單同步至 B2C Calendar 霸佔檔期，並無縫分發您上載嘅廣告片！</p>
                    <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">返回首頁</button>
                </div>
            )}
        </div>

        <div className="flex justify-between items-center mt-6">
            <button 
                onClick={() => setStep(prev => Math.max(1, prev - 1))} 
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${step === 1 || step === 5 ? 'invisible' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
            >
                <ChevronLeft size={18}/> 上一步
            </button>
            
            {step < 4 ? (
                <button 
                    onClick={() => setStep(prev => prev + 1)} 
                    className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                >
                    下一步 <ChevronRight size={18}/>
                </button>
            ) : step === 4 ? (
                <button 
                    onClick={handleFinalSubmit} 
                    disabled={isSubmitting} 
                    className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 bg-slate-900 text-white shadow-lg hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <><Loader2 className="animate-spin" size={18}/> 處理中...</>
                    ) : (
                        <><FileText size={18}/> 提交企劃及 Invoice</>
                    )}
                </button>
            ) : null}
        </div>
      </div>
    </div>
  );
};

export default CorporateBooking;