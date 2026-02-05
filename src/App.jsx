import React, { useState, useEffect } from 'react'; 
import { Loader2, UploadCloud } from 'lucide-react';
import { useDoohSystem } from './hooks/useDoohSystem';

// Components
import Header from './components/Header';
// import InfoBox from './components/InfoBox'; // ❌ 移除這個
import TutorialModal from './components/TutorialModal'; // ✅ 加入這個
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
    recalculateAllBids, // 🔥 Admin Tool
    HOURS, getHourTier,
    getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed,
    isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted,
    occupiedSlots
  } = useDoohSystem();

  // 🔥 [新狀態] 控制教學 Modal
  const [isTutorialOpen, setIsTutorialOpen] = useState(false); // 預設為 true，一入黎就彈

  // 🔥 關鍵修正：處理「立即上傳」點擊
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
      
      {/* Header 包含了「玩法說明」按鈕 */}
      <Header 
        user={user} 
        onLoginClick={() => setIsLoginModalOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)} 
        onHelpClick={() => setIsTutorialOpen(true)} // 按下 header 幫助按鈕時打開
      />

      <main className="max-w-5xl mx-auto p-3 md:p-6 space-y-4 md:space-y-8 mt-4">
        
        {/* ❌ 移除了 InfoBox，因為現在用 Modal */}
        
        {/* 直接顯示 Screen Selector，因為這就是主菜 */}
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

      {/* 🔥 隱藏的 File Input */}
      <input 
        type="file" 
        id="hidden-file-input" 
        style={{ display: 'none' }} 
        accept="video/*" 
        onChange={handleRealUpload} 
      />

      {/* --- Modals Section --- */}
      
      {/* 🔥 新增：教學 Modal */}
      <TutorialModal 
        isOpen={isTutorialOpen} 
        onClose={() => setIsTutorialOpen(false)} 
      />

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        handleGoogleLogin={handleGoogleLogin} 
        isLoginLoading={isLoginLoading} 
      />
      <ScreenDetailModal 
        screen={viewingScreen} 
        onClose={() => setViewingScreen(null)} 
      />
      <MyOrdersModal 
        isOpen={isProfileModalOpen} 
        user={user} 
        myOrders={myOrders} 
        onClose={() => setIsProfileModalOpen(false)} 
        onLogout={handleLogout} 
        onUploadClick={handleUploadClick} 
        handleUpdateBid={handleUpdateBid} 
      />
      <BuyoutModal 
        isOpen={isBuyoutModalOpen} 
        onClose={() => setIsBuyoutModalOpen(false)} 
        pricing={pricing} 
        selectedSpecificDates={selectedSpecificDates} 
        termsAccepted={termsAccepted} 
        setTermsAccepted={setTermsAccepted} 
        onConfirm={() => initiateTransaction('buyout')} 
      />
      <BiddingModal 
        isOpen={isBidModalOpen} 
        onClose={() => setIsBidModalOpen(false)} 
        generateAllSlots={generateAllSlots} 
        slotBids={slotBids} 
        handleSlotBidChange={handleSlotBidChange} 
        batchBidInput={batchBidInput} 
        setBatchBidInput={setBatchBidInput} 
        handleBatchBid={handleBatchBid} 
        isBundleMode={isBundleMode} 
        pricing={pricing} 
        termsAccepted={termsAccepted} 
        setTermsAccepted={setTermsAccepted} 
        onConfirm={() => initiateTransaction('bid')} 
      />
      <UrgentUploadModal 
        isOpen={isUrgentUploadModalOpen} 
        modalPaymentStatus={modalPaymentStatus} 
        creativeStatus={creativeStatus} 
        isUploadingReal={isUploadingReal} 
        uploadProgress={uploadProgress} 
        handleRealUpload={handleRealUpload} 
        emailStatus={emailStatus} 
        onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} 
      />
      
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