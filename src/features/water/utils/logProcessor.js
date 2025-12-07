// src/features/water/utils/logProcessor.js
// ============================================================
// Water Log 데이터 처리 유틸리티
// ============================================================

/**
 * 서버/CSV에서 가져온 로우 로그 데이터를 포맷팅
 * @param {Array} rawLogs - 서버에서 받은 원본 로그 배열
 * @returns {Array} 포맷팅된 로그 배열
 */
export const formatWaterLogs = (rawLogs) => {
  if (!Array.isArray(rawLogs)) return [];

  return rawLogs.map((log, index) => {
    // id가 없으면 인덱스 기반으로 생성 (임시)
    const id = log.id || `log-${index}-${Date.now()}`;
    
    // 시간 포맷팅 (HH:MM)
    let time = log.time || "00:00";
    if (log.timestamp) {
      // timestamp가 "YYYY-MM-DD HH:MM:SS" 또는 "HH:MM" 형식이면 추출
      const parts = log.timestamp.split(' ');
      if (parts.length > 1) {
        time = parts[1].substring(0, 5);
      } else if (log.timestamp.includes(':')) {
        time = log.timestamp.substring(0, 5);
      }
    }

    return {
      id: id,
      timestamp: log.timestamp || "",
      time: time,
      amount: parseInt(log.amount || log.waterMl || 0, 10),
      aiResult: log.aiResult || log.ai_result || "",
      imageUrl: log.imageUrl || log.image_url || "",
      isDrink: log.isDrink || false, // 음료 여부 (AI 분석 결과 등)
      ...log // 나머지 속성 유지
    };
  }).sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * 로그 통계 계산 (총 섭취량, 횟수)
 * @param {Array} logs - 포맷팅된 로그 배열
 * @returns {Object} { waterMl, drinkCount }
 */
export const calculateLogStats = (logs) => {
  const waterMl = logs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const drinkCount = logs.filter(log => (log.amount || 0) > 0).length;
  return { waterMl, drinkCount };
};

/**
 * 로그 엔트리 업데이트 (불변성 유지)
 * @param {Array} logs - 기존 로그 배열
 * @param {string|number} logId - 수정할 로그 ID
 * @param {Object} updates - 수정할 필드들
 * @returns {Array} 업데이트된 새 로그 배열
 */
export const updateLogEntry = (logs, logId, updates) => {
  return logs.map(log => {
    if (log.id === logId) {
      return { ...log, ...updates };
    }
    return log;
  });
};



