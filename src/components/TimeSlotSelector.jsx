import React from 'react';
import { Clock } from 'lucide-react';

const TimeSlotSelector = ({ HOURS, previewDate, selectedScreens, occupiedSlots, getHourTier, selectedHours, toggleHour }) => {
  
  // Need to recreate formatDateKey here or pass it as prop, but simpler to recreate since it's utility
  const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
      <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2"><Clock size={16}/> 3. 選擇時段</h2>
      <div className="flex gap-3 text-[10px] mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Prime</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Gold</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Normal</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 overflow-y-auto max-h-[300px]">
        {HOURS.map(h => {
          const dateStr = formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
          
          let isSoldOut = false;
          selectedScreens.forEach(screenId => {
            const key = `${dateStr}-${h.val}-${screenId}`;
            if (occupiedSlots.has(key)) {
              isSoldOut = true;
            }
          });

          const tier = getHourTier(h.val);
          let tierClass = 'border-slate-200 text-slate-600 hover:bg-slate-50';
          
          if (isSoldOut) {
            tierClass = 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed decoration-slice'; 
          } else if (selectedHours.has(h.val)) {
            tierClass = 'bg-blue-600 text-white border-blue-600';
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
              {isSoldOut && <span className="block text-[8px] font-normal">已售</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default TimeSlotSelector;