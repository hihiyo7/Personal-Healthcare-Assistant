// src/utils/studyCalculator.js
// ============================================================
// Study 관련 계산 유틸리티 (세션 기반 시간 계산 포함)
// ============================================================

/**
 * Laptop 활동 카테고리 정의
 */
export const LAPTOP_CATEGORIES = {
  lecture: { label: 'Lecture', isStudy: true, emoji: '🎓' },
  assignment: { label: 'Assignment', isStudy: true, emoji: '📝' },
  coding: { label: 'Coding', isStudy: true, emoji: '💻' },
  youtube: { label: 'YouTube', isStudy: false, emoji: '📺' },
  game: { label: 'Game', isStudy: false, emoji: '🎮' }
};

/**
 * Book 활동 목적 정의
 * - study: 교육용 도서 (전공서, 교재, 학습 목적)
 * - etc: 일반 도서 (소설, 에세이, 취미 독서)
 */
export const BOOK_PURPOSES = {
  study: { label: '교육용 도서', isStudy: true, emoji: '📚', description: '전공서, 교재, 학습 목적' },
  etc: { label: '일반 도서', isStudy: false, emoji: '📖', description: '소설, 에세이, 취미 독서' }
};

/**
 * Book purpose가 study인지 확인
 * @param {string} purpose - 'study' | 'etc'
 * @returns {boolean}
 */
export const isBookStudy = (purpose) => {
  return BOOK_PURPOSES[purpose]?.isStudy === true;
};

/**
 * Laptop 카테고리가 공부인지 확인
 * @param {string} category - 카테고리 키
 * @returns {boolean}
 */
export const isStudyCategory = (category) => {
  return LAPTOP_CATEGORIES[category]?.isStudy === true;
};

/**
 * 로그를 세션(활동 단위)으로 묶기
 * - 5분 이상 간격이 있으면 다른 세션으로 분리
 * - 반환: 각 세션의 시작~끝 시간 차이 (분)
 * 
 * @param {Array} logs - 로그 배열 (timestamp 필드 필요)
 * @param {number} gapMinutes - 세션 분리 간격 (기본 5분)
 * @returns {Array} 세션 배열 [{ startTime, endTime, logs, durationMin }]
 */
export const groupLogsIntoSessions = (logs, gapMinutes = 5) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // 시간순 정렬
  const sorted = [...logs].sort((a, b) => {
    const timeA = a.timestamp || a.time || '';
    const timeB = b.timestamp || b.time || '';
    return timeA.localeCompare(timeB);
  });

  const sessions = [];
  let currentSession = {
    logs: [sorted[0]],
    startTime: sorted[0].timestamp || sorted[0].time,
    endTime: sorted[0].timestamp || sorted[0].time
  };

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(`2000-01-01 ${extractTime(currentSession.endTime)}`);
    const currTime = new Date(`2000-01-01 ${extractTime(sorted[i].timestamp || sorted[i].time)}`);
    const diffMin = (currTime - prevTime) / (1000 * 60);

    if (diffMin > gapMinutes) {
      // 새 세션 시작
      sessions.push(finalizeSession(currentSession));
      currentSession = {
        logs: [sorted[i]],
        startTime: sorted[i].timestamp || sorted[i].time,
        endTime: sorted[i].timestamp || sorted[i].time
      };
    } else {
      // 같은 세션에 추가
      currentSession.logs.push(sorted[i]);
      currentSession.endTime = sorted[i].timestamp || sorted[i].time;
    }
  }

  // 마지막 세션 추가
  sessions.push(finalizeSession(currentSession));

  return sessions;
};

/**
 * 시간 문자열에서 HH:MM 추출
 */
const extractTime = (timeStr) => {
  if (!timeStr) return '00:00';
  // "2025-12-04 21:30" 형식이면 시간만 추출
  const match = timeStr.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '00:00';
};

/**
 * 세션 정보 최종화 (시간 계산)
 */
const finalizeSession = (session) => {
  const startParts = extractTime(session.startTime).split(':');
  const endParts = extractTime(session.endTime).split(':');
  
  const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
  
  // 세션 내 로그가 1개면 최소 1분으로 계산
  const durationMin = session.logs.length === 1 ? 1 : Math.max(endMin - startMin, 1);

  return {
    ...session,
    durationMin,
    startTimeStr: extractTime(session.startTime),
    endTimeStr: extractTime(session.endTime),
    logCount: session.logs.length
  };
};

/**
 * 세션 기반 총 공부 시간 계산
 * @param {Array} logs - 로그 배열
 * @returns {number} 총 시간 (분)
 */
export const calculateSessionBasedTime = (logs) => {
  const sessions = groupLogsIntoSessions(logs);
  return sessions.reduce((sum, s) => sum + s.durationMin, 0);
};

/**
 * Book 로그에서 공부 시간 계산 (세션 기반)
 * @param {Array} bookLogs - Book 로그 배열
 * @returns {number} 총 공부 시간 (분)
 */
export const calculateBookStudyTime = (bookLogs) => {
  if (!Array.isArray(bookLogs) || bookLogs.length === 0) return 0;
  return calculateSessionBasedTime(bookLogs);
};

/**
 * Laptop 로그에서 공부 시간 계산 (세션 기반, study 카테고리만)
 * @param {Array} laptopLogs - Laptop 로그 배열
 * @returns {number} 총 공부 시간 (분)
 */
export const calculateLaptopStudyTime = (laptopLogs) => {
  if (!Array.isArray(laptopLogs) || laptopLogs.length === 0) return 0;
  const studyLogs = laptopLogs.filter(log => isStudyCategory(log.category));
  return calculateSessionBasedTime(studyLogs);
};

/**
 * Laptop 로그에서 비공부 시간 계산 (세션 기반, youtube, game 등)
 * @param {Array} laptopLogs - Laptop 로그 배열
 * @returns {number} 총 비공부 시간 (분)
 */
export const calculateLaptopNonStudyTime = (laptopLogs) => {
  if (!Array.isArray(laptopLogs) || laptopLogs.length === 0) return 0;
  const nonStudyLogs = laptopLogs.filter(log => !isStudyCategory(log.category));
  return calculateSessionBasedTime(nonStudyLogs);
};

/**
 * 전체 공부 시간 계산 (Book + Laptop Study)
 * @param {Array} bookLogs - Book 로그 배열
 * @param {Array} laptopLogs - Laptop 로그 배열
 * @returns {number} 총 공부 시간 (분)
 */
export const calculateTotalStudyTime = (bookLogs, laptopLogs) => {
  return calculateBookStudyTime(bookLogs) + calculateLaptopStudyTime(laptopLogs);
};

/**
 * Book 진행률 계산
 * @param {number} readPages - 읽은 페이지 수
 * @param {number} totalPages - 총 페이지 수
 * @returns {number} 진행률 (0-100)
 */
export const calculateBookProgress = (readPages, totalPages) => {
  if (!totalPages || totalPages <= 0) return 0;
  if (!readPages || readPages < 0) return 0;
  return Math.min(Math.round((readPages / totalPages) * 100), 100);
};

/**
 * Today's Goal 통합 점수 계산
 * @param {number} waterMl - 오늘 물 섭취량 (ml)
 * @param {number} waterGoal - 물 목표량 (ml)
 * @param {number} studyMin - 오늘 공부 시간 (분)
 * @param {number} studyGoal - 공부 목표 시간 (분)
 * @returns {number} 통합 점수 (0-100)
 */
export const calculateOverallScore = (waterMl, waterGoal, studyMin, studyGoal) => {
  const waterRate = waterGoal > 0 ? Math.min(waterMl / waterGoal, 1) : 0;
  const studyRate = studyGoal > 0 ? Math.min(studyMin / studyGoal, 1) : 0;
  
  // 두 지표의 평균
  const score = ((waterRate + studyRate) / 2) * 100;
  return Math.round(score);
};

/**
 * 시간(분)을 시간:분 형식으로 변환
 * @param {number} minutes - 분
 * @returns {string} '0시간 00분' 또는 '00분' 형식
 */
export const formatMinutesToTime = (minutes) => {
  if (!minutes || minutes <= 0) return '0분';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }
  return `${mins}분`;
};

/**
 * 카테고리별 Laptop 시간 집계
 * @param {Array} laptopLogs - Laptop 로그 배열
 * @returns {Object} 카테고리별 시간 { lecture: 30, assignment: 45, ... }
 */
export const aggregateLaptopByCategory = (laptopLogs) => {
  if (!Array.isArray(laptopLogs)) return {};
  
  // 세션 기반으로 카테고리별 집계
  const sessions = groupLogsIntoSessions(laptopLogs);
  const result = {};
  
  sessions.forEach(session => {
    // 세션 내 첫 번째 로그의 카테고리 사용
    const category = session.logs[0]?.category || 'other';
    result[category] = (result[category] || 0) + session.durationMin;
  });
  
  return result;
};

/**
 * Radar Chart용 데이터 생성
 * @param {Object} params
 * @returns {Array} Radar 데이터 배열
 */
export const generateRadarData = ({ 
  waterMl, 
  waterGoal, 
  bookStudyMin, 
  bookGoal,
  laptopStudyMin, 
  laptopGoal,
  sleepMin = 0,
  sleepGoal = 480, // 8시간
  dietScore = 0,
  dietGoal = 100
}) => {
  const calc = (value, goal) => goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  
  return [
    { subject: 'Water', A: calc(waterMl, waterGoal), fullMark: 100 },
    { subject: 'Book', A: calc(bookStudyMin, bookGoal), fullMark: 100 },
    { subject: 'Laptop', A: calc(laptopStudyMin, laptopGoal), fullMark: 100 },
    { subject: 'Sleep', A: calc(sleepMin, sleepGoal), fullMark: 100 },
    { subject: 'Diet', A: calc(dietScore, dietGoal), fullMark: 100 }
  ];
};

export default {
  LAPTOP_CATEGORIES,
  isStudyCategory,
  groupLogsIntoSessions,
  calculateSessionBasedTime,
  calculateBookStudyTime,
  calculateLaptopStudyTime,
  calculateLaptopNonStudyTime,
  calculateTotalStudyTime,
  calculateBookProgress,
  calculateOverallScore,
  formatMinutesToTime,
  aggregateLaptopByCategory,
  generateRadarData
};
