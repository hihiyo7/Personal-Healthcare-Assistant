// src/components/WeeklyTrendChart.jsx
// ============================================================
// 주간 트렌드 막대 차트
// - 물 섭취량 (파란색)
// - 공부 시간 (보라색)
// - 필터: 전체 비율/물/공부
// ============================================================

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function WeeklyTrendChart({ data = [], currentDate, isDarkMode, waterGoal = 2000, studyGoal = 300 }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'water' | 'study'
  
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const cardStyle = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';

  // 전체 비율 데이터 계산
  const chartData = useMemo(() => {
    return data.map(d => {
      const waterPercent = waterGoal > 0 ? Math.min((d.water / waterGoal) * 100, 100) : 0;
      const studyPercent = studyGoal > 0 ? Math.min((d.study / studyGoal) * 100, 100) : 0;
      const totalPercent = (waterPercent + studyPercent) / 2;
      
      return {
        ...d,
        waterPercent: Math.round(waterPercent),
        studyPercent: Math.round(studyPercent),
        totalPercent: Math.round(totalPercent),
        isToday: d.date === currentDate
      };
    });
  }, [data, waterGoal, studyGoal, currentDate]);

  if (!data || data.length === 0) {
    return (
      <div className={`p-6 rounded-3xl border shadow-sm ${cardStyle}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
          <TrendingUp size={20} className="text-blue-500" />
          Weekly Trend
        </h3>
        <div className={`h-64 flex items-center justify-center ${textSecondary}`}>데이터가 없습니다</div>
      </div>
    );
  }

  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const formatXAxis = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getMonth() + 1}/${date.getDate()}(${weekdayLabels[date.getDay()]})`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    
    return (
      <div className={`px-4 py-3 rounded-xl shadow-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <p className="font-semibold mb-2">{formatXAxis(label)}</p>
        {filter === 'all' && (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>물: {d.water}ml ({d.waterPercent}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span>공부: {d.study}분 ({d.studyPercent}%)</span>
            </div>
            <div className={`pt-1 mt-1 border-t ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
              <span className="font-bold">종합: {d.totalPercent}%</span>
            </div>
          </div>
        )}
        {filter === 'water' && (
          <div className="text-sm">
            <span>물: {d.water}ml ({d.waterPercent}%)</span>
          </div>
        )}
        {filter === 'study' && (
          <div className="text-sm">
            <span>공부: {d.study}분 ({d.studyPercent}%)</span>
          </div>
        )}
      </div>
    );
  };

  const getFilterBtnStyle = (f) => {
    const isActive = filter === f;
    if (isActive) return isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-300';
    return isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100';
  };

  // 현재 필터에 따른 dataKey
  const getDataKey = () => {
    if (filter === 'water') return 'waterPercent';
    if (filter === 'study') return 'studyPercent';
    return 'totalPercent';
  };

  // 현재 필터에 따른 색상
  const getBarColor = (entry) => {
    if (filter === 'water') return '#3b82f6'; // 파랑
    if (filter === 'study') return '#8b5cf6'; // 보라
    // 전체는 종합 점수에 따라 색상 변화 (Water 색상과 겹치지 않게)
    if (entry.totalPercent >= 80) return '#10b981'; // 녹색 (80%+)
    if (entry.totalPercent >= 50) return '#06b6d4'; // 청록/시안 (50-79%)
    return '#f59e0b'; // 주황 (~49%)
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${cardStyle}`}>
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
          <TrendingUp size={20} className="text-blue-500" />
          Weekly Trend
        </h3>
        
        {/* 필터 버튼 */}
        <div className="flex gap-1">
          <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${getFilterBtnStyle('all')}`}>전체</button>
          <button onClick={() => setFilter('water')} className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${getFilterBtnStyle('water')}`}>Water</button>
          <button onClick={() => setFilter('study')} className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${getFilterBtnStyle('study')}`}>Study</button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeOpacity={0.5} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => { const d = new Date(value); return `${d.getMonth() + 1}/${d.getDate()}`; }} 
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 }} 
              axisLine={false} tickLine={false} dy={10} 
            />
            <YAxis 
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              width={40}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar 
              dataKey={getDataKey()} 
              radius={[6, 6, 0, 0]}
              maxBarSize={50}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry)}
                  opacity={entry.isToday ? 1 : 0.7}
                  stroke="none"
                  strokeWidth={0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* 범례 */}
      <div className={`flex justify-center gap-6 mt-4 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        {filter === 'all' ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className={textSecondary}>80%+</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-cyan-500"></div>
              <span className={textSecondary}>50-79%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span className={textSecondary}>~49%</span>
            </div>
          </>
        ) : filter === 'water' ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className={textSecondary}>물 섭취 달성률</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-violet-500"></div>
            <span className={textSecondary}>공부 시간 달성률</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const generateWeeklyData = (centerDate, getWaterForDate, getStudyForDate) => {
  const data = [];
  const center = new Date(centerDate);
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(center.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    data.push({
      date: dateStr,
      displayDay: `${d.getMonth() + 1}/${d.getDate()}`,
      water: getWaterForDate ? getWaterForDate(dateStr) : 0,
      study: getStudyForDate ? getStudyForDate(dateStr) : 0
    });
  }
  return data;
};
