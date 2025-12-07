import React, { useState, useEffect, useCallback } from 'react';
import { Utensils } from 'lucide-react';

// ====== 커스텀 훅 (Feature-based path) ======
import { useAuth } from './features/auth/hooks/useAuth';
import { useWaterLogs } from './features/water/hooks/useWaterLogs';
import { useStudyLogs } from './features/study/hooks/useStudyLogs';

// ====== 유틸리티 (Feature-based path) ======
import { buildHydrationSummary } from './shared/utils/summaryBuilder';
import { updateHistoryEntry } from './features/auth/utils/historyUtils';
import { calculateOverallScore } from './features/study/utils/studyCalculator';

// ====== 컴포넌트 (Feature-based path) ======
import NavBar from './shared/components/NavBar';
import ComingSoon from './shared/components/ComingSoon';
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import WaterDetail from './features/water/WaterDetail';
import Profile from './features/auth/Profile';
import Achievement from './shared/components/Achievement';
import ChatBot from './shared/components/ChatBot';
import Toast from './shared/components/Toast';

// ====== Study 관련 페이지 (Feature-based path) ======
import StudyCategory from './features/study/StudyCategory';
import BookStudyDetail from './features/study/BookStudyDetail';
import LaptopStudyDetail from './features/study/LaptopStudyDetail';

