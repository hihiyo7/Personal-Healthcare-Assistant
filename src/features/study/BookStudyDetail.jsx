// src/features/study/BookStudyDetail.jsx
// ============================================================
// Book Study 상세 화면 (Fixed)
// 1. authors 데이터 타입 강제 변환 (Crash 방지) - 핵심 수정
// 2. 이벤트 핸들링 최적화
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, BookOpen, Clock, Edit2, Sparkles, Loader, User, Book, X, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import BookModal from '../study/components/BookModal'; 

/* 헬퍼 함수: 시간 추출 */
const extractTime = (ts) => {
  if (!ts) return "00:00";
  const timestampStr = String(ts);
  if (timestampStr.includes(':') && timestampStr.length === 5) return timestampStr;
  if (timestampStr.includes(' ')) {
    const parts = timestampStr.split(' ');
    if (parts.length > 1) return parts[1].substring(0, 5);
  }
  if (timestampStr.includes('T')) return timestampStr.split('T')[1].substring(0, 5);
  return "00:00";
};

/* 헬퍼 함수: 분 -> 시간 문자열 변환 */
const formatMinutesToTime = (minutes) => {
  if (!minutes) return '0분';
  if (minutes < 1) return `${minutes.toFixed(1)}분`; 
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

/* 헬퍼 함수: 시간 문자열 -> 분 변환 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/* [핵심 수정] 저자 데이터 안전 변환 함수 */
const safeParseAuthors = (data) => {
  if (Array.isArray(data)) return data; // 이미 배열이면 통과
  if (typeof data === 'string') {
    // "['작가명']" 처럼 생긴 문자열이거나, "작가1, 작가2" 형태인 경우 처리
    const cleaned = data.replace(/[\[\]']/g, ""); // 대괄호와 따옴표 제거
    return cleaned.split(',').map(s => s.trim()).filter(str => str.length > 0);
  }
  return []; // 없거나 이상하면 빈 배열 반환 (에러 방지)
};

export default function BookStudyDetail({ logs = [], onBack, onUpdateBook, onImageAnalysis, isDarkMode }) {
  const [selectedSession, setSelectedSession] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null); 
  const [hoveredSession, setHoveredSession] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const cardBase = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // ─────────────────────────────────────────────
  // 데이터 가공 (useMemo)
  // ─────────────────────────────────────────────
  const sessions = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    const groups = {};
    logs.forEach(log => {
      const key = log.sourceFile || 'unknown';
      if (!groups[key]) {
        groups[key] = { id: key, sourceFile: key, logs: [] };
      }
      groups[key].logs.push(log);
    });

    return Object.values(groups).map(group => {
      const sorted = group.logs.sort((a, b) => {
        const timeA = extractTime(a.time || a.timestamp);
        const timeB = extractTime(b.time || b.timestamp);
        return timeA.localeCompare(timeB);
      });

      const firstLog = sorted[0];
      const lastLog = sorted[sorted.length - 1];
      const startTime = extractTime(firstLog.time || firstLog.timestamp);
      const endTime = extractTime(lastLog.time || lastLog.timestamp);
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      
      const totalDuration = sorted.reduce((sum, log) => sum + (log.durationMin || 0), 0);
      const durationMin = totalDuration > 0 ? totalDuration : Math.max(endMin - startMin, 0.1); 
      const representativeLog = sorted.find(log => log.bookTitle) || sorted[0];

      // [핵심 수정 적용] 저자 데이터 안전하게 변환
      const safeAuthors = safeParseAuthors(representativeLog.bookAuthors);

      return {
        id: group.id,
        logs: sorted,
        startTime,
        endTime,
        durationMin: parseFloat(durationMin.toFixed(1)),
        logCount: sorted.length,
        isStudy: (representativeLog.purpose || 'study') === 'study',
        displayTime: `${startTime}~${endTime}`,
        bookInfo: {
          bookId: representativeLog.bookId || null,
          bookTitle: representativeLog.bookTitle || '',
          bookAuthors: safeAuthors, // 무조건 배열로 들어감 -> Modal 에러 해결
          bookThumbnail: representativeLog.bookThumbnail || '',
          totalPages: representativeLog.totalPages || 0,
          readPages: representativeLog.readPages || 0,
          progress: representativeLog.progress || 0,
          purpose: representativeLog.purpose || 'study',
          description: representativeLog.description || ''
        }
      };
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [logs]);

  const totalMinutes = parseFloat(sessions.reduce((sum, s) => sum + s.durationMin, 0).toFixed(1));

  const timelineData = useMemo(() => {
    return sessions.map((session, idx) => {
      const startMin = parseTimeToMinutes(session.startTime);
      const endMin = parseTimeToMinutes(session.endTime);
      return {
        id: session.id,
        name: session.bookInfo.bookTitle || `독서 ${idx + 1}`,
        start: startMin,
        end: endMin, 
        duration: session.durationMin,
        startTime: session.startTime,
        endTime: session.endTime,
        isStudy: session.isStudy,
        session
      };
    });
  }, [sessions]);

  // ─────────────────────────────────────────────
  // 이벤트 핸들러
  // ─────────────────────────────────────────────
  
  const handleBarMouseEnter = (item) => {
    if (hoveredSession?.id !== item.id) {
        setHoveredSession({ ...item.session, ...item });
    }
  };

  const handleContainerMouseLeave = () => {
    setHoveredSession(null);
  };

  const handleEditClick = useCallback((session) => {
    const info = session.bookInfo ? session.bookInfo : session;
    const sId = session.id || session.sessionId;
    const dur = session.durationMin;

    // safe parse authors
    const safeInfo = {
      ...session.bookInfo,
      bookAuthors: safeParseAuthors(session.bookInfo.bookAuthors),
      sessionId: session.id,
      durationMin: session.durationMin,

      // 🔥🔥 가장 중요! 서버 전송에 필요한 logs를 포함시킴
      logs: session.logs
    };

    setSelectedSession(safeInfo);
    setIsModalOpen(true);
  }, []);

const handleSave = (updatedInfo) => {
  if (onUpdateBook && selectedSession) {

    const firstLog = selectedSession.logs[0];  // logs에서 대표 로그 추출

    onUpdateBook(firstLog, updatedInfo);
  }
  setIsModalOpen(false);
};



  const handleAIAnalyze = (e, log) => {
    e.stopPropagation();
    if (onImageAnalysis && !log.isAnalyzing) {
        const fileName = log.imageFile || (log.imageUrl ? log.imageUrl.split('/').pop() : null);
        if (fileName) onImageAnalysis(log.id, fileName);
    }
  };

  const handleImageClick = (imageUrl) => {
    setExpandedImage(imageUrl);
  };

  const toggleSessionExpand = (sessionId) => {
    setExpandedSessionId(prev => prev === sessionId ? null : sessionId);
  };

  // 하단 리스트 메모이제이션
  const renderedSessionList = useMemo(() => (
    <div className="space-y-4">
      {sessions.map((session, idx) => (
        <div key={idx} className={`rounded-3xl border shadow-sm overflow-hidden ${cardBase}`}>
          <div 
            className={`p-6 flex justify-between items-start cursor-pointer transition ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}
            onClick={() => toggleSessionExpand(session.id)}
          >
            <div className="flex gap-4">
              <div className={`w-16 h-20 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                {session.bookInfo.bookThumbnail ? (
                  <img src={session.bookInfo.bookThumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Book size={24} className="text-slate-400" />
                )}
              </div>
              <div>
                <h3 className={`text-lg font-bold ${textPrimary}`}>{session.bookInfo.bookTitle || "책 정보 미입력"}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${session.bookInfo.purpose === 'study' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {session.bookInfo.purpose === 'study' ? '📚 교육용' : '📖 취미'}
                  </span>
                  <span className={`text-sm flex items-center gap-1 ${textSecondary}`}>
                    <User size={12}/>
                    {/* 여기도 안전하게 .join 사용 */}
                    {session.bookInfo.bookAuthors.join(', ')}
                  </span>
                </div>
                {session.bookInfo.totalPages > 0 && (
                  <div className="mt-3">
                    <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((session.bookInfo.readPages / session.bookInfo.totalPages) * 100, 100)}%` }}/>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 text-right">{session.bookInfo.readPages} / {session.bookInfo.totalPages} p</p>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                 <span className={`text-2xl font-bold font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{session.startTime}</span>
                 {expandedSessionId === session.id ? <ChevronUp size={20} className={textSecondary}/> : <ChevronDown size={20} className={textSecondary}/>}
              </div>
              <div className={`text-sm font-bold flex items-center gap-1 ${textSecondary}`}>
                <Clock size={14} />{session.durationMin}분
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleEditClick(session); }}
                className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition border flex items-center gap-1 z-10 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Edit2 size={12} /> 정보 수정
              </button>
            </div>
          </div>
          {expandedSessionId === session.id && (
            <div className={`border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <table className="w-full text-left text-sm">
                <thead className={`text-xs uppercase border-b ${isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                  <tr>
                    <th className="p-3 pl-6">Time</th><th className="p-3">Action</th><th className="p-3">Image</th><th className="p-3 text-center">AI Check</th><th className="p-3 text-right pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {session.logs.map((log) => (
                    <tr key={log.id} className={`transition ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                      <td className={`p-3 pl-6 font-mono text-xs ${textSecondary}`}>{extractTime(log.time || log.timestamp)}</td>
                      <td className={`p-3 text-xs ${textPrimary}`}>{log.action || 'Reading'}</td>
                      <td className="p-3">
                        {log.imageUrl ? (
                          <div className={`w-16 h-10 rounded overflow-hidden border cursor-pointer hover:opacity-80 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`} onClick={() => handleImageClick(log.imageUrl)}>
                            <img src={log.imageUrl} alt="log" className="w-full h-full object-contain bg-black/5" />
                          </div>
                        ) : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="p-3 text-center">
                        {log.imageUrl ? (
                            log.aiResult && log.aiResult !== "Not Analyzed" ? (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${log.aiResult.toLowerCase().includes('study') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{log.aiResult}</span>
                            ) : (
                                <button onClick={(e) => handleAIAnalyze(e, log)} disabled={log.isAnalyzing} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold hover:bg-indigo-100 transition disabled:opacity-50">
                                    {log.isAnalyzing ? <Loader size={10} className="animate-spin"/> : <Sparkles size={10}/>} 분석
                                </button>
                            )
                        ) : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="p-3 text-right pr-6"><span className="text-xs text-slate-400">Recorded</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  ), [sessions, expandedSessionId, isDarkMode, cardBase, textPrimary, textSecondary, handleEditClick]); 

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* 1. Header */}
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

      {/* 2. Summary + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase} flex flex-col justify-center`}>
          <h2 className={`text-lg font-bold mb-6 flex items-center gap-2 ${textPrimary}`}>
            <Clock size={20} className="text-blue-500" />
            오늘의 독서 요약
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <p className={`text-sm ${textSecondary}`}>총 독서 시간</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {formatMinutesToTime(totalMinutes)}
              </p>
            </div>
            <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
              <p className={`text-sm ${textSecondary}`}>활동 수</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{sessions.length}개</p>
            </div>
          </div>
        </div>

        {/* 타임라인 카드 */}
        <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
            <TrendingUp size={18} className="text-blue-500" />
            오늘의 독서 타임라인
          </h2>
          {timelineData.length > 0 ? (
            <div className="space-y-3 select-none">
              <div 
                className="relative"
                onMouseLeave={handleContainerMouseLeave}
              >
                {/* 배경 트랙 */}
                <div className={`h-12 rounded-lg ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'} relative`}>
                  {[6, 12, 18].map(hour => (
                    <div key={hour} className={`absolute top-0 bottom-0 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`} style={{ left: `${(hour / 24) * 100}%` }} />
                  ))}
                  
                  {/* 세션 바 */}
                  {timelineData.map((item, idx) => {
                    const leftPercent = (item.start / 1440) * 100;
                    const widthPercent = Math.max(((item.end - item.start) / 1440) * 100, 0.5);
                    const isHovered = hoveredSession?.id === item.session?.id;
                    const isStudy = item.isStudy;
                    
                    let bgClass = isStudy
                        ? (isHovered ? 'bg-gradient-to-r from-blue-400 to-blue-300 scale-y-125' : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:scale-y-110')
                        : (isHovered ? 'bg-gradient-to-r from-purple-400 to-purple-300 scale-y-125' : 'bg-gradient-to-r from-purple-500 to-purple-400 hover:scale-y-110');

                    return (
                      <div key={item.id || idx}
                        className={`absolute top-2 bottom-2 rounded-md cursor-pointer transition-all shadow-sm ${bgClass}`}
                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '6px' }}
                        onClick={() => handleEditClick(item.session)}
                        onMouseEnter={() => handleBarMouseEnter(item)}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 px-0.5">
                  {[0, 6, 12, 18, 24].map(hour => (<span key={hour} className={`text-[10px] ${textSecondary}`}>{hour === 24 ? '24시' : `${hour}시`}</span>))}
                </div>
              </div>

              {/* 하단 상세 카드 */}
              {hoveredSession && (
                <div className={`mt-3 p-4 rounded-2xl border-2 transition-all animate-fade-in ${
                    hoveredSession.isStudy ? (isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200') : (isDarkMode ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200')
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${hoveredSession.isStudy ? (isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100') : (isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100')}`}>
                      <BookOpen size={20} className={hoveredSession.isStudy ? 'text-blue-500' : 'text-purple-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${textPrimary}`}>{hoveredSession.name}</p>
                      <p className={`text-sm ${textSecondary}`}>{hoveredSession.isStudy ? '📚 교육용 독서' : '📖 일반 독서'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${hoveredSession.isStudy ? (isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600')}`}>
                        <Clock size={14} /> <span>{hoveredSession.startTime}</span> <span className="opacity-50">→</span> <span>{hoveredSession.endTime}</span>
                      </div>
                      <p className={`text-lg font-bold mt-1 ${hoveredSession.isStudy ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : (isDarkMode ? 'text-purple-400' : 'text-purple-600')}`}>
                          {hoveredSession.duration.toFixed(1)}분
                      </p>
                    </div>
                    <button onClick={() => handleEditClick(hoveredSession.session || hoveredSession)} className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">수정하기</button>
                  </div>
                </div>
              )}
            </div>
          ) : <div className={`text-center py-8 text-sm ${textSecondary}`}>데이터 없음</div>}
        </div>
      </div>

      {renderedSessionList}

      <BookModal
        isOpen={isModalOpen}
        log={selectedSession} 
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        isDarkMode={isDarkMode}
        onAnalyzeImage={(log) => log.bookId ? handleAIAnalyze({ stopPropagation: ()=>{} }, log) : null} 
      />

      {expandedImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/0 p-4 animate-fade-in" onClick={() => setExpandedImage(null)}>
          <button className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/70 transition backdrop-blur-sm" onClick={() => setExpandedImage(null)}><X size={24}/></button>
          <img src={expandedImage} alt="Expanded" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}