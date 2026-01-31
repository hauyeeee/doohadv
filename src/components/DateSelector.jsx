import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Repeat, CalendarDays } from 'lucide-react';

const WEEKDAYS_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

const DateSelector = ({ 
  mode, setMode, setSelectedSpecificDates, 
  currentDate, setCurrentDate, 
  selectedWeekdays, toggleWeekday, 
  weekCount, setWeekCount, 
  renderCalendar 
}) => (
  <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col h-full">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2">
        <CalendarIcon size={16}/> 2. 選擇日期
      </h2>
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button 
          onClick={() => { setMode('specific'); setSelectedSpecificDates(new Set()); }} 
          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
        >
          指定日期
        </button>
        <button 
          onClick={() => { setMode('recurring'); setSelectedSpecificDates(new Set()); }} 
          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
        >
          週期模式
        </button>
      </div>
    </div>
    
    <div className="flex justify-between items-center mb-4">
      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
      <div className="text-center">
        <div className="text-sm text-slate-500 font-medium">年份</div>
        <div className="text-2xl font-extrabold text-blue-600 bg-blue-50 px-6 py-2 rounded-xl shadow-sm border border-blue-100">
          {currentDate.getFullYear()}年 {currentDate.getMonth()+1}月
        </div>
        <div className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">⚠️ 請核對年份月份</div>
      </div>
      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
    </div>

    {mode === 'recurring' && (
      <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-blue-700 flex items-center gap-1"><Repeat size={12}/> 重複星期</span>
          <div className="flex gap-1">
            {WEEKDAYS_LABEL.map((d, i) => (
              <button key={d} onClick={() => toggleWeekday(i)} className={`w-6 h-6 text-[10px] rounded-full font-bold transition-all ${selectedWeekdays.has(i) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border hover:border-blue-300'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-blue-700 flex items-center gap-1"><CalendarDays size={12}/> 持續週數</span>
          <select value={weekCount} onChange={(e) => setWeekCount(Number(e.target.value))} className="text-xs border border-blue-200 rounded px-2 py-1 bg-white outline-none">
            {Array.from({length: 8}, (_, i) => i + 1).map(w => <option key={w} value={w}>{w} 週</option>)}
          </select>
        </div>
      </div>
    )}
    
    <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1">
      {WEEKDAYS_LABEL.map(d => <div key={d}>{d}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-1 flex-1 content-start">
      {renderCalendar()}
    </div>
  </section>
);

export default DateSelector;