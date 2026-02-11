import React, { useState, useEffect } from 'react'; 
import { Loader2, UploadCloud, AlertTriangle, Monitor } from 'lucide-react'; 
import { useDoohSystem } from './hooks/useDoohSystem';

// Components
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
    occupiedSlots, existingBids, // 🔥 獲取市場實時出價
    
    // New Props
    restrictionModalData, 
    setRestrictionModalData, 
    handleProceedAfterRestriction,
    resumePayment,
    isTimeMismatchModalOpen,      // 👈 新增
    setIsTimeMismatchModalOpen,   // 👈 新增
  } = useDoohSystem();

  const [isTutorialOpen, setIsTutorialOpen] = useState(false); 
  const [restrictionAgreed, setRestrictionAgreed] = useState(false); 

  // Reset agreement when modal opens
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

      <input 
        type="file" 
        id="hidden-file-input" 
        style={{ display: 'none' }} 
        accept="video/*" 
        onChange={handleRealUpload} 
      />

      {/* --- Modals Section --- */}
      
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
            
            {/* 背景裝飾 */}
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
      
      {/* 🔥 傳入 existingBids 進行即時比價 */}
      <MyOrdersModal 
        isOpen={isProfileModalOpen} 
        user={user} 
        myOrders={myOrders} 
        existingBids={existingBids} 
        onClose={() => setIsProfileModalOpen(false)} 
        onLogout={handleLogout} 
        onUploadClick={handleUploadClick} 
        handleUpdateBid={handleUpdateBid} 
        onResumePayment={resumePayment} 
      />
      
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

export default DOOHBiddingSystem;