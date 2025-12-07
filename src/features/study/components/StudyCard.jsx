// src/components/StudyCard.jsx
// ============================================================
// Study 로그 카드 컴포넌트
// - Book 로그 표시 (제목, 진행률, 읽은 페이지)
// - Laptop 로그 표시 (공부=노랑, 기타=회색)
// ============================================================

import React from 'react';
import { BookOpen, Laptop, Clock } from 'lucide-react';
import { LAPTOP_CATEGORIES, formatMinutesToTime, calculateBookProgress } from '../utils/studyCalculator';

export default function StudyCard({ log, onClick, isDarkMode, selected = false }) {
  if (!log) return null;

  const isBook = log.type === 'book';
  const isLaptop = log.type === 'laptop';
  
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDarkMode ? 'bg-slate-800' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-slate-700' : 'border-slate-200';

  const renderBookCard = () => {
    const progress = log.progress || calculateBookProgress(log.readPages, log.totalPages);
    const hasBookInfo = log.bookTitle && log.bookTitle.length > 0;
    
    return (
      <div className="flex items-start gap-4">
        {log.bookThumbnail || log.imageUrl ? (
          <img src={log.bookThumbnail || log.imageUrl} alt={log.bookTitle || 'Book'} className="w-14 h-20 rounded-lg object-cover shadow-sm flex-shrink-0" />
        ) : (
          <div className={`w-14 h-20 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
            <BookOpen size={24} className="text-blue-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold truncate ${textPrimary}`}>{hasBookInfo ? log.bookTitle : '책 정보 미입력'}</p>
              {log.bookAuthors && log.bookAuthors.length > 0 && (
                <p className={`text-sm truncate ${textSecondary}`}>{log.bookAuthors.join(', ')}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>Book</span>
          </div>
          {log.totalPages > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className={textSecondary}>진행률</span>
                <span className={progress >= 100 ? 'text-emerald-500' : 'text-blue-500'}>{progress}%</span>
              </div>
              <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
              </div>
              <p className={`text-xs mt-1 ${textSecondary}`}>{log.readPages || 0} / {log.totalPages} 페이지</p>
            </div>
          )}
          <div className={`flex items-center gap-2 mt-2 text-sm ${textSecondary}`}>
            <Clock size={14} />
            <span>{formatMinutesToTime(log.durationMin)}</span>
            {log.timestamp && (<><span>·</span><span>{log.timestamp.split(' ')[1]?.slice(0, 5) || ''}</span></>)}
          </div>
        </div>
      </div>
    );
  };

  const renderLaptopCard = () => {
    const categoryInfo = LAPTOP_CATEGORIES[log.category] || LAPTOP_CATEGORIES.lecture;
    const isStudy = categoryInfo.isStudy;
    
    return (
      <div className="flex items-start gap-4">
        {log.imageUrl ? (
          <img src={log.imageUrl} alt="Activity" className="w-14 h-14 rounded-xl object-cover shadow-sm flex-shrink-0" />
        ) : (
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            isStudy 
              ? (isDarkMode ? 'bg-amber-500/20' : 'bg-amber-50') 
              : (isDarkMode ? 'bg-slate-600/30' : 'bg-slate-100')
          }`}>
            <Laptop size={24} className={isStudy ? 'text-amber-500' : 'text-slate-400'} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${textPrimary}`}>
                {categoryInfo.label}
                {log.subject && (<span className={`font-normal ${textSecondary}`}> · {log.subject}</span>)}
              </p>
              {log.note && <p className={`text-sm truncate ${textSecondary}`}>{log.note}</p>}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
              isStudy 
                ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-600') 
                : (isDarkMode ? 'bg-slate-600/30 text-slate-400' : 'bg-slate-100 text-slate-500')
            }`}>
              {isStudy ? 'Study' : 'Other'}
            </span>
          </div>
          <div className="mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isStudy 
                ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600') 
                : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')
            }`}>
              {isStudy ? '공부 시간에 포함' : '공부 시간에서 제외'}
            </span>
          </div>
          <div className={`flex items-center gap-2 mt-2 text-sm ${textSecondary}`}>
            <Clock size={14} />
            <span className={isStudy ? 'text-amber-500 font-medium' : ''}>{formatMinutesToTime(log.durationMin)}</span>
            {log.timestamp && (<><span>·</span><span>{log.timestamp.split(' ')[1]?.slice(0, 5) || ''}</span></>)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <button onClick={onClick} className={`w-full p-4 rounded-2xl border text-left transition-all ${cardBg} ${selected ? (isBook ? 'border-blue-500 shadow-md shadow-blue-500/10' : 'border-amber-500 shadow-md shadow-amber-500/10') : `${cardBorder} hover:shadow-md hover:border-opacity-0`}`}>
      {isBook && renderBookCard()}
      {isLaptop && renderLaptopCard()}
    </button>
  );
}

export function EmptyStudyState({ type, isDarkMode }) {
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgColor = isDarkMode ? 'bg-slate-800' : 'bg-slate-50';
  const Icon = type === 'book' ? BookOpen : Laptop;
  const label = type === 'book' ? '독서' : '노트북 활동';
  
  return (
    <div className={`p-8 rounded-2xl text-center ${bgColor}`}>
      <Icon size={40} className={`mx-auto mb-3 ${textSecondary}`} />
      <p className={textSecondary}>{label} 기록이 없습니다</p>
    </div>
  );
}
