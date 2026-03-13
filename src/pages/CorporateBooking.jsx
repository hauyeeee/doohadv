import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, Building2, Train, Target, FileText, CheckCircle, 
  ChevronRight, ChevronLeft, AlertTriangle, CalendarRange, 
  Clock, BarChart3, UploadCloud, Info, X, Monitor, Loader2, Sparkles 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// 修正 Leaflet Icon 遺失 Bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ 
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png', 
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', 
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png' 
});

const CATEGORIES = [ 
    { id: 'fnb', name: '餐飲美食 (F&B)' }, 
    { id: 'retail', name: '零售及服裝 (Retail)' }, 
    { id: 'finance', name: '金融及保險 (Finance)' }, 
    { id: 'alcohol', name: '酒類飲品 (Alcohol)' } 
];

// 🔥 全新：智能時段區塊 (不再依賴死板鐘數)
const DAYPARTING_BLOCKS = [ 
    { 
        id: 'smart_prime', 
        name: '旗艦黃金時段 (Smart Prime)', 
        desc: '系統自動抽取各屏幕最高人流之專屬時段 (無折扣)' 
    }, 
    { 
        id: 'smart_gold_normal', 
        name: '日常優質時段 (Gold & Normal)', 
        desc: '非黃金時段，適合長線曝光維持聲量 (原價計費)' // 🔥 改咗呢度
    }
];

const SOV_OPTIONS = [
    { val: 10, label: "10% 標準" },
    { val: 30, label: "30% 高頻" },
    { val: 50, label: "50% 半霸屏" },
    { val: 100, label: "100% 獨家包場" }
];

