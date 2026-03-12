import React from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; 

const TimeSlotSelector = ({ HOURS, previewDate, selectedScreens, occupiedSlots, corporateSlots, getHourTier, selectedHours, toggleHour }) => {
  const { t } = useLanguage(); 
  
  const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
      <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2"><Clock size={16}/> {t('time_selector_title')}</h2>
      
      <div className="flex gap-3 text-[10px] mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> {t('label_prime')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> {t('label_gold')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Normal</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
        {HOURS.map(h => {
          const dateStr = formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
          
          let isSoldOut = false;
          let hasCorporate = false;
          
          selectedScreens.forEach(screenId => {
            const key = `${dateStr}-${h.val}-${screenId}`;
            if (occupiedSlots.has(key)) isSoldOut = true;
            if (corporateSlots && corporateSlots.has(key)) hasCorporate = true; // 🔥 大客進駐
          });

          const tier = getHourTier(h.val);
          let tierClass = 'border-slate-200 text-slate-600 hover:bg-slate-50';
          
          if (isSoldOut) {
            tierClass = 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed decoration-slice'; 
          } else if (selectedHours.has(h.val)) {
            tierClass = 'bg-blue-600 text-white border-blue-600';
          } else if (hasCorporate) { 
            // 🔥 有大客，但未滿，變成橙色搶手狀態
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
              {isSoldOut && <span className="block text-[8px] font-normal">{t('legend_occupied')}</span>}
              {hasCorporate && !isSoldOut && !selectedHours.has(h.val) && <span className="block text-[9px] font-bold text-orange-600 mt-0.5">🔥熱門</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default TimeSlotSelector;