import React from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; 

const TimeSlotSelector = ({ HOURS, previewDate, selectedScreens, occupiedSlots, corporateSOV, getHourTier, selectedHours, toggleHour }) => {
  const { t } = useLanguage(); 
  const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
      <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2"><Clock size={16}/> {t('time_selector_title')}</h2>
      
      <div className="flex gap-3 text-[10px] mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 品牌專屬</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> 黃金時段</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> 一般時段</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
        {HOURS.map(h => {
          const dateStr = formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
          
          let isSoldOut = false;
          let maxCorpSOV = 0;
          
          selectedScreens.forEach(screenId => {
            const key = `${dateStr}-${h.val}-${screenId}`;
            if (occupiedSlots.has(key)) isSoldOut = true;
            if (corporateSOV && corporateSOV[key]) {
                maxCorpSOV = Math.max(maxCorpSOV, corporateSOV[key]);
                if (corporateSOV[key] >= 100) isSoldOut = true; // 100% 滿晒
            }
          });

          const tier = getHourTier(h.val);
          let tierClass = 'border-slate-200 text-slate-600 hover:bg-slate-50';
          
          if (isSoldOut && maxCorpSOV >= 100) {
            tierClass = 'bg-slate-900 text-slate-400 border-slate-900 cursor-not-allowed'; 
          } else if (isSoldOut) {
            tierClass = 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed decoration-slice'; 
          } else if (selectedHours.has(h.val)) {
            tierClass = 'bg-blue-600 text-white border-blue-600';
          } else if (maxCorpSOV > 0) { 
            tierClass = 'border-orange-400 bg-orange-50 text-orange-800 font-bold shadow-inner';
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
              {isSoldOut && maxCorpSOV >= 100 && <span className="block text-[8px] font-bold text-slate-500 mt-0.5">🚫 品牌包場</span>}
              {isSoldOut && maxCorpSOV < 100 && <span className="block text-[8px] font-normal">{t('legend_occupied')}</span>}
              {maxCorpSOV > 0 && !isSoldOut && !selectedHours.has(h.val) && <span className="block text-[9px] font-bold text-orange-600 mt-0.5">🔥 餘 {100 - maxCorpSOV}%</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default TimeSlotSelector;