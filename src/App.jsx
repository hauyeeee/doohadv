import React, { useState, useEffect } from 'react'; 
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2, UploadCloud, AlertTriangle, Monitor, Clock, CheckCircle, X } from 'lucide-react'; 
import { useDoohSystem } from './hooks/useDoohSystem';
import { initAnalytics, trackPageView, trackEvent } from './utils/analytics';

// Pages & Components
import AdminPanel from './pages/AdminPanel'; 
import Privacy from './pages/Privacy';       
import Terms from './pages/Terms';           
import Player from './pages/Player';
import SEO from './components/SEO';
import Footer from './components/Footer';
import Header from './components/Header';
import TutorialModal from './components/TutorialModal'; 
import ScreenSelector from './components/ScreenSelector';
import DateSelector from './components/DateSelector';
import TimeSlotSelector from './components/TimeSlotSelector';
import PricingSummary from './components/PricingSummary';

// Modals
import ScreenDetailModal from './components/ScreenDetailModal';
import MyOrdersModal from './components/MyOrdersModal';
import BiddingModal from './components/BiddingModal';
import BuyoutModal from './components/BuyoutModal';
import LoginModal from './components/LoginModal';
import UrgentUploadModal from './components/UrgentUploadModal';

const DOOHBiddingSystem = () => {
  const {
    user, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted,
    setCurrentOrderId, 
    handleGoogleLogin, handleLogout,
    toggleScreen, toggleHour, toggleWeekday, toggleDate,
    handleBatchBid, handleSlotBidChange,
    handleBidClick, handleBuyoutClick,
    initiateTransaction, processPayment, handleRealUpload, closeTransaction,
    viewingScreen,
    handleUpdateBid,
    recalculateAllBids, 
    HOURS, getHourTier,
    getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed,
    isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted,
    occupiedSlots, existingBids, 
    restrictionModalData, setRestrictionModalData, handleProceedAfterRestriction,
    resumePayment, isTimeMismatchModalOpen, setIsTimeMismatchModalOpen,   
  } = useDoohSystem();

  const [isTutorialOpen, setIsTutorialOpen] = useState(false); 
  const [restrictionAgreed, setRestrictionAgreed] = useState(false); 

  // 🔥 修正：只保留 Purchase 追蹤，刪除舊版 ReactGA 呼叫，避免白畫面！
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get('success') === 'true') {
        trackEvent("E-commerce", "Purchase", "DOOH_Ad_Slot", 1);
        console.log("💰 Purchase Event Fired!");
    }
  }, []);

  useEffect(() => {
      if (restrictionModalData) setRestrictionAgreed(false);
  }, [restrictionModalData]);

  const handleUploadClick = (orderId) => {
    if (setCurrentOrderId) setCurrentOrderId(orderId);
    localStorage.setItem('temp_order_id', orderId);
    const fileInput = document.getElementById('hidden-file-input');
    if (fileInput) {
        fileInput.value = ''; 
        fileInput.click();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 relative pt-0">
      <SEO title="DOOH Adv Platform - 自己廣告自己投平台" />
      <Header 
        user={user} 
        onLoginClick={() => setIsLoginModalOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)} 
        onHelpClick={() => setIsTutorialOpen(true)} 
      />

      <main className="max-w-5xl mx-auto p-3 md:p-6 space-y-4 md:space-y-8 mt-4">
        <ScreenSelector 
          selectedScreens={selectedScreens}
          screenSearchTerm={screenSearchTerm}
          setScreenSearchTerm={setScreenSearchTerm}
          isScreensLoading={isScreensLoading}
          filteredScreens={filteredScreens}
          toggleScreen={toggleScreen}
          setViewingScreen={setViewingScreen}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <DateSelector 
            mode={mode} 
            setMode={setMode} 
            setSelectedSpecificDates={setSelectedSpecificDates}
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate}
            selectedWeekdays={selectedWeekdays} 
            toggleWeekday={toggleWeekday}
            weekCount={weekCount} 
            setWeekCount={setWeekCount}
            toggleDate={toggleDate}
            getDaysInMonth={getDaysInMonth}
            getFirstDayOfMonth={getFirstDayOfMonth}
            formatDateKey={formatDateKey}
            isDateAllowed={isDateAllowed}
            selectedSpecificDates={selectedSpecificDates}
          />
          
          <TimeSlotSelector 
            HOURS={HOURS} 
            previewDate={previewDate} 
            selectedScreens={selectedScreens} 
            occupiedSlots={occupiedSlots} 
            getHourTier={getHourTier} 
            selectedHours={selectedHours} 
            toggleHour={toggleHour}
          />
        </div>

        <PricingSummary 
          pricing={pricing} 
          isBundleMode={isBundleMode} 
          handleBidClick={handleBidClick} 
          handleBuyoutClick={handleBuyoutClick} 
        />
      </main>

      <Footer />

      <input 
        type="file" 
        id="hidden-file-input" 
        style={{ display: 'none' }} 
        accept="video/*" 
        onChange={handleRealUpload} 
      />

      {restrictionModalData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border-2 border-red-100 flex flex-col gap-4">
                  <div className="flex items-center gap-3 border-b pb-4">
                      <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="text-red-600" size={24}/></div>
                      <h3 className="text-xl font-bold text-red-700">⚠️ 重要注意事項</h3>
                  </div>
                  
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm text-slate-600">您選擇的屏幕包含特殊條件或限制，請細閱以下內容：</p>
                      {restrictionModalData.screens.map(s => (
                          <div key={s.id} className="bg-red-50 p-4 rounded-lg border border-red-100">
                              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Monitor size={16}/> {s.name}</h4>
                              <p className="text-sm text-red-600 leading-relaxed font-bold">{s.restrictions}</p>
                          </div>
                      ))}
                  </div>

                  <div className="pt-4 border-t flex flex-col gap-3">
                      <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                              type="checkbox" 
                              className="mt-1 w-4 h-4" 
                              checked={restrictionAgreed}
                              onChange={(e) => setRestrictionAgreed(e.target.checked)}
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                              我已閱讀並同意上述條款，並明白付款後 <strong className="text-red-600">不設退款</strong>。
                          </span>
                      </label>
                      <div className="flex gap-3 mt-2">
                          <button onClick={() => setRestrictionModalData(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg font-bold hover:bg-slate-200">取消</button>
                          <button 
                              onClick={() => {
                                  if(restrictionAgreed) handleProceedAfterRestriction();
                                  else alert("請先勾選同意條款");
                              }} 
                              className={`flex-1 py-3 rounded-lg font-bold shadow-lg transition-all ${restrictionAgreed ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                          >
                              確認並繼續付款
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isTimeMismatchModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500"></div>
                  <div className="mb-5 flex justify-center">
                      <div className="bg-orange-50 p-4 rounded-full border border-orange-100">
                          <Clock size={40} className="text-orange-500" />
                      </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">競價時段限制</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                      由於競價需要在特定時間進行結算，<br/>
                      一張競價訂單只能包含 <strong>「同一日期 + 同一小時」</strong>。
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-3 border border-slate-100">
                      <div className="flex items-start gap-3">
                          <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18}/>
                          <div>
                              <p className="text-sm font-bold text-slate-700">正確做法</p>
                              <p className="text-xs text-slate-500">同時競投 Screen A, B, C (全部都在 15:00)</p>
                          </div>
                      </div>
                      <div className="flex items-start gap-3">
                          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18}/>
                          <div>
                              <p className="text-sm font-bold text-slate-700">不支援</p>
                              <p className="text-xs text-slate-500">一張單同時包含 15:00 和 16:00</p>
                          </div>
                      </div>
                  </div>
                  <button 
                      onClick={() => setIsTimeMismatchModalOpen(false)} 
                      className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                  >
                      明白了，我會分開結帳
                  </button>
              </div>
          </div>
      )}

      <TutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} handleGoogleLogin={handleGoogleLogin} isLoginLoading={isLoginLoading} />
      <ScreenDetailModal screen={viewingScreen} onClose={() => setViewingScreen(null)} />
      <MyOrdersModal isOpen={isProfileModalOpen} user={user} myOrders={myOrders} existingBids={existingBids} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onUploadClick={handleUploadClick} handleUpdateBid={handleUpdateBid} onResumePayment={resumePayment} />
      <BuyoutModal isOpen={isBuyoutModalOpen} onClose={() => setIsBuyoutModalOpen(false)} pricing={pricing} selectedSpecificDates={selectedSpecificDates} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('buyout')} />
      <BiddingModal isOpen={isBidModalOpen} onClose={() => setIsBidModalOpen(false)} generateAllSlots={generateAllSlots} slotBids={slotBids} handleSlotBidChange={handleSlotBidChange} batchBidInput={batchBidInput} setBatchBidInput={setBatchBidInput} handleBatchBid={handleBatchBid} isBundleMode={isBundleMode} pricing={pricing} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('bid')} />
      <UrgentUploadModal isOpen={isUrgentUploadModalOpen} modalPaymentStatus={modalPaymentStatus} creativeStatus={creativeStatus} isUploadingReal={isUploadingReal} uploadProgress={uploadProgress} handleRealUpload={handleRealUpload} emailStatus={emailStatus} onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} />
      
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

// 統一路由及自動觸發 PageView
const AnalyticsTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  
  return null;
};

const App = () => {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      <AnalyticsTracker />
      <Routes>
        <Route path="/" element={<DOOHBiddingSystem />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/player/:screenId" element={<Player />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* 👇 👇 👇 WhatsApp 懸浮按鈕 (貼喺度就啱晒) 👇 👇 👇 */}
      {!window.location.pathname.includes('/player') && !window.location.pathname.includes('/admin') && (
        <button
            onClick={() => {
                if (window.gtag) {
                    window.gtag('event', 'click_whatsapp', {
                        'event_category': 'Contact',
                        'event_label': 'Floating_Button'
                    });
                }
                // 🔥 記得將下面呢個數字改做你真正聽緊嘅 WhatsApp 號碼 (唔洗加 + 號)
                const phoneNumber = "85268786834"; 
                const message = encodeURIComponent("你好，我對「自己廣告自己投」有興趣，想了解多啲！");
                window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            }}
            className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-3.5 rounded-full shadow-lg hover:bg-[#128C7E] hover:scale-110 transition-all flex items-center justify-center group"
            title="WhatsApp 聯絡我們"
        >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            <span className="absolute right-16 bg-white text-slate-800 text-sm font-bold px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-100">
                有問題？搵我哋啦！
            </span>
        </button>
      )}
      {/* 👆 👆 👆 WhatsApp 懸浮按鈕完結 👆 👆 👆 */}
      
    </>
  );
};

export default App;