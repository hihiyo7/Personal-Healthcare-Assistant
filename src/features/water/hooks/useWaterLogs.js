// src/hooks/useWaterLogs.js
// 물 마시기 로그 관리 커스텀 훅
// - AI Summary는 버튼 클릭 시에만 호출

import { useState, useEffect, useCallback } from 'react';
import { fetchWaterLogs, analyzeDrinkImage, generateAISummary } from '../../../shared/services/apiService';
import { formatWaterLogs, calculateLogStats, updateLogEntry } from '../utils/logProcessor';

export const useWaterLogs = (currentDate, currentUser, onHistoryUpdate, studySummary, bookLogs = [], laptopLogs = []) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ waterMl: 0, studyMin: 0, calories: 0 });
  const [drinkCount, setDrinkCount] = useState(0);
  const [aiSummary, setAiSummary] = useState(null);  // 초기값 null (버튼 클릭 전)
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // ─────────────────────────────────────────────
  // AI Summary 생성 (버튼 클릭 시에만 호출)
  // ─────────────────────────────────────────────
  const fetchAISummary = useCallback(async () => {
    // 중복 요청 방지
    if (aiLoading) return;
    
    try {
      setAiLoading(true);
      setAiSummary("AI가 오늘 하루를 정리 중이에요…");
      
      
      // 책 정보 추출 (가장 최근 또는 가장 많이 읽은 책)
      let bookInfo = null;
      if (bookLogs && bookLogs.length > 0) {
        // sourceFile별 그룹핑하여 첫 번째 세션 정보 사용
        const groups = {};
        bookLogs.forEach(log => {
          const key = log.sourceFile || 'unknown';
          if (!groups[key]) groups[key] = { logs: [], bookTitle: log.bookTitle };
          groups[key].logs.push(log);
          // 책 정보가 있으면 업데이트
          if (log.bookTitle) {
            groups[key].bookTitle = log.bookTitle;
            groups[key].bookAuthors = log.bookAuthors;
            groups[key].totalPages = log.totalPages;
            groups[key].readPages = log.readPages;
            groups[key].description = log.description;
            groups[key].purpose = log.purpose;
          }
        });
        
        // 가장 정보가 많은 세션 선택
        const sessionWithInfo = Object.values(groups).find(g => g.bookTitle) || Object.values(groups)[0];
        if (sessionWithInfo) {
          // 세션 duration 계산
          const sorted = sessionWithInfo.logs.sort((a, b) => {
            const timeA = a.timestamp || a.time || '';
            const timeB = b.timestamp || b.time || '';
            return timeA.localeCompare(timeB);
          });
          const extractMin = (ts) => {
            if (!ts) return 0;
            let t = ts;
            if (ts.includes('T')) t = ts.split('T')[1]?.slice(0, 5) || '00:00';
            else if (ts.includes(' ')) t = ts.split(' ')[1]?.slice(0, 5) || '00:00';
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          const startMin = extractMin(sorted[0]?.timestamp || sorted[0]?.time);
          const endMin = extractMin(sorted[sorted.length - 1]?.timestamp || sorted[sorted.length - 1]?.time);
          const durationMin = Math.max(endMin - startMin, 1);
          
          bookInfo = {
            title: sessionWithInfo.bookTitle || '',
            authors: sessionWithInfo.bookAuthors || [],
            readPages: sessionWithInfo.readPages || 0,
            totalPages: sessionWithInfo.totalPages || 0,
            durationMin: durationMin,
            description: sessionWithInfo.description || '',
            purpose: sessionWithInfo.purpose || 'study'
          };
        }
      }
      
      // 노트북 정보 추출
      let laptopInfo = null;
      if (laptopLogs && laptopLogs.length > 0) {
        // 첫 번째 세션의 카테고리와 전체 시간
        const firstLog = laptopLogs[0];
        laptopInfo = {
          category: firstLog.category || 'lecture',
          durationMin: studySummary?.totalLaptopStudyMin || 0,
          isStudy: firstLog.isStudy !== false
        };
      }
      
      const summaryData = {
        date: currentDate,
        waterMl: stats.waterMl,
        waterGoal: currentUser?.goals?.water || 2000,
        studyMin: studySummary?.totalStudyMin || 0,
        studyGoal: currentUser?.goals?.study || 300,
        bookInfo,
        laptopInfo
      };

      const summary = await generateAISummary(summaryData);
      
      if (summary) {
        setAiSummary(summary);
      } else {
        setAiSummary("오늘은 물과 공부 기록을 천천히 쌓아가는 하루였어요.");
      }
    } catch (error) {
      console.error("AI Summary error:", error);
      setAiSummary("요약 생성에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setAiLoading(false);
    }
  }, [currentDate, currentUser, stats.waterMl, studySummary, aiLoading, bookLogs, laptopLogs]);

  // ─────────────────────────────────────────────
  // 날짜 변경 시 상태 초기화
  // ─────────────────────────────────────────────
  useEffect(() => {
    // 날짜가 변경되면 이전 날짜의 상태를 명시적으로 초기화
    setLogs([]);
    setStats({ waterMl: 0, studyMin: 0, calories: 0 });
    setDrinkCount(0);
    setAiSummary(null);
    setLoading(false);
    setAiLoading(false);
  }, [currentDate]);

  // ─────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setAiSummary(null);  // 날짜 변경 시 AI Summary 초기화
      
      const rawLogs = await fetchWaterLogs(currentDate);
      console.log('[useWaterLogs] Raw logs from server:', rawLogs);
      
      const formatted = formatWaterLogs(rawLogs);
      console.log('[useWaterLogs] Formatted logs:', formatted);
      
      setLogs(formatted);

      const { waterMl, drinkCount: drinks } = calculateLogStats(formatted);
      console.log('[useWaterLogs] Stats calculated:', { waterMl, drinks });
      setStats({ waterMl, studyMin: 0, calories: 0 });
      setDrinkCount(drinks);

      // 히스토리 업데이트 - 실제 CSV 데이터가 있는 경우에만
      // water CSV가 존재하거나 study logs가 있을 때만 히스토리에 기록
      const studyMinutes = studySummary?.totalStudyMin || 0;
      const hasWaterData = formatted.length > 0;
      const hasStudyData = (bookLogs && bookLogs.length > 0) || (laptopLogs && laptopLogs.length > 0);
      
      // ✅ Update history if EITHER water OR study data exists (safe props, no infinite loop)
      if (onHistoryUpdate && (hasWaterData || hasStudyData)) {
        onHistoryUpdate(currentDate, waterMl, drinks, studyMinutes);
      }
      
      // ❌ AI Summary 자동 호출 제거됨
      // fetchAISummary는 버튼 클릭 시에만 호출
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, currentUser, onHistoryUpdate]);

  // 날짜 변경 시 자동 로드 (AI Summary 제외)
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 이미지 분석
  const handleImageAnalysis = async (logId, imageFile) => {
    if (!imageFile) {
      alert("분석할 이미지가 없습니다.");
      return;
    }

    setLogs(prev =>
      prev.map(l => l.id === logId ? { ...l, aiResult: "Analyzing..." } : l)
    );

    try {
      const response = await analyzeDrinkImage(logId, imageFile);
      const resultText = response.result;

      setLogs(prev => {
        const updated = prev.map(l => {
          if (l.id === logId) {
            const isDrinkDetected =
              resultText.toLowerCase().includes("cola") ||
              resultText.toLowerCase().includes("coffee") ||
              resultText.toLowerCase().includes("juice") ||
              resultText.toLowerCase().includes("drink");

            return {
              ...l,
              aiResult: resultText,
              analyzed: true,
              isDrink: isDrinkDetected
            };
          }
          return l;
        });

        const { waterMl, drinkCount: drinks } = calculateLogStats(updated);
        setStats({ waterMl, studyMin: 0, calories: 0 });
        setDrinkCount(drinks);

        return updated;
      });
    } catch (err) {
      console.error(err);
      alert("이미지 분석 중 오류 발생");
    }
  };

  const handleManualLogUpdate = (logId, newTime, newAmount, newAiResult) => {
    const updatedLogs = updateLogEntry(logs, logId, {
      time: newTime,
      amount: newAmount,
      aiResult: newAiResult
    });
    
    setLogs(updatedLogs);

    const { waterMl, drinkCount: drinks } = calculateLogStats(updatedLogs);
    setStats({ waterMl, studyMin: 0, calories: 0 });
    setDrinkCount(drinks);
  };

  const clearLogs = () => {
    setLogs([]);
    setStats({ waterMl: 0, studyMin: 0, calories: 0 });
    setDrinkCount(0);
    setAiSummary(null);
  };

  return {
    logs,
    stats,
    drinkCount,
    aiSummary,
    aiLoading,
    loading,
    loadLogs,
    fetchAISummary,  // ✅ 버튼에서 호출할 함수
    handleImageAnalysis,
    handleManualLogUpdate,
    clearLogs
  };
};

export default useWaterLogs;