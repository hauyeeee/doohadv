import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route, Link } from 'react-router-dom';
import { Loader2, UploadCloud, AlertTriangle, Monitor, Clock, CheckCircle, X, FileText, Shield } from 'lucide-react';
import { useDoohSystem } from './hooks/useDoohSystem';

// Analytics
import { initAnalytics, trackPageView } from './utils/analytics';

// Components
import Header from './components/Header';
import ScreenSelector from './components/ScreenSelector';
import DateSelector from './components/DateSelector';
import TimeSlotSelector from './components/TimeSlotSelector';
import PricingSummary from './components/PricingSummary';
import Footer from './components/Footer';
import SEO from './components/SEO';
import TutorialModal from './components/TutorialModal';

// Modals
import ScreenDetailModal from './components/ScreenDetailModal';
import MyOrdersModal from './components/MyOrdersModal';
import BiddingModal from './components/BiddingModal';
import BuyoutModal from './components/BuyoutModal';
import LoginModal from './components/LoginModal';
import UrgentUploadModal from './components/UrgentUploadModal';

// Pages
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AdminPanel from './pages/AdminPanel';

// ==========================================
// 1. 主頁面組件 (用戶端 Dashboard)
// ==========================================
const MainDashboard = () => {
  const {
    user, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    occupiedSlots, isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted,
    
    // 限制與警報相關
    restrictionModalData, setRestrictionModalData, handleProceedAfterRestriction,
    isTimeMismatchModalOpen, setIsTimeMismatchModalOpen,

    // Setters & Handlers
    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted, setCurrentOrderId,
    handleGoogleLogin, handleLogout, toggleScreen, toggleHour, toggleWeekday, toggleDate, 
    handleBatchBid, handleSlotBidChange, handleBidClick, handleBuyoutClick, 
    initiateTransaction, processPayment, handleRealUpload, closeTransaction, viewingScreen,
    resumePayment, handleUpdateBid, recalculateAllBids,
    
    // Helpers
    HOURS, getHourTier, existingBids
  } = useDoohSystem();

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [restrictionAgreed, setRestrictionAgreed] = useState(false);

  // 隱藏的文件上傳觸發器
  const handleUploadClick = (orderId) => {
    if (setCurrentOrderId) setCurrentOrderId(orderId);
    localStorage.setItem('temp_order_id', orderId);
    const fileInput = document.getElementById('hidden-file-input');
    if (fileInput) {
        fileInput.value = ''; 
        fileInput.click();
    }
  };

  useEffect(() => {
    if (restrictionModalData) setRestrictionAgreed(false);
  }, [restrictionModalData]);

  return (
    <>
      <Header 
        user={user} 
        onLoginClick={() => setIsLoginModalOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)}
        onHelpClick={() => setIsTutorialOpen(true)}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-8 animate-in fade-in duration-500">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {/* Step 1: Screen Selector */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shadow-blue-200">1</div>
                <h2 className="text-xl font-bold text-slate-800">選擇投放屏幕</h2>
              </div>
              <ScreenSelector 
                selectedScreens={selectedScreens} 
                screenSearchTerm={screenSearchTerm} 
                setScreenSearchTerm={setScreenSearchTerm} 
                isScreensLoading={isScreensLoading} 
                filteredScreens={filteredScreens} 
                toggleScreen={toggleScreen} 
                setViewingScreen={setViewingScreen} 
              />
            </div>

            {/* Step 2 & 3: Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shadow-blue-200">2</div>
                  <h2 className="text-xl font-bold text-slate-800">選擇播放日期</h2>
                </div>
                <DateSelector 
                  mode={mode} setMode={setMode} setSelectedSpecificDates={setSelectedSpecificDates} 
                  currentDate={currentDate} setCurrentDate={setCurrentDate} 
                  selectedWeekdays={selectedWeekdays} toggleWeekday={toggleWeekday} 
                  weekCount={weekCount} setWeekCount={setWeekCount} 
                  toggleDate={toggleDate} isDateAllowed={isDateAllowed} selectedSpecificDates={selectedSpecificDates} 
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shadow-blue-200">3</div>
                  <h2 className="text-xl font-bold text-slate-800">選擇播放時段</h2>
                </div>
                <TimeSlotSelector 
                  HOURS={HOURS} previewDate={previewDate} 
                  selectedScreens={selectedScreens} occupiedSlots={occupiedSlots} 
                  getHourTier={getHourTier} selectedHours={selectedHours} 
                  toggleHour={toggleHour} 
                />
              </div>
            </div>
          </div>

          {/* Pricing Sidebar */}
          <aside className="lg:col-span-1 h-fit sticky top-24">
            <PricingSummary 
              pricing={pricing} 
              isBundleMode={isBundleMode} 
              handleBidClick={handleBidClick} 
              handleBuyoutClick={handleBuyoutClick} 
            />
            
            {/* Privacy & Terms Links */}
            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-400 mb-2">了解更多平台規則</p>
              <div className="flex justify-center gap-4 text-xs font-bold text-slate-500">
                <Link to="/terms" className="flex items-center gap-1 hover:text-slate-900 hover:underline transition-colors">
                  <FileText size={12}/> 條款及細則
                </Link>
                <span className="text-slate-300">|</span>
                <Link to="/privacy" className="flex items-center gap-1 hover:text-slate-900 hover:underline transition-colors">
                  <Shield size={12}/> 私隱政策
                </Link>
              </div>
            </div>

          </aside>
        </div>
      </main>

      <Footer />

      {/* Hidden File Input */}
      <input type="file" id="hidden-file-input" style={{ display: 'none' }} accept="video/*" onChange={handleRealUpload} />

      {/* --- Modals --- */}
      {isTimeMismatchModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500"></div>
             <div className="mb-5 flex justify-center"><div className="bg-orange-50 p-4 rounded-full border border-orange-100"><Clock size={40} className="text-orange-500" /></div></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">競價時段限制</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">一張競價訂單只能包含 <strong>「同一日期 + 同一小時」</strong>。<br/>建議分次提交，或改用 <strong>買斷 (Buyout)</strong> 模式。</p>
              <button onClick={() => setIsTimeMismatchModalOpen(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">明白</button>
          </div>
        </div>
      )}

      {restrictionModalData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border-2 border-red-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b pb-4"><div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="text-red-600" size={24}/></div><h3 className="text-xl font-bold text-red-700">⚠️ 重要注意事項</h3></div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">{restrictionModalData.screens.map(s => (<div key={s.id} className="bg-red-50 p-4 rounded-lg border border-red-100"><h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Monitor size={16}/> {s.name}</h4><p className="text-sm text-red-600 leading-relaxed font-bold">{s.restrictions}</p></div>))}</div>
            <div className="pt-4 border-t flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer group"><input type="checkbox" className="mt-1 w-4 h-4" checked={restrictionAgreed} onChange={(e) => setRestrictionAgreed(e.target.checked)} /><span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">我已閱讀並同意上述條款。</span></label>
              <div className="flex gap-3 mt-2"><button onClick={() => setRestrictionModalData(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg font-bold hover:bg-slate-200">取消</button><button onClick={() => { if(restrictionAgreed) handleProceedAfterRestriction(); else alert("請先勾選同意條款"); }} className={`flex-1 py-3 rounded-lg font-bold shadow-lg transition-all ${restrictionAgreed ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>確認並繼續</button></div>
            </div>
          </div>
        </div>
      )}

      {transactionStep !== 'idle' && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in duration-300">
            {transactionStep === 'summary' && pendingTransaction ? (
                <>
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">確認訂單金額</h3>
                    <p className="text-slate-500 text-sm mb-6">類型: <span className="font-bold text-slate-700">{pendingTransaction.type === 'buyout' ? '即時買斷' : '競價投標'}</span><br/>共 {pendingTransaction.slotCount} 個時段</p>
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100"><span className="text-xs text-slate-400 block mb-1">應付總額</span><span className="text-3xl font-black text-blue-600">HK$ {pendingTransaction.amount.toLocaleString()}</span></div>
                    <button onClick={processPayment} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 transition-all active:scale-95 mb-3">前往加密付款</button>
                    <button onClick={closeTransaction} className="text-sm text-slate-400 font-bold hover:text-slate-600">返回修改</button>
                </>
            ) : (
                <div className="py-10"><Loader2 className="animate-spin text-blue-600 mx-auto mb-6" size={48}/><h3 className="text-lg font-bold text-slate-800 mb-2">正在處理中...</h3><p className="text-slate-500 text-sm">請勿重新整理或關閉視窗</p></div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <TutorialModal isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
      <ScreenDetailModal screen={viewingScreen} onClose={() => setViewingScreen(null)} />
      <MyOrdersModal 
        isOpen={isProfileModalOpen} user={user} myOrders={myOrders} existingBids={existingBids} occupiedSlots={occupiedSlots}
        onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} 
        onUploadClick={handleUploadClick}
        handleUpdateBid={handleUpdateBid} onResumePayment={resumePayment}
      />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} handleGoogleLogin={handleGoogleLogin} isLoginLoading={isLoginLoading} />
      <BuyoutModal isOpen={isBuyoutModalOpen} onClose={() => setIsBuyoutModalOpen(false)} pricing={pricing} selectedSpecificDates={selectedSpecificDates} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('buyout')} />
      <BiddingModal isOpen={isBidModalOpen} onClose={() => setIsBidModalOpen(false)} generateAllSlots={generateAllSlots} slotBids={slotBids} handleSlotBidChange={handleSlotBidChange} batchBidInput={batchBidInput} setBatchBidInput={setBatchBidInput} handleBatchBid={handleBatchBid} isBundleMode={isBundleMode} pricing={pricing} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('bid')} />
      <UrgentUploadModal isOpen={isUrgentUploadModalOpen} modalPaymentStatus={modalPaymentStatus} creativeStatus={creativeStatus} isUploadingReal={isUploadingReal} uploadProgress={uploadProgress} handleRealUpload={handleRealUpload} emailStatus={emailStatus} onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} />
    </>
  );
};

// ==========================================
// 2. App Root Component (路由設定)
// ==========================================
const App = () => {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SEO />
      <Routes>
        <Route path="/" element={<MainDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </div>
  );
};

export default App;