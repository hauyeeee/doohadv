import React, { useState, useMemo, useEffect } from 'react';
import { Map, MapPin, Building2, Train, Target, FileText, CheckCircle, ChevronRight, ChevronLeft, AlertTriangle, Users, CalendarRange, Clock, Download, BarChart3, Loader2 } from 'lucide-react';
import { useDoohSystem } from '../hooks/useDoohSystem'; // 🔥 引入真系統 Data

const CATEGORIES = [
  { id: 'fnb', name: '餐飲美食 (F&B)' },
  { id: 'retail', name: '零售及服裝 (Retail)' },
  { id: 'finance', name: '金融及保險 (Finance)' },
  { id: 'alcohol', name: '酒類飲品 (Alcohol)' },
  { id: 'medical', name: '醫療及保健 (Medical)' },
];

const DAYPARTING_OPTIONS = [
  { id: 'all_day', name: '全日覆蓋 (08:00 - 23:00)', hours: 15, multiplier: 1.0 },
  { id: 'rush_hour', name: '黃金通勤 (08:00-10:00, 17:00-20:00)', hours: 5, multiplier: 1.5 },
  { id: 'nightlife', name: '夜間消費 (19:00 - 02:00)', hours: 7, multiplier: 1.2 },
];

const CorporateBooking = () => {
  // 🔥 1. 從 Firebase 拎真機位 Data
  const { filteredScreens, isScreensLoading } = useDoohSystem();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [industry, setIndustry] = useState('');
  
  const [regionMode, setRegionMode] = useState('district');
  const [selectedScreens, setSelectedScreens] = useState(new Set());
  const [dayparting, setDayparting] = useState('all_day');
  const [sov, setSov] = useState(10);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 🔥 2. 將真 Data 格式化 (包底防 Error)
  const realScreens = useMemo(() => {
    if (!filteredScreens) return [];
    return filteredScreens.filter(s => s.isActive !== false).map(s => ({
      ...s,
      basePrice: Number(s.basePrice) || 50,
      footfall: Number(s.footfall) || 100000, // 如果 DB 未填人流，預設 10萬
      audience: s.audience ? String(s.audience).split(',') : ['大眾'],
      bannedCategories: s.bannedCategories || [], // 預留欄位畀物管限制
      district: s.district || '其他地區',
      mtr: s.mtr || '未設定港鐵線' // 如果你 DB 未有 MTR 欄位，會跌入呢度
    }));
  }, [filteredScreens]);

  // 初次載入時，預設全選所有機
  useEffect(() => {
    if (realScreens.length > 0 && selectedScreens.size === 0 && !isSubmitted) {
      setSelectedScreens(new Set(realScreens.map(s => s.id)));
    }
  }, [realScreens]);

  const handleToggleScreen = (id) => {
    const newSet = new Set(selectedScreens);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedScreens(newSet);
  };

  const activeScreens = useMemo(() => {
    return realScreens.filter(s => selectedScreens.has(s.id) && (!industry || !s.bannedCategories.includes(industry)));
  }, [selectedScreens, industry, realScreens]);

  const conflicts = useMemo(() => {
    return realScreens.filter(s => selectedScreens.has(s.id) && industry && s.bannedCategories.includes(industry));
  }, [selectedScreens, industry, realScreens]);

  // 🔥 3. 核心功能：按地區或 MTR 分 Group！
  const groupedScreens = useMemo(() => {
    const groups = {};
    realScreens.forEach(screen => {
      const key = regionMode === 'district' ? screen.district : screen.mtr;
      if (!groups[key]) groups[key] = [];
      groups[key].push(screen);
    });
    // 排返個靚次序 (可按 key 字母排)
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {});
  }, [realScreens, regionMode]);

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

    const cpm = totalImpressions > 0 ? (totalCost / (totalImpressions / 1000)) : 0;
    return { days, cost: totalCost, impressions: totalImpressions, cpm };
  }, [activeScreens, dateRange, dayparting, sov]);

  if (isScreensLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48}/></div>;
  }

  // --- Render Steps ---
  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Target className="text-blue-600" /> 第一步：廣告企劃設定 (Campaign Strategy)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-slate-700">企劃名稱 (Campaign Name)</label>
              <input type="text" placeholder="例如：2024 Q4 節日大促銷" value={campaignName} onChange={e=>setCampaignName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold" />
          </div>
          <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-1"><CalendarRange size={16}/> 廣告檔期 (Flight Dates)</label>
              <div className="flex items-center gap-2">
                  <input type="date" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start: e.target.value})} className="flex-1 p-3 border border-slate-300 rounded-lg outline-none text-sm" />
                  <span className="text-slate-400">至</span>
                  <input type="date" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end: e.target.value})} className="flex-1 p-3 border border-slate-300 rounded-lg outline-none text-sm" />
              </div>
          </div>
          <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">行業類別 (Industry)</label>
              <select value={industry} onChange={e=>setIndustry(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white">
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
        <MapPin className="text-blue-600" /> 第二步：網絡覆蓋與時段 (Coverage & Dayparting)
      </h2>
      
      <div className="flex gap-4 mb-4">
        <button onClick={() => setRegionMode('district')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${regionMode === 'district' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <Building2 size={18}/> 按商業區 (Districts)
        </button>
        <button onClick={() => setRegionMode('mtr')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${regionMode === 'mtr' ? 'border-green-600 bg-green-50 text-green-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <Train size={18}/> 港鐵沿線 (MTR Lines)
        </button>
      </div>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3"><Clock size={18}/> 播放時段策略 (Dayparting)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DAYPARTING_OPTIONS.map(opt => (
                  <div key={opt.id} onClick={()=>setDayparting(opt.id)} className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${dayparting === opt.id ? 'border-blue-600 bg-white shadow-sm' : 'border-blue-100 bg-blue-50/50 hover:border-blue-300'}`}>
                      <p className={`font-bold text-sm ${dayparting === opt.id ? 'text-blue-700' : 'text-slate-600'}`}>{opt.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">每日 {opt.hours} 小時</p>
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[400px]">
        {/* Map View */}
        <div className="md:col-span-2 bg-slate-200 rounded-xl border border-slate-300 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')] opacity-50"></div>
            <div className="text-center relative z-10">
                <Map size={48} className="mx-auto text-slate-400 mb-2"/>
                <p className="font-bold text-slate-600">地圖預覽區 (即將支援 Google Map)</p>
            </div>
        </div>
        
        {/* 🔥 Grouped Screen List */}
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-800 text-white font-bold text-sm flex justify-between">
                <span>機位名單</span>
                <span className="bg-blue-500 px-2 rounded-full text-xs">{activeScreens.length} 部已選</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                {Object.entries(groupedScreens).map(([groupName, screensInGroup]) => (
                    <div key={groupName} className="space-y-2">
                        {/* Group Header */}
                        <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm p-2 rounded text-xs font-bold text-slate-600 border-b border-slate-200 z-10 flex justify-between">
                            <span>{groupName}</span>
                            <span>{screensInGroup.filter(s => selectedScreens.has(s.id)).length} / {screensInGroup.length}</span>
                        </div>
                        {/* Items in Group */}
                        {screensInGroup.map(screen => {
                            const isBanned = industry && screen.bannedCategories.includes(industry);
                            return (
                            <div key={screen.id} onClick={() => !isBanned && handleToggleScreen(screen.id)} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${isBanned ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : selectedScreens.has(screen.id) ? 'border-blue-500 bg-blue-50 cursor-pointer' : 'border-slate-200 bg-white cursor-pointer hover:border-blue-300'}`}>
                                <div className="w-full pr-2">
                                    <p className="font-bold text-xs text-slate-800 leading-tight">
                                        {screen.name} 
                                        {isBanned && <AlertTriangle size={12} className="text-orange-500 inline ml-1"/>}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[150px]">{screen.location || screen.district}</p>
                                </div>
                                {!isBanned && (
                                    <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selectedScreens.has(screen.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                                        {selectedScreens.has(screen.id) && <CheckCircle size={14}/>}
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 className="text-blue-600" /> 第三步：聲量與預測指標 (SOV & Projections)
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
              <label className="block font-bold text-slate-700 text-lg">選擇 Share of Voice (SOV %)</label>
              <p className="text-sm text-slate-500 mb-4">SOV 決定您的廣告曝光頻率。大客專屬最高 30%。</p>
              <div className="grid grid-cols-3 gap-3">
                  {[10, 20, 30].map(val => (
                      <button 
                          key={val} onClick={() => setSov(val)} 
                          className={`py-4 rounded-xl border-2 font-black text-2xl transition-all ${sov === val ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-105' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                      >
                          {val}%
                      </button>
                  ))}
              </div>
              
              {conflicts.length > 0 && (
                  <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                      <AlertTriangle size={16} className="inline mr-1 mb-1"/> 
                      基於您選擇嘅行業 ({CATEGORIES.find(c=>c.id===industry)?.name})，系統已自動剔除 <strong>{conflicts.length}</strong> 部物管受限機位，以確保 KPI 準確。
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
                      <span className="text-sm text-slate-300">總預算 (Est. Total Cost)</span>
                      <span className="text-xl font-bold text-blue-400">HK$ {metrics.cost.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
      <div className="space-y-6 animate-in fade-in flex flex-col items-center">
        <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-sm rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-purple-600"></div>
            <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">廣告排期企劃書 (Media Plan)</h3>
                <p className="text-slate-500 font-bold">{campaignName || '未命名企劃'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">檔期</span><span className="font-bold">{dateRange.start || 'TBC'} 至 {dateRange.end || 'TBC'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">覆蓋網絡</span><span className="font-bold">{activeScreens.length} 部屏幕 ({regionMode === 'district' ? '按商業區' : '按港鐵線'})</span></div>
                <div className="flex justify-between"><span className="text-slate-500">時段策略</span><span className="font-bold">{DAYPARTING_OPTIONS.find(d=>d.id===dayparting)?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">聲量佔比</span><span className="font-bold">{sov}% SOV</span></div>
            </div>
            <div className="text-center">
                <p className="text-sm text-slate-500 mb-1">總投資額 (Total Investment)</p>
                <span className="text-5xl font-black text-slate-900">HK$ {metrics.cost.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                <p className="text-xs text-green-600 font-bold mt-2">有效 CPM: HK$ {metrics.cpm.toFixed(2)}</p>
            </div>
        </div>
      </div>
  );

  if (isSubmitted) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-lg w-full">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-4">企劃已提交審批！</h2>
                  <p className="text-slate-600 mb-6 text-sm">我哋嘅 Account Manager 會喺 1 個工作天內聯絡你，並將正式嘅 Invoice 同 Media Plan PDF Send 去你 Email。</p>
                  <div className="flex gap-3">
                      <button className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 flex justify-center items-center gap-2"><Download size={16}/> 下載 PDF 備份</button>
                      <button onClick={() => window.location.reload()} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800">返回主頁</button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex justify-between items-center border border-slate-200">
            <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2 rounded-lg text-white"><Building2 size={24}/></div>
                <div><h1 className="font-black text-lg text-slate-900 leading-tight">DOOH Enterprise</h1><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Media Planner Portal</p></div>
            </div>
            <div className="hidden md:flex gap-1">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-blue-600 text-white shadow-md' : step > s ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            {step > s ? <CheckCircle size={14}/> : s}
                        </div>
                        {s < 4 && <div className={`w-8 h-1 mx-1 rounded-full ${step > s ? 'bg-blue-200' : 'bg-slate-100'}`}></div>}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[550px]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
        </div>

        <div className="flex justify-between items-center mt-6">
            <button onClick={() => setStep(prev => Math.max(1, prev - 1))} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}><ChevronLeft size={18}/> Back</button>
            {step < 4 ? (
                <button onClick={() => setStep(prev => Math.min(4, prev + 1))} className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">Next Step <ChevronRight size={18}/></button>
            ) : (
                <div className="flex gap-3">
                    <button className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"><Download size={18}/> Export Media Plan</button>
                    <button onClick={() => setIsSubmitted(true)} className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-xl transition-all active:scale-95"><FileText size={18}/> Submit Request</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CorporateBooking;