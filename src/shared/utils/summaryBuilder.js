// src/utils/summaryBuilder.js
// 챗봇/리포트용 Summary 생성 유틸리티

import { normalizeHistory } from '../../features/auth/utils/historyUtils';

/**
 * 기간별 수분 섭취 요약 생성
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 * @param {Object} params - 필요한 데이터
 * @returns {Object|null} 요약 객체
 */
export const buildHydrationSummary = (period, { 
  currentUser, 
  currentDate, 
  stats, 
  drinkCount 
}) => {
  if (!currentUser) return null;

  const goalWater = currentUser.goals.water;
  const history = normalizeHistory(currentUser.history, goalWater);
  const refDate = new Date(currentDate);

  const inRange = (d, start, end) => d >= start && d <= end;

  // ─────────────────────────────────────────────
  // Daily Summary
  // ─────────────────────────────────────────────
  if (period === "daily") {
    const todayEntry = history.find(h => h.date === currentDate) || { water: 0, score: 0 };
    return {
      period: "daily",
      date: currentDate,
      goalWater,
      waterMl: stats.waterMl,
      drinkCount,
      historyWater: todayEntry.water,
      historyScore: todayEntry.score
    };
  }

  // ─────────────────────────────────────────────
  // Weekly Summary (최근 7일)
  // ─────────────────────────────────────────────
  if (period === "weekly") {
    const start = new Date(refDate);
    start.setDate(refDate.getDate() - 6);
    const end = new Date(refDate);

    const days = history.filter(h => {
      const d = new Date(h.date + "T00:00:00");
      return inRange(d, start, end);
    });

    const totalWater = days.reduce((sum, d) => sum + (d.water || 0), 0);

    return {
      period: "weekly",
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      goalWater,
      totalWater,
      avgWater: Math.round(totalWater / (days.length || 1)),
      reachedGoalDays: days.filter(d => (d.water || 0) >= goalWater).length,
      days: days.map(d => ({
        date: d.date,
        water: d.water,
        score: d.score
      }))
    };
  }

  // ─────────────────────────────────────────────
  // Monthly Summary
  // ─────────────────────────────────────────────
  const monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

  const mDays = history.filter(h =>
    inRange(new Date(h.date + "T00:00:00"), monthStart, monthEnd)
  );

  const mTotal = mDays.reduce((sum, d) => sum + (d.water || 0), 0);

  return {
    period: "monthly",
    month: `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`,
    goalWater,
    totalWater: mTotal,
    avgWater: Math.round(mTotal / (mDays.length || 1)),
    reachedGoalDays: mDays.filter(d => (d.water || 0) >= goalWater).length,
    days: mDays.map(d => ({
      date: d.date,
      water: d.water,
      score: d.score
    }))
  };
};