const CorporateBooking = ({ screens = [], pricingConfig = {} }) => {
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [industry, setIndustry] = useState('');
  
  // 預設選擇全日 24 小時
  const [selectedDayparts, setSelectedDayparts] = useState(['all_day']); 
  const [sov, setSov] = useState(30); 
  
  const [regionMode, setRegionMode] = useState('district'); 
  const [selectedScreens, setSelectedScreens] = useState(new Set()); 
  const [previewScreen, setPreviewScreen] = useState(null); 
  const [uploadedFile, setUploadedFile] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 防呆處理
  const processedScreens = useMemo(() => {
    if (!screens || !Array.isArray(screens) || screens.length === 0) return [];
    return screens.map((s, index) => {
      let safeBanned = Array.isArray(s.bannedCategories) ? s.bannedCategories : (typeof s.bannedCategories === 'string' && s.bannedCategories.trim() !== '' ? [s.bannedCategories] : []);
      return {
        id: String(s.id || Math.random()), 
        name: s.name || '未命名屏幕', 
        group: s.district || s.bundleGroup || '未分類地區', 
        type: 'district', 
        basePrice: Number(s.basePrice) || 50, 
        bannedCategories: safeBanned, 
        footfall: Number(s.footfall) || 100000, 
        specs: s.specifications || s.size || '標準屏幕', 
        tierRules: s.tierRules || {}, // 🔥 保留最核心嘅 Database Tier Rules
        image: (s.images && Array.isArray(s.images) && s.images.length > 0) ? s.images[0] : 'https://placehold.co/600x400?text=No+Image',
        lat: Number(s.lat) || 22.3193 + (index * 0.005), 
        lng: Number(s.lng) || 114.1694 + (index * 0.005),
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

  const toggleDaypart = (id) => {
      let newSet = new Set(selectedDayparts);
      if (newSet.has('all_day')) newSet.delete('all_day'); 
      
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);

      if (newSet.size === 0) newSet.add('all_day'); 
      setSelectedDayparts(Array.from(newSet));
  };

  const currentGroups = useMemo(() => {
      return [...new Set(processedScreens.filter(s => s.type === regionMode).map(s => s.group))];
  }, [regionMode, processedScreens]);

  const activeScreens = useMemo(() => {
      return processedScreens.filter(s => selectedScreens.has(s.id) && (!industry || !s.bannedCategories.includes(industry)));
  }, [selectedScreens, industry, processedScreens]);

  const conflicts = useMemo(() => {
      return processedScreens.filter(s => selectedScreens.has(s.id) && industry && s.bannedCategories.includes(industry));
  }, [selectedScreens, industry, processedScreens]);

  // 🔥 終極定價引擎：讀取每部機嘅 Prime/Gold 並套用階梯折扣
  const metrics = useMemo(() => {
      let days = 30;
      if (dateRange.start && dateRange.end) { 
          days = Math.max(1, Math.ceil(Math.abs(new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24))); 
      }
      
      const isAllDay = selectedDayparts.includes('all_day');
      const sovMultiplier = sov / 100;
      
      // 讀取 Admin 設定嘅倍數
      const p_prime = pricingConfig?.primeMultiplier || 3.5;
      const p_gold = pricingConfig?.goldMultiplier || 1.8;
      
      let totalCost = 0;
      let totalImpressions = 0;
      
      activeScreens.forEach(s => { 
          let screenDailyCost = 0;
          let screenActiveHoursCount = 0;
          
          // 預設讀取 Default，因為預測唔到具體星期幾，用 Default 做估算最準
          const rules = s.tierRules?.default || { prime: [], gold: [] };
          const primeHours = (rules.prime || []).map(Number);
          const goldHours = (rules.gold || []).map(Number);
          
          for (let h = 0; h < 24; h++) {
              const isPrime = primeHours.includes(h);
              const isGold = goldHours.includes(h);
              
              let includeHour = false;
              let hourDiscount = 1.0; // 預設正價

              if (isAllDay) {
                  includeHour = true;
                  hourDiscount = 0.90; // 🔥 改為 0.90 (即 10% Off)
              } else {
                  if (selectedDayparts.includes('smart_prime') && isPrime) { 
                      includeHour = true; 
                      hourDiscount = 1.0; // Prime 無折
                  }
                  if (selectedDayparts.includes('smart_gold_normal') && !isPrime) { 
                      includeHour = true; 
                      hourDiscount = 1.0; // 🔥 取消 5% 優惠，改為 1.0
                  }
              }

              if (includeHour) {
                  let multiplier = 1.0;
                  if (isPrime) multiplier = p_prime;
                  else if (isGold) multiplier = p_gold;
                  
                  screenDailyCost += (s.basePrice * multiplier * sovMultiplier * hourDiscount);
                  screenActiveHoursCount++;
              }
          }
          
          totalCost += screenDailyCost * days;
          // 按比例計算人流 (假設人流平均分佈於 24 小時)
          totalImpressions += (s.footfall * (screenActiveHoursCount / 24) * days * sovMultiplier); 
      });
      
      return { 
          days, 
          cost: totalCost, 
          impressions: totalImpressions, 
          cpm: totalImpressions > 0 ? (totalCost / (totalImpressions / 1000)) : 0,
          isAllDay 
      };
  }, [activeScreens, dateRange, selectedDayparts, sov, pricingConfig]);

  // 🔥 真實入單邏輯 (跟 Metrics 一致)
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
          if (uploadedFile) {
              const storageRef = ref(storage, `corporate_uploads/${Date.now()}_${uploadedFile.name}`);
              const snapshot = await uploadBytesResumable(storageRef, uploadedFile);
              videoUrl = await getDownloadURL(snapshot.ref); 
              videoName = uploadedFile.name;
          }
          
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
          const isAllDay = selectedDayparts.includes('all_day');
          const p_prime = pricingConfig?.primeMultiplier || 3.5;
          const p_gold = pricingConfig?.goldMultiplier || 1.8;
          const detailedSlots = [];

          // 逐日逐部機逐個鐘生成
          dates.forEach(d => {
              const dayOfWeek = new Date(d).getDay();
              
              activeScreens.forEach(s => {
                  // 讀取當天專屬嘅 Tier Rules
                  const rules = s.tierRules?.[dayOfWeek] || s.tierRules?.default || { prime: [], gold: [] };
                  const primeHours = (rules.prime || []).map(Number);
                  const goldHours = (rules.gold || []).map(Number);
                  
                  for (let h = 0; h < 24; h++) {
                      const isPrime = primeHours.includes(h);
                      const isGold = goldHours.includes(h);
                      
                      let includeHour = false;
                      let hourDiscount = 1.0;

                      if (isAllDay) {
                          includeHour = true;
                          hourDiscount = 0.90; // 🔥 改為 0.90 (10% Off)
                      } else {
                          if (selectedDayparts.includes('smart_prime') && isPrime) { 
                              includeHour = true; 
                              hourDiscount = 1.0; 
                          }
                          if (selectedDayparts.includes('smart_gold_normal') && !isPrime) { 
                              includeHour = true; hourDiscount = 1.0; // 🔥 改為 1.0
                          }
                      }

                      if (includeHour) {
                          let multiplier = 1.0;
                          if (isPrime) multiplier = p_prime;
                          else if (isGold) multiplier = p_gold;
                          
                          const finalPrice = s.basePrice * multiplier * (sov/100) * hourDiscount;
                          
                          detailedSlots.push({ 
                              date: d, 
                              hour: h, 
                              screenId: String(s.id), 
                              screenName: s.name, 
                              isCorporate: true, 
                              sov: sov, 
                              slotStatus: 'won', 
                              bidPrice: finalPrice 
                          }); 
                      }
                  }
              });
          });
          
          const orderData = { 
              type: 'buyout', 
              orderType: 'corporate', 
              campaignName, 
              sov, 
              industry, 
              dayparting: selectedDayparts.join(','), 
              detailedSlots, 
              status: 'paid', 
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
                            <p>尚未載入數據</p>
                        </div>
                    ) : (
                        processedScreens.filter(s => s.type === regionMode).map(screen => { 
                            const isBanned = industry && screen.bannedCategories.includes(industry); 
                            return (
                                <div 
                                    key={screen.id} 
                                    className={`p-2 rounded-lg border flex justify-between items-center transition-all ${isBanned ? 'bg-slate-50 border-slate-100 opacity-50' : selectedScreens.has(screen.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                                >
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
                            ); 
                        })
                    )}
                </div>
            </div>
        </div>
        <div className="lg:col-span-2 bg-slate-200 rounded-xl border border-slate-300 relative overflow-hidden h-[500px] z-0 shadow-inner">
            <MapContainer center={[22.3193, 114.1694]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-blue-600" /> 第三步：聲量與預測指標 (SOV & Projections)
      </h2>
      
      {/* 🔥 智能時段選擇器 */}
      <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                  <Clock size={18}/> 播放時段策略 (可多選組合)
              </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {DAYPARTING_BLOCKS.map(block => {
                  const isSelected = selectedDayparts.includes(block.id);
                  return (
                      <div 
                          key={block.id} 
                          onClick={() => toggleDaypart(block.id)} 
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-600 bg-white shadow-md transform scale-[1.02]' : 'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-white'}`}
                      >
                          <div className="flex justify-between items-center mb-2">
                              <p className={`font-bold text-base ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>{block.name}</p>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                                  {isSelected && <CheckCircle size={14} />}
                              </div>
                          </div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{block.desc}</p>
                      </div>
                  )
              })}
          </div>

          {/* ROS 獨立大掣 (25% Off) */}
          <div 
              onClick={() => setSelectedDayparts(['all_day'])} 
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${selectedDayparts.includes('all_day') ? 'border-green-500 bg-green-50 shadow-lg transform scale-[1.01]' : 'border-green-200 bg-white hover:border-green-400'}`}
          >
              <div>
                  <p className={`font-black text-lg flex items-center gap-2 mb-1 ${selectedDayparts.includes('all_day') ? 'text-green-700' : 'text-slate-700'}`}>
                      🌟 全日霸屏 ROS (24小時)
                      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                          <Sparkles size={10}/> 專享 10% 折扣
                      </span>
                  </p>
                  <p className="text-xs text-slate-500">系統自動包攬屏幕全日 24 小時時段，將投資效益最大化！</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedDayparts.includes('all_day') ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 bg-slate-50 group-hover:border-green-400'}`}>
                  {selectedDayparts.includes('all_day') && <CheckCircle size={16} />}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
              <label className="block font-bold text-slate-700 text-lg">選擇 Share of Voice (SOV %)</label>
              <p className="text-sm text-slate-500 mb-4">為企業專屬品牌包場方案，可選擇高達 100% 獨家聲量。</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SOV_OPTIONS.map(opt => (
                      <button 
                          key={opt.val} 
                          onClick={() => setSov(opt.val)} 
                          className={`py-4 rounded-xl border-2 font-bold transition-all ${sov === opt.val ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-105' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                      >
                          <div className="text-xl font-black">{opt.val}%</div>
                          <div className="text-[10px] opacity-80 mt-1">{opt.label}</div>
                      </button>
                  ))}
              </div>
              {conflicts.length > 0 && (
                  <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                      <AlertTriangle size={16} className="inline mr-1 mb-1"/> 
                      系統已自動剔除 <strong>{conflicts.length}</strong> 部物管受限機位。
                  </div>
              )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 opacity-5">
                  <BarChart3 size={200}/>
              </div>
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                  <h3 className="font-bold text-slate-400 uppercase tracking-wider text-xs">投資回報預測</h3>
                  {metrics.isAllDay && (
                      <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle size={10}/> ROS 25% Off 已啟動
                      </span>
                  )}
              </div>

              <div className="space-y-6 relative z-10">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">預估總曝光 (Est. Impressions)</p>
                      <p className="text-4xl font-black text-white">
                          {metrics.impressions.toLocaleString(undefined, {maximumFractionDigits:0})} 
                          <span className="text-lg font-normal text-slate-400 ml-1">次</span>
                      </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-6">
                      <div>
                          <p className="text-slate-400 text-sm mb-1">預計千人成本 (CPM)</p>
                          <p className="text-2xl font-bold text-blue-400">HK$ {metrics.cpm.toFixed(2)}</p>
                      </div>
                      <div>
                          <p className="text-slate-400 text-sm mb-1">企劃日數 (Duration)</p>
                          <p className="text-2xl font-bold text-blue-400">{metrics.days} 日</p>
                      </div>
                  </div>
                  <div className="mt-4 bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                      <span className="text-sm text-slate-300 font-medium">預計總投資額 (Total Cost)</span>
                      <span className="text-3xl font-black text-green-400">HK$ {metrics.cost.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-in fade-in">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud className="text-blue-600" /> 第四步：上載廣告素材 (Creative Assets)
        </h2>
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
            <p className="text-sm text-slate-600 mb-4">請上載您嘅廣告影片。確認後系統將自動將影片分發至已選機位。</p>
            <label className="border-2 border-dashed border-blue-300 bg-white hover:bg-blue-50 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer max-w-xl mx-auto">
                <input 
                    type="file" 
                    accept="video/mp4,video/mov" 
                    className="hidden" 
                    onChange={(e) => setUploadedFile(e.target.files[0])} 
                />
                <UploadCloud size={48} className="text-blue-500 mb-3"/>
                {uploadedFile ? (
                    <div className="text-green-600 font-bold flex items-center gap-2">
                        <CheckCircle size={20}/> {uploadedFile.name} (已準備)
                    </div>
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
                      <button onClick={() => setPreviewScreen(null)} className="absolute top-3 right-3 bg-black/50 text-white p-1 rounded-full hover:bg-black">
                          <X size={20}/>
                      </button>
                  </div>
                  <div className="p-6">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{previewScreen.group}</div>
                      <h3 className="text-2xl font-black text-slate-800 mb-4">{previewScreen.name}</h3>
                      <div className="space-y-3 text-sm">
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                              <span className="text-slate-500">預估日人流</span>
                              <span className="font-bold text-slate-800">{previewScreen.footfall.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                              <span className="text-slate-500">屏幕規格</span>
                              <span className="font-bold text-slate-800">{previewScreen.specs}</span>
                          </div>
                          <div className="flex justify-between pb-2">
                              <span className="text-slate-500">物管禁播類別</span>
                              <span className="font-bold text-red-600">{previewScreen.bannedCategories.join(', ') || '無限制'}</span>
                          </div>
                      </div>
                      <button 
                          onClick={() => setPreviewScreen(null)} 
                          className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                      >
                          關閉預覽
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex justify-between items-center border border-slate-200">
            <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2 rounded-lg text-white">
                    <Building2 size={24}/>
                </div>
                <div>
                    <h1 className="font-black text-lg text-slate-900">DOOH Enterprise</h1>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">企業專屬方案</p>
                </div>
            </div>
            <div className="hidden md:flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-blue-600 text-white shadow-md' : step > s ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            {s}
                        </div>
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
                    <h2 className="text-3xl font-black text-slate-900 mb-2">企業企劃已鎖定！</h2>
                    <p className="text-slate-600 max-w-md mx-auto mb-6">系統已經自動為 {activeScreens.length} 部機位鎖定庫存，並開始分發您上載的專屬廣告。</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
                    >
                        返回首頁
                    </button>
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
                        <><FileText size={18}/> 確認鎖定檔期</>
                    )}
                </button>
            ) : null}
        </div>
      </div>
    </div>
  );
};
export default CorporateBooking;