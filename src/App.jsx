import React from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Monitor, 
  DollarSign, Loader2, MapPin, 
  TrendingUp, Search, LogIn,
  Zap, Layers, Sparkles, Ban, HelpCircle, Gavel, CalendarDays, Repeat, Map as MapIcon, Lock, Info, AlertTriangle
} from 'lucide-react';

import ScreenDetailModal from './components/ScreenDetailModal';
import MyOrdersModal from './components/MyOrdersModal';
import BiddingModal from './components/BiddingModal';
import BuyoutModal from './components/BuyoutModal';
import LoginModal from './components/LoginModal';
import UrgentUploadModal from './components/UrgentUploadModal';

import { useDoohSystem } from './hooks/useDoohSystem';

const DOOHBiddingSystem = () => {
  const {
    user, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    toast, transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    
    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted,
    
    handleGoogleLogin, handleLogout,
    toggleScreen, toggleHour, toggleWeekday, toggleDate,
    handleBatchBid, handleSlotBidChange,
    handleBidClick, handleBuyoutClick,
    initiateTransaction, processPayment, handleRealUpload, closeTransaction,
    viewingScreen,
    
    // Constants & Helpers (passed from hook for simplicity)
    HOURS, WEEKDAYS_LABEL, getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed, getHourTier,
    
    // Boolean flags for Modals
    isBuyoutModalOpen, isBidModalOpen, 
    // State needed for modals (passed through)
    slotBids, batchBidInput
  } = useDoohSystem();

  const renderCalendar = () => { 
    const year = currentDate.getFullYear(); 
    const month = currentDate.getMonth(); 
    const daysInMonth = getDaysInMonth(year, month); 
    const firstDayIdx = getFirstDayOfMonth(year, month); 
    const days = []; 
    for (let i = 0; i < firstDayIdx; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>); 
    for (let d = 1; d <= daysInMonth; d++) { 
        const dateKey = formatDateKey(year, month, d); 
        const isAllowed = isDateAllowed(year, month, d); 
        const isSelected = mode === 'specific' ? selectedSpecificDates.has(dateKey) : false; 
        let isPreview = false;
        if (mode === 'recurring') {
            const thisDay = new Date(year, month, d);
            if (selectedWeekdays.has(thisDay.getDay()) && isAllowed) isPreview = true;
        }
        days.push(
            <button key={dateKey} onClick={() => toggleDate(year, month, d)} disabled={!isAllowed || (mode === 'recurring' && !isPreview)} 
                className={`h-10 w-full rounded-md text-sm font-medium transition-all relative 
                ${!isAllowed ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 
                  isSelected ? 'bg-blue-600 text-white shadow-md' : 
                  isPreview ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'hover:bg-gray-100 text-gray-700'}`}
            >
                {d}
            </button>
        ); 
    } 
    return days; 
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 relative pt-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-8 z-30 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg"><Monitor size={20} /></div>
            <div className="flex flex-col">
                <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">DOOHadv</h1>
                <span className="text-[10px] text-slate-500 font-bold">自己廣告自己投 Bid your own adv here!</span>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {user ? (<button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-lg transition-colors"><img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" /></button>) : (<button onClick={() => setIsLoginModalOpen(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"><LogIn size={16} /> 登入</button>)}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50"></div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 relative z-10"><HelpCircle size={16}/> 玩法說明 How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold"><Gavel size={18}/> 競價投標 (Bidding)</div>
                    <ul className="space-y-2 text-xs text-slate-600">
                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>價高者得：</strong> 自由出價，適合預算有限或爭奪黃金時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-orange-500 font-bold">•</span> <span className="text-orange-700 font-medium"><strong>限制：</strong> 僅開放予 24小時 至 7天 內的時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>預授權機制：</strong> 提交時只凍結額度 (Pre-auth)，不即時扣款。</span></li>
                    </ul>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold"><Zap size={18}/> 直接買斷 (Buyout)</div>
                    <ul className="space-y-2 text-xs text-slate-600">
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時鎖定：</strong> 付出一口價，立即確保獲得該時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>遠期預訂：</strong> 支援 7 至 60 天後的預訂 (Prime Time 除外)。</span></li>
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時扣款：</strong> 交易確認後立即從信用卡扣除全數。</span></li>
                    </ul>
                </div>
            </div>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[350px]">
            <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Monitor size={16} /> 1. 選擇屏幕 ({selectedScreens.size})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>
                    <div className="relative flex-1 w-full sm:w-48"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" placeholder="搜尋地點..." value={screenSearchTerm} onChange={(e) => setScreenSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"/></div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                {isScreensLoading ? <div className="text-center p-10"><Loader2 className="animate-spin inline"/></div> : (
                    <table className="w-full text-left text-sm border-collapse table-fixed">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 font-semibold">
                            <tr>
                                <th className="p-3 w-[15%] text-center">選取</th>
                                <th className="p-3 w-[60%] sm:w-[40%]">屏幕名稱</th>
                                <th className="p-3 hidden sm:table-cell sm:w-[15%]">區域</th>
                                <th className="p-3 hidden sm:table-cell sm:w-[15%]">規格</th>
                                <th className="p-3 w-[25%] sm:w-[15%] text-right">詳情</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredScreens.map(s => (
                                <tr key={s.id} className={`hover:bg-blue-50/50 ${selectedScreens.has(s.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" checked={selectedScreens.has(s.id)} onChange={() => toggleScreen(s.id)} className="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                                    </td>
                                    <td className="p-3 overflow-hidden">
                                        <div className="font-bold truncate text-slate-800">{s.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 truncate"><MapPin size={10} className="shrink-0"/> {s.location}</div>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell">
                                        <span className="bg-slate-100 px-2 py-1 rounded-full text-xs text-slate-600">{s.district}</span>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell text-slate-500 text-xs">{s.size}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => setViewingScreen(s)} className="text-blue-600 text-xs flex items-center justify-end gap-1 ml-auto font-bold hover:underline bg-blue-50 sm:bg-transparent px-2 py-1 sm:p-0 rounded">
                                            <MapIcon size={14}/> 詳情
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2"><CalendarIcon size={16}/> 2. 選擇日期</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => { setMode('specific'); setSelectedSpecificDates(new Set()); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>指定日期</button>
                    <button onClick={() => { setMode('recurring'); setSelectedSpecificDates(new Set()); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>週期模式</button>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                <div className="text-center">
                    <div className="text-sm text-slate-500 font-medium">年份</div>
                    <div className="text-2xl font-extrabold text-blue-600 bg-blue-50 px-6 py-2 rounded-xl shadow-sm border border-blue-100">
                        {currentDate.getFullYear()}年 {currentDate.getMonth()+1}月
                    </div>
                    <div className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">⚠️ 請核對年份月份</div>
                </div>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
            </div>

            {mode === 'recurring' && (
                <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-blue-700 flex items-center gap-1"><Repeat size={12}/> 重複星期</span><div className="flex gap-1">{WEEKDAYS_LABEL.map((d, i) => (<button key={d} onClick={() => toggleWeekday(i)} className={`w-6 h-6 text-[10px] rounded-full font-bold transition-all ${selectedWeekdays.has(i) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border hover:border-blue-300'}`}>{d}</button>))}</div></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-blue-700 flex items-center gap-1"><CalendarDays size={12}/> 持續週數</span><select value={weekCount} onChange={(e) => setWeekCount(Number(e.target.value))} className="text-xs border border-blue-200 rounded px-2 py-1 bg-white outline-none">{Array.from({length: 8}, (_, i) => i + 1).map(w => <option key={w} value={w}>{w} 週</option>)}</select></div>
                </div>
            )}
            
            <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1">{WEEKDAYS_LABEL.map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 flex-1 content-start">{renderCalendar()}</div>
          </section>

          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2"><Clock size={16}/> 3. 選擇時段</h2>
              <div className="flex gap-3 text-[10px] mb-3"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Prime</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Gold</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Normal</span></div>
              <div className="grid grid-cols-4 gap-1.5 overflow-y-auto max-h-[300px]">
                  {HOURS.map(h => {
                      const dateStr = formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
                      
                      let isSoldOut = false;
                      selectedScreens.forEach(screenId => {
                          const key = `${dateStr}-${h.val}-${screenId}`;
                          if (occupiedSlots.has(key)) {
                              isSoldOut = true;
                          }
                      });

                      const tier = getHourTier(h.val);
                      let tierClass = 'border-slate-200 text-slate-600 hover:bg-slate-50';
                      
                      if (isSoldOut) {
                          tierClass = 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed decoration-slice'; 
                      } else if (selectedHours.has(h.val)) {
                          tierClass = 'bg-blue-600 text-white border-blue-600';
                      } else if (tier === 'prime') {
                          tierClass = 'border-red-200 bg-red-50 text-red-700 font-bold';
                      } else if (tier === 'gold') {
                          tierClass = 'border-orange-200 bg-orange-50 text-orange-700 font-medium';
                      }

                      return (
                          <button 
                              key={h.val} 
                              onClick={() => !isSoldOut && toggleHour(h.val)} 
                              disabled={isSoldOut} 
                              className={`text-xs py-2 rounded border transition-all ${tierClass}`}
                          >
                              {h.label}
                              {isSoldOut && <span className="block text-[8px] font-normal">已售</span>}
                          </button>
                      );
                  })}
              </div>
          </section>
        </div>

        <section className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between border-t-4 border-blue-500">
            <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><DollarSign size={16}/> 價格預覽 {isBundleMode && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Sparkles size={10}/> Bundle Active</span>}</h2>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">共 {pricing.totalSlots} 個可用時段</span>
                </div>
                <div className="flex items-center justify-between gap-4 mt-1">
                    <div><p className="text-xs text-slate-400 mb-0.5">最低起標總額</p><div className="flex items-baseline gap-1"><span className="text-sm text-orange-500 font-bold">HK$</span><span className="text-2xl font-bold text-orange-400 tracking-tight">{pricing.minBidTotal.toLocaleString()}</span><span className="text-xs text-slate-500">起</span></div></div>
                    <div className="w-px h-10 bg-slate-700"></div>
                    <div className="text-right"><p className="text-xs text-slate-400 mb-0.5">直接買斷總額</p>{pricing.hasRestrictedBuyout ? (<div className="text-red-400 text-sm font-bold flex items-center justify-end gap-1"><Lock size={14}/> 不適用</div>) : (<div className="flex items-baseline justify-end gap-1"><span className="text-sm text-emerald-600 font-bold">HK$</span><span className="text-2xl font-bold text-emerald-500 tracking-tight">{pricing.buyoutTotal.toLocaleString()}</span></div>)}</div>
                </div>
                <div className="space-y-1 mt-3 min-h-[20px]">
                    {isBundleMode && (
                        <div className="text-xs text-purple-300 flex items-center gap-1 bg-purple-900/30 px-2 py-1 rounded border border-purple-800">
                            <Sparkles size={12} className="text-purple-400"/> 
                            <span>⚡ 已啟動聯播網模式 (Network Effect): 廣告將於同一區域同步播放，獲得最大曝光效益。 (溢價 +25%)</span>
                        </div>
                    )}
                    
                    {/* 🔥 遠期 Prime 鎖定警告 */}
                    {pricing.hasPrimeFarFutureLock && (
                        <div className="text-xs text-red-300 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-800">
                            <Lock size={12}/> 
                            <span>遠期 Prime (暫未開放，請於7天內競價)</span>
                        </div>
                    )}

                    {pricing.urgentCount > 0 && (<div className="text-xs text-orange-400 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded"><Zap size={12}/> 已包含 {pricing.urgentCount} 個急單時段 (附加費 +20%)</div>)}
                    {pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock && <div className="text-xs text-red-400 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded"><Lock size={12}/> 包含 Prime 時段，無法直接買斷</div>}
                    {pricing.soldOutCount > 0 && <div className="text-xs text-slate-400 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><Ban size={12}/> 已自動過濾 {pricing.soldOutCount} 個已售罄時段</div>}
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={handleBidClick} disabled={!pricing.canStartBidding} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${!pricing.canStartBidding ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-900/50'}`}>
                    <span>
                        {pricing.hasRestrictedBid 
                            ? '🚫 限買斷' 
                            : '出價競投'}
                    </span>
                    {!pricing.hasRestrictedBid && pricing.totalSlots > 0 && <span className="text-[10px] font-normal opacity-80">自由出價</span>}
                </button>
                <button onClick={handleBuyoutClick} disabled={pricing.hasRestrictedBuyout || pricing.totalSlots === 0} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${(pricing.hasRestrictedBuyout || pricing.totalSlots === 0) ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-900/50'}`}><span>直接買斷</span>{pricing.totalSlots > 0 && !pricing.hasRestrictedBuyout && <span className="text-[10px] font-normal opacity-80">即時確認</span>}</button>
            </div>
        </section>
      </main>

      {/* Modals */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full z-50">{toast}</div>}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} handleGoogleLogin={handleGoogleLogin} isLoginLoading={isLoginLoading} />
      <ScreenDetailModal screen={viewingScreen} onClose={() => setViewingScreen(null)} />
      <MyOrdersModal isOpen={isProfileModalOpen} user={user} myOrders={myOrders} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onUploadClick={(id) => { setCurrentOrderId(id); setIsUrgentUploadModalOpen(true); setIsProfileModalOpen(false); }} />
      {isBuyoutModalOpen && <BuyoutModal isOpen={isBuyoutModalOpen} onClose={() => setIsBuyoutModalOpen(false)} pricing={pricing} selectedSpecificDates={selectedSpecificDates} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('buyout')} hasUrgentRisk={pricing.hasUrgentRisk} />}
      {isBidModalOpen && <BiddingModal isOpen={isBidModalOpen} onClose={() => setIsBidModalOpen(false)} generateAllSlots={generateAllSlots} slotBids={slotBids} handleSlotBidChange={handleSlotBidChange} batchBidInput={batchBidInput} setBatchBidInput={setBatchBidInput} handleBatchBid={handleBatchBid} isBundleMode={isBundleMode} pricing={pricing} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('bid')} />}
      {isUrgentUploadModalOpen && <UrgentUploadModal isOpen={isUrgentUploadModalOpen} modalPaymentStatus={modalPaymentStatus} creativeStatus={creativeStatus} isUploadingReal={isUploadingReal} uploadProgress={uploadProgress} handleRealUpload={handleRealUpload} emailStatus={emailStatus} onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} />}
      
      {transactionStep !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
            {transactionStep === 'summary' && pendingTransaction ? (
                <>
                    <h3 className="text-lg font-bold mb-4">訂單摘要</h3>
                    <p className="mb-4">類型: {pendingTransaction.type === 'buyout' ? '買斷 (即扣款)' : '競價 (預授權)'}</p>
                    <p className="text-xl font-bold text-blue-600 mb-6">HK$ {pendingTransaction.amount}</p>
                    <button onClick={processPayment} className="w-full bg-slate-900 text-white py-3 rounded font-bold">前往付款</button>
                </>
            ) : <><Loader2 className="animate-spin mx-auto mb-4"/><p>正在連接 Stripe...</p></>}
          </div>
        </div>
      )}
    </div>
  );
};
export default DOOHBiddingSystem;