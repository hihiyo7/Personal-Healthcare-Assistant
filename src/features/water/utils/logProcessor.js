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

export const calculateLogStats = (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { waterMl: 0, drinkCount: 0 };
  }

  // 시간 기준 정렬 (HH:MM 문자열 기준)
  const sorted = [...logs].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  let totalWater = 0;
  let drinkCount = 0;

  let currentGroupAmount = 0;
  let lastTimeMin = null;

  const toMinutes = (t) => {
    if (!t || !t.includes(':')) return null;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  sorted.forEach((log) => {
    const timeMin = toMinutes(log.time);
    const amount = Number(log.amount) || 0;

    if (lastTimeMin === null || timeMin === null) {
      // 첫 로그 → 새 그룹 시작
      if (currentGroupAmount > 0) {
        totalWater += currentGroupAmount;
        drinkCount += 1;
      }
      currentGroupAmount = amount;
    } else {
      const gap = timeMin - lastTimeMin;
      if (gap > 5) {
        // 5분 초과 → 이전 그룹 종료, 새 그룹 시작
        totalWater += currentGroupAmount;
        drinkCount += 1;
        currentGroupAmount = amount;
      } else {
        // 같은 활동으로 계속
        currentGroupAmount += amount;
      }
    }

    lastTimeMin = timeMin;
  });

  // 마지막 그룹 반영
  if (currentGroupAmount > 0) {
    totalWater += currentGroupAmount;
    drinkCount += 1;
  }

  return { waterMl: totalWater, drinkCount };
};
