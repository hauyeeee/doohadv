import React from 'react';
import { HelpCircle, Gavel, Zap, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; // 🔥 Import Hook

const TutorialModal = ({ isOpen, onClose }) => {
  const { t, lang } = useLanguage(); // 🔥 Get translation function and current language

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* Header */}
        <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="text-blue-600" size={20}/> 
            {t('play_guide')} {/* 🔥 Translated Title */}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bidding Column */}
          <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-2 mb-3 text-blue-700 font-bold text-lg">
              <div className="bg-blue-100 p-2 rounded-lg"><Gavel size={20}/></div>
              {t('order_type_bid')} {/* 🔥 Translated Header */}
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Highest Bidder Wins: ' : '價高者得：'}</strong> 
                  {lang === 'en' ? 'Place your bid freely. Best for limited budgets or prime slots.' : '自由出價，適合預算有限或爭奪黃金時段。'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Time Limit: ' : '限制：'}</strong> 
                  {lang === 'en' ? 'Open for slots within 24h to 7 days.' : '僅開放予 24小時 至 7天 內的時段。'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Pre-auth: ' : '預授權機制：'}</strong> 
                  {lang === 'en' ? 'Funds are held (Pre-auth) but not charged immediately.' : '提交時只凍結額度 (Pre-auth)，不即時扣款。'}
                </span>
              </li>
            </ul>
          </div>

          {/* Buyout Column */}
          <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 hover:border-emerald-300 transition-colors">
            <div className="flex items-center gap-2 mb-3 text-emerald-700 font-bold text-lg">
              <div className="bg-emerald-100 p-2 rounded-lg"><Zap size={20}/></div>
              {t('order_type_buyout')} {/* 🔥 Translated Header */}
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Instant Lock: ' : '即時鎖定：'}</strong> 
                  {lang === 'en' ? 'Pay fixed price to secure the slot immediately.' : '付出一口價，立即確保獲得該時段。'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Future Booking: ' : '遠期預訂：'}</strong> 
                  {lang === 'en' ? 'Supports booking 7-60 days in advance (except Prime Time).' : '支援 7 至 60 天後的預訂 (Prime Time 除外)。'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-0.5">•</span> 
                <span>
                  <strong>{lang === 'en' ? 'Instant Charge: ' : '即時扣款：'}</strong> 
                  {lang === 'en' ? 'Full amount charged immediately upon confirmation.' : '交易確認後立即從信用卡扣除全數。'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            {lang === 'en' ? 'Got it, Start Booking' : '明白，開始選位'}
            <ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default TutorialModal;