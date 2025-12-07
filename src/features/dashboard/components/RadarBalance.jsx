// src/components/RadarBalance.jsx
// ============================================================
// Balance Radar 차트 컴포넌트
// - Water, Book, Laptop, Sleep, Diet
// ============================================================

import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Activity } from 'lucide-react';
import { generateRadarData } from '../../study/utils/studyCalculator';

export default function RadarBalance({ 
  waterMl = 0, 
  waterGoal = 2000,
  bookStudyMin = 0,
  laptopStudyMin = 0,
  studyGoal = 300,
  sleepMin = 0,
  dietScore = 0,
  isDarkMode 
}) {
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const cardStyle = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';

  // 단순화: 공부 목표를 Book/Laptop 동일 비율로 분배해 과도한 100% 표시 방지
  const bookGoal = Math.max(1, Math.round(studyGoal * 0.5));
  const laptopGoal = Math.max(1, Math.round(studyGoal * 0.5));

  const radarData = generateRadarData({
    waterMl, waterGoal, bookStudyMin, bookGoal, laptopStudyMin, laptopGoal,
    sleepMin, sleepGoal: 480, dietScore, dietGoal: 100
  });

  const overallBalance = Math.round(radarData.reduce((sum, item) => sum + item.A, 0) / radarData.length);

  const getBalanceMessage = () => {
    if (overallBalance >= 80) return { text: 'Excellent', color: 'text-emerald-500' };
    if (overallBalance >= 60) return { text: 'Good', color: 'text-blue-500' };
    if (overallBalance >= 40) return { text: 'Average', color: 'text-amber-500' };
    return { text: 'Needs Work', color: 'text-red-500' };
  };

  const balanceStatus = getBalanceMessage();

  // 계산된 퍼센트
  const waterPct = waterGoal > 0 ? Math.min(Math.round((waterMl / waterGoal) * 100), 100) : 0;
  const bookPct = bookGoal > 0 ? Math.min(Math.round((bookStudyMin / bookGoal) * 100), 100) : 0;
  const laptopPct = laptopGoal > 0 ? Math.min(Math.round((laptopStudyMin / laptopGoal) * 100), 100) : 0;
  const sleepPct = Math.min(Math.round((sleepMin / 480) * 100), 100);
  const dietPct = Math.min(dietScore, 100);

  return (
    <div className={`p-5 rounded-3xl border shadow-sm ${cardStyle}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${textSecondary}`}>
          <Activity size={16} />
          Balance
        </h3>
        <div className="text-right">
          <span className={`text-xs ${textSecondary}`}>Score</span>
          <p className={`text-lg font-bold ${balanceStatus.color}`}>{overallBalance}%</p>
        </div>
      </div>

      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke={isDarkMode ? "#475569" : "#e2e8f0"} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Today" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 상세 항목 - 텍스트 기반 */}
      <div className="grid grid-cols-5 gap-1 mt-3">
        <BalanceItem label="Water" value={waterPct} isDarkMode={isDarkMode} />
        <BalanceItem label="Book" value={bookPct} isDarkMode={isDarkMode} />
        <BalanceItem label="Laptop" value={laptopPct} isDarkMode={isDarkMode} />
        <BalanceItem label="Sleep" value={sleepPct} isDarkMode={isDarkMode} />
        <BalanceItem label="Diet" value={dietPct} isDarkMode={isDarkMode} />
      </div>

      <div className={`mt-3 p-2 rounded-lg text-center text-xs ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
        <span className={balanceStatus.color}>{balanceStatus.text}</span>
      </div>
    </div>
  );
}

function BalanceItem({ label, value, isDarkMode }) {
  const percent = Math.min(value || 0, 100);
  const color = percent >= 80 ? 'text-emerald-500' : percent >= 50 ? 'text-blue-500' : percent >= 30 ? 'text-amber-500' : (isDarkMode ? 'text-slate-500' : 'text-slate-400');
  
  return (
    <div className="text-center">
      <span className={`text-[9px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <p className={`text-xs font-bold ${color}`}>{percent}%</p>
    </div>
  );
}
