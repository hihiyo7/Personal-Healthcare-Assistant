// src/components/LaptopModal.jsx
// ============================================================
// Laptop 활동 분류 모달
// - 카테고리: Lecture, Assignment, Coding (공부) - 노랑
// - 카테고리: YouTube, Game (비공부) - 회색
// ============================================================

import React, { useEffect, useState } from 'react';
import { X, Laptop, Check, Clock, FileText } from 'lucide-react';
import { LAPTOP_CATEGORIES, isStudyCategory, formatMinutesToTime } from '../utils/studyCalculator';

export default function LaptopModal({ isOpen, log, onSave, onClose, isDarkMode }) {
  const [category, setCategory] = useState(log?.category || 'lecture');
  const [subject, setSubject] = useState(log?.subject || '');
  const [note, setNote] = useState(log?.note || '');
  const [durationMin, setDurationMin] = useState(log?.durationMin || 0);
  const [manualDuration, setManualDuration] = useState(false);

  const modalBg = isDarkMode ? 'bg-slate-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputStyle = isDarkMode ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400';
  const cardBg = isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50';

  // 모달이 다른 로그로 열릴 때 state가 이전 값으로 남는 문제 방지
  useEffect(() => {
    if (!isOpen) return;
    setCategory(log?.category || 'lecture');
    setSubject(log?.subject || '');
    setNote(log?.note || '');
    setDurationMin(log?.durationMin || 0);
    setManualDuration(false);
  }, [isOpen, log?.id]);

  if (!isOpen) return null;

  const studyCategories = Object.entries(LAPTOP_CATEGORIES).filter(([, v]) => v.isStudy);
  const nonStudyCategories = Object.entries(LAPTOP_CATEGORIES).filter(([, v]) => !v.isStudy);
  const isStudy = isStudyCategory(category);
  const categoryInfo = LAPTOP_CATEGORIES[category];

  const handleSave = () => {
    onSave({ category, isStudy: isStudyCategory(category), subject, note, durationMin: manualDuration ? durationMin : log?.durationMin || 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start justify-center p-4">
        <div className={`relative w-full max-w-lg my-8 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl ${modalBg}`} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={`sticky top-0 z-10 p-6 pb-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <Laptop size={24} className="text-blue-500" />
              활동 분류
            </h2>
            <button onClick={onClose} className={`p-2 rounded-xl transition ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
              <X size={20} className={textSecondary} />
            </button>
          </div>
          {log?.timestamp && <p className={`text-sm mt-2 ${textSecondary}`}>기록 시간: {log.timestamp}</p>}
        </div>

        <div className="p-6 space-y-6">
          {/* 공부 카테고리 - 노랑 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${textSecondary}`}>
              공부 활동
              <span className="text-amber-500">(공부 시간에 포함)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {studyCategories.map(([key, value]) => (
                <button 
                  key={key} 
                  onClick={() => setCategory(key)} 
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    category === key 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : isDarkMode 
                        ? 'border-slate-600 hover:border-amber-500/50 bg-slate-700/50' 
                        : 'border-slate-200 hover:border-amber-300 bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-medium ${category === key ? 'text-amber-500' : textPrimary}`}>{value.label}</p>
                  {category === key && <div className="mt-2"><Check size={16} className="text-amber-500 mx-auto" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* 비공부 카테고리 - 회색 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${textSecondary}`}>
              기타 활동
              <span className="text-slate-400">(공부 시간에서 제외)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {nonStudyCategories.map(([key, value]) => (
                <button 
                  key={key} 
                  onClick={() => setCategory(key)} 
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    category === key 
                      ? 'border-slate-500 bg-slate-500/10' 
                      : isDarkMode 
                        ? 'border-slate-600 hover:border-slate-500 bg-slate-700/50' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-medium ${category === key ? (isDarkMode ? 'text-slate-300' : 'text-slate-600') : textPrimary}`}>{value.label}</p>
                  {category === key && <div className="mt-2"><Check size={16} className="text-slate-500 mx-auto" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 카테고리 표시 */}
          <div className={`p-4 rounded-2xl ${
            isStudy 
              ? (isDarkMode ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200') 
              : (isDarkMode ? 'bg-slate-600/20 border border-slate-600/30' : 'bg-slate-100 border border-slate-200')
          }`}>
            <div className="flex items-center gap-3">
              <Laptop size={24} className={isStudy ? 'text-amber-500' : 'text-slate-500'} />
              <div>
                <p className={`font-bold ${isStudy ? 'text-amber-500' : (isDarkMode ? 'text-slate-300' : 'text-slate-600')}`}>{categoryInfo?.label}</p>
                <p className={`text-sm ${textSecondary}`}>{isStudy ? '공부 시간에 포함됩니다' : '공부 시간에서 제외됩니다'}</p>
              </div>
            </div>
          </div>

          {/* 과목명 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${textSecondary}`}><FileText size={14} />과목/내용 (선택)</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 자료구조, 영어 회화" className={`w-full px-4 py-3 rounded-xl border outline-none transition ${inputStyle}`} />
          </div>

          {/* 메모 */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${textSecondary}`}>메모 (선택)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="추가 메모를 입력하세요" rows={3} className={`w-full px-4 py-3 rounded-xl border outline-none transition resize-none ${inputStyle}`} />
          </div>

          {/* 시간 */}
          <div className={`p-4 rounded-2xl ${cardBg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium flex items-center gap-2 ${textSecondary}`}><Clock size={16} />활동 시간</span>
              <button onClick={() => setManualDuration(!manualDuration)} className={`text-xs px-3 py-1 rounded-full transition ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-200 hover:bg-slate-300'} ${textPrimary}`}>{manualDuration ? '자동 시간 사용' : '수동 입력'}</button>
            </div>
            {manualDuration ? (
              <div className="flex items-center gap-2">
                <input type="number" value={durationMin || ''} onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)} placeholder="0" min="0" className={`flex-1 px-4 py-2 rounded-xl border outline-none ${inputStyle}`} />
                <span className={textSecondary}>분</span>
              </div>
            ) : (
              <p className={`text-2xl font-bold ${isStudy ? 'text-amber-500' : (isDarkMode ? 'text-slate-300' : 'text-slate-600')}`}>{formatMinutesToTime(log?.durationMin || 0)}</p>
            )}
          </div>

          {log?.imageUrl && (
            <div>
              <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${textSecondary}`}>캡처 이미지</label>
              <img src={log.imageUrl} alt="Activity capture" className="w-full h-48 object-cover rounded-2xl" />
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className={`sticky bottom-0 p-6 pt-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
          <div className="flex gap-3">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl font-semibold transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>취소</button>
            <button onClick={handleSave} className={`flex-1 py-3 rounded-xl font-semibold text-white transition ${isStudy ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-500 hover:bg-slate-600'}`}>저장</button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
