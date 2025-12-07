// src/components/BookModal.jsx
// ============================================================
// Book 상세 입력 모달
// - 책 검색 (Google Books API)
// - 읽은 페이지 입력
// - 진행률 계산
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Search, BookOpen, Loader2, ExternalLink, GraduationCap, Book, Clock, History } from 'lucide-react';
import { searchBooks } from '../utils/bookApi';
import { calculateBookProgress, BOOK_PURPOSES } from '../utils/studyCalculator';

// LocalStorage 키
const RECENT_BOOKS_KEY = 'recentBooks';
const MAX_RECENT_BOOKS = 5;

// 최근 읽은 책 저장
const saveRecentBook = (book) => {
  try {
    const saved = localStorage.getItem(RECENT_BOOKS_KEY);
    let recentBooks = saved ? JSON.parse(saved) : [];
    
    // 중복 제거 (같은 책 ID면 제거)
    recentBooks = recentBooks.filter(b => b.bookId !== book.bookId);
    
    // 새 책 맨 앞에 추가
    recentBooks.unshift({
      bookId: book.bookId,
      bookTitle: book.bookTitle,
      bookAuthors: book.bookAuthors,
      bookThumbnail: book.bookThumbnail,
      totalPages: book.totalPages,
      description: book.description,
      lastReadPages: book.readPages || 0, // 마지막 읽은 페이지
      lastReadDate: new Date().toISOString().split('T')[0]
    });
    
    // 최대 개수 유지
    if (recentBooks.length > MAX_RECENT_BOOKS) {
      recentBooks = recentBooks.slice(0, MAX_RECENT_BOOKS);
    }
    
    localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(recentBooks));
  } catch (e) {
    console.error('Failed to save recent book:', e);
  }
};

// 최근 읽은 책 불러오기
const getRecentBooks = () => {
  try {
    const saved = localStorage.getItem(RECENT_BOOKS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load recent books:', e);
    return [];
  }
};

// 최근 읽은 책 삭제
const deleteRecentBook = (bookId) => {
  try {
    const saved = localStorage.getItem(RECENT_BOOKS_KEY);
    let recentBooks = saved ? JSON.parse(saved) : [];
    recentBooks = recentBooks.filter(b => b.bookId !== bookId);
    localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(recentBooks));
    return recentBooks;
  } catch (e) {
    console.error('Failed to delete recent book:', e);
    return [];
  }
};

/**
 * @typedef {Object} BookModalProps
 * @property {boolean} isOpen - 모달 표시 여부
 * @property {Object} log - 현재 Book 로그
 * @property {(updates: Object) => void} onSave - 저장 핸들러
 * @property {() => void} onClose - 닫기 핸들러
 * @property {boolean} isDarkMode - 다크모드 여부
 */

export default function BookModal({ isOpen, log, onSave, onClose, isDarkMode }) {
  // ─────────────────────────────────────────────
  // 상태
  // ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [recentBooks, setRecentBooks] = useState([]);
  
  // 로컬 편집 상태
  const [selectedBook, setSelectedBook] = useState({
    bookId: log?.bookId || '',
    bookTitle: log?.bookTitle || '',
    bookAuthors: log?.bookAuthors || [],
    bookThumbnail: log?.bookThumbnail || '',
    totalPages: log?.totalPages || 0,
    description: log?.description || ''
  });
  const [readPages, setReadPages] = useState(log?.readPages || 0);
  const [purpose, setPurpose] = useState(log?.purpose || 'study'); // 'study' | 'etc'
  
  // 최근 읽은 책 목록 로드
  useEffect(() => {
    if (isOpen) {
      setRecentBooks(getRecentBooks());
    }
  }, [isOpen]);

  // 스타일
  const modalBg = isDarkMode ? 'bg-slate-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputStyle = isDarkMode 
    ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500' 
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400';
  const cardBg = isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50';

  if (!isOpen) return null;

  // ─────────────────────────────────────────────
  // 책 검색
  // ─────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const results = await searchBooks(searchQuery);
      setSearchResults(results);
      
      if (results.length === 0) {
        setSearchError('검색 결과가 없습니다.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // ─────────────────────────────────────────────
  // 책 선택
  // ─────────────────────────────────────────────
  const handleSelectBook = (book) => {
    setSelectedBook({
      bookId: book.id,
      bookTitle: book.title,
      bookAuthors: book.authors,
      bookThumbnail: book.thumbnail,
      totalPages: book.pageCount,
      description: book.description
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  // ─────────────────────────────────────────────
  // 최근 책 선택
  // ─────────────────────────────────────────────
  const handleSelectRecentBook = (book) => {
    setSelectedBook({
      bookId: book.bookId,
      bookTitle: book.bookTitle,
      bookAuthors: book.bookAuthors,
      bookThumbnail: book.bookThumbnail,
      totalPages: book.totalPages,
      description: book.description
    });
    // 마지막 읽은 페이지부터 이어서 (기본값으로 설정)
    setReadPages(book.lastReadPages || 0);
    setSearchResults([]);
    setSearchQuery('');
  };
  
  // ─────────────────────────────────────────────
  // 최근 책 삭제
  // ─────────────────────────────────────────────
  const handleDeleteRecentBook = (e, bookId) => {
    e.stopPropagation(); // 버튼 클릭이 부모 요소로 전파되지 않도록
    const updatedBooks = deleteRecentBook(bookId);
    setRecentBooks(updatedBooks);
  };
  
  // ─────────────────────────────────────────────
  // 저장
  // ─────────────────────────────────────────────
  const handleSave = () => {
    const progress = calculateBookProgress(readPages, selectedBook.totalPages);
    
    // 최근 읽은 책 목록에 저장
    if (selectedBook.bookId) {
      saveRecentBook({
        ...selectedBook,
        readPages
      });
    }
    
    onSave({
      ...selectedBook,
      readPages,
      progress,
      purpose // study | etc
    });
    
    onClose();
  };

  // 진행률 계산
  const progress = calculateBookProgress(readPages, selectedBook.totalPages);

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl ${modalBg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={`sticky top-0 z-10 p-4 pb-3 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'} rounded-t-3xl`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <BookOpen size={24} className="text-blue-500" />
              책 정보 입력
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
            >
              <X size={20} className={textSecondary} />
            </button>
          </div>
          
          {/* 로그 시간 표시 */}
          {log?.timestamp && (
            <p className={`text-sm mt-2 ${textSecondary}`}>
              기록 시간: {log.timestamp}
            </p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* 최근 읽은 책 섹션 (책이 아직 선택되지 않았을 때만 표시) */}
          {!selectedBook.bookTitle && recentBooks.length > 0 && (
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2 ${textSecondary}`}>
                <History size={12} />
                최근 읽은 책
              </label>
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                {recentBooks.map((book, idx) => (
                  <div
                    key={book.bookId || idx}
                    className={`relative flex items-center gap-2 p-2 transition ${
                      isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-blue-50'
                    } ${idx > 0 ? (isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100') : ''}`}
                  >
                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDeleteRecentBook(e, book.bookId)}
                      className={`absolute top-1 right-1 p-1 rounded-full transition z-10 ${
                        isDarkMode ? 'hover:bg-slate-600 text-slate-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-400 hover:text-red-500'
                      }`}
                      title="삭제"
                    >
                      <X size={14} />
                    </button>
                    
                    {/* 클릭 가능한 영역 */}
                    <button
                      onClick={() => handleSelectRecentBook(book)}
                      className="flex items-center gap-2 flex-1 text-left pr-6"
                    >
                      {book.bookThumbnail ? (
                        <img src={book.bookThumbnail} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-8 h-11 rounded flex items-center justify-center ${cardBg}`}>
                          <BookOpen size={14} className={textSecondary} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate text-xs ${textPrimary}`}>{book.bookTitle}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {book.lastReadPages || 0}p
                          </span>
                          <span className={`text-[10px] ${textSecondary}`}>
                            {book.lastReadDate}
                          </span>
                        </div>
                      </div>
                      <div className={`text-[10px] font-medium px-2 py-1 rounded-lg flex-shrink-0 ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'
                      }`}>
                        이어서 읽기
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 책 검색 섹션 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${textSecondary}`}>
              {recentBooks.length > 0 && !selectedBook.bookTitle ? '새로운 책 검색' : '책 검색'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="책 제목을 입력하세요"
                className={`flex-1 px-3 py-2.5 rounded-xl border outline-none transition text-sm ${inputStyle}`}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1.5 text-sm"
              >
                {isSearching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                검색
              </button>
            </div>

            {/* 검색 에러 */}
            {searchError && (
              <p className="text-sm text-amber-500 mt-2">{searchError}</p>
            )}

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className={`mt-3 rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                {searchResults.map((book, idx) => (
                  <button
                    key={book.id || idx}
                    onClick={() => handleSelectBook(book)}
                    className={`w-full p-3 flex items-start gap-3 text-left transition ${
                      isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                    } ${idx > 0 ? (isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100') : ''}`}
                  >
                    {book.thumbnail ? (
                      <img src={book.thumbnail} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-12 h-16 rounded flex items-center justify-center ${cardBg}`}>
                        <BookOpen size={20} className={textSecondary} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${textPrimary}`}>{book.title}</p>
                      <p className={`text-sm ${textSecondary}`}>{book.authors?.join(', ') || '저자 미상'}</p>
                      <p className={`text-xs ${textSecondary}`}>{book.pageCount || 0}페이지</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 선택된 책 정보 */}
          {selectedBook.bookTitle && (
            <div className={`p-4 rounded-2xl ${cardBg}`}>
              <div className="flex items-start gap-4">
                {selectedBook.bookThumbnail ? (
                  <img 
                    src={selectedBook.bookThumbnail} 
                    alt={selectedBook.bookTitle}
                    className="w-20 h-28 rounded-lg object-cover shadow-md"
                  />
                ) : (
                  <div className={`w-20 h-28 rounded-lg flex items-center justify-center ${
                    isDarkMode ? 'bg-slate-600' : 'bg-slate-200'
                  }`}>
                    <BookOpen size={32} className={textSecondary} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-lg ${textPrimary}`}>{selectedBook.bookTitle}</h3>
                  <p className={`text-sm ${textSecondary}`}>
                    {selectedBook.bookAuthors?.join(', ') || '저자 미상'}
                  </p>
                  <p className={`text-sm mt-1 ${textSecondary}`}>
                    총 {selectedBook.totalPages || 0}페이지
                  </p>
                  {selectedBook.description && (
                    <p className={`text-xs mt-2 line-clamp-2 ${textSecondary}`}>
                      {selectedBook.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 독서 목적 선택 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${textSecondary}`}>
              독서 목적
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPurpose('study')}
                className={`p-2.5 rounded-xl border-2 transition-all ${
                  purpose === 'study'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : isDarkMode 
                      ? 'border-slate-600 hover:border-slate-500 bg-slate-700/50' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className={purpose === 'study' ? 'text-blue-500' : textSecondary} />
                  <span className={`text-sm font-semibold ${purpose === 'study' ? 'text-blue-600 dark:text-blue-400' : textPrimary}`}>
                    📚 교육용
                  </span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setPurpose('etc')}
                className={`p-2.5 rounded-xl border-2 transition-all ${
                  purpose === 'etc'
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                    : isDarkMode 
                      ? 'border-slate-600 hover:border-slate-500 bg-slate-700/50' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Book size={18} className={purpose === 'etc' ? 'text-violet-500' : textSecondary} />
                  <span className={`text-sm font-semibold ${purpose === 'etc' ? 'text-violet-600 dark:text-violet-400' : textPrimary}`}>
                    📖 일반
                  </span>
                </div>
              </button>
            </div>
            <p className={`text-[11px] mt-1.5 ${textSecondary}`}>
              {purpose === 'study' 
                ? '✅ Study 시간에 포함' 
                : '⏸️ Study 제외 (AI 분석에만 활용)'
              }
            </p>
          </div>

          {/* 읽은 페이지 입력 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${textSecondary}`}>
              오늘 읽은 페이지 수
            </label>
            <input
              type="number"
              value={readPages || ''}
              onChange={(e) => setReadPages(parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
              max={selectedBook.totalPages || 9999}
              className={`w-full px-3 py-2.5 rounded-xl border outline-none transition text-sm ${inputStyle}`}
            />
          </div>

          {/* 진행률 표시 */}
          {selectedBook.totalPages > 0 && (
            <div className={`p-3 rounded-xl ${cardBg}`}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-medium ${textSecondary}`}>독서 진행률</span>
                <span className={`text-sm font-bold ${
                  progress >= 100 ? 'text-emerald-500' : 
                  progress >= 50 ? 'text-blue-500' : 
                  textPrimary
                }`}>
                  {progress}% ({readPages || 0}/{selectedBook.totalPages}p)
                </span>
              </div>
              <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 공부 시간 표시 */}
          {log?.durationMin > 0 && (
            <div className={`p-3 rounded-xl ${cardBg}`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-medium ${textSecondary}`}>기록된 독서 시간</span>
                <span className={`text-sm font-bold text-blue-500`}>
                  {log.durationMin}분
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className={`sticky bottom-0 p-4 pt-3 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'} rounded-b-3xl`}>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm ${
                isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 transition text-sm"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Portal로 body에 직접 렌더링
  return ReactDOM.createPortal(modalContent, document.body);
}

