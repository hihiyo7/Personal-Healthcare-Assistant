// src/utils/historyUtils.js
// 히스토리 관련 유틸리티 함수들

/**
 * 과거 히스토리 시드 데이터 생성
 * @param {number} days - 생성할 일 수
 * @returns {Array} 히스토리 배열
 */
export const generatePastHistory = (days) => {
  const history = [];
  const today = new Date();
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    history.push({
      date: dateStr,
      score: 0,
      water: 0,
      study: 0,
      calories: 0,
      feedback: "상세 데이터가 업로드되지 않았습니다."
    });
  }
  return history;
};

/**
 * 히스토리 점수 정규화
 * - 데이터 없으면 score: 0
 * - 데이터 있으면 물 목표 대비 점수 계산
 * @param {Array} history - 히스토리 배열
 * @param {number} goalWater - 물 목표량 (ml)
 * @returns {Array} 정규화된 히스토리
 */
export const normalizeHistory = (history, goalWater) => {
  return (history || []).map(h => {
    const waterVal = typeof h.water === 'number' ? h.water : 0;

    // 데이터 없음 → 0점
    if (h.feedback === "상세 데이터가 업로드되지 않았습니다." || waterVal === 0) {
      return { ...h, score: 0, water: h.water ?? 0 };
    }

    // 점수가 없거나 유효하지 않으면 재계산
    if (typeof h.water === 'number' && 
       (h.score === null || h.score === undefined || Number.isNaN(h.score))) {
      const score = goalWater > 0
        ? (waterVal >= goalWater ? 100 : Math.round((waterVal / goalWater) * 90))
        : 0;
      return { ...h, score };
    }
    return h;
  });
};

/**
 * 히스토리에서 특정 날짜 엔트리 업데이트
 * @param {Array} history - 히스토리 배열
 * @param {Object} newEntry - 새 엔트리
 * @returns {Array} 업데이트된 히스토리
 */
export const updateHistoryEntry = (history, newEntry) => {
  let newHistory = [...history];
  const idx = newHistory.findIndex(h => h.date === newEntry.date);
  if (idx >= 0) {
    newHistory[idx] = newEntry;
  } else {
    newHistory.push(newEntry);
  }
  newHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
  return newHistory;
};

/**
 * 목표 변경 시 히스토리 전체 점수 재계산
 * @param {Array} history - 기존 히스토리
 * @param {number} waterGoal - 새 물 목표 (ml)
 * @param {number} studyGoal - 새 공부 목표 (분)
 * @returns {Array} 점수가 재계산된 히스토리
 */
export const recalculateHistoryScores = (history, waterGoal, studyGoal) => {
  if (!Array.isArray(history)) return [];

  return history.map(entry => {
    const water = entry.water || 0;
    const study = entry.study || 0;

    const waterRate = waterGoal > 0 ? Math.min(water / waterGoal, 1) : 0;
    const studyRate = studyGoal > 0 ? Math.min(study / studyGoal, 1) : 0;
    
    // 두 지표의 평균으로 점수 재계산
    const newScore = Math.round(((waterRate + studyRate) / 2) * 100);

    return {
      ...entry,
      score: newScore
    };
  });
};