// ============================================================
//                       APP COMPONENT
// ============================================================
export default function App() {
  // ─────────────────────────────────────────────
  // 테마 상태
  // ─────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(false);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // ─────────────────────────────────────────────
  // Toast 알림
  // ─────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  // ─────────────────────────────────────────────
  // 인증 훅 사용
  // ─────────────────────────────────────────────
  const {
    currentUser,
    handleLogin,
    handleSignup,
    handleLogout,
    handleUpdateGoals,
    handleUpdateProfile,
    handleDeleteHistory,
    updateHistory
  } = useAuth();

  // ─────────────────────────────────────────────
  // 화면 상태 (view 확장)
  // - dashboard, detail-water, detail-study, detail-food, profile
  // - detail-study-book, detail-study-laptop (신규)
  // ─────────────────────────────────────────────
  const [view, setView] = useState(() => {
    if (!localStorage.getItem('currentUser')) return 'login';
    return localStorage.getItem('lastView') || 'dashboard';
  });

  const [currentDate, setCurrentDate] = useState(
    () => localStorage.getItem('viewingDate') || new Date().toISOString().split('T')[0]
  );

  const [showAchievement, setShowAchievement] = useState(false);

  // ─────────────────────────────────────────────
  // 히스토리 업데이트 콜백 (study 시간은 별도로 업데이트)
  // ─────────────────────────────────────────────
  const handleHistoryUpdate = useCallback((date, totalWater, drinks, studyMinutes = 0) => {
    if (!currentUser) return;
    // 실제 기록(물 또는 공부)이 없으면 히스토리를 만들지 않는다.
    if ((totalWater || 0) === 0 && (studyMinutes || 0) === 0) return;

    const waterGoal = currentUser.goals?.water || 2000;
    const studyGoal = currentUser.goals?.study || 300;
    
    // 물 + 공부 통합 점수 계산 (Infinity 방지 로직 적용된 함수 사용)
    const combinedScore = calculateOverallScore(totalWater, waterGoal, studyMinutes, studyGoal);

    const newEntry = {
      date: date,
      score: combinedScore,
      water: totalWater,
      study: studyMinutes,
      calories: 0,
      feedback: `물 ${totalWater}ml, 공부 ${studyMinutes}분`
    };

    const newHistory = updateHistoryEntry(currentUser.history, newEntry);
    
    if (JSON.stringify(currentUser.history) !== JSON.stringify(newHistory)) {
      updateHistory(newHistory);
    }
  }, [currentUser, updateHistory]);

  // ─────────────────────────────────────────────
  // Study 로그 훅 사용 (먼저 호출 - AI Summary에 필요)
  // ─────────────────────────────────────────────
  const {
    bookLogs,
    laptopLogs,
    todayBookLogs,
    todayLaptopLogs,
    totalStudyMin,
    totalBookMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    hasServerData: hasStudyData,  // CSV 데이터 존재 여부
    updateBookLog,
    updateLaptopLog,
    updateBookWithInfo,
    updateBookPages
  } = useStudyLogs(currentDate);

  // Study Summary 객체 (AI Summary용)
  const studySummary = {
    totalStudyMin,
    totalBookMin,
    totalLaptopMin: totalLaptopStudyMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    hasServerData: hasStudyData  // CSV 데이터 존재 여부 전달
  };

  // ─────────────────────────────────────────────
  // 물 로그 훅 사용 (studySummary 이후에 호출)
  // ─────────────────────────────────────────────
  const {
    logs,
    stats,
    drinkCount,
    aiSummary,
    aiLoading,
    loading,
    handleImageAnalysis,
    handleManualLogUpdate,
    clearLogs,
    fetchAISummary
  } = useWaterLogs(currentDate, currentUser, handleHistoryUpdate, studySummary, bookLogs, laptopLogs);

  // ─────────────────────────────────────────────
  // localStorage 동기화
  // ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('lastView', view);
    localStorage.setItem('viewingDate', currentDate);
  }, [view, currentDate]);

  // ─────────────────────────────────────────────
  // 로그인 핸들러 (with 화면 전환)
  // ─────────────────────────────────────────────
  const onLogin = (id, pw) => {
    const success = handleLogin(id, pw);
    if (success) {
      setView("dashboard");
    } else {
      alert("로그인 실패");
    }
  };

  // ─────────────────────────────────────────────
  // 회원가입 핸들러
  // ─────────────────────────────────────────────
  const onSignup = (name, id, pw) => {
    const result = handleSignup(name, id, pw);
    alert(result.message);
    return result.success;
  };

  // ─────────────────────────────────────────────
  // 로그아웃 핸들러 (with 화면 전환)
  // ─────────────────────────────────────────────
  const onLogout = () => {
    handleLogout();
    setView("login");
  };

  // ─────────────────────────────────────────────
  // 로고 클릭 → 오늘 대시보드로
  // ─────────────────────────────────────────────
  const handleLogoClick = () => {
    setCurrentDate(new Date().toISOString().split("T")[0]);
    setView("dashboard");
  };

  // ─────────────────────────────────────────────
  // 목표 수정 (with Toast)
  // ─────────────────────────────────────────────
  const onUpdateGoals = (newGoals) => {
    handleUpdateGoals(newGoals);
    showToast("목표가 수정되었습니다", "success");
  };

  // ─────────────────────────────────────────────
  // 기록 삭제 (with 확인)
  // ─────────────────────────────────────────────
  const onDeleteHistory = (date) => {
    if (!window.confirm(`${date} 기록을 초기화하시겠습니까?`)) return;
    handleDeleteHistory(date);
    clearLogs();
    showToast("기록이 초기화되었습니다", "success");
  };

  // ─────────────────────────────────────────────
  // 히스토리 로드 (날짜 클릭 시)
  // ─────────────────────────────────────────────
  const handleLoadHistory = (date) => {
    setCurrentDate(date);
    setView("dashboard");
  };

  // ─────────────────────────────────────────────
  // 프로필 업데이트 (with Toast)
  // ─────────────────────────────────────────────
  const onUpdateProfile = (updates) => {
    handleUpdateProfile(updates);
    showToast("프로필이 업데이트되었습니다", "success");
  };

  // ─────────────────────────────────────────────
  // CSV 업로드 (자동 동기화 모드에서는 비활성화)
  // ─────────────────────────────────────────────
  const handleFileUpload = () => {
    alert("자동 동기화 모드입니다. CSV 업로드는 필요하지 않습니다.");
  };

  // ─────────────────────────────────────────────
  // Summary Builder (챗봇용)
  // ─────────────────────────────────────────────
  const getSummary = (period) => {
    return buildHydrationSummary(period, {
      currentUser,
      currentDate,
      stats,
      drinkCount
    });
  };

  // ─────────────────────────────────────────────
  // Study 카테고리 선택 핸들러
  // ─────────────────────────────────────────────
  const handleSelectStudyCategory = (category) => {
    if (category === 'book') {
      setView('detail-study-book');
    } else if (category === 'laptop') {
      setView('detail-study-laptop');
    }
    // pen은 잠금 상태이므로 무시
  };

  // ============================================================
  //                          RENDERING
  // ============================================================
  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${
        isDarkMode
          ? "bg-slate-950 text-slate-100"
          : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* 다크 모드 배경 효과 */}
      <div
        className={`fixed top-0 left-0 w-full h-full pointer-events-none z-0 transition-opacity duration-500 ${
          isDarkMode
            ? "opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"
            : "opacity-0"
        }`}
      />

      <div className="relative z-10">
        {view === "login" ? (
          // ─────────────────────────────────────────────
          // 로그인 화면
          // ─────────────────────────────────────────────
          <Login
            onLogin={onLogin}
            onSignup={onSignup}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        ) : (
          <>
            {/* ─────────────────────────────────────────────
                상단 네비게이션바
            ───────────────────────────────────────────── */}
            <NavBar
              user={currentUser}
              setView={setView}
              currentView={view}
              onLogout={onLogout}
              onLogoClick={handleLogoClick}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
            />

            {/* ─────────────────────────────────────────────
                메인 페이지 컨테이너
            ───────────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto p-6 pb-20">
              {/* DASHBOARD */}
              {view === "dashboard" && (
                <Dashboard
                  user={currentUser}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  stats={stats}
                  drinkCount={drinkCount}
                  aiSummary={aiSummary}
                  aiLoading={aiLoading}
                  loading={loading}
                  onFileUpload={handleFileUpload}
                  onNavigate={setView}
                  isDarkMode={isDarkMode}
                  studySummary={studySummary}
                  onGenerateAISummary={fetchAISummary}
                  onResetDay={handleDeleteHistory}
                />
              )}

              {/* WATER DETAIL */}
              {view === "detail-water" && (
                <WaterDetail
                  logs={logs}
                  stats={stats}
                  user={currentUser}
                  onBack={() => setView("dashboard")}
                  onImageAnalysis={handleImageAnalysis}
                  onManualEdit={handleManualLogUpdate}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* STUDY CATEGORY 선택 화면 */}
              {view === "detail-study" && (
                <StudyCategory
                  isDarkMode={isDarkMode}
                  onSelectCategory={handleSelectStudyCategory}
                  onBack={() => setView("dashboard")}
                  studySummary={studySummary}
                  bookLogs={bookLogs}
                  laptopLogs={laptopLogs}
                />
              )}

              {/* BOOK STUDY DETAIL */}
              {view === "detail-study-book" && (
                <BookStudyDetail
                  logs={bookLogs}
                  isDarkMode={isDarkMode}
                  onUpdateLog={updateBookLog}
                  onBack={() => setView("detail-study")}
                />
              )}

              {/* LAPTOP STUDY DETAIL */}
              {view === "detail-study-laptop" && (
                <LaptopStudyDetail
                  logs={laptopLogs}
                  isDarkMode={isDarkMode}
                  onUpdateLog={updateLaptopLog}
                  onBack={() => setView("detail-study")}
                />
              )}

              {/* FOOD */}
              {view === "detail-food" && (
                <ComingSoon
                  title="Meals & Calories"
                  icon={<Utensils size={40} />}
                  onBack={() => setView("dashboard")}
                />
              )}

              {/* PROFILE */}
              {view === "profile" && (
                <Profile
                  user={currentUser}
                  onLoadHistory={handleLoadHistory}
                  onUpdateGoals={onUpdateGoals}
                  onDeleteHistory={onDeleteHistory}
                  onLogout={onLogout}
                  onUpdateProfile={onUpdateProfile}
                  onUpdateHistory={updateHistory} // onUpdateHistory prop 전달
                  isDarkMode={isDarkMode}
                />
              )}
            </div>

            {/* ─────────────────────────────────────────────
                챗봇 + 업적 팝업
            ───────────────────────────────────────────── */}
            <ChatBot
              user={currentUser}
              stats={stats}
              drinkCount={drinkCount}
              currentDate={currentDate}
              buildSummary={getSummary}
            />

            <Achievement
              show={showAchievement}
              onClose={() => setShowAchievement(false)}
              title="Hydration Master!"
              desc="Great job! You reached your daily goal."
            />
          </>
        )}

        {/* ─────────────────────────────────────────────
            전역 Toast 알림
        ───────────────────────────────────────────── */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}
