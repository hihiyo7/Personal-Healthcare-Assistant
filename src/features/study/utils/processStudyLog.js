// src/utils/processStudyLog.js
// ============================================================
// Study 로그 처리 유틸리티
// Raw 로그 → 가공된 로그로 변환
// ============================================================

import { isStudyCategory, isBookStudy } from './studyCalculator';

/**
 * @typedef {Object} RawStudyLog
 * @property {string|number} id
 * @property {'book'|'laptop'} type
 * @property {string} timestamp
 * @property {number} [duration_frames] - 프레임 수 (서버에서 올 경우)
 * @property {number} [durationMin] - 분 단위 시간
 * @property {string} [imageUrl]
 * @property {string} [imageFile]
 */

/**
 * @typedef {Object} ProcessedBookLog
 * @property {string|number} id
 * @property {'book'} type
 * @property {string} timestamp
 * @property {number} durationMin
 * @property {string} [imageUrl]
 * @property {string} [bookId] - Google Books ID
 * @property {string} [bookTitle]
 * @property {string[]} [bookAuthors]
 * @property {string} [bookThumbnail]
 * @property {number} [totalPages]
 * @property {number} [readPages]
 * @property {number} [progress] - 0-100
 * @property {string} [description]
 * @property {'study'|'etc'} purpose - 독서 목적 (study: 교육용, etc: 일반)
 * @property {boolean} isStudy - study 목적인지 여부
 */

/**
 * @typedef {Object} ProcessedLaptopLog
 * @property {string|number} id
 * @property {'laptop'} type
 * @property {string} timestamp
 * @property {number} durationMin
 * @property {string} [imageUrl]
 * @property {string} category - lecture/assignment/coding/youtube/game
 * @property {boolean} isStudy
 * @property {string} [subject]
 * @property {string} [note]
 */

/**
 * Raw Book 로그를 처리된 형식으로 변환
 * @param {RawStudyLog} raw - 원시 로그
 * @returns {ProcessedBookLog}
 */
export const processBookLog = (raw) => {
  const durationMin = raw.durationMin || 
    (raw.duration_frames ? Math.round(raw.duration_frames / 30) : 0);
  
  const purpose = raw.purpose || 'study'; // 기본값: study (교육용)

  return {
    id: raw.id,
    type: 'book',
    timestamp: raw.timestamp || '',
    time: raw.time || '',
    durationMin,
    imageUrl: raw.imageUrl || null,
    imageFile: raw.imageFile || null,
    // Book 상세 정보는 사용자가 Modal에서 입력
    bookId: raw.bookId || null,
    bookTitle: raw.bookTitle || '',
    bookAuthors: raw.bookAuthors || [],
    bookThumbnail: raw.bookThumbnail || '',
    totalPages: raw.totalPages || 0,
    readPages: raw.readPages || 0,
    progress: raw.progress || 0,
    description: raw.description || '',
    action: raw.action || '',
    sourceFile: raw.sourceFile || '',  // CSV 파일명 유지 (세션 그룹핑용)
    purpose,
    isStudy: isBookStudy(purpose)
  };
};

/**
 * Raw Laptop 로그를 처리된 형식으로 변환
 * @param {RawStudyLog} raw - 원시 로그
 * @returns {ProcessedLaptopLog}
 */
export const processLaptopLog = (raw) => {
  const durationMin = raw.durationMin || 
    (raw.duration_frames ? Math.round(raw.duration_frames / 30) : 0);
  
  const category = raw.category || 'lecture'; // 기본값
  
  return {
    id: raw.id,
    type: 'laptop',
    timestamp: raw.timestamp || '',
    time: raw.time || '',
    durationMin,
    imageUrl: raw.imageUrl || null,
    imageFile: raw.imageFile || null,
    category,
    isStudy: isStudyCategory(category),
    subject: raw.subject || '',
    note: raw.note || '',
    action: raw.action || '',
    sourceFile: raw.sourceFile || ''  // CSV 파일명 유지 (세션 그룹핑용)
  };
};

/**
 * 로그 배열을 타입별로 분리
 * @param {Array} logs - 혼합 로그 배열
 * @returns {{ bookLogs: ProcessedBookLog[], laptopLogs: ProcessedLaptopLog[] }}
 */
export const separateLogsByType = (logs) => {
  if (!Array.isArray(logs)) {
    return { bookLogs: [], laptopLogs: [] };
  }

  const bookLogs = [];
  const laptopLogs = [];

  logs.forEach(log => {
    if (log.type === 'book') {
      bookLogs.push(processBookLog(log));
    } else if (log.type === 'laptop') {
      laptopLogs.push(processLaptopLog(log));
    }
  });

  return { bookLogs, laptopLogs };
};

/**
 * Book 로그에 책 정보 업데이트
 * @param {ProcessedBookLog} log - 기존 로그
 * @param {Object} bookInfo - Google Books API 결과
 * @returns {ProcessedBookLog}
 */
export const updateBookLogWithInfo = (log, bookInfo) => {
  return {
    ...log,
    bookId: bookInfo.id || log.bookId,
    bookTitle: bookInfo.title || log.bookTitle,
    bookAuthors: bookInfo.authors || log.bookAuthors,
    bookThumbnail: bookInfo.thumbnail || log.bookThumbnail,
    totalPages: bookInfo.pageCount || log.totalPages,
    description: bookInfo.description || log.description
  };
};

/**
 * Book 로그의 읽은 페이지 업데이트 및 진행률 계산
 * @param {ProcessedBookLog} log - 기존 로그
 * @param {number} readPages - 읽은 페이지 수
 * @returns {ProcessedBookLog}
 */
export const updateBookLogPages = (log, readPages) => {
  const totalPages = log.totalPages || 0;
  const progress = totalPages > 0 
    ? Math.min(Math.round((readPages / totalPages) * 100), 100)
    : 0;

  return {
    ...log,
    readPages,
    progress
  };
};

/**
 * Laptop 로그에 카테고리 정보 업데이트
 * @param {ProcessedLaptopLog} log - 기존 로그
 * @param {Object} updates - 업데이트할 정보
 * @returns {ProcessedLaptopLog}
 */
export const updateLaptopLogCategory = (log, updates) => {
  const category = updates.category || log.category;
  
  return {
    ...log,
    ...updates,
    category,
    isStudy: isStudyCategory(category)
  };
};

/**
 * 날짜별로 로그 필터링
 * @param {Array} logs - 로그 배열
 * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Array}
 */
export const filterLogsByDate = (logs, dateStr) => {
  if (!Array.isArray(logs) || !dateStr) return [];
  
  return logs.filter(log => {
    if (!log.timestamp) return false;
    return log.timestamp.startsWith(dateStr);
  });
};

/**
 * 날짜 범위로 로그 필터링
 * @param {Array} logs - 로그 배열
 * @param {string} startDate - 시작 날짜
 * @param {string} endDate - 종료 날짜
 * @returns {Array}
 */
export const filterLogsByDateRange = (logs, startDate, endDate) => {
  if (!Array.isArray(logs)) return [];
  
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  
  return logs.filter(log => {
    if (!log.timestamp) return false;
    const logDate = new Date(log.timestamp);
    return logDate >= start && logDate <= end;
  });
};

export default {
  processBookLog,
  processLaptopLog,
  separateLogsByType,
  updateBookLogWithInfo,
  updateBookLogPages,
  updateLaptopLogCategory,
  filterLogsByDate,
  filterLogsByDateRange
};


