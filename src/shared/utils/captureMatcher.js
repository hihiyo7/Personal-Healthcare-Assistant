// src/hooks/useWaterLogs.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { generateAISummary } from '../../../shared/services/apiService';
import { calculateLogStats } from '../utils/logProcessor';

// 백엔드 서버 주소
const API_BASE_URL = 'http://localhost:8000';

export const useWaterLogs = (currentDate, currentUser, onHistoryUpdate, studySummary) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ waterMl: 0, studyMin: 0, calories: 0 });
  const [drinkCount, setDrinkCount] = useState(0);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const currentDateRef = useRef(currentDate);
  const currentUserRef = useRef(currentUser);

  // currentUser 업데이트
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // 1. 로그 불러오기
  const loadLogs = useCallback(async () => {
    if (!currentUserRef.current) return;
    const fetchDate = currentDate;

    try {
      setLoading(true);
      setAiSummary(null);

      // 서버 API 호출
      const response = await fetch(`${API_BASE_URL}/api/logs/water/${fetchDate}`);
      if (!response.ok) throw new Error('서버 연결 실패');

      const rawData = await response.json();

      // 요청 보낸 날짜와 현재 날짜가 다르면 무시 (비동기 꼬임 방지)
      if (fetchDate !== currentDateRef.current) return;

      // 데이터 가공
      const formatted = rawData.map(item => ({
        id: item.id,
        time: item.time || item.timestamp?.split('T')[1]?.slice(0, 5) || "00:00",
        amount: item.amount || 200,
        imageUrl: item.imageUrl || null, 
        // 이미지 파일명이 없으면 URL에서 추출 (분석 요청용)
        imageFile: item.imageFile || (item.imageUrl ? item.imageUrl.split('/').pop() : null),
        aiResult: item.ai_result === "Not Analyzed" ? "" : item.ai_result,
        userLabel: item.manual_label || "", // 초기 로드 시 DB값 (현재는 빈값일 수 있음)
        isAnalyzing: false,
        analyzed: item.ai_result !== "Not Analyzed"
      }));

      setLogs(formatted);

      // 통계 계산
      const { waterMl, drinkCount: drinks } = calculateLogStats(formatted);
      setStats({ waterMl, studyMin: 0, calories: 0 });
      setDrinkCount(drinks);

      // 대시보드 히스토리 업데이트용 콜백
      const studyMinutes = studySummary?.totalStudyMin || 0;
      if (onHistoryUpdate) {
        onHistoryUpdate(fetchDate, waterMl, drinks, studyMinutes);
      }

    } catch (err) {
      if (fetchDate !== currentDateRef.current) return;
      console.error(err);
    } finally {
      if (fetchDate === currentDateRef.current) setLoading(false);
    }
  }, [currentDate, onHistoryUpdate, studySummary]);

  // 날짜 변경 시 자동 로드
  useEffect(() => {
    currentDateRef.current = currentDate;
    loadLogs();
  }, [currentDate, loadLogs]);

  // 2. 이미지 분석 함수
  const handleImageAnalysis = async (logId, imageFile) => {
    // 파일명 확보 (인자가 없으면 logs 상태에서 찾기)
    let targetFilename = imageFile;
    if (!targetFilename) {
        const log = logs.find(l => l.id === logId);
        if (log && log.imageUrl) {
            targetFilename = log.imageUrl.split('/').pop();
        }
    }

    if (!targetFilename) {
      alert("분석할 이미지를 찾을 수 없습니다.");
      return;
    }

    // 로딩 상태 켜기
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, isAnalyzing: true } : l));

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            image_filename: targetFilename,
            log_id: logId 
        })
      });

      const data = await response.json();
      const resultText = data.result;

      setLogs(prev => {
        const updated = prev.map(l => {
          if (l.id === logId) {
            // 결과 텍스트 파싱
            const isDrinkDetected = !resultText.toLowerCase().includes("water");
            const autoResult = isDrinkDetected ? "Drink Detected" : "Water Verified";
            return {
              ...l,
              aiResult: autoResult, // AI 결과 업데이트
              isAnalyzing: false,
              analyzed: true
            };
          }
          return l;
        });
        
        // 통계 갱신
        const { waterMl, drinkCount: drinks } = calculateLogStats(updated);
        setStats(prev => ({ ...prev, waterMl }));
        setDrinkCount(drinks);

        return updated;
      });

    } catch (err) {
      console.error(err);
      alert("AI 분석 실패");
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, isAnalyzing: false } : l));
    }
  };

  // 3. 수동 수정 함수 (userLabel 저장)
  const handleManualLogUpdate = (logId, newTime, newAmount, newAiResult, newUserLabel) => {
    setLogs(prevLogs => {
        const updatedLogs = prevLogs.map(log => {
            if (log.id === logId) {
                return {
                    ...log,
                    time: newTime,
                    amount: parseInt(newAmount) || 0,
                    aiResult: newAiResult,
                    userLabel: newUserLabel // 여기가 중요: 사용자 입력값 저장
                };
            }
            return log;
        });

        // 통계 즉시 갱신
        const { waterMl, drinkCount: drinks } = calculateLogStats(updatedLogs);
        setStats(prev => ({ ...prev, waterMl }));
        setDrinkCount(drinks);
        
        return updatedLogs;
    });
  };

  // 4. AI 요약 생성
  const fetchAISummary = useCallback(async () => {
    if (aiLoading) return;
    try {
      setAiLoading(true);
      setAiSummary("AI가 오늘 하루를 정리 중이에요…");
      
      const summaryData = {
        date: currentDate,
        waterMl: stats.waterMl,
        waterGoal: currentUser?.goals?.water || 2000,
        studyMin: studySummary?.totalStudyMin || 0,
        studyGoal: currentUser?.goals?.study || 300,
        bookInfo: null, 
        laptopInfo: null,
      };

      const response = await fetch(`${API_BASE_URL}/api/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summaryData)
      });
      
      const data = await response.json();
      setAiSummary(data.summary);

    } catch (error) {
      setAiSummary("요약 생성 실패");
    } finally {
      setAiLoading(false);
    }
  }, [currentDate, currentUser, stats, studySummary, aiLoading]);

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
    fetchAISummary,
    handleImageAnalysis,
    handleManualLogUpdate,
    clearLogs
  };
};

export default useWaterLogs;