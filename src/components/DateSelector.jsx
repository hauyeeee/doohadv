import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Repeat, CalendarDays } from 'lucide-react';
import CalendarGrid from './CalendarGrid'; 
import { useLanguage } from '../context/LanguageContext'; // 🔥 1. Hook

// Define arrays for both languages
const WEEKDAYS_LABEL_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_LABEL_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DateSelector = ({ 
  mode, setMode, setSelectedSpecificDates, 
  currentDate, setCurrentDate, 
  selectedWeekdays, toggleWeekday, 
  weekCount, setWeekCount, 
  toggleDate,
  getDaysInMonth, 
  getFirstDayOfMonth, 
  formatDateKey, 
  isDateAllowed,
  selectedSpecificDates 
}) => {
  const { t, lang } = useLanguage(); // 🔥 2. t()
  const WEEKDAYS_LABEL = lang === 'en' ? WEEKDAYS_LABEL_EN : WEEKDAYS_LABEL_ZH;

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2">
          <CalendarIcon size={16}/> {t('date_selector_title')}
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => { setMode('specific'); setSelectedSpecificDates(new Set()); }} 
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            {t('mode_specific')}
          </button>
          <button 
            onClick={() => { setMode('recurring'); setSelectedSpecificDates(new Set()); }} 
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            {t('mode_consecutive')}
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
        <div className="text-center">
          <div className="text-sm text-slate-500 font-medium">{lang==='en'?'Year':'年份'}</div>
          <div className="text-2xl font-extrabold text-blue-600 bg-blue-50 px-6 py-2 rounded-xl shadow-sm border border-blue-100">
            {/* 🔥 Auto Date Format */}
            {currentDate.toLocaleDateString(lang==='en'?'en-US':'zh-HK', {year:'numeric', month:'long'})}
          </div>
          <div className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">⚠️ {lang==='en'?'Check Year/Month':'請核對年份月份'}</div>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
      </div>

      {mode === 'recurring' && (
        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-blue-700 flex items-center gap-1"><Repeat size={12}/> {t('select_days_hint')}</span>
            <div className="flex gap-1">
              {WEEKDAYS_LABEL.map((d, i) => (
                <button key={d} onClick={() => toggleWeekday(i)} className={`w-6 h-6 text-[10px] rounded-full font-bold transition-all ${selectedWeekdays.has(i) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border hover:border-blue-300'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-blue-700 flex items-center gap-1"><CalendarDays size={12}/> {lang==='en'?'Duration':'持續週數'}</span>
            <select value={weekCount} onChange={(e) => setWeekCount(Number(e.target.value))} className="text-xs border border-blue-200 rounded px-2 py-1 bg-white outline-none">
              {Array.from({length: 8}, (_, i) => i + 1).map(w => <option key={w} value={w}>{w} {t('week_unit')}</option>)}
            </select>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1">
        {WEEKDAYS_LABEL.map(d => <div key={d}>{d}</div>)}
      </div>
      
      <div className="grid grid-cols-7 gap-1 flex-1 content-start">
        <CalendarGrid 
          currentDate={currentDate}
          mode={mode}
          selectedSpecificDates={selectedSpecificDates}
          selectedWeekdays={selectedWeekdays}
          toggleDate={toggleDate}
          getDaysInMonth={getDaysInMonth}
          getFirstDayOfMonth={getFirstDayOfMonth}
          formatDateKey={formatDateKey}
          isDateAllowed={isDateAllowed}
        />
      </div>
    </section>
  );
};

export default DateSelector;