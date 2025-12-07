// src/hooks/useStudyLogs.js
// ============================================================
// Study 로그 관리 커스텀 훅 (서버 연동 + LocalStorage 지속성)
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
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

  // LocalStorage Key (날짜별 저장)
  const getStorageKey = (date) => `studyLogs_${date}`;

  // ─────────────────────────────────────────────
  // 로그 로드 (Server + LocalStorage Merge)
  // ─────────────────────────────────────────────
  const loadStudyLogs = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[useStudyLogs] Loading logs for:', date);
      
      // 1. 서버에서 원본 데이터 로드
      const serverResponse = await fetchStudyLogsAPI(date);
      const { logs: serverData, totalBookMin, totalLaptopMin, sessions } = serverResponse;
      
      setServerTotalBookMin(totalBookMin || 0);
      setServerTotalLaptopMin(totalLaptopMin || 0);
      setServerSessions(sessions || []);
      
      // 2. 서버 데이터 포맷팅
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

      // 3. LocalStorage 확인 (사용자 수정 사항) - 서버에 데이터가 있을 때만 적용
      let finalLogs = processedServerLogs;
      
      if (processedServerLogs.length > 0) {
        // 서버에 데이터가 있는 경우에만 LocalStorage 확인
        const savedLogs = localStorage.getItem(getStorageKey(date));
        if (savedLogs) {
          try {
            const localLogs = JSON.parse(savedLogs);
            // 로컬 데이터가 존재하고, 서버 데이터와 ID가 매칭되면 로컬 수정사항 적용
            if (localLogs.length > 0) {
              // 서버 데이터 기반으로 로컬 수정사항 병합
              finalLogs = processedServerLogs.map(serverLog => {
                const localLog = localLogs.find(l => l.id === serverLog.id);
                if (localLog) {
                  // 로컬에서 수정된 필드 모두 적용 (Laptop + Book 필드)
                  return {
                    ...serverLog,
                    // Laptop 필드
                    category: localLog.category || serverLog.category,
                    subject: localLog.subject || serverLog.subject,
                    note: localLog.note || serverLog.note,
                    // Book 필드
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
              console.log('[useStudyLogs] Merged with LocalStorage edits');
            }
          } catch (e) {
            console.error('Error parsing local logs', e);
          }
        }
      } else {
        // 서버에 데이터가 없으면 해당 날짜의 LocalStorage도 클리어
        localStorage.removeItem(getStorageKey(date));
        console.log('[useStudyLogs] No server data for', date, '- cleared LocalStorage');
      }
      
      setStudyLogs(finalLogs);
      
      if (onLogsLoaded) {
        onLogsLoaded(finalLogs);
      }
    } catch (err) {
      console.error('Study logs load error:', err);
      setError(err.message);
      setStudyLogs([]);
    } finally {
      setLoading(false);
    }
  }, [onLogsLoaded]);

  useEffect(() => {
    if (currentDate) {
      loadStudyLogs(currentDate);
    }
  }, [currentDate, loadStudyLogs]);

  // ─────────────────────────────────────────────
  // 로그 변경 시 LocalStorage 저장
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (currentDate && studyLogs.length > 0) {
      localStorage.setItem(getStorageKey(currentDate), JSON.stringify(studyLogs));
    }
  }, [studyLogs, currentDate]);


  // ─────────────────────────────────────────────
  // Memoized Values
  // ─────────────────────────────────────────────
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

  // 카테고리별 시간 계산 (사용자 수정 반영)
  // 세션 기반으로 계산 (동일 sourceFile = 하나의 세션)
  const { totalLaptopStudyMin, totalLaptopNonStudyMin } = useMemo(() => {
    // sourceFile별로 그룹핑
    const groups = {};
    laptopLogs.forEach(log => {
      const key = log.sourceFile || 'unknown';
      if (!groups[key]) {
        groups[key] = {
          logs: [],
          category: log.category || 'lecture'
        };
      }
      groups[key].logs.push(log);
      // 카테고리는 가장 최근 수정된 값 사용
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

      // 세션 시간 계산 (첫 로그 ~ 마지막 로그)
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

      // 카테고리가 study인지 확인
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
  }, [laptopLogs]);

  const totalBookMin = serverTotalBookMin;
  const totalStudyMin = totalBookMin + totalLaptopStudyMin;

  // ─────────────────────────────────────────────
  // Update Handlers
  // ─────────────────────────────────────────────
  const updateBookWithInfo = useCallback((logId, bookInfo) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') {
        return updateBookLogWithInfo(log, bookInfo);
      }
      return log;
    }));
  }, []);

  const updateBookPages = useCallback((logId, readPages) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') {
        return updateBookLogPages(log, readPages);
      }
      return log;
    }));
  }, []);

  const updateBookLog = useCallback((logId, updates) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'book') {
        return { ...log, ...updates };
      }
      return log;
    }));
  }, []);

  const updateLaptopLog = useCallback((logId, updates) => {
    setStudyLogs(prev => prev.map(log => {
      if (log.id === logId && log.type === 'laptop') {
        return updateLaptopLogCategory(log, updates);
      }
      return log;
    }));
  }, []);

  // CSV 데이터가 실제로 있는지 여부 (서버에서 로그를 받았는지)
  const hasServerData = studyLogs.length > 0;

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
    hasServerData,  // CSV 데이터 존재 여부
    
    loadStudyLogs,
    updateBookWithInfo,
    updateBookPages,
    updateBookLog,
    updateLaptopLog
  };
};

export default useStudyLogs;
