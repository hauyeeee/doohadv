import React, { useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Repeat, CalendarDays } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const DateSelector = ({ 
  mode, setMode, setSelectedSpecificDates, 
  currentDate, setCurrentDate, 
  selectedWeekdays, toggleWeekday, 
  weekCount, setWeekCount, 
  toggleDate, 
  isDateAllowed, 
  selectedSpecificDates 
}) => {
  const { t } = useLanguage();

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      
      // 🔥🔥🔥 修正重點：使用本地時間產生 YYYY-MM-DD，解決時區誤差問題
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // 檢查日期是否可選 (如果 isDateAllowed 沒傳入，預設為 true)
      const allowed = isDateAllowed ? isDateAllowed(dateObj) : true;
      const isSelected = selectedSpecificDates.has(dateStr);

      days.push(
        <button
          key={d}
          // 🔥 確保點擊時，如果允許，就執行 toggleDate
          onClick={() => {
             if (allowed) toggleDate(dateStr);
          }}
          disabled={!allowed}
          className={`
            h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
            ${isSelected 
              ? 'bg-blue-600 text-white shadow-md scale-110' 
              : allowed 
                ? 'hover:bg-blue-50 text-slate-700 hover:text-blue-600' 
                : 'text-slate-300 cursor-not-allowed bg-slate-50 opacity-50'
            }
          `}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        <CalendarIcon className="text-slate-400" size={20}/> {t('date_selector_title')}
      </h3>

      {/* Mode Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
        <button 
          onClick={() => setMode('specific')}
          className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${mode === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CalendarDays size={14}/> {t('mode_specific')}
        </button>
        <button 
          onClick={() => setMode('consecutive')}
          className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${mode === 'consecutive' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Repeat size={14}/> {t('mode_consecutive')}
        </button>
      </div>

      {mode === 'specific' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Calendar Header */}
          <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20}/></button>
            <span className="font-bold text-slate-800">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20}/></button>
          </div>
          
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2 text-center">
            {WEEKDAYS.map(d => <span key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</span>)}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-2 justify-items-center">
            {renderCalendar()}
          </div>
          
          <div className="mt-4 text-center text-xs text-slate-400">
            {t('select_dates_hint')}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">{t('week_unit')}</label>
            <div className="grid grid-cols-7 gap-2">
              {['日','一','二','三','四','五','六'].map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleWeekday(i)}
                  className={`
                    aspect-square rounded-lg flex flex-col items-center justify-center border-2 transition-all
                    ${selectedWeekdays.has(i) 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                    }
                  `}
                >
                  <span className="text-sm font-bold">{d}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t('week_unit')} (Duration)</label>
                <span className="text-blue-600 font-bold text-lg">{weekCount} {t('week_unit')}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="12" 
              value={weekCount} 
              onChange={(e) => setWeekCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-bold">
                <span>1 {t('week_unit')}</span>
                <span>12 {t('week_unit')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateSelector;