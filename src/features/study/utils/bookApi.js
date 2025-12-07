// src/utils/bookApi.js
// ============================================================
// Google Books API Wrapper
// 실제 API Key는 환경변수로 관리
// ============================================================

// Vite 환경변수에서 API Key 로드 (VITE_ 접두사 필요)
const GOOGLE_BOOKS_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || '';
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

/**
 * @typedef {Object} BookInfo
 * @property {string} id - Google Books ID
 * @property {string} title - 책 제목
 * @property {string[]} authors - 저자 목록
 * @property {string} description - 책 설명
 * @property {string} thumbnail - 표지 이미지 URL
 * @property {number} pageCount - 총 페이지 수
 * @property {string} publishedDate - 출판일
 * @property {string} publisher - 출판사
 */

/**
 * Google Books API에서 책 검색
 * @param {string} query - 검색어 (책 제목)
 * @param {number} maxResults - 최대 결과 수
 * @returns {Promise<BookInfo[]>} 검색 결과
 */
export const searchBooks = async (query, maxResults = 5) => {
  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      maxResults: maxResults.toString(),
      printType: 'books',
      langRestrict: 'ko', // 한국어 우선
    });

    if (GOOGLE_BOOKS_API_KEY) {
      params.append('key', GOOGLE_BOOKS_API_KEY);
    }

    const response = await fetch(`${GOOGLE_BOOKS_API_URL}?${params}`);
    
    if (!response.ok) {
      console.error('Google Books API Error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map(item => parseBookItem(item));
  } catch (error) {
    console.error('Book search error:', error);
    return [];
  }
};

/**
 * Google Books API 응답을 BookInfo로 변환
 * @param {Object} item - API 응답 아이템
 * @returns {BookInfo}
 */
const parseBookItem = (item) => {
  const info = item.volumeInfo || {};
  const imageLinks = info.imageLinks || {};

  return {
    id: item.id,
    title: info.title || '제목 없음',
    authors: info.authors || [],
    description: info.description || '',
    thumbnail: imageLinks.thumbnail || imageLinks.smallThumbnail || '',
    pageCount: info.pageCount || 0,
    publishedDate: info.publishedDate || '',
    publisher: info.publisher || ''
  };
};

/**
 * ISBN으로 책 상세 정보 조회
 * @param {string} isbn - ISBN 번호
 * @returns {Promise<BookInfo|null>}
 */
export const getBookByISBN = async (isbn) => {
  if (!isbn) return null;

  try {
    const results = await searchBooks(`isbn:${isbn}`, 1);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('ISBN search error:', error);
    return null;
  }
};

/**
 * 책 ID로 상세 정보 조회
 * @param {string} bookId - Google Books ID
 * @returns {Promise<BookInfo|null>}
 */
export const getBookById = async (bookId) => {
  if (!bookId) return null;

  try {
    const url = `${GOOGLE_BOOKS_API_URL}/${bookId}`;
    const params = GOOGLE_BOOKS_API_KEY ? `?key=${GOOGLE_BOOKS_API_KEY}` : '';
    
    const response = await fetch(`${url}${params}`);
    
    if (!response.ok) {
      return null;
    }

    const item = await response.json();
    return parseBookItem(item);
  } catch (error) {
    console.error('Book detail error:', error);
    return null;
  }
};

export default { searchBooks, getBookByISBN, getBookById };

