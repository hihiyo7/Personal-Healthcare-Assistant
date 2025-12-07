// src/Services/booksService.js
// ============================================================
// 책 검색 서비스 (Mock)
// 추후 Google Books API로 교체 예정
// ============================================================

/**
 * @typedef {Object} BookSearchResult
 * @property {string} title - 책 제목
 * @property {string} author - 저자
 * @property {string} description - 책 설명
 * @property {string} thumbnail - 표지 이미지 URL
 * @property {number} pageCount - 총 페이지 수
 * @property {string} publishedDate - 출판일
 */

// Mock 책 데이터베이스
const MOCK_BOOKS = [
  {
    title: '클린 코드',
    author: '로버트 C. 마틴',
    description: '애자일 소프트웨어 장인 정신. 나쁜 코드도 돌아간다. 하지만 코드가 깨끗하지 못하면 개발 조직은 기어간다.',
    thumbnail: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=300&fit=crop',
    pageCount: 464,
    publishedDate: '2013-12-24'
  },
  {
    title: '리팩터링',
    author: '마틴 파울러',
    description: '코드 구조를 체계적으로 개선하여 효율적인 리팩터링을 수행하는 방법을 설명합니다.',
    thumbnail: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=200&h=300&fit=crop',
    pageCount: 518,
    publishedDate: '2020-04-01'
  },
  {
    title: '자바스크립트 완벽 가이드',
    author: '데이비드 플래너건',
    description: '자바스크립트의 모든 것을 다루는 완벽한 레퍼런스 가이드입니다.',
    thumbnail: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=200&h=300&fit=crop',
    pageCount: 1096,
    publishedDate: '2021-06-09'
  },
  {
    title: '알고리즘',
    author: '로버트 세지윅',
    description: '컴퓨터 과학의 핵심인 알고리즘과 자료구조를 체계적으로 설명합니다.',
    thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=200&h=300&fit=crop',
    pageCount: 976,
    publishedDate: '2018-03-15'
  },
  {
    title: '디자인 패턴',
    author: 'GoF',
    description: '재사용 가능한 객체지향 소프트웨어의 핵심요소를 설명하는 고전입니다.',
    thumbnail: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=300&fit=crop',
    pageCount: 395,
    publishedDate: '2015-01-01'
  }
];

/**
 * 책 검색 (Mock)
 * 추후 Google Books API로 교체 예정
 * @param {string} query - 검색어
 * @returns {Promise<BookSearchResult[]>} 검색 결과
 */
export const searchBooks = async (query) => {
  // 네트워크 지연 시뮬레이션
  await new Promise(resolve => setTimeout(resolve, 500));

  if (!query || query.trim() === '') {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  
  // Mock 데이터에서 검색
  const results = MOCK_BOOKS.filter(book => 
    book.title.toLowerCase().includes(lowerQuery) ||
    book.author.toLowerCase().includes(lowerQuery)
  );

  // 검색 결과가 없으면 기본 결과 반환
  if (results.length === 0) {
    return [{
      title: query,
      author: '알 수 없음',
      description: `"${query}"에 대한 검색 결과입니다. 실제 Google Books API 연동 시 더 정확한 정보가 표시됩니다.`,
      thumbnail: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=300&fit=crop',
      pageCount: 0,
      publishedDate: ''
    }];
  }

  return results;
};

/**
 * 책 상세 정보 조회 (Mock)
 * @param {string} title - 책 제목
 * @returns {Promise<BookSearchResult|null>} 책 정보
 */
export const getBookDetails = async (title) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const book = MOCK_BOOKS.find(b => 
    b.title.toLowerCase() === title.toLowerCase()
  );
  
  return book || null;
};

/**
 * Google Books API 호출 (추후 구현)
 * @param {string} query - 검색어
 * @returns {Promise<BookSearchResult[]>} 검색 결과
 */
export const searchGoogleBooks = async (query) => {
  // TODO: 실제 Google Books API 연동
  // const API_KEY = process.env.REACT_APP_GOOGLE_BOOKS_API_KEY;
  // const response = await fetch(
  //   `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${API_KEY}`
  // );
  // const data = await response.json();
  // return data.items.map(item => ({
  //   title: item.volumeInfo.title,
  //   author: item.volumeInfo.authors?.join(', ') || '알 수 없음',
  //   description: item.volumeInfo.description || '',
  //   thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
  //   pageCount: item.volumeInfo.pageCount || 0,
  //   publishedDate: item.volumeInfo.publishedDate || ''
  // }));
  
  // 현재는 Mock 사용
  return searchBooks(query);
};

export default { searchBooks, getBookDetails, searchGoogleBooks };


