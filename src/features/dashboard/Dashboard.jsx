// src/pages/Dashboard.jsx
// ============================================================
// 통합 대시보드 - 물 + 공부(Book/Laptop)
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, Droplets, BookOpen, Utensils, Sparkles, 
  Battery, Wifi, Target, Trash2
} from 'lucide-react';

// 컴포넌트
import WeatherSection from './components/WeatherSection';
import WeeklyTrendChart, { generateWeeklyData } from './components/WeeklyTrendChart';
import RadarBalance from './components/RadarBalance';
import DatePicker from '../../shared/components/DatePicker';

// 유틸리티
import { calculateOverallScore, formatMinutesToTime } from '../study/utils/studyCalculator';
import { generateQuickTips, getTipColorClass } from './utils/tipsGenerator';

export default function Dashboard({ 
  user, 
  currentDate, 
  setCurrentDate, 
  stats, 
  drinkCount, 
  aiSummary, 
  aiLoading,  // ✅ 추가
  loading, 
  onFileUpload, 
  onNavigate, 
  isDarkMode,
  studySummary = { totalStudyMin: 0, totalBookMin: 0, totalLaptopMin: 0, totalLaptopNonStudyMin: 0 },
  onGenerateAISummary,
  onResetDay
}) {
  const todayIso = new Date().toISOString().split('T')[0];
  const isToday = currentDate === todayIso;
  const isFuture = currentDate > todayIso;
  const uploadDisabled = isFuture;

  // DatePicker 컴포넌트로 이동됨

  const cardStyle = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const waterPercent = user.goals.water > 0 ? Math.min((stats.waterMl / user.goals.water) * 100, 100) : 0;
  const studyPercent = user.goals.study > 0 ? Math.min((studySummary.totalStudyMin / user.goals.study) * 100, 100) : 0;
  const overallScore = calculateOverallScore(stats.waterMl, user.goals.water, studySummary.totalStudyMin, user.goals.study);
  const batteryLevel = 38;

  // handleDateChange는 DatePicker 내부에서 처리됨

  const weeklyData = useMemo(() => {
    const getWater = (date) => {
      if (date === currentDate) return stats.waterMl;
      const log = user.history?.find(h => h.date === date);
      return log ? log.water : 0;
    };
    const getStudy = (date) => {
      if (date === currentDate) return studySummary.totalStudyMin;
      const log = user.history?.find(h => h.date === date);
      return log?.study || 0;
    };
    return generateWeeklyData(currentDate, getWater, getStudy);
  }, [currentDate, user.history, stats.waterMl, studySummary.totalStudyMin, user.goals.water, user.goals.study]);

  const quickTips = useMemo(() => {
    return generateQuickTips({
      waterMl: stats.waterMl,
      waterGoal: user.goals.water,
      studyMin: studySummary.totalStudyMin,
      studyGoal: user.goals.study,
      bookProgress: 0,
      bookStudyMin: studySummary.totalBookMin,
      laptopStudyMin: studySummary.totalLaptopStudyMin || studySummary.totalLaptopMin,
      laptopNonStudyMin: studySummary.totalLaptopNonStudyMin || 0,
      currentTime: new Date().toTimeString().slice(0, 5)
    }, 3);
  }, [stats.waterMl, user.goals, studySummary]);

  // DatePicker 컴포넌트 내부에서 Popover로 처리됨

  const getScoreRingColor = () => {
    if (overallScore >= 100) return '#10b981';
    if (overallScore >= 70) return '#3b82f6';
    if (overallScore >= 40) return '#f59e0b';
    return '#94a3b8';
  };

  const getButtonText = () => (!isToday || stats.waterMl > 0) ? "Update CSV" : "Import Log";

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 상단 헤더 */}
      <div className={`p-5 rounded-3xl border shadow-sm transition-colors duration-300 ${cardStyle}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className={`text-2xl font-bold ${textPrimary}`}>Daily Health Monitor</h2>
              {!isToday && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isFuture 
                    ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                    : (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600')
                }`}>
                  {isFuture ? 'Future' : 'History'}
                </span>
              )}
            </div>
            
            <DatePicker 
              value={currentDate} 
              onChange={setCurrentDate} 
              isDarkMode={isDarkMode} 
            />
          </div>
          
          <div className="flex flex-col items-end gap-2 relative">
            <div className="relative">
              <input type="file" accept=".csv" onChange={onFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={uploadDisabled} />
              <button disabled={uploadDisabled} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                <Upload size={16} /> {getButtonText()}
              </button>
            </div>
            {/* 기록 초기화 버튼 (위치 이동) */}
            {!isFuture && (
              <button
                onClick={() => onResetDay && onResetDay(currentDate)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition ${
                  isDarkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'
                }`}
              >
                <Trash2 size={12} /> 날짜 초기화
              </button>
            )}
            {uploadDisabled && <p className={`text-[9px] mt-1.5 text-center ${textSecondary}`}>미래 날짜 불가</p>}
          </div>
        </div>
      </div>

      {/* 메인 그리드 레이아웃 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* 좌측 메인 영역 */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Today's Goal - 간소화 (물 섭취 + 공부 시간만) */}
          <div className={`p-6 rounded-3xl border shadow-sm transition-colors duration-300 ${cardStyle}`}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="8" fill="none" />
                  <circle cx="64" cy="64" r="56" stroke={getScoreRingColor()} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(overallScore / 100) * 352} 352`} className="transition-all duration-700 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${textPrimary}`}>{overallScore}</span>
                  <span className={`text-[10px] ${textSecondary}`}>통합 점수</span>
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${textPrimary}`}>
                  <Target size={18} className="text-slate-500" />
                  Today's Goal
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* 물 섭취 */}
                  <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets size={14} className="text-blue-500" />
                      <span className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>물 섭취</span>
                    </div>
                    <p className={`text-xl font-bold ${isDarkMode ? 'text-blue-100' : 'text-blue-700'}`}>
                      {stats.waterMl.toLocaleString()}<span className="text-xs font-normal ml-1 opacity-60">ml</span>
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}>목표: {user.goals.water.toLocaleString()}ml ({Math.round(waterPercent)}%)</p>
                  </div>
                  
                  {/* 공부 시간 */}
                  <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} className="text-violet-500" />
                      <span className={`text-xs ${isDarkMode ? 'text-violet-300' : 'text-violet-600'}`}>공부 시간</span>
                    </div>
                    <p className={`text-xl font-bold ${isDarkMode ? 'text-violet-100' : 'text-violet-700'}`}>
                      {formatMinutesToTime(studySummary.totalStudyMin)}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-violet-400' : 'text-violet-500'}`}>목표: {formatMinutesToTime(user.goals.study)} ({Math.round(studyPercent)}%)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 목표 진행률 카드들 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GoalCard title="Water" value={stats.waterMl} unit="ml" goal={user.goals.water} icon={<Droplets size={20} />} color="blue" onClick={() => onNavigate('detail-water')} isDarkMode={isDarkMode} />
            <GoalCard title="Study" value={studySummary.totalStudyMin} unit="min" goal={user.goals.study} icon={<BookOpen size={20} />} color="violet" onClick={() => onNavigate('detail-study')} isDarkMode={isDarkMode} subInfo={`Book ${studySummary.totalBookMin}분 · Laptop ${studySummary.totalLaptopMin}분`} />
            <GoalCard title="Meals" value={stats.calories} unit="kcal" goal={user.goals.calories} icon={<Utensils size={20} />} color="emerald" onClick={() => onNavigate('detail-food')} isDarkMode={isDarkMode} inactive />
          </div>

{/* AI Daily Summary - 버튼 클릭 시에만 생성 */}
<div className={`relative rounded-3xl border shadow-sm transition-all duration-300 overflow-hidden 
  ${cardStyle} 
  ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}
  hover:shadow-md hover:border-amber-200/40`}>

  {/* 상단 크림톤 그라데이션 */}
  <div className="absolute top-0 left-0 right-0 h-1.5 
      bg-gradient-to-r from-amber-300/70 via-yellow-300/70 to-amber-300/70" />

  <div className="p-6 pb-8">
    <div className="flex items-center justify-between mb-6">
      <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
        <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-amber-300/10' : 'bg-gradient-to-br from-amber-50 to-yellow-100'}`}>
          <Sparkles size={20} className="text-amber-500" />
        </div>
        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
          AI Daily Summary
        </span>
      </h3>

      {/* AI 요약 생성 버튼 */}
      <button
        onClick={onGenerateAISummary}
        disabled={aiLoading}
        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
          aiLoading
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 hover:from-amber-500 hover:to-yellow-500 shadow-md hover:shadow-lg transform hover:scale-[1.02]'
        }`}
      >
        {aiLoading ? '분석 중...' : '✨ AI 요약 생성'}
      </button>
    </div>

    <div className={`min-h-[120px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
      {aiLoading ? (
        <div className={`flex flex-col items-center justify-center py-8 gap-4 ${isDarkMode ? 'bg-slate-700/30' : 'bg-amber-50/50'} rounded-2xl`}>
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm font-medium ${isDarkMode ? 'text-amber-300' : 'text-amber-600'} animate-pulse`}>
            AI가 오늘 하루를 분석하고 있어요...
          </p>
        </div>
      ) : aiSummary ? (
        <div className={`p-5 rounded-2xl ${isDarkMode ? 'bg-slate-700/40' : 'bg-gradient-to-br from-amber-50/80 to-yellow-50/80'}`}>
          <AISummaryText text={aiSummary} isDarkMode={isDarkMode} />
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center py-8 text-center ${isDarkMode ? 'bg-slate-700/20' : 'bg-slate-50'} rounded-2xl`}>
          <div className={`p-3 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-amber-100'} mb-3`}>
            <Sparkles size={24} className={isDarkMode ? 'text-amber-400' : 'text-amber-500'} />
          </div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            버튼을 클릭하면 오늘 하루를 AI가 요약해드려요
          </p>
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            물 섭취량과 공부 시간을 종합 분석합니다
          </p>
        </div>
      )}
    </div>
  </div>
</div>


          {/* Weekly Trend */}
          <WeeklyTrendChart data={weeklyData} currentDate={currentDate} isDarkMode={isDarkMode} waterGoal={user.goals.water} studyGoal={user.goals.study} />
        </div>

        {/* 우측 사이드바 */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Device Status */}
          <div className={`p-6 rounded-3xl border shadow-sm transition-colors duration-300 ${cardStyle}`}>
            <h3 className={`text-sm font-bold uppercase mb-4 tracking-wider ${textSecondary}`}>Device Status</h3>
            <div className="space-y-4">
              <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}><Wifi size={18} /></div>
                  <p className={`text-sm font-bold ${textPrimary}`}>AI Glass</p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-green-500 font-medium">Connected</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
              
              <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${batteryLevel >= 60 ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600') : batteryLevel >= 30 ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600') : (isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}`}><Battery size={18} /></div>
                  <p className={`text-sm font-bold ${textPrimary}`}>Battery</p>
                </div>
                <span className={`text-xs font-medium ml-auto ${batteryLevel >= 60 ? 'text-green-500' : batteryLevel >= 30 ? 'text-amber-500' : 'text-red-500'}`}>{batteryLevel}% Remaining</span>
              </div>
            </div>
          </div>

          <WeatherSection currentDate={currentDate} isDarkMode={isDarkMode} />
          <RadarBalance waterMl={stats.waterMl} waterGoal={user.goals.water} bookStudyMin={studySummary.totalBookMin} laptopStudyMin={studySummary.totalLaptopMin} studyGoal={user.goals.study} sleepMin={0} dietScore={0} isDarkMode={isDarkMode} />

          {/* Quick Tips */}
          <div className={`p-5 rounded-3xl border shadow-sm transition-colors duration-300 ${cardStyle}`}>
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${textSecondary}`}>Quick Tips</h3>
            <div className="space-y-2">
              {quickTips.length > 0 ? quickTips.map((tip) => (<DynamicTipItem key={tip.id} tip={tip} isDarkMode={isDarkMode} />)) : (<p className={`text-sm ${textSecondary}`}>팁을 생성 중입니다...</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const GoalCard = ({ title, value, unit, goal, icon, color, onClick, isDarkMode, inactive, subInfo }) => {
  const percent = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  const colorMap = {
    blue: { icon: 'text-blue-500', bar: 'bg-blue-500', barBg: isDarkMode ? 'bg-slate-700' : 'bg-slate-200', accent: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50' },
    violet: { icon: 'text-violet-500', bar: 'bg-violet-500', barBg: isDarkMode ? 'bg-slate-700' : 'bg-slate-200', accent: isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50' },
    emerald: { icon: 'text-emerald-500', bar: 'bg-emerald-500', barBg: isDarkMode ? 'bg-slate-700' : 'bg-slate-200', accent: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50' },
  };
  const c = colorMap[color];
  
  return (
    <button onClick={onClick} disabled={inactive} className={`p-4 rounded-2xl border text-left transition-all group ${inactive ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'} ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.accent}`}>{React.cloneElement(icon, { className: c.icon, size: 18 })}</div>
        <span className={`text-xs font-bold ${percent >= 100 ? 'text-emerald-500' : percent >= 50 ? 'text-blue-500' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>{Math.round(percent)}%</span>
      </div>
      <h4 className={`text-xs font-semibold mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{title}</h4>
      <p className={`text-xl font-bold ${subInfo ? 'mb-1' : 'mb-2'} ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value.toLocaleString()}<span className={`text-xs font-normal ml-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span></p>
      {subInfo && <p className={`text-[10px] mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{subInfo}</p>}
      <div className={`h-1.5 rounded-full ${c.barBg}`}><div className={`h-full rounded-full transition-all duration-500 ${c.bar}`} style={{ width: `${percent}%` }} /></div>
    </button>
  );
};

const DynamicTipItem = ({ tip, isDarkMode }) => {
  const colorClass = getTipColorClass(tip.type, isDarkMode);
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-xl border ${colorClass}`}>
      <span className="text-base flex-shrink-0">{tip.emoji}</span>
      <span className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{tip.text}</span>
    </div>
  );
};

// AI Summary 텍스트 컴포넌트 - 문장별 띄어쓰기 + 애니메이션
const AISummaryText = ({ text, isDarkMode }) => {
  const [displayedSentences, setDisplayedSentences] = useState([]);
  
  useEffect(() => {
    if (!text) {
      setDisplayedSentences([]);
      return;
    }
    
    // 문장 분리 (. ! ? 기준)
    const sentences = text
      .split(/(?<=[.!?])\s*/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());
    
    // 초기화
    setDisplayedSentences([]);
    
    // 타이머 배열 저장용
    const timers = [];
    
    // 문장별로 순차적으로 표시
    sentences.forEach((sentence, index) => {
      const timer = setTimeout(() => {
        setDisplayedSentences(prev => {
          // 중복 방지
          if (prev.includes(sentence)) return prev;
          return [...prev, sentence];
        });
      }, index * 500); // 각 문장 0.5초 간격
      timers.push(timer);
    });
    
    // Cleanup
    return () => timers.forEach(t => clearTimeout(t));
  }, [text]);

  return (
    <div className="space-y-4">
      {displayedSentences.map((sentence, idx) => (
        <p 
          key={`${idx}-${sentence.slice(0, 10)}`} 
          className={`text-[15px] leading-[1.8] ${
            isDarkMode ? 'text-slate-200' : 'text-slate-700'
          }`}
          style={{ 
            opacity: 0,
            animation: 'fadeInUp 0.6s ease forwards',
            animationDelay: `${idx * 0.15}s`
          }}
        >
          {sentence}
        </p>
      ))}
    </div>
  );
};

const InternalTypewriter = ({ text, speed = 15, isDarkMode }) => {
  const [displayText, setDisplayText] = useState("");
  useEffect(() => {
    if (!text) { setDisplayText(""); return; }
    setDisplayText(""); let i = 0;
    const timer = setInterval(() => { i++; setDisplayText(text.slice(0, i)); if (i >= text.length) clearInterval(timer); }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return <div className={`whitespace-pre-line leading-relaxed min-h-[24px] text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{displayText}</div>;
};
