// src/features/study/hooks/useStudyLogs.js
// ============================================================
// Study 로그 관리 커스텀 훅 (서버 연동 + LocalStorage 지속성)
// 수정: 날짜 변경 직후 Stale Data(이전 데이터)가 계산되는 현상 차단
// ============================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { fetchStudyLogs as fetchStudyLogsAPI } from '../../../shared/services/apiService';
import { 
  processBookLog, 
  processLaptopLog, 
  updateBookLogWithInfo, 
  updateBookLogPages, 
  updateLaptopLogCategory, 
  filterLogsByDate
} from '../utils/processStudyLog';
import { isStudyCategory } from '../utils/studyCalculator';

export const useStudyLogs = (currentDate, onLogsLoaded) => {
  // ─────────────────────────────────────────────
  // 상태
  // ─────────────────────────────────────────────
  const [studyLogs, setStudyLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [serverTotalBookMin, setServerTotalBookMin] = useState(0);
  const [serverTotalLaptopMin, setServerTotalLaptopMin] = useState(0);
  const [serverSessions, setServerSessions] = useState([]);

  // ✅ 현재 보고 있는 날짜를 추적하기 위한 Ref (비동기 방어 및 Stale Data 방지용)
  const currentDateRef = useRef(currentDate);

  // LocalStorage Key (날짜별 저장)
  const getStorageKey = (date) => `studyLogs_${date}`;

  // ─────────────────────────────────────────────
  // 로그 로드 (Server + LocalStorage Merge)
  // ─────────────────────────────────────────────
  const loadStudyLogs = useCallback(async (fetchDate) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[useStudyLogs] Loading logs for: ${fetchDate}`);
      
      const serverResponse = await fetchStudyLogsAPI(fetchDate);

      // 비동기 응답 후, 사용자가 이미 다른 날짜로 이동했다면 무시
      if (fetchDate !== currentDateRef.current) {
        console.log(`[useStudyLogs] Date changed during fetch. Ignored ${fetchDate}.`);
        return;
      }

      const { logs: serverData, totalBookMin, totalLaptopMin, sessions } = serverResponse;
      
      setServerTotalBookMin(totalBookMin || 0);
      setServerTotalLaptopMin(totalLaptopMin || 0);
      setServerSessions(sessions || []);
      
      const processedServerLogs = (serverData || []).map(row => ({
        id: row.id,
        type: row.type || 'laptop',
        timestamp: row.timestamp,
        time: row.time,
        durationMin: row.durationMin || Math.round((row.duration_sec || 0) / 60),
        durationSec: row.duration_sec,
        durationFrames: row.duration_frames,
        imageUrl: row.imageUrl,
        imageFile: row.imageFile,
        action: row.action,
        category: row.category || 'lecture',
        subject: row.subject || '',
        note: row.note || '',
        sourceFile: row.source_file || ''
      }));

      // LocalStorage 확인
      let finalLogs = processedServerLogs;
      if (processedServerLogs.length > 0) {
        const savedLogs = localStorage.getItem(getStorageKey(fetchDate));
        if (savedLogs) {
          try {
            const localLogs = JSON.parse(savedLogs);
            if (localLogs.length > 0) {
              finalLogs = processedServerLogs.map(serverLog => {
                const localLog = localLogs.find(l => l.id === serverLog.id);
                if (localLog) {
                  return {
                    ...serverLog,
                    category: localLog.category || serverLog.category,
                    subject: localLog.subject || serverLog.subject,
                    note: localLog.note || serverLog.note,
                    bookId: localLog.bookId || serverLog.bookId,
                    bookTitle: localLog.bookTitle || serverLog.bookTitle,
                    bookAuthors: localLog.bookAuthors || serverLog.bookAuthors,
                    bookThumbnail: localLog.bookThumbnail || serverLog.bookThumbnail,
                    totalPages: localLog.totalPages || serverLog.totalPages,
                    readPages: localLog.readPages || serverLog.readPages,
                    progress: localLog.progress || serverLog.progress,
                    description: localLog.description || serverLog.description,
                    purpose: localLog.purpose || serverLog.purpose
                  };
                }
                return serverLog;
              });
            }
          } catch (e) {
            console.error('Error parsing local logs', e);
          }
        }
      } else {
        localStorage.removeItem(getStorageKey(fetchDate));
      }
      
      setStudyLogs(finalLogs);
      
      if (onLogsLoaded) {
        onLogsLoaded(finalLogs);
      }
    } catch (err) {
      if (fetchDate !== currentDateRef.current) return;
      console.error('Study logs load error:', err);
      setError(err.message);
      setStudyLogs([]);
    } finally {
      if (fetchDate === currentDateRef.current) {
        setLoading(false);
      }
    }
  }, [onLogsLoaded]);

  useEffect(() => {
    // 날짜 변경 시 Ref 업데이트 및 상태 즉시 초기화
    currentDateRef.current = currentDate;
    
    setStudyLogs([]);
    setServerTotalBookMin(0);
    setServerTotalLaptopMin(0);

    if (currentDate) {
      loadStudyLogs(currentDate);
    }
  }, [currentDate, loadStudyLogs]);

  useEffect(() => {
    if (currentDate && studyLogs.length > 0) {
      localStorage.setItem(getStorageKey(currentDate), JSON.stringify(studyLogs));
    }
  }, [studyLogs, currentDate]);


  // ─────────────────────────────────────────────
  // Memoized Values (수정: 날짜 불일치 시 0 리턴)
  // ─────────────────────────────────────────────
  const isDateStale = currentDate !== currentDateRef.current; // 현재 렌더링 날짜 vs Ref 날짜 비교

  const bookLogs = useMemo(() => 
    studyLogs.filter(log => log.type === 'book').map(processBookLog),
    [studyLogs]
  );

  const laptopLogs = useMemo(() => 
    studyLogs.filter(log => log.type === 'laptop').map(processLaptopLog),
    [studyLogs]
  );

  const todayBookLogs = useMemo(() => filterLogsByDate(bookLogs, currentDate), [bookLogs, currentDate]);
  const todayLaptopLogs = useMemo(() => filterLogsByDate(laptopLogs, currentDate), [laptopLogs, currentDate]);

  // 카테고리별 시간 계산
  const { totalLaptopStudyMin, totalLaptopNonStudyMin } = useMemo(() => {
    // ✅ [핵심 수정] 렌더링 중인 날짜(currentDate)가 아직 Ref에 반영되지 않았다면(useEffect 실행 전)
    // 데이터는 이전 날짜의 것이므로 계산 결과를 0으로 강제합니다.
    if (currentDate !== currentDateRef.current) {
      return { totalLaptopStudyMin: 0, totalLaptopNonStudyMin: 0 };
    }

    const groups = {};
    laptopLogs.forEach(log => {
      const key = log.sourceFile || 'unknown';
      if (!groups[key]) {
        groups[key] = { logs: [], category: log.category || 'lecture' };
      }
      groups[key].logs.push(log);
      groups[key].category = log.category || 'lecture';
    });

    let studyMin = 0;
    let nonStudyMin = 0;

    Object.values(groups).forEach(group => {
      const sorted = group.logs.sort((a, b) => {
        const timeA = a.timestamp || a.time || '';
        const timeB = b.timestamp || b.time || '';
        return timeA.localeCompare(timeB);
      });

      if (sorted.length === 0) return;

      const firstTime = sorted[0].timestamp || sorted[0].time || '';
      const lastTime = sorted[sorted.length - 1].timestamp || sorted[sorted.length - 1].time || '';
      
      const extractMinutes = (ts) => {
        if (!ts) return 0;
        let timeStr = ts;
        if (ts.includes('T')) timeStr = ts.split('T')[1]?.slice(0, 5) || '';
        else if (ts.includes(' ')) timeStr = ts.split(' ')[1]?.slice(0, 5) || '';
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const startMin = extractMinutes(firstTime);
      const endMin = extractMinutes(lastTime);
      const duration = Math.max(endMin - startMin, 1);

      if (isStudyCategory(group.category)) {
        studyMin += duration;
      } else {
        nonStudyMin += duration;
      }
    });

    return { 
      totalLaptopStudyMin: studyMin, 
      totalLaptopNonStudyMin: nonStudyMin 
    };
  }, [laptopLogs, currentDate]); // currentDate를 의존성에 포함

  // ✅ [핵심 수정] BookMin 역시 날짜가 안 맞으면 0 처리
  const totalBookMin = (currentDate !== currentDateRef.current) ? 0 : serverTotalBookMin;
  const totalStudyMin = totalBookMin + totalLaptopStudyMin;

  // ─────────────────────────────────────────────
  // Update Handlers
  // ─────────────────────────────────────────────
  const updateBookWithInfo = useCallback((logId, bookInfo) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') return updateBookLogWithInfo(log, bookInfo);
      return log;
    }));
  }, []);

  const updateBookPages = useCallback((logId, readPages) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') return updateBookLogPages(log, readPages);
      return log;
    }));
  }, []);

  const updateBookLog = useCallback((logId, updates) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') return { ...log, ...updates };
      return log;
    }));
  }, []);

  const updateLaptopLog = useCallback((logId, updates) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'laptop') return updateLaptopLogCategory(log, updates);
      return log;
    }));
  }, []);

  // CSV 데이터 존재 여부 (Stale 상태면 false 처리)
  const hasServerData = (currentDate === currentDateRef.current) && studyLogs.length > 0;

  return {
    studyLogs,
    bookLogs,
    laptopLogs,
    todayBookLogs,
    todayLaptopLogs,
    loading,
    error,
    
    totalBookMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    totalStudyMin,
    
    sessions: serverSessions,
    hasServerData,
    
    loadStudyLogs,
    updateBookWithInfo,
    updateBookPages,
    updateBookLog,
    updateLaptopLog
  };
};

export default useStudyLogs;