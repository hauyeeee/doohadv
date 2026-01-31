import React from 'react';

const CalendarGrid = ({ 
    currentDate, 
    mode, 
    selectedSpecificDates, 
    selectedWeekdays, 
    toggleDate, 
    // Helpers passed from parent
    getDaysInMonth, 
    getFirstDayOfMonth, 
    formatDateKey, 
    isDateAllowed 
}) => {
    const year = currentDate.getFullYear(); 
    const month = currentDate.getMonth(); 
    const daysInMonth = getDaysInMonth(year, month); 
    const firstDayIdx = getFirstDayOfMonth(year, month); 
    
    const days = []; 
    
    // 空白格 (上個月的剩餘日子)
    for (let i = 0; i < firstDayIdx; i++) {
        days.push(<div key={`empty-${i}`} className="h-10"></div>); 
    }
    
    // 實體日子
    for (let d = 1; d <= daysInMonth; d++) { 
        const dateKey = formatDateKey(year, month, d); 
        const isAllowed = isDateAllowed(year, month, d); 
        const isSelected = mode === 'specific' ? selectedSpecificDates.has(dateKey) : false; 
        
        let isPreview = false;
        if (mode === 'recurring') {
            const thisDay = new Date(year, month, d);
            // 注意：這裡直接用 new Date 可能會有時區問題，但如果只看 getDay() 影響不大
            if (selectedWeekdays.has(thisDay.getDay()) && isAllowed) isPreview = true;
        }

        let btnClass = 'text-slate-300 cursor-not-allowed bg-slate-50'; // Default disabled

        if (isAllowed) {
            if (isSelected) {
                btnClass = 'bg-blue-600 text-white shadow-md hover:bg-blue-700';
            } else if (isPreview) {
                btnClass = 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200';
            } else {
                btnClass = 'hover:bg-slate-100 text-slate-700 bg-white border border-transparent';
            }
        }

        days.push(
            <button 
                key={dateKey} 
                onClick={() => toggleDate(year, month, d)} 
                disabled={!isAllowed || (mode === 'recurring' && !isPreview)} 
                className={`h-10 w-full rounded-md text-sm font-medium transition-all relative ${btnClass}`}
            >
                {d}
            </button>
        ); 
    } 
    
    return <>{days}</>;
};

export default CalendarGrid;