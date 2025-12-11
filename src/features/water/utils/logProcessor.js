// src/features/water/utils/logProcessor.js
// ============================================================
// Water Log 데이터 처리 유틸리티 (수정됨)
// ============================================================

export const formatWaterLogs = (rawLogs) => {
  if (!Array.isArray(rawLogs)) return [];

  return rawLogs.map((log, index) => {
    // id가 없으면 인덱스 기반으로 생성
    const id = log.id !== undefined ? log.id : `log-${index}-${Date.now()}`;
    
    // 시간 포맷팅 (HH:MM)
    let time = log.time || "00:00";
    if (log.timestamp) {
      const parts = log.timestamp.split(' ');
      if (parts.length > 1) {
        time = parts[1].substring(0, 5);
      } else if (log.timestamp.includes('T')) {
        time = log.timestamp.split('T')[1].substring(0, 5);
      }
    }

    return {
      id: id,
      timestamp: log.timestamp || "",
      time: time,
      amount: parseInt(log.amount || log.waterMl || 0, 10),
      
      // [핵심] 기존 속성 매핑
      aiResult: log.aiResult || log.ai_result || "",
      imageUrl: log.imageUrl || log.image_url || "",
      
      // [수정] userLabel (사용자 수정값)을 명시적으로 추가!
      // log.userLabel: 프론트엔드 상태값
      // log.manual_label: 백엔드 DB값
      userLabel: log.userLabel || log.manual_label || "", 
      
      isDrink: log.isDrink || false,
      
      ...log // 나머지 속성 유지
    };
  }).sort((a, b) => a.time.localeCompare(b.time));
};

// ... (calculateLogStats, updateLogEntry는 기존 코드 그대로 유지) ...
export const calculateLogStats = (logs) => {
  const waterMl = logs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const drinkCount = logs.filter(log => (log.amount || 0) > 0).length;
  return { waterMl, drinkCount };
};

export const updateLogEntry = (logs, logId, updates) => {
  return logs.map(log => {
    if (log.id === logId) {
      return { ...log, ...updates };
    }
    return log;
  });
};