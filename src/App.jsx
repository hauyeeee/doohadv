import React from 'react';
import { Loader2 } from 'lucide-react';
import { useDoohSystem } from './hooks/useDoohSystem';

// Components
import Header from './components/Header';
import InfoBox from './components/InfoBox';
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
  // 1. 調用 Hook 獲取所有邏輯與狀態
  const {
    // State
    user, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    
    // Setters
    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted,
    
    // Handlers
    handleGoogleLogin, handleLogout,
    toggleScreen, toggleHour, toggleWeekday, toggleDate,
    handleBatchBid, handleSlotBidChange,
    handleBidClick, handleBuyoutClick,
    initiateTransaction, processPayment, handleRealUpload, closeTransaction,
    viewingScreen,
    
    // UI Helpers & Constants
    HOURS, getHourTier,
    getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed, // 🔥 這些要傳給 DateSelector
    
    // Modal Specific
    isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted,
    occupiedSlots // TimeSlotSelector 需要這個
  } = useDoohSystem();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 relative pt-8">
      <Header 
        user={user} 
        onLoginClick={() => setIsLoginModalOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)} 
      />

      <main className="max-w-5xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        <InfoBox />

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
          {/* 🔥 這裡簡化了，不需要 renderCalendar prop */}
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
            // 傳遞 Helpers 給 CalendarGrid 使用
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

      {/* --- Modals Section --- */}
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
        onUploadClick={(id) => { setCurrentOrderId(id); setIsUrgentUploadModalOpen(true); setIsProfileModalOpen(false); }} 
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