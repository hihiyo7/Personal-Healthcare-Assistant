// src/features/study/components/LaptopStudyDetail.jsx
// ============================================================
// Laptop Study 상세 화면 - 활동 분리 로직 긴급 수정본
// 1. 시간 계산: duration_sec(분 환산)을 더해서 종료 시간 계산
// 2. 그룹핑: (다음 로그 시작 - 이전 로그 종료) > 5분이면 무조건 분리
// 3. 디자인/기능: 기존 코드 100% 유지 (도넛 두께, 모달, 이미지 등)
// ============================================================

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Laptop, Clock, BookOpen, Gamepad2, PieChart, 
  ChevronDown, ChevronUp, TrendingUp, Info, Sparkles, Loader, 
  Edit2, Save, X 
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid 
} from 'recharts';

import LaptopModal from './components/LaptopModal'; 
import {
  formatMinutesToTime,
  LAPTOP_CATEGORIES,
  isStudyCategory
} from './utils/studyCalculator';

/* ============================================================
   컬러 상수
============================================================ */
const STUDY_YELLOW = '#f59e0b'; 
const NON_STUDY_GRAY = '#9ca3af'; 

const PIE_COLORS_STUDY = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'];
const PIE_COLORS_NON = ['#9ca3af', '#d1d5db', '#e5e7eb'];

/* ============================================================
   헬퍼 함수 (시간 계산 로직 수정)
============================================================ */
const extractTime = (ts) => {
  if (!ts) return '00:00';
  // timestamp가 "2025-12-10 13:54:00" 형태일 경우 시간만 추출
  if (ts.includes('T')) return ts.split('T')[1]?.slice(0, 5) || '00:00';
  if (ts.includes(' ')) {
      const parts = ts.split(' ');
      if (parts.length > 1) return parts[1].slice(0, 5);
  }
  // 이미 "13:54" 형태라면
  if (ts.includes(':')) return ts.slice(0, 5);
  return '00:00';
};

// "13:54" -> 834 (분)으로 변환
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// 834 -> "13:54" 로 변환
const minutesToTimeString = (totalMinutes) => {
  let h = Math.floor(totalMinutes / 60) % 24;
  let m = Math.floor(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// [핵심 수정] 로그 그룹핑 (5분 갭 로직 강화)
const groupLogsByTimeGap = (logs, gapMinutes = 5) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // 1. 시간순 정렬 (필수)
  const sorted = [...logs].sort((a, b) => {
    const timeA = extractTime(a.time || a.timestamp);
    const timeB = extractTime(b.time || b.timestamp);
    return timeA.localeCompare(timeB);
  });

  const sessions = [];
  
  // 첫 번째 로그로 세션 시작
  let currentSession = {
    logs: [sorted[0]],
  };

  for (let i = 1; i < sorted.length; i++) {
    // 이전 로그 (바로 직전 로그 기준)
    const prevLog = sorted[i - 1]; 
    const currLog = sorted[i];

    // [계산] 이전 로그 종료 시간 = 시작시간(분) + 수행시간(분)
    const prevStartMin = parseTimeToMinutes(extractTime(prevLog.time || prevLog.timestamp));
    const prevDuration = parseFloat(prevLog.durationMin || 0);
    const prevEndMin = prevStartMin + prevDuration;

    // [계산] 현재 로그 시작 시간
    const currStartMin = parseTimeToMinutes(extractTime(currLog.time || currLog.timestamp));

    // [판단] (현재 시작) - (이전 종료) > 5분 이면 끊기
    // 예: 13:54 시작 + 0.8분 = 13:54.8 종료
    //     14:51 시작 (891분)
    //     891 - 834.8 = 56.2분 차이 -> 분리됨
    if ((currStartMin - prevEndMin) > gapMinutes) {
      sessions.push(finalizeSession(currentSession));
      currentSession = { logs: [currLog] };
    } else {
      currentSession.logs.push(currLog);
    }
  }
  // 마지막 세션 추가
  sessions.push(finalizeSession(currentSession));
  
  return sessions;
};

// 세션 정보 확정
const finalizeSession = (session) => {
  const sorted = session.logs;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
//  원본 합계
const totalDurationRaw = sorted.reduce(
  (sum, log) => sum + (parseFloat(log.durationMin) || 0),
  0
);

// 첫째 자리 반올림
const totalDuration = Math.round(totalDurationRaw * 10) / 10;


  // 시작 시간
  const startTime = extractTime(first.time || first.timestamp);
  
  // 종료 시간 = 마지막 로그 시작 + 마지막 로그 지속시간
  const lastStartMin = parseTimeToMinutes(extractTime(last.time || last.timestamp));
  const lastEndMin = lastStartMin + (parseFloat(last.durationMin) || 0);
  const endTime = minutesToTimeString(lastEndMin);

  // 카테고리 (가장 많이 등장한 카테고리 찾기 or 첫 번째)
  const category = first.category || 'lecture'; 
  const categoryInfo = LAPTOP_CATEGORIES[category] || { label: 'Lecture' };

  // 사용자 라벨 우선 확인
  const userLabels = sorted.map(l => l.userLabel).filter(Boolean);
  const representativeLabel = userLabels.length > 0 ? userLabels[0] : null;
  
  let isStudy = isStudyCategory(category);
  if (representativeLabel) {
      const labelLower = representativeLabel.toLowerCase();
      isStudy = labelLower.includes('study') || !labelLower.includes('game');
  } else if (first.aiResult) {
      isStudy = first.aiResult.toLowerCase().includes('study');
  }

  // 대표 이미지
  const validImgLog = sorted.find(l => l.imageUrl || l.captureUrl);
  const sessionImageUrl = validImgLog ? (validImgLog.imageUrl || validImgLog.captureUrl) : null;

  return {
    id: first.id,
    logs: sorted,
    startTime,
    endTime,
    displayTime: `${startTime}~${endTime}`,
    durationMin:totalDuration, // 소수점 1자리
    category: category,
    categoryLabel: categoryInfo.label,
    isStudy: isStudy,
    logCount: sorted.length,
    imageUrl: sessionImageUrl
  };
};

/* ============================================================
   메인 컴포넌트
============================================================ */
export default function LaptopStudyDetail({ logs = [], onUpdateLog, onImageAnalysis, onBack, isDarkMode }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedSession, setExpandedSession] = useState(null);
  const [hoveredSession, setHoveredSession] = useState(null);

  const cardBase = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // [그룹핑 적용]
  const sessions = useMemo(() => groupLogsByTimeGap(logs, 5), [logs]);
  
  const studySessions = sessions.filter(s => s.isStudy);
  const nonStudySessions = sessions.filter(s => !s.isStudy);

  const studyMinutesRaw = studySessions.reduce((sum, s) => sum + s.durationMin, 0);
  const nonStudyMinutesRaw = nonStudySessions.reduce((sum, s) => sum + s.durationMin, 0);

  const studyMinutes = Math.round(studyMinutesRaw * 10) / 10;
  const nonStudyMinutes = Math.round(nonStudyMinutesRaw * 10) / 10;

  const totalMinutes = Math.round((studyMinutes + nonStudyMinutes) * 10) / 10;


  const filteredSessions = useMemo(() => {
    if (filter === 'study') return studySessions;
    if (filter === 'non-study') return nonStudySessions;
    return sessions;
  }, [sessions, filter, studySessions, nonStudySessions]);

  // 타임라인 데이터
  const timelineData = useMemo(() => sessions.map(session => ({
    id: session.id,
    start: parseTimeToMinutes(session.startTime),
    end: Math.max(parseTimeToMinutes(session.endTime), parseTimeToMinutes(session.startTime) + 5),
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.durationMin,
    name: session.categoryLabel,
    isStudy: session.isStudy,
    session: session
  })), [sessions]);

  // 도넛 차트 데이터
  const categoryData = useMemo(() => {
    const map = {};
    sessions.forEach(session => {
      const key = session.category || 'other';
      map[key] = (map[key] || 0) + session.durationMin;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: LAPTOP_CATEGORIES[key]?.label || key,
      value: parseFloat(value.toFixed(1)),
      isStudy: isStudyCategory(key)
    }));
  }, [sessions]);

  const getFilterBtnStyle = (f) => {
    const active = filter === f;
    if (f === 'all' && active) return isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-400' : 'bg-blue-100 text-blue-700 border-blue-300';
    if (f === 'study' && active) return isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-400' : 'bg-amber-100 text-amber-700 border-amber-300';
    if (f === 'non-study' && active) return isDarkMode ? 'bg-slate-500/20 text-slate-300 border-slate-400' : 'bg-slate-200 text-slate-700 border-slate-300';
    return isDarkMode ? 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100';
  };

  /* ===================== 핸들러 ===================== */

  // 세션 수정 모달
  const handleSessionEdit = (session) => {
    const representative = {
      ...session.logs[0],
      isSessionEdit: true,
      sessionId: session.id, 
      relatedLogs: session.logs,
      imageUrl: session.imageUrl,
      durationMin: session.durationMin,
      displayTime: session.displayTime,
      userLabel: session.isStudy ? 'Study' : 'Game'
    };
    setSelectedLog(representative);
    setShowModal(true);
  };

  // 개별 로그 수정 모달
  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  // 저장 (시간 수정 포함)
  const handleModalSave = (updates) => {
    if (selectedLog && onUpdateLog) {
      if (selectedLog.isSessionEdit) {
        const session = sessions.find(s => s.id === selectedLog.sessionId);
        if (session) {
            session.logs.forEach(log => {
                const newUserLabel = updates.userLabel || (updates.category === 'game' ? 'Game' : 'Study');
                onUpdateLog(log.id, newUserLabel);
            });
        }
      } else {
        const newUserLabel = updates.userLabel || updates.aiResult;
        // 개별 로그 수정 시 시간/양도 업데이트 (필요 시)
        onUpdateLog(selectedLog.id, newUserLabel, updates.time, updates.amount); 
      }
    }
    setShowModal(false);
    setSelectedLog(null);
  };

  // AI 분석 요청
  const handleAIAnalyze = (e, log) => {
    e.stopPropagation();
    if (onImageAnalysis && !log.isAnalyzing) {
        const fileName = log.imageFile || (log.imageUrl ? log.imageUrl.split('/').pop() : null);
        onImageAnalysis(log.id, fileName);
    }
  };

  const toggleSession = (sessionId) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
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

      {/* Summary & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 요약 */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase} flex flex-col justify-center`}>
          <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${textPrimary}`}>
            <Clock size={18} className="text-blue-500" /> 오늘의 활동 요약
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
              <p className="text-xs text-blue-500 mb-1">전체</p>
              <p className="text-xl font-bold text-blue-600">{formatMinutesToTime(totalMinutes)}</p>
            </div>
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
              <p className="text-xs text-amber-500 mb-1">공부</p>
              <p className="text-xl font-bold text-amber-600">{formatMinutesToTime(studyMinutes)}</p>
            </div>
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
              <p className="text-xs text-slate-500 mb-1">제외</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{formatMinutesToTime(nonStudyMinutes)}</p>
            </div>
          </div>
        </div>

        {/* 도넛 차트 */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase} flex flex-col min-h-[280px]`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
            <PieChart size={18} className="text-blue-500" /> 카테고리 분포
          </h2>
          {categoryData.length > 0 ? (
            <div className="flex-1 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie 
                    data={categoryData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={45} 
                    outerRadius={90} 
                    dataKey="value" 
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
          ) : <div className="flex-1 flex items-center justify-center text-sm text-gray-400">데이터 없음</div>}
        </div>
      </div>

      {/* Timeline */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
          <TrendingUp size={18} className="text-amber-500" /> 오늘의 공부 타임라인
        </h2>
        {timelineData.length > 0 ? (
          <div className="space-y-3">
            <div className="relative">
              <div className={`h-12 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'} relative`}>
                {[6, 12, 18].map(hour => <div key={hour} className={`absolute top-0 bottom-0 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`} style={{ left: `${(hour / 24) * 100}%` }} />)}
                {timelineData.map((item, idx) => {
                  const leftPercent = (item.start / 1440) * 100;
                  const widthPercent = Math.max(((item.end - item.start) / 1440) * 100, 0.5);
                  return (
                    <div key={item.id || idx}
                      className={`absolute top-2 bottom-2 rounded-md cursor-pointer transition-all shadow-sm ${
                        hoveredSession?.id === item.session?.id 
                          ? (item.isStudy ? 'bg-gradient-to-r from-amber-400 to-amber-300 scale-y-125' : 'bg-gradient-to-r from-slate-400 to-slate-300 scale-y-125') 
                          : (item.isStudy ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:scale-y-110' : 'bg-gradient-to-r from-slate-500 to-slate-400 hover:scale-y-110')
                      }`}
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '6px' }}
                      onClick={() => handleSessionEdit(item.session)}
                      onMouseEnter={() => setHoveredSession({ ...item.session, ...item })}
                      onMouseLeave={() => setHoveredSession(null)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {[0, 6, 12, 18, 24].map(hour => <span key={hour} className={`text-[10px] ${textSecondary}`}>{hour === 24 ? '24시' : `${hour}시`}</span>)}
              </div>
            </div>
            
            {hoveredSession && (
              <div className={`mt-3 p-4 rounded-2xl border-2 transition-all animate-fade-in ${hoveredSession.isStudy ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200') : (isDarkMode ? 'bg-slate-700/50 border-slate-500/30' : 'bg-slate-100 border-slate-300')}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${hoveredSession.isStudy ? (isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100') : (isDarkMode ? 'bg-slate-600' : 'bg-slate-200')}`}>
                    {hoveredSession.isStudy ? <BookOpen size={20} className="text-amber-500" /> : <Gamepad2 size={20} className="text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${textPrimary}`}>{hoveredSession.isStudy ? '💻' : '🎮'} {hoveredSession.name}</p>
                    <p className={`text-sm ${textSecondary}`}>{hoveredSession.isStudy ? '공부 활동' : '기타 활동'}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${hoveredSession.isStudy ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600') : (isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600')}`}>
                      <Clock size={14} /> <span>{hoveredSession.startTime}</span> <span className="opacity-50">→</span> <span>{hoveredSession.endTime}</span>
                    </div>
                    <p className={`text-lg font-bold mt-1 ${hoveredSession.isStudy ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : (isDarkMode ? 'text-slate-300' : 'text-slate-600')}`}>{hoveredSession.duration.toFixed(1)}분</p>
                  </div>
                  <button onClick={() => handleSessionEdit(hoveredSession.session || hoveredSession)} className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">수정하기</button>
                </div>
              </div>
            )}
          </div>
        ) : <div className={`text-center py-8 text-sm ${textSecondary}`}>데이터 없음</div>}
      </div>

      {/* Sessions Table */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${textPrimary}`}>활동 기록 ({filteredSessions.length})</h2>
          <div className="flex gap-2">
            {['all', 'study', 'non-study'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs border ${getFilterBtnStyle(f)}`}>
                {f === 'all' ? '전체' : f === 'study' ? '공부' : '기타'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <div key={session.id} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              
              {/* 세션 헤더 */}
              <div className={`p-4 flex justify-between items-center cursor-pointer ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`} onClick={() => toggleSession(session.id)}>
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-mono font-bold ${session.isStudy ? 'text-amber-500' : 'text-slate-500'}`}>{session.displayTime}</span>
                  <div className="flex items-center gap-2">
                    <Laptop size={16} className={session.isStudy ? 'text-amber-500' : 'text-slate-400'} />
                    <span className="font-bold">{formatMinutesToTime(session.durationMin)}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${session.isStudy ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{session.categoryLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSessionEdit(session); }}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-50 z-10"
                  >
                    활동 수정
                  </button>
                  {expandedSession === session.id ? <ChevronUp size={20} className={textSecondary} /> : <ChevronDown size={20} className={textSecondary} />}
                </div>
              </div>

              {/* 상세 로그 테이블 */}
              {expandedSession === session.id && (
                <div className={`border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                      <tr>
                        <th className="p-3 pl-6">Time</th>
                        <th className="p-3">Image (Click AI)</th>
                        <th className="p-3">AI Result</th>
                        <th className="p-3 font-bold text-blue-600">My Label</th>
                        <th className="p-3 text-center">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {session.logs.map((log) => (
                        <tr key={log.id}>
                          <td className="p-3 pl-6 font-mono text-xs text-gray-500">{extractTime(log.time)}</td>
                          
                          {/* 이미지 클릭 -> AI 분석 */}
                          <td className="p-3">
                            {log.imageUrl ? (
                              <div className="relative group w-20 h-14 rounded overflow-hidden flex items-center justify-center border cursor-pointer bg-white" onClick={(e) => handleAIAnalyze(e, log)}>
                                <img src={log.imageUrl} alt="img" className={`w-full h-full object-contain ${log.isAnalyzing ? 'opacity-50' : ''}`} />
                                {log.isAnalyzing && <div className="absolute inset-0 flex items-center justify-center"><Loader className="animate-spin w-4 h-4 text-blue-500"/></div>}
                                {!log.isAnalyzing && !log.analyzed && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity"><Sparkles size={14} className="text-white"/></div>}
                              </div>
                            ) : <span className="text-xs text-gray-300">-</span>}
                          </td>

                          <td className="p-3 text-xs text-gray-500">{log.aiResult || "-"}</td>
                          <td className="p-3 text-xs font-bold text-blue-600">{log.userLabel || "-"}</td>
                          
                          {/* 개별 수정 */}
                          <td className="p-3 text-center">
                            <button onClick={() => handleLogClick(log)} className="p-1 text-gray-400 hover:text-blue-500"><Edit2 size={14}/></button>
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
      </div>

      {/* 모달 */}
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