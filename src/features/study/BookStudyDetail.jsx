// src/pages/BookStudyDetail.jsx
// ============================================================
// Book Study 상세 화면
// - CSV 파일별 세션 그룹핑 (한 CSV = 한 활동)
// - 첫/마지막 로그 시간 차이로 독서 시간 계산
// ============================================================

import React, { useState, useMemo } from 'react';
import { ArrowLeft, BookOpen, Clock, BarChart3, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { EmptyStudyState } from './components/StudyCard';
import BookModal from './components/BookModal';
import { formatMinutesToTime } from './utils/studyCalculator';

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
        logs: []
      };
    }
    groups[key].logs.push(log);
  });

  // 각 그룹의 시간 계산 (첫 로그 ~ 마지막 로그)
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

    // 세션의 대표 책 정보 (첫 로그 또는 가장 완전한 정보)
    const representativeLog = sorted.find(log => log.bookTitle) || sorted[0];

    return {
      id: group.sourceFile,
      sourceFile: group.sourceFile,
      logs: sorted,
      startTime,
      endTime,
      displayTime,
      durationMin,
      logCount: sorted.length,
      // 책 정보
      bookId: representativeLog.bookId || null,
      bookTitle: representativeLog.bookTitle || '',
      bookAuthors: representativeLog.bookAuthors || [],
      bookThumbnail: representativeLog.bookThumbnail || '',
      totalPages: representativeLog.totalPages || 0,
      readPages: representativeLog.readPages || 0,
      progress: representativeLog.progress || 0,
      // 목적 (study/etc)
      purpose: representativeLog.purpose || 'study',
      isStudy: representativeLog.isStudy !== false
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

export default function BookStudyDetail({ logs = [], onUpdateLog, onBack, isDarkMode }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);
  const [hoveredSession, setHoveredSession] = useState(null); // 호버된 세션

  const cardBase = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // CSV 파일별 세션 그룹핑
  const sessions = useMemo(() => groupLogsBySourceFile(logs), [logs]);
  
  const totalMinutes = useMemo(() => 
    sessions.reduce((sum, s) => sum + s.durationMin, 0), 
    [sessions]
  );

  // 24시간 타임라인 데이터 (세션별 막대)
  const timelineData = useMemo(() => {
    return sessions.map((session, idx) => {
      const startMin = parseTimeToMinutes(session.startTime);
      const endMin = parseTimeToMinutes(session.endTime);
      
      return {
        id: session.id,
        name: session.bookTitle || `독서 ${idx + 1}`,
        start: startMin,
        end: endMin,
        duration: session.durationMin,
        startTime: session.startTime,
        endTime: session.endTime,
        session
      };
    });
  }, [sessions]);
  
  // 세션 단위 수정
  const handleSessionEdit = (session) => {
    const representativeLog = {
      ...session.logs[0],
      isSessionEdit: true,
      sessionId: session.id,
      // 세션의 대표 정보 사용
      bookId: session.bookId,
      bookTitle: session.bookTitle,
      bookAuthors: session.bookAuthors,
      bookThumbnail: session.bookThumbnail,
      totalPages: session.totalPages,
      readPages: session.readPages,
      progress: session.progress,
      durationMin: session.durationMin,
      purpose: session.purpose
    };
    setSelectedLog(representativeLog);
    setShowModal(true);
  };

  const handleLogClick = (log) => {
    setSelectedLog(log);
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
    <div className="space-y-6 animate-fade-in pb-10">
      {/* 헤더 */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 rounded-xl transition ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
            <ArrowLeft size={22} className={textSecondary} />
          </button>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <BookOpen size={24} className="text-blue-500" />
              Book Study
            </h1>
            <p className={`text-sm ${textSecondary}`}>
              총 {sessions.length}개 활동 · {formatMinutesToTime(totalMinutes)} 독서
            </p>
          </div>
        </div>
      </div>

      {/* Summary + 그래프 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
            <Clock size={20} className="text-blue-500" />
            오늘의 독서 요약
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <p className={`text-sm ${textSecondary}`}>총 독서 시간</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{formatMinutesToTime(totalMinutes)}</p>
            </div>
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
              <p className={`text-sm ${textSecondary}`}>활동 수</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{sessions.length}개</p>
            </div>
          </div>
        </div>



        {/* 24시간 타임라인 */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
            <BarChart3 size={20} className="text-blue-500" />
            오늘의 독서 타임라인
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
                  
                  {/* 독서 세션 막대들 */}
                  {timelineData.map((item, idx) => {
                    const leftPercent = (item.start / 1440) * 100;
                    const widthPercent = Math.max(((item.end - item.start) / 1440) * 100, 0.5);
                    const session = item.session;
                    const isHovered = hoveredSession?.id === session?.id;
                    
                    return (
                      <div
                        key={item.id || idx}
                        className={`absolute top-2 bottom-2 rounded-md cursor-pointer transition-all shadow-sm ${
                          isHovered 
                            ? 'bg-gradient-to-r from-blue-400 to-blue-300 scale-y-125 ring-2 ring-blue-400/50' 
                            : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 hover:scale-y-110'
                        }`}
                        style={{ 
                          left: `${leftPercent}%`, 
                          width: `${widthPercent}%`,
                          minWidth: '6px'
                        }}
                        onClick={() => handleSessionEdit(session)}
                        onMouseEnter={() => setHoveredSession({ ...session, ...item })}
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
                  isDarkMode 
                    ? 'bg-blue-500/10 border-blue-500/30' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-4">
                    {/* 책 썸네일 */}
                    {hoveredSession.bookThumbnail ? (
                      <img src={hoveredSession.bookThumbnail} alt="" className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <BookOpen size={20} className="text-blue-500" />
                      </div>
                    )}
                    
                    {/* 책 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${textPrimary}`}>
                        📖 {hoveredSession.name || '책 정보 미입력'}
                      </p>
                      {hoveredSession.bookAuthors?.length > 0 && (
                        <p className={`text-sm ${textSecondary}`}>
                          {hoveredSession.bookAuthors.join(', ')}
                        </p>
                      )}
                      {hoveredSession.totalPages > 0 && (
                        <p className={`text-xs ${textSecondary}`}>
                          진행: {hoveredSession.readPages || 0} / {hoveredSession.totalPages} 페이지 ({hoveredSession.progress || 0}%)
                        </p>
                      )}
                    </div>
                    
                    {/* 시간 정보 */}
                    <div className="flex-shrink-0 text-right">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <Clock size={14} />
                        <span>{hoveredSession.startTime}</span>
                        <span className="opacity-50">→</span>
                        <span>{hoveredSession.endTime}</span>
                      </div>
                      <p className={`text-lg font-bold mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {hoveredSession.duration}분
                      </p>
                    </div>
                    
                    {/* 수정 버튼 */}
                    <button
                      onClick={() => handleSessionEdit(hoveredSession.session || hoveredSession)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${
                        isDarkMode 
                          ? 'bg-blue-500 hover:bg-blue-400 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                        isDarkMode ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
        </div>
      </div>

      {/* 세션 리스트 (CSV 파일별) */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
            독서 활동 기록
            <span className={`ml-2 text-sm font-normal ${textSecondary}`}>
              ({sessions.length}개 활동)
            </span>
          </h2>
        </div>

        <p className={`text-xs mb-3 flex items-center gap-2 ${textSecondary}`}>
          <Info size={14} className="text-blue-400" />
          <span>행의 <span className="font-bold text-indigo-500">활동 수정</span>은 세션 일괄 수정, <span className="font-bold text-blue-500">수정</span>은 개별 로그 수정입니다.</span>
        </p>

        {sessions.length === 0 ? (
          <EmptyStudyState type="book" isDarkMode={isDarkMode} />
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className={`rounded-2xl border overflow-hidden transition ${
                expandedSession === session.id 
                  ? 'border-blue-500/50' 
                  : (isDarkMode ? 'border-slate-700' : 'border-slate-200')
              }`}>
                {/* 세션 헤더 */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className={`w-full p-4 flex items-center gap-4 transition ${
                    expandedSession === session.id 
                      ? (isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50') 
                      : (isDarkMode ? 'bg-slate-900/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')
                  }`}
                >
                  {/* 책 썸네일 */}
                  {session.bookThumbnail ? (
                    <img src={session.bookThumbnail} alt={session.bookTitle} className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                      <BookOpen size={20} className="text-blue-500" />
                    </div>
                  )}
                  
                  {/* 책 정보 */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`font-semibold truncate ${textPrimary}`}>
                        {session.bookTitle || '책 정보 미입력'}
                      </p>
                      {/* 목적 뱃지 */}
                      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        session.isStudy
                          ? (isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600')
                          : (isDarkMode ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-600')
                      }`}>
                        {session.isStudy ? '📚 교육용' : '📖 일반'}
                      </span>
                    </div>
                    {session.bookAuthors && session.bookAuthors.length > 0 && (
                      <p className={`text-sm truncate ${textSecondary}`}>
                        {session.bookAuthors.join(', ')}
                      </p>
                    )}
                    {session.totalPages > 0 && (
                      <p className={`text-xs ${textSecondary}`}>
                        {session.readPages || 0} / {session.totalPages} 페이지 ({session.progress || 0}%)
                      </p>
                    )}
                  </div>

                  {/* 시간 정보 (세로 배치) */}
                  <div className="flex-shrink-0 text-right min-w-[90px]">
                    <p className={`text-base font-mono font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {session.displayTime}
                    </p>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-500'}`}>
                      {formatMinutesToTime(session.durationMin)}
                    </p>
                  </div>

                  {/* 로그 수 뱃지 */}
                  <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                    isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {session.logCount}건
                  </div>
                  
                  {/* 활동 수정 버튼 */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); handleSessionEdit(session); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isDarkMode 
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    활동 수정
                  </div>
                  
                  {/* 확장 아이콘 */}
                  <div className="flex-shrink-0">
                    {expandedSession === session.id ? (
                      <ChevronUp size={20} className={textSecondary} />
                    ) : (
                      <ChevronDown size={20} className={textSecondary} />
                    )}
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

      <BookModal 
        isOpen={showModal} 
        log={selectedLog} 
        onSave={handleModalSave} 
        onClose={() => { setShowModal(false); setSelectedLog(null); }} 
        isDarkMode={isDarkMode} 
      />
    </div>
  );
}

