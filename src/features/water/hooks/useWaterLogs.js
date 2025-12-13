// src/features/water/hooks/useWaterLogs.js
// 물 섭취 로그 로딩 + 통계 + AI 요약 훅

import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateLogStats } from '../utils/logProcessor';

const API_BASE_URL = 'http://localhost:8000';

// onHistoryUpdate는 더 이상 사용하지 않고,
// App 레벨에서 stats/studySummary를 기반으로 history를 갱신함
export const useWaterLogs = (currentDate, currentUser, _unusedOnHistoryUpdate, studySummary) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ waterMl: 0, studyMin: 0, calories: 0 });
  // stats가 어떤 날짜 기준인지 함께 보관해서, App에서 잘못된 날짜로 history를 업데이트하지 않도록 함
  const [statsDate, setStatsDate] = useState(null);

  const [drinkCount, setDrinkCount] = useState(0);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentDateRef = useRef(currentDate);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // 타임스탬프에서 HH:MM 추출
  const extractTimeFromTimestamp = (ts) => {
    if (!ts) return '00:00';
    try {
      if (ts.includes('T')) {
        return ts.split('T')[1].substring(0, 5);
      }
      if (ts.includes(' ')) {
        const parts = ts.split(' ');
        if (parts.length > 1) return parts[1].substring(0, 5);
      }
      if (ts.includes(':')) {
        return ts.substring(0, 5);
      }
      return '00:00';
    } catch {
      return '00:00';
    }
  };

  const extractFilename = (pathOrUrl) => {
    if (!pathOrUrl) return null;
    const cleanPath = pathOrUrl.replace(/\\/g, '/');
    return cleanPath.split('/').pop();
  };

  // 1. 서버에서 물 로그 로드
  const loadLogs = useCallback(async () => {
    if (!currentUserRef.current) return;
    const fetchDate = currentDate;

    try {
      setLoading(true);
      setAiSummary(null);

      const response = await fetch(`${API_BASE_URL}/api/logs/water/${fetchDate}`);
      if (!response.ok) throw new Error('서버 응답 오류');

      const rawData = await response.json();

      // 날짜가 바뀐 뒤 도착한 응답이면 버린다
      if (fetchDate !== currentDateRef.current) return;

      const formatted = rawData.map((item) => {
        const displayTime = item.time
          ? item.time.substring(0, 5)
          : extractTimeFromTimestamp(item.timestamp);

        const imgUrl = item.imageUrl || item.capture_path || null;
        const fName = extractFilename(imgUrl);

        return {
          id: item.id,
          time: displayTime,
          amount: parseInt(item.amount, 10) || 200,
          imageUrl: imgUrl,
          imageFile: fName,
          aiResult: item.ai_result === 'Not Analyzed' ? '' : item.ai_result,
          userLabel: item.manual_label || '',
          isAnalyzing: false,
          analyzed: item.ai_result !== 'Not Analyzed',
        };
      });

      setLogs(formatted);

      const { waterMl, drinkCount: drinks } = calculateLogStats(formatted);
      setStats({ waterMl, studyMin: 0, calories: 0 });
      setStatsDate(fetchDate);
      setDrinkCount(drinks);
    } catch (err) {
      if (fetchDate !== currentDateRef.current) return;
      console.error(err);
    } finally {
      if (fetchDate === currentDateRef.current) setLoading(false);
    }
  }, [currentDate, studySummary]);

  useEffect(() => {
    currentDateRef.current = currentDate;
    loadLogs();
  }, [currentDate, loadLogs]);

  // 2. 개별 이미지 AI 분석
  const handleImageAnalysis = async (logId, imageFile) => {
    let targetFilename = imageFile;
    if (!targetFilename) {
      const log = logs.find((l) => l.id === logId);
      if (log) {
        targetFilename = log.imageFile || extractFilename(log.imageUrl);
      }
    }

    if (!targetFilename) {
      alert(`분석할 이미지 파일을 찾을 수 없습니다. (ID: ${logId})`);
      return;
    }

    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, isAnalyzing: true } : l)),
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_filename: targetFilename,
          log_id: logId,
        }),
      });

      const data = await response.json();
      const resultText = data.result || '';

      setLogs((prev) => {
        const updated = prev.map((l) => {
          if (l.id === logId) {
            const isDrinkDetected = !resultText.toLowerCase().includes('water');
            const autoResult = isDrinkDetected ? 'Drink Detected' : 'Water Verified';
            return {
              ...l,
              aiResult: autoResult,
              isAnalyzing: false,
              analyzed: true,
            };
          }
          return l;
        });

        const { waterMl, drinkCount: drinks } = calculateLogStats(updated);
        setStats((prevStats) => ({ ...prevStats, waterMl }));
        setDrinkCount(drinks);

        return updated;
      });
    } catch (err) {
      console.error(err);
      alert('AI 분석 요청 중 오류가 발생했습니다.');
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, isAnalyzing: false } : l)),
      );
    }
  };

  // 3. 수동 로그 수정
  const handleManualLogUpdate = (logId, newTime, newAmount, newAiResult, newUserLabel) => {
    setLogs((prevLogs) => {
      const updatedLogs = prevLogs.map((log) => {
        if (log.id === logId) {
          return {
            ...log,
            time: newTime,
            amount: parseInt(newAmount, 10) || 0,
            aiResult: newAiResult,
            userLabel: newUserLabel,
          };
        }
        return log;
      });

      const { waterMl, drinkCount: drinks } = calculateLogStats(updatedLogs);
      setStats((prevStats) => ({ ...prevStats, waterMl }));
      setDrinkCount(drinks);

      return updatedLogs;
    });
  };

  // 4. AI Daily Summary
  const fetchAISummary = useCallback(async () => {
    if (aiLoading) return;
    try {
      setAiLoading(true);
      setAiSummary('AI가 오늘 기록을 정리하는 중입니다...');

      const summaryData = {
        date: currentDate,
        waterMl: stats.waterMl,
        waterGoal: currentUser?.goals?.water || 2000,
        studyMin: studySummary?.totalStudyMin || 0,
        studyGoal: currentUser?.goals?.study || 300,
        bookInfo:
          studySummary?.bookLogs?.length > 0
            ? {
                title: studySummary.bookLogs[0].bookTitle,
                authors: studySummary.bookLogs[0].bookAuthors
                  ? studySummary.bookLogs[0].bookAuthors.split(',').map((a) => a.trim())
                  : [],
                readPages: studySummary.bookLogs[0].readPages,
                totalPages: studySummary.bookLogs[0].totalPages,
                durationMin: studySummary.totalBookMin,
                description: studySummary.bookLogs[0].description,
                purpose: studySummary.bookLogs[0].purpose || 'study',
              }
            : null,
        laptopInfo: null,
      };

      const response = await fetch(`${API_BASE_URL}/api/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summaryData),
      });

      const data = await response.json();
      setAiSummary(data.summary);
    } catch (error) {
      setAiSummary('AI 요약 생성에 실패했습니다.');
    } finally {
      setAiLoading(false);
    }
  }, [currentDate, currentUser, stats, studySummary, aiLoading]);

  const clearLogs = () => {
    setLogs([]);
    setStats({ waterMl: 0, studyMin: 0, calories: 0 });
    setStatsDate(null);
    setDrinkCount(0);
    setAiSummary(null);
  };

  return {
    logs,
    stats,
    statsDate,
    drinkCount,
    aiSummary,
    aiLoading,
    loading,
    loadLogs,
    fetchAISummary,
    handleImageAnalysis,
    handleManualLogUpdate,
    clearLogs,
  };
};

export default useWaterLogs;

