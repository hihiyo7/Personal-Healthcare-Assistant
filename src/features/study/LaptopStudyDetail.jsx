// src/pages/LaptopStudyDetail.jsx
// ============================================================
// Laptop Study 상세 화면
// - CSV 파일별 세션 그룹핑 (한 CSV = 한 활동)
// - 24시간 타임라인 (전체 시간 표시)
// ============================================================

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Laptop, Clock, BookOpen, Gamepad2, PieChart, ChevronDown, ChevronUp, TrendingUp, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

import LaptopModal from './components/LaptopModal';
import {
  formatMinutesToTime,
  LAPTOP_CATEGORIES,
  isStudyCategory
} from './utils/studyCalculator';

/* ============================================================
   컬러 상수 (공부=노랑, 제외=회색, 전체=파랑)
============================================================ */
const STUDY_YELLOW = '#f59e0b'; // amber-500 (공부)
const NON_STUDY_GRAY = '#9ca3af'; // gray-400 (기타/제외)

const PIE_COLORS_STUDY = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const PIE_COLORS_NON = ['#9ca3af', '#d1d5db', '#e5e7eb'];

/**
 * 로그를 CSV 파일(sourceFile)별로 그룹핑
 * 한 CSV 파일 = 한 활동 (세션)
 */
const groupLogsBySourceFile = (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const groups = {};
  
  logs.forEach(log => {
    const key = log.sourceFile || 'unknown';
    if (!groups[key]) {
      groups[key] = {
        sourceFile: key,
        logs: [],
        category: log.category || 'lecture'
      };
    }
    groups[key].logs.push(log);
  });

  // 각 그룹의 시간 계산
  return Object.values(groups).map(group => {
    const sorted = group.logs.sort((a, b) => {
      const timeA = a.timestamp || a.time || '';
      const timeB = b.timestamp || b.time || '';
      return timeA.localeCompare(timeB);
    });

    const firstLog = sorted[0];
    const lastLog = sorted[sorted.length - 1];
    
    const startTime = extractTime(firstLog.timestamp || firstLog.time);
    const endTime = extractTime(lastLog.timestamp || lastLog.time);
    
    // 시간 차이 계산
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    const durationMin = Math.max(endMin - startMin, 1);
    
    const displayTime = startTime === endTime ? startTime : `${startTime}~${endTime}`;
    const isStudy = isStudyCategory(group.category);
    const categoryInfo = LAPTOP_CATEGORIES[group.category] || { label: 'Lecture' };

    return {
      id: group.sourceFile,
      sourceFile: group.sourceFile,
      logs: sorted,
      startTime,
      endTime,
      displayTime,
      durationMin,
      category: group.category,
      categoryLabel: categoryInfo.label,
      isStudy,
      logCount: sorted.length
    };
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

const extractTime = (ts) => {
  if (!ts) return '00:00';
  // "2025-12-04T21:30:00" 형식
  if (ts.includes('T')) {
    return ts.split('T')[1]?.slice(0, 5) || '00:00';
  }
  // "2025-12-04 21:30" 형식
  if (ts.includes(' ')) {
    return ts.split(' ')[1]?.slice(0, 5) || '00:00';
  }
  // "21:30" 형식
  return ts.slice(0, 5);
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export default function LaptopStudyDetail({ logs = [], onUpdateLog, onBack, isDarkMode, totalLaptopMin = 0 }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedSession, setExpandedSession] = useState(null);
  const [hoveredSession, setHoveredSession] = useState(null);

  /* ===================== 기본 톤 ===================== */
  const cardBase = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  /* ===================== CSV 파일별 세션 그룹핑 ===================== */
  const sessions = useMemo(() => groupLogsBySourceFile(logs), [logs]);
  
  const studySessions = useMemo(() => sessions.filter(s => s.isStudy), [sessions]);
  const nonStudySessions = useMemo(() => sessions.filter(s => !s.isStudy), [sessions]);
  
  // 세션 기반 시간 계산
  const studyMinutes = useMemo(() => studySessions.reduce((sum, s) => sum + s.durationMin, 0), [studySessions]);
  const nonStudyMinutes = useMemo(() => nonStudySessions.reduce((sum, s) => sum + s.durationMin, 0), [nonStudySessions]);
  const totalMinutes = studyMinutes + nonStudyMinutes;

  const filteredSessions = useMemo(() => {
    if (filter === 'study') return studySessions;
    if (filter === 'non-study') return nonStudySessions;
    return sessions;
  }, [sessions, filter, studySessions, nonStudySessions]);

  /* ===================== 24시간 타임라인 데이터 (Book과 동일한 방식) ===================== */
  const timelineData = useMemo(() => {
    return sessions.map(session => {
      const startMin = parseTimeToMinutes(session.startTime);
      const endMin = parseTimeToMinutes(session.endTime);
      
      return {
        id: session.id,
        start: startMin,
        end: Math.max(endMin, startMin + 5), // 최소 5분으로 표시
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.durationMin,
        name: session.categoryLabel,
        isStudy: session.isStudy,
        session: session
      };
    });
  }, [sessions]);

  /* ===================== 차트 데이터 ===================== */
  const categoryData = useMemo(() => {
    const map = {};
    sessions.forEach(session => {
      const key = session.category || 'other';
      map[key] = (map[key] || 0) + session.durationMin;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: LAPTOP_CATEGORIES[key]?.label || key,
      value,
      isStudy: isStudyCategory(key)
    }));
  }, [sessions]);

  /* ===================== 필터 버튼 스타일 ===================== */
  const getFilterBtnStyle = (f) => {
    const active = filter === f;
    if (f === 'all' && active) {
      return isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-400' : 'bg-blue-100 text-blue-700 border-blue-300';
    }
    if (f === 'study' && active) {
      return isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-400' : 'bg-amber-100 text-amber-700 border-amber-300';
    }
    if (f === 'non-study' && active) {
      return isDarkMode ? 'bg-slate-500/20 text-slate-300 border-slate-400' : 'bg-slate-200 text-slate-700 border-slate-300';
    }
    return isDarkMode
      ? 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-slate-700'
      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100';
  };

  /* ===================== 핸들러 ===================== */
  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  // 세션 단위 수정
  const handleSessionEdit = (session) => {
    const representativeLog = {
      ...session.logs[0],
      isSessionEdit: true,
      sessionId: session.id
    };
    setSelectedLog(representativeLog);
    setShowModal(true);
  };

  const handleModalSave = (updates) => {
    if (selectedLog && onUpdateLog) {
      if (selectedLog.isSessionEdit) {
        // 세션 내 모든 로그 업데이트
        const targetSession = sessions.find(s => s.id === selectedLog.sessionId);
        if (targetSession) {
          targetSession.logs.forEach(log => {
            onUpdateLog(log.id, updates);
          });
        }
      } else {
        // 개별 로그 업데이트
        onUpdateLog(selectedLog.id, updates);
      }
    }
    setShowModal(false);
    setSelectedLog(null);
  };

  const toggleSession = (sessionId) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10"> {/* pb-10 추가로 하단 여백 확보 */}

      {/* ===================== Header ===================== */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
            <ArrowLeft size={22} className={textSecondary} />
          </button>
          <div>
            <h1 className={`text-2xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <Laptop size={24} className="text-blue-500" />
              Laptop Study
            </h1>
            <p className={`text-sm ${textSecondary}`}>
              총 {sessions.length}개 활동 · {formatMinutesToTime(studyMinutes)} 공부
              {nonStudyMinutes > 0 && <span className="opacity-60"> ({formatMinutesToTime(nonStudyMinutes)} 제외)</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ===================== Summary + Chart ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Summary (화면 크기에 따라 높이 조절) */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase} flex flex-col justify-center`}>
          <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${textPrimary}`}>
            <Clock size={18} className="text-blue-500" />
            오늘의 활동 요약
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {/* 전체 - 파랑 */}
            <div className={`${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'} p-4 rounded-2xl flex flex-col justify-center min-h-[100px]`}>
              <p className="text-xs text-blue-600 mb-1">전체</p>
              <p className="text-xl font-bold text-blue-700 mb-1">{formatMinutesToTime(totalMinutes)}</p>
              <p className={`text-[10px] ${textSecondary}`}>{sessions.length}개 활동</p>
            </div>

            {/* 공부 - 노랑 */}
            <div className={`${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'} p-4 rounded-2xl flex flex-col justify-center min-h-[100px]`}>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={14} className="text-amber-500" />
                <p className="text-xs text-amber-600">공부</p>
              </div>
              <p className="text-xl font-bold text-amber-600 mb-1">{formatMinutesToTime(studyMinutes)}</p>
              <p className={`text-[10px] ${textSecondary}`}>{studySessions.length}개 활동</p>
            </div>

            {/* 제외 - 회색 */}
            <div className={`${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'} p-4 rounded-2xl flex flex-col justify-center min-h-[100px]`}>
              <div className="flex items-center gap-2 mb-1">
                <Gamepad2 size={14} className="text-slate-500" />
                <p className="text-xs text-slate-500">제외</p>
              </div>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>
                {formatMinutesToTime(nonStudyMinutes)}
              </p>
              <p className={`text-[10px] ${textSecondary}`}>{nonStudySessions.length}개 활동</p>
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase} flex flex-col min-h-[280px]`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
            <PieChart size={18} className="text-blue-500" />
            카테고리 분포
          </h2>

          {categoryData && categoryData.length > 0 ? (
            <div className="flex-1 w-full flex items-center justify-center" style={{ minHeight: '220px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    startAngle={0}
                    endAngle={360}
                    outerRadius={60}
                    innerRadius={30}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                    isAnimationActive={true}
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.isStudy ? PIE_COLORS_STUDY[idx % PIE_COLORS_STUDY.length] : PIE_COLORS_NON[idx % PIE_COLORS_NON.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}분`} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${textSecondary}`}>
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ===================== Timeline (24시간) - Book과 동일한 디자인 ===================== */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
          <TrendingUp size={18} className="text-amber-500" />
          오늘의 공부 타임라인
        </h2>

        {timelineData.length > 0 ? (
          <div className="space-y-3">
            {/* 24시간 타임라인 바 */}
            <div className="relative">
              {/* 배경 그리드 */}
              <div className={`h-12 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'} relative`}>
                {/* 시간 구분선 (6시간 간격) */}
                {[6, 12, 18].map(hour => (
                  <div 
                    key={hour}
                    className={`absolute top-0 bottom-0 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}
                    style={{ left: `${(hour / 24) * 100}%` }}
                  />
                ))}
                
                {/* 세션 막대들 */}
                {timelineData.map((item, idx) => {
                  const leftPercent = (item.start / 1440) * 100;
                  const widthPercent = Math.max(((item.end - item.start) / 1440) * 100, 0.5);
                  const isHovered = hoveredSession?.id === item.session?.id;
                  
                  return (
                    <div
                      key={item.id || idx}
                      className={`absolute top-2 bottom-2 rounded-md cursor-pointer transition-all shadow-sm ${
                        isHovered 
                          ? (item.isStudy 
                              ? 'bg-gradient-to-r from-amber-400 to-amber-300 scale-y-125 ring-2 ring-amber-400/50' 
                              : 'bg-gradient-to-r from-slate-400 to-slate-300 scale-y-125 ring-2 ring-slate-400/50')
                          : (item.isStudy
                              ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 hover:scale-y-110'
                              : 'bg-gradient-to-r from-slate-500 to-slate-400 hover:from-slate-400 hover:to-slate-300 hover:scale-y-110')
                      }`}
                      style={{ 
                        left: `${leftPercent}%`, 
                        width: `${widthPercent}%`,
                        minWidth: '6px'
                      }}
                      onClick={() => handleSessionEdit(item.session)}
                      onMouseEnter={() => setHoveredSession({ ...item.session, ...item })}
                      onMouseLeave={() => setHoveredSession(null)}
                    />
                  );
                })}
              </div>

              {/* 시간 라벨 */}
              <div className="flex justify-between mt-1">
                {[0, 6, 12, 18, 24].map(hour => (
                  <span key={hour} className={`text-[10px] ${textSecondary}`}>
                    {hour === 24 ? '24시' : `${hour}시`}
                  </span>
                ))}
              </div>
            </div>

            {/* 호버된 세션 정보 카드 */}
            {hoveredSession ? (
              <div className={`mt-3 p-4 rounded-2xl border-2 transition-all animate-fade-in ${
                hoveredSession.isStudy
                  ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200')
                  : (isDarkMode ? 'bg-slate-700/50 border-slate-500/30' : 'bg-slate-100 border-slate-300')
              }`}>
                <div className="flex items-center gap-4">
                  {/* 아이콘 */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    hoveredSession.isStudy 
                      ? (isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100')
                      : (isDarkMode ? 'bg-slate-600' : 'bg-slate-200')
                  }`}>
                    {hoveredSession.isStudy 
                      ? <BookOpen size={20} className="text-amber-500" />
                      : <Gamepad2 size={20} className="text-slate-500" />
                    }
                  </div>
                  
                  {/* 활동 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${textPrimary}`}>
                      {hoveredSession.isStudy ? '💻' : '🎮'} {hoveredSession.name || hoveredSession.categoryLabel}
                    </p>
                    <p className={`text-sm ${textSecondary}`}>
                      {hoveredSession.isStudy ? '공부 활동' : '기타 활동'}
                    </p>
                    <p className={`text-xs ${textSecondary}`}>
                      {hoveredSession.logCount || hoveredSession.session?.logCount || 1}개 로그
                    </p>
                  </div>
                  
                  {/* 시간 정보 */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                      hoveredSession.isStudy
                        ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600')
                        : (isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600')
                    }`}>
                      <Clock size={14} />
                      <span>{hoveredSession.startTime}</span>
                      <span className="opacity-50">→</span>
                      <span>{hoveredSession.endTime}</span>
                    </div>
                    <p className={`text-lg font-bold mt-1 ${
                      hoveredSession.isStudy 
                        ? (isDarkMode ? 'text-amber-400' : 'text-amber-600')
                        : (isDarkMode ? 'text-slate-300' : 'text-slate-600')
                    }`}>
                      {hoveredSession.duration}분
                    </p>
                  </div>
                  
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleSessionEdit(hoveredSession.session || hoveredSession)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${
                      hoveredSession.isStudy
                        ? (isDarkMode ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white')
                        : (isDarkMode ? 'bg-slate-500 hover:bg-slate-400 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white')
                    }`}
                  >
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              /* 세션 목록 (간략) */
              <div className="flex flex-wrap gap-2 mt-3">
                {timelineData.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer transition ${
                      item.isStudy
                        ? (isDarkMode ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200')
                        : (isDarkMode ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                    }`}
                    onMouseEnter={() => setHoveredSession({ ...item.session, ...item })}
                    onMouseLeave={() => setHoveredSession(null)}
                    onClick={() => handleSessionEdit(item.session)}
                  >
                    <span className="font-medium">{item.startTime}</span>
                    <span className={textSecondary}>·</span>
                    <span>{item.duration}분</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className={`text-sm ${textSecondary} text-center py-8`}>
            아직 데이터가 없습니다
          </p>
        )}

        {/* 범례 */}
        {timelineData.length > 0 && (
          <div className={`flex justify-center gap-6 text-xs font-medium mt-4 ${textSecondary}`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: STUDY_YELLOW }}></div> 공부
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: NON_STUDY_GRAY }}></div> 기타
            </div>
          </div>
        )}
      </div>

      {/* ===================== Sessions (CSV 파일별) ===================== */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${textPrimary}`}>
            활동 기록
            <span className={`ml-2 text-sm font-normal ${textSecondary}`}>
              ({filteredSessions.length}개 활동)
            </span>
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs border ${getFilterBtnStyle('all')}`}>전체</button>
            <button onClick={() => setFilter('study')} className={`px-3 py-1.5 rounded-lg text-xs border ${getFilterBtnStyle('study')}`}>공부</button>
            <button onClick={() => setFilter('non-study')} className={`px-3 py-1.5 rounded-lg text-xs border ${getFilterBtnStyle('non-study')}`}>기타</button>
          </div>
        </div>

        <p className={`text-xs mb-3 flex items-center gap-2 ${textSecondary}`}>
          <Info size={14} className="text-blue-400" />
          <span>행의 <span className="font-bold text-indigo-500">활동 수정</span>은 세션 일괄 수정, <span className="font-bold text-blue-500">수정</span>은 개별 로그 수정입니다.</span>
        </p>

        {filteredSessions.length === 0 ? (
          <div className={`h-32 flex items-center justify-center rounded-2xl border border-dashed ${textSecondary} ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            활동 기록이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div key={session.id} className={`rounded-2xl border overflow-hidden transition ${
                expandedSession === session.id 
                  ? (session.isStudy ? 'border-amber-500/50' : 'border-slate-500/50') 
                  : (isDarkMode ? 'border-slate-700' : 'border-slate-200')
              }`}>
                {/* 세션 헤더 */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className={`w-full p-4 flex items-center justify-between transition ${
                    expandedSession === session.id 
                      ? (session.isStudy 
                          ? (isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50') 
                          : (isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'))
                      : (isDarkMode ? 'bg-slate-900/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-xl font-mono font-bold ${session.isStudy ? 'text-amber-500' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                      {session.displayTime}
                    </div>
                    <div className="flex items-center gap-2">
                      <Laptop size={16} className={session.isStudy ? 'text-amber-500' : 'text-slate-400'} />
                      <span className={`font-bold ${session.isStudy ? 'text-amber-500' : (isDarkMode ? 'text-slate-300' : 'text-slate-600')}`}>
                        {formatMinutesToTime(session.durationMin)}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      session.isStudy 
                        ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600')
                        : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
                    }`}>
                      {session.categoryLabel}
                    </span>
                    <span className={`text-xs ${textSecondary}`}>
                      {session.logCount}건
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleSessionEdit(session); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isDarkMode 
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                          : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                      }`}
                    >
                      활동 수정
                    </div>
                    {expandedSession === session.id ? <ChevronUp size={20} className={textSecondary} /> : <ChevronDown size={20} className={textSecondary} />}
                  </div>
                </button>

                {/* 상세 로그 테이블 */}
                {expandedSession === session.id && (
                  <div className={`border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                    <table className={`w-full text-left text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <thead className={`${isDarkMode ? 'bg-slate-900/50 text-slate-500' : 'bg-slate-100 text-slate-500'} text-xs uppercase`}>
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Image</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
                        {session.logs.map((log, idx) => (
                          <tr key={log.id || idx} className={`transition ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                            <td className={`p-3 font-mono text-xs ${textSecondary}`}>
                              {extractTime(log.timestamp || log.time)}
                            </td>
                            <td className="p-3 text-xs">
                              {log.action || '-'}
                            </td>
                            <td className="p-3">
                              {log.imageUrl ? (
                                <img src={log.imageUrl} alt="Capture" className="w-12 h-12 rounded-lg object-cover" />
                              ) : (
                                <span className={`text-xs ${textSecondary}`}>-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleLogClick(log)} 
                                className="text-xs font-bold text-blue-500 hover:underline"
                              >
                                수정
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <LaptopModal
        isOpen={showModal}
        log={selectedLog}
        onSave={handleModalSave}
        onClose={() => { setShowModal(false); setSelectedLog(null); }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
