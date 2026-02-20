import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorPlay, BatteryCharging, ArrowRight, AlertCircle } from 'lucide-react';

const ScanCheck = () => {
  const navigate = useNavigate();
  const [showPowerbankHint, setShowPowerbankHint] = useState(false);

  // 1️⃣ 一入呢頁，即刻射個 Event 話畀 GA 同 Pixel 知「有人掃咗大 QR Code」
  useEffect(() => {
    if (window.gtag) {
      window.gtag('event', 'scan_qr_arrived', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'ScanQrArrived');
    }
  }, []);

  // 2️⃣ 撳「想落廣告」的處理
  const handleAdvertise = () => {
    if (window.gtag) {
      window.gtag('event', 'intent_advertise', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'IntentAdvertise');
    }
    // 帶佢去主頁 (Landing Page)
    navigate('/');
  };

  // 3️⃣ 撳「想借充電寶」的處理
  const handlePowerbank = () => {
    if (window.gtag) {
      window.gtag('event', 'intent_powerbank', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'IntentPowerbank');
    }
    // 顯示提示，唔好帶佢去主頁
    setShowPowerbankHint(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in fade-in slide-in-from-bottom-4">
        
        {/* 頂部圖示 */}
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <MonitorPlay className="w-8 h-8 text-blue-600" />
        </div>

        {/* 標題問題 */}
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          您是否想要在此屏幕<br className="hidden sm:block"/>投放廣告？
        </h1>
        <p className="text-slate-500 text-sm mb-8">
          Are you looking to advertise on this screen?
        </p>

        {!showPowerbankHint ? (
          <div className="space-y-4">
            {/* ✅ 是的 按鈕 */}
            <button 
              onClick={handleAdvertise}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg flex items-center justify-between transition-all shadow-md hover:shadow-lg"
            >
              <span className="flex items-center gap-2">
                ✅ 係，我想睇報價
              </span>
              <ArrowRight size={20} />
            </button>

            {/* ❌ 不是 按鈕 */}
            <button 
              onClick={handlePowerbank}
              className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-4 px-6 rounded-xl text-lg flex items-center justify-start gap-2 transition-all"
            >
              ❌ 唔係，我想借充電寶
            </button>
          </div>
        ) : (
          /* 提示借充電寶的畫面 */
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-center mb-4">
              <div className="bg-amber-100 p-3 rounded-full">
                <BatteryCharging className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <h3 className="font-bold text-amber-900 text-lg mb-2">請掃描機器上的小 QR Code</h3>
            <p className="text-amber-700 text-sm">
              此畫面為廣告投放專用。如需租借充電寶，請尋找並掃描貼在<b>充電寶機身</b>上的專用 QR Code 貼紙。
            </p>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-slate-400 text-xs text-center">
        Powered by DOOHAdv
      </div>
    </div>
  );
};

export default ScanCheck;