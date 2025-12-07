// src/utils/tipsGenerator.js
// ============================================================
// Quick Tips 동적 생성 유틸리티
// 조건 기반으로 맞춤형 팁 제공
// ============================================================

/**
 * @typedef {Object} TipConditions
 * @property {number} waterMl - 물 섭취량 (ml)
 * @property {number} waterGoal - 물 목표량 (ml)
 * @property {number} studyMin - 공부 시간 (분)
 * @property {number} studyGoal - 공부 목표 시간 (분)
 * @property {number} bookProgress - Book 평균 진행률 (0-100)
 * @property {number} bookStudyMin - Book 공부 시간 (분)
 * @property {number} laptopStudyMin - Laptop 공부 시간 (분)
 * @property {number} laptopNonStudyMin - Laptop 비공부 시간 (분)
 * @property {string} currentTime - 현재 시간 (HH:mm)
 */

/**
 * @typedef {Object} Tip
 * @property {string} id - 팁 ID
 * @property {string} emoji - 이모지
 * @property {string} text - 팁 내용
 * @property {'water'|'study'|'book'|'laptop'|'general'} type - 팁 타입
 * @property {number} priority - 우선순위 (높을수록 먼저 표시)
 */

/**
 * 조건 기반 Quick Tips 생성
 * @param {TipConditions} conditions - 현재 상태
 * @param {number} maxTips - 최대 팁 개수
 * @returns {Tip[]}
 */
export const generateQuickTips = (conditions, maxTips = 3) => {
  const tips = [];
  
  const {
    waterMl = 0,
    waterGoal = 2000,
    studyMin = 0,
    studyGoal = 300,
    bookProgress = 0,
    bookStudyMin = 0,
    laptopStudyMin = 0,
    laptopNonStudyMin = 0,
    currentTime = new Date().toTimeString().slice(0, 5)
  } = conditions;

  // 물 관련 진행률
  const waterPercent = waterGoal > 0 ? (waterMl / waterGoal) * 100 : 0;
  // 공부 관련 진행률
  const studyPercent = studyGoal > 0 ? (studyMin / studyGoal) * 100 : 0;
  // 현재 시간
  const hour = parseInt(currentTime.split(':')[0]);

  // ─────────────────────────────────────────────
  // 물 관련 팁
  // ─────────────────────────────────────────────
  if (waterPercent < 30) {
    tips.push({
      id: 'water-low',
      emoji: '💧',
      text: '물 섭취량이 목표의 30% 미만이에요. 지금 물 한 잔 어때요?',
      type: 'water',
      priority: 100
    });
  } else if (waterPercent < 50 && hour >= 14) {
    tips.push({
      id: 'water-afternoon',
      emoji: '💧',
      text: '오후인데 아직 목표의 절반이에요. 물을 더 마셔주세요.',
      type: 'water',
      priority: 80
    });
  } else if (waterPercent < 70 && hour >= 18) {
    tips.push({
      id: 'water-evening',
      emoji: '🌙',
      text: '저녁이에요. 자기 전 과한 수분은 피하되, 목표량은 채워보세요.',
      type: 'water',
      priority: 70
    });
  } else if (waterPercent >= 100) {
    tips.push({
      id: 'water-complete',
      emoji: '✨',
      text: '물 목표 달성! 꾸준한 수분 섭취를 유지하세요.',
      type: 'water',
      priority: 40
    });
  } else {
    // 팁이 없을 때 표시할 기본 팁
    tips.push({
        id: 'water-generic',
        emoji: '🥤',
        text: '물은 건강의 기본입니다. 틈틈이 마시는 습관을 길러보세요.',
        type: 'water',
        priority: 20
    });
  }

  // ─────────────────────────────────────────────
  // 공부 관련 팁
  // ─────────────────────────────────────────────
  if (studyPercent < 20 && hour >= 12) {
    tips.push({
      id: 'study-low',
      emoji: '📚',
      text: '아직 공부 시간이 부족해요. 짧은 독서부터 시작해보는 건 어떨까요?',
      type: 'study',
      priority: 95
    });
  } else if (studyPercent < 50 && hour >= 16) {
    tips.push({
      id: 'study-afternoon',
      emoji: '✏️',
      text: '집중력이 떨어질 시간이에요. 스트레칭 후 다시 시작해봐요!',
      type: 'study',
      priority: 85
    });
  } else if (studyPercent < 80 && hour >= 20) {
    tips.push({
      id: 'study-night',
      emoji: '📖',
      text: '오늘 목표까지 조금 남았어요! 마지막까지 힘내세요.',
      type: 'study',
      priority: 75
    });
  } else if (studyPercent >= 100) {
    tips.push({
      id: 'study-complete',
      emoji: '🎓',
      text: '오늘의 공부 목표 달성! 훌륭해요, 충분한 휴식도 중요합니다.',
      type: 'study',
      priority: 50
    });
  } else {
    // 팁이 없을 때 표시할 기본 팁
    tips.push({
        id: 'study-generic',
        emoji: '📝',
        text: '꾸준한 학습이 중요합니다. 하루 30분이라도 집중해보세요.',
        type: 'study',
        priority: 20
    });
  }

  // ─────────────────────────────────────────────
  // Book / Laptop 상세 팁
  // ─────────────────────────────────────────────
  if (bookStudyMin < 30 && studyMin > 0) {
    tips.push({
      id: 'book-encourage',
      emoji: '📗',
      text: '독서 시간이 적어요. 하루 30분 독서는 어떨까요?',
      type: 'book',
      priority: 60
    });
  }

  if (laptopNonStudyMin > laptopStudyMin && laptopNonStudyMin > 60) {
    tips.push({
      id: 'laptop-warn',
      emoji: '⚠️',
      text: '비공부 활동(게임/영상) 비중이 높아요. 학습 밸런스를 맞춰보세요.',
      type: 'laptop',
      priority: 90
    });
  }
  
  // 기본 팁 추가 (팁 개수가 부족할 경우)
  if (tips.length < maxTips) {
    tips.push({
      id: 'general-health',
      emoji: '🌿',
      text: '규칙적인 생활 습관이 건강의 지름길입니다.',
      type: 'general',
      priority: 10
    });
  }


  // 우선순위 정렬 및 개수 제한
  return tips
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTips);
};

export const getTipColorClass = (type, isDarkMode) => {
  switch (type) {
    case 'water':
      return isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200';
    case 'study':
      return isDarkMode ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200';
    case 'book':
      return isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200';
    case 'laptop':
      return isDarkMode ? 'bg-slate-500/10 border-slate-500/30' : 'bg-slate-100 border-slate-200';
    default:
      return isDarkMode ? 'bg-slate-700/30 border-slate-700' : 'bg-white border-slate-100';
  }
};
