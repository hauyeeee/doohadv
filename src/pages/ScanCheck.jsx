import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MonitorPlay, BatteryCharging, ArrowRight } from 'lucide-react';

const ScanCheck = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [showPowerbankHint, setShowPowerbankHint] = useState(false);

  useEffect(() => {
    if (window.gtag) {
      window.gtag('event', 'scan_qr_arrived', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'ScanQrArrived');
    }
  }, []);

  const handleAdvertise = () => {
    if (window.gtag) {
      window.gtag('event', 'intent_advertise', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'IntentAdvertise');
    }
    
    navigate({
        pathname: '/',
        search: location.search 
    });
  };

  const handlePowerbank = () => {
    if (window.gtag) {
      window.gtag('event', 'intent_powerbank', { event_category: 'Funnel' });
    }
    if (window.fbq) {
      window.fbq('trackCustom', 'IntentPowerbank');
    }
    setShowPowerbankHint(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in fade-in slide-in-from-bottom-4">
        
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <MonitorPlay className="w-8 h-8 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          您是否想在此屏幕<br className="hidden sm:block"/>投放廣告？
        </h1>
        <p className="text-slate-500 text-sm mb-2">
          您是否想在此屏幕投放广告？
        </p>
        <p className="text-slate-400 text-xs mb-8">
          Are you looking to advertise on this screen?
        </p>

        {!showPowerbankHint ? (
          <div className="space-y-4">
            <button 
              onClick={handleAdvertise}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg flex items-center justify-between transition-all shadow-md hover:shadow-lg"
            >
              <span className="flex items-center gap-2">
                ✅ 是的，查看報價 (Yes)
              </span>
              <ArrowRight size={20} />
            </button>

            <button 
              onClick={handlePowerbank}
              className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-4 px-6 rounded-xl text-lg flex items-center justify-start gap-2 transition-all"
            >
              ❌ 不是，我想借充電寶 (No)
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-center mb-4">
              <div className="bg-amber-100 p-3 rounded-full">
                <BatteryCharging className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <h3 className="font-bold text-amber-900 text-lg mb-2">請掃描機器上的小 QR Code</h3>
            <p className="text-amber-700 text-sm mb-2">
              请扫描机器上的小 QR Code
            </p>
            <p className="text-amber-800 text-xs text-left leading-relaxed">
              此畫面為廣告投放專用。如需租借充電寶，請尋找並掃描貼在<b>充電寶機身</b>上的專用 QR Code 貼紙。<br/><br/>
              此画面为广告投放专用。如需租借充电宝，请寻找并扫描贴在<b>充电宝机身</b>上的专用 QR Code 贴纸。<br/><br/>
              <span className="text-[10px] text-amber-600/80">
                This page is for advertising inquiries only. To rent a powerbank, please scan the specific QR code sticker located on the powerbank machine itself.
              </span>
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