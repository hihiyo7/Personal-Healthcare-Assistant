// src/features/study/hooks/useStudyLogs.js
// ============================================================
// Study 로그 관리 커스텀 훅 (FINAL SAVE FIX)
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// 백엔드 주소
const API_BASE_URL = 'http://localhost:8000';

export const useStudyLogs = (currentDate, onLogsLoaded) => {

  const [studySummaryText, setStudySummaryText] = useState(null);
  const [studySummaryLoading, setStudySummaryLoading] = useState(false);

  const [studyLogs, setStudyLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [serverTotalBookMin, setServerTotalBookMin] = useState(0);
  const [serverTotalLaptopMin, setServerTotalLaptopMin] = useState(0);

  const currentDateRef = useRef(currentDate);

  // ─────────────────────────────────────────────
  // 1. 로그 로드
  // ─────────────────────────────────────────────
  const loadStudyLogs = useCallback(async (fetchDate) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/logs/study/${fetchDate}`);
      if (!response.ok) throw new Error('서버 연결 실패');

      const data = await response.json();
      if (fetchDate !== currentDateRef.current) return;

      const { logs, totalBookMin, totalLaptopMin } = data;

      const processedLogs = (logs || []).map(log => ({
        id: log.id,
        bookId: log.book_id || "",   // ✅ 이 줄 추가

        type: (log.object || 'laptop').toLowerCase().includes('book') ? 'book' : 'laptop',
        timestamp: log.timestamp || "",
        time: log.time || (log.timestamp ? log.timestamp.split('T')[1]?.slice(0, 5) : "00:00"),

        durationMin: log.duration_min || 0,
        imageUrl: log.imageUrl || null,
        imageFile: log.imageUrl ? log.imageUrl.split('/').pop() : null,

        aiResult: log.ai_result === "Not Analyzed" ? "" : log.ai_result,
        userLabel: log.manual_label || "",

        bookTitle: log.book_title || "",
        bookAuthors: log.book_authors || "",
        bookThumbnail: log.book_thumbnail || "",
        readPages: log.read_pages || 0,
        totalPages: log.total_pages || 0,
        description: log.description || "",
        purpose: log.purpose || "study",

        sourceFile: log.source_file || "",
        category: log.category || "lecture",

        isAnalyzing: false,
        analyzed: log.ai_result !== "Not Analyzed",
      }));

      setStudyLogs(processedLogs);
      setServerTotalBookMin(totalBookMin || 0);
      setServerTotalLaptopMin(totalLaptopMin || 0);

      onLogsLoaded?.(processedLogs);

    } catch (err) {
      console.error(err);
      setError(err.message);
      setStudyLogs([]);
    } finally {
      setLoading(false);
    }
  }, [onLogsLoaded]);

  useEffect(() => {
    currentDateRef.current = currentDate;
    loadStudyLogs(currentDate);
  }, [currentDate, loadStudyLogs]);

  // ─────────────────────────────────────────────
  // 2. 통계 계산 ✅ (⚠️ 먼저 선언)
  // ─────────────────────────────────────────────
  const { totalLaptopStudyMin, totalLaptopNonStudyMin } = useMemo(() => {
    let studyMin = 0;
    let nonStudyMin = 0;

    studyLogs.filter(l => l.type === 'laptop').forEach(log => {
      const label = (log.userLabel || log.aiResult || "Study").toLowerCase();
      const duration = parseFloat(log.durationMin) || 0;

      if (label.includes('game') || label.includes('youtube') || label.includes('other')) {
        nonStudyMin += duration;
      } else {
        studyMin += duration;
      }
    });

    return {
      totalLaptopStudyMin: +studyMin.toFixed(1),
      totalLaptopNonStudyMin: +nonStudyMin.toFixed(1),
    };
  }, [studyLogs]);

  const totalBookMin =
    currentDate !== currentDateRef.current ? 0 : serverTotalBookMin;

  const currentBookMin = useMemo(() => {
    return studyLogs
      .filter(l => l.type === 'book')
      .reduce((acc, curr) => acc + (parseFloat(curr.durationMin) || 0), 0);
  }, [studyLogs]);

  const displayTotalBookMin =
    currentBookMin > 0 ? +currentBookMin.toFixed(1) : totalBookMin;

  const totalStudyMin = displayTotalBookMin + totalLaptopStudyMin;

// ─────────────────────────────────────────────
// 3. 독서 요약 생성 ✅ (최종 수정본)
// ─────────────────────────────────────────────
const fetchStudySummary = useCallback(async () => {
  if (studySummaryLoading) return;

  const books = studyLogs.filter(
    l => l.type === "book" && l.bookId
  );

  if (books.length === 0) {
    setStudySummaryText("오늘은 독서 기록이 없어요.");
    return;
  }

  // ✅ 가장 최근에 선택된 책
  const mainBook = books[books.length - 1];

  const bookInfo = {
    title: mainBook.bookTitle,
    authors: mainBook.bookAuthors
      ? mainBook.bookAuthors.split(',').map(a => a.trim())
      : [],
    readPages: mainBook.readPages,
    totalPages: mainBook.totalPages,
    durationMin: displayTotalBookMin,
    description: mainBook.description,
    purpose: mainBook.purpose,
  };

  const payload = {
    date: currentDate,
    waterMl: 0,
    waterGoal: 0,
    studyMin: totalStudyMin,
    studyGoal: 0,
    bookInfo,
    laptopInfo: null,
  };

  try {
    setStudySummaryLoading(true);
    setStudySummaryText("AI가 독서 요약을 정리 중입니다…");

    const res = await fetch(`${API_BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setStudySummaryText(data.summary);

  } catch (e) {
    console.error(e);
    setStudySummaryText("요약 생성 실패");
  } finally {
    setStudySummaryLoading(false);
  }
}, [
  studyLogs,
  displayTotalBookMin,
  totalStudyMin,
  currentDate,
  studySummaryLoading
]);
// ─────────────────────────────────────────────
// 4. 책 정보 업데이트 (BookModal → 서버 저장)
// ─────────────────────────────────────────────
const handleUpdateBookInfo = useCallback(async (log, updates) => {
  try {
    if (!log?.id) {
      console.error("❌ log_id 없음 — 저장 불가");
      return;
    }

    if (!log?.sourceFile) {
      console.error("❌ source_file 없음 — 저장 불가");
      return;
    }

    const payload = {
      source_file: log.sourceFile,        // ⚠ snake_case (서버 요구)
      log_id: log.id,                     // ⚠ 필수
      updates: {
        book_id: updates.bookId,
        book_title: updates.bookTitle,
        book_authors: Array.isArray(updates.bookAuthors)
          ? updates.bookAuthors.join(',')
          : updates.bookAuthors,
        book_thumbnail: updates.bookThumbnail,
        total_pages: updates.totalPages,
        read_pages: updates.readPages,
        description: updates.description || '',
        purpose: updates.purpose || 'study',
        duration_min: updates.durationMin,
      }
    };

    console.log("📤 Sending payload:", payload);

    const response = await fetch(`${API_BASE_URL}/api/logs/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      console.error("❌ 서버 업데이트 실패:", await response.text());
      return;
    }

    console.log("✅ 서버 저장 성공 → 로그 재로드");
    await loadStudyLogs(currentDateRef.current);

  } catch (err) {
    console.error("Book info update error:", err);
  }
}, [loadStudyLogs]);


  // ─────────────────────────────────────────────
  // return
  // ─────────────────────────────────────────────
  return {
    studyLogs,
    loading,
    error,

    totalBookMin: displayTotalBookMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    totalStudyMin,

    loadStudyLogs,
    fetchStudySummary,
    handleUpdateBookInfo,


    studySummaryText,
    studySummaryLoading,

    bookLogs: studyLogs.filter(l => l.type === 'book'),
    laptopLogs: studyLogs.filter(l => l.type === 'laptop'),

    hasServerData: studyLogs.length > 0,
  };
};

export default useStudyLogs;
