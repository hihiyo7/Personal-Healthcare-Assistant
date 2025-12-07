import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView({ history, goals, onDateClick, isDarkMode }) {
  // ★ [수정] 진짜 '오늘' 날짜를 기준으로 초기화
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0~11

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getDataForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return history.find(h => h.date === dateStr);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const containerStyle = `p-6 rounded-3xl border shadow-sm mt-6 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`;
  const headerTextStyle = isDarkMode ? 'text-white' : 'text-slate-700';
  const subTextStyle = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const iconButtonStyle = `p-1 rounded-full ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`;
  const ringBgColor = isDarkMode ? "#334155" : "#e2e8f0"; 

  return (
    <div className={containerStyle}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-lg font-bold ${headerTextStyle}`}>Monthly Tracker</h3>
        <div className={`flex items-center gap-4 font-bold ${subTextStyle}`}>
          <button onClick={prevMonth} className={iconButtonStyle}><ChevronLeft size={20}/></button>
          <span>{monthNames[month]} {year}</span>
          <button onClick={nextMonth} className={iconButtonStyle}><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-slate-400 font-bold mb-2 uppercase">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {blanks.map((_, i) => <div key={`blank-${i}`} className="h-24"></div>)}

        {days.map(day => {
          const data = getDataForDay(day);
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // ✅ 실제 데이터가 있는지 확인 (water, study, calories 중 하나라도 있어야 함)
          const hasRealData = data && ((data.water || 0) > 0 || (data.study || 0) > 0 || (data.calories || 0) > 0);
          
          const cellStyle = `h-24 rounded-xl border p-1 flex flex-col items-center justify-between transition cursor-pointer group relative
            ${isDarkMode 
              ? 'bg-slate-900/50 border-slate-700 hover:border-blue-500 hover:bg-slate-800' 
              : 'bg-slate-50 border-slate-100 hover:border-blue-400 hover:bg-blue-50'}`;
          
          const dayTextStyle = `text-sm font-bold ${hasRealData ? (isDarkMode ? 'text-white' : 'text-slate-800') : 'text-slate-300'}`;

          return (
            <div key={day} onClick={() => onDateClick(dateString)} className={cellStyle}>
              <span className={dayTextStyle}>{day}</span>
              {hasRealData ? (
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 transform -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={ringBgColor} strokeWidth="2" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray={`${Math.min((data.water/goals.water)*100, 100)}, 100`} />
                    <path d="M18 5.0845 a 12.9155 12.9155 0 0 1 0 25.831 a 12.9155 12.9155 0 0 1 0 -25.831" fill="none" stroke={ringBgColor} strokeWidth="2" />
                    <path d="M18 5.0845 a 12.9155 12.9155 0 0 1 0 25.831 a 12.9155 12.9155 0 0 1 0 -25.831" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray={`${Math.min((data.study/goals.study)*100, 100)}, 100`} />
                    <path d="M18 8.0845 a 9.9155 9.9155 0 0 1 0 19.831 a 9.9155 9.9155 0 0 1 0 -19.831" fill="none" stroke={ringBgColor} strokeWidth="2" />
                    <path d="M18 8.0845 a 9.9155 9.9155 0 0 1 0 19.831 a 9.9155 9.9155 0 0 1 0 -19.831" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray={`${Math.min((data.calories/goals.calories)*100, 100)}, 100`} />
                  </svg>
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-full border border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}></div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-center gap-4 mt-6 text-[10px] uppercase font-bold text-slate-400">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Water</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Study</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Meal</div>
      </div>
    </div>
  );
}