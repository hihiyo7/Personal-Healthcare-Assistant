import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Utensils } from 'lucide-react';

// ====== 커스텀 훅 (Feature-based path) ======
import { useAuth } from './features/auth/hooks/useAuth';
import { useWaterLogs } from './features/water/hooks/useWaterLogs';
import { useStudyLogs } from './features/study/hooks/useStudyLogs';

// ====== 유틸리티 (Feature-based path) ======
import { buildHydrationSummary } from './shared/utils/summaryBuilder';
// import { updateHistoryEntry } from './features/auth/utils/historyUtils'; // 사용 안함
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
  // 화면 상태
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
  // 히스토리 업데이트 콜백
  // ─────────────────────────────────────────────
// 기존 함수 전체를 아래 코드로 교체
const handleHistoryUpdate = useCallback((date, totalWater, studyMinutes = 0) => {
  if (!currentUser) return;

  const water = totalWater || 0;
  const study = studyMinutes || 0;

  const waterGoal = currentUser.goals?.water || 2000;
  const studyGoal = currentUser.goals?.study || 300;

  const combinedScore = calculateOverallScore(water, waterGoal, study, studyGoal);

  const newEntry = {
    date,
    score: combinedScore,
    water,
    study,
    calories: 0,
    feedback: `오늘 물 ${water}ml, 공부 ${study}분`,
  };

  let updatedHistory = currentUser.history ? [...currentUser.history] : [];
  const existingIndex = updatedHistory.findIndex((h) => h.date === date);
  const hasExisting = existingIndex !== -1;

  // 완전히 빈 날인데, 기존 히스토리도 없으면 새로 안 만든다
  if (!hasExisting && water === 0 && study === 0) {
    return;
  }

  if (hasExisting) {
    const existing = updatedHistory[existingIndex];

    // 값이 완전히 같으면 굳이 다시 저장 안 함
    if (
      existing.water === newEntry.water &&
      existing.study === newEntry.study &&
      existing.score === newEntry.score
    ) {
      return;
    }

    updatedHistory[existingIndex] = {
      ...existing,
      ...newEntry,
    };
  } else {
    updatedHistory.push(newEntry);
  }

  if (JSON.stringify(currentUser.history) !== JSON.stringify(updatedHistory)) {
    updateHistory(updatedHistory);
  }
}, [currentUser, updateHistory]);


  // ─────────────────────────────────────────────
  // Study 로그 훅 사용 [FIX: 중요 수정]
  // ─────────────────────────────────────────────
  const {
    bookLogs,
    laptopLogs,
    // todayBookLogs, // (필요 없으면 삭제)
    // todayLaptopLogs, // (필요 없으면 삭제)
    totalStudyMin,
    totalBookMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    hasServerData: hasStudyData,
    
    // [FIX] 여기서 정확한 함수명을 꺼내야 합니다.
    handleUpdateBookInfo,  // 책 정보 저장 함수
    handleManualLogUpdate: updateLaptopLog, // 랩탑용 수정 함수 (이름 매핑)
    
    // [FIX] Study용 이미지 분석 함수 (이름 충돌 방지 위해 별칭 사용)
    handleImageAnalysis: handleStudyImageAnalysis 
  } = useStudyLogs(currentDate);

  const studySummary = useMemo(() => ({
    totalStudyMin,
    totalBookMin,
    bookLogs,
    totalLaptopMin: totalLaptopStudyMin,
    totalLaptopStudyMin,
    totalLaptopNonStudyMin,
    hasServerData: hasStudyData
  }), [totalStudyMin, totalBookMin, totalLaptopStudyMin, totalLaptopNonStudyMin, hasStudyData]);

  // ─────────────────────────────────────────────
  // 물 로그 훅 사용
  // ─────────────────────────────────────────────
  const {
    logs,
    stats,
    statsDate,
    drinkCount,
    aiSummary,
    aiLoading,
    loading,
    handleImageAnalysis, // Water용 이미지 분석
    handleManualLogUpdate, // Water용 수동 수정
    clearLogs,
    fetchAISummary
  } = useWaterLogs(currentDate, currentUser, null, studySummary);

  // 물/공부 데이터가 모두 계산된 뒤 History를 갱신
  useEffect(() => {
    if (!currentUser) return;
    // stats가 아직 다른 날짜 기준이면 history 업데이트 금지
    if (!statsDate || statsDate !== currentDate) return;

    const totalWater = stats.waterMl || 0;
    const studyMinutes = totalStudyMin || 0;

    // 완전히 비어 있는 날 + 기존 히스토리도 없는 날은 handleHistoryUpdate에서 걸러진다.
    handleHistoryUpdate(currentDate, totalWater, studyMinutes);
  }, [currentUser, currentDate, statsDate, stats.waterMl, totalStudyMin, handleHistoryUpdate]);

  // ─────────────────────────────────────────────
  // localStorage 동기화
  // ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('lastView', view);
    localStorage.setItem('viewingDate', currentDate);
  }, [view, currentDate]);

  // ─────────────────────────────────────────────
  // 핸들러들
  // ─────────────────────────────────────────────
  const onLogin = (id, pw) => {
    const success = handleLogin(id, pw);
    if (success) setView("dashboard");
    else alert("로그인 실패");
  };

  const onSignup = (name, id, pw) => {
    const result = handleSignup(name, id, pw);
    alert(result.message);
    return result.success;
  };

  const onLogout = () => {
    handleLogout();
    setView("login");
  };

  const handleLogoClick = () => {
    setCurrentDate(new Date().toISOString().split("T")[0]);
    setView("dashboard");
  };

  const onUpdateGoals = (newGoals) => {
    handleUpdateGoals(newGoals);
    showToast("목표가 수정되었습니다", "success");
  };

  const onDeleteHistory = (date) => {
    if (!window.confirm(`${date} 기록을 초기화하시겠습니까?`)) return;
    handleDeleteHistory(date);
    clearLogs();
    showToast("기록이 초기화되었습니다", "success");
  };

  const handleLoadHistory = (date) => {
    setCurrentDate(date);
    setView("dashboard");
  };

  const onUpdateProfile = (updates) => {
    handleUpdateProfile(updates);
    showToast("프로필이 업데이트되었습니다", "success");
  };

  const handleFileUpload = () => {
    alert("자동 동기화 모드입니다. CSV 업로드는 필요하지 않습니다.");
  };

  const getSummary = (period) => {
    return buildHydrationSummary(period, {
      currentUser,
      currentDate,
      stats,
      drinkCount
    });
  };

  const handleSelectStudyCategory = (category) => {
    if (category === 'book') setView('detail-study-book');
    else if (category === 'laptop') setView('detail-study-laptop');
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
      <div
        className={`fixed top-0 left-0 w-full h-full pointer-events-none z-0 transition-opacity duration-500 ${
          isDarkMode
            ? "opacity-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"
            : "opacity-0"
        }`}
      />

      <div className="relative z-10">
        {view === "login" ? (
          <Login
            onLogin={onLogin}
            onSignup={onSignup}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        ) : (
          <>
            <NavBar
              user={currentUser}
              setView={setView}
              currentView={view}
              onLogout={onLogout}
              onLogoClick={handleLogoClick}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
            />

            <div className="max-w-6xl mx-auto p-6 pb-20">
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

              {view === "detail-water" && (
                <WaterDetail
                  logs={logs}
                  stats={stats}
                  user={currentUser}
                  onBack={() => setView("dashboard")}
                  onImageAnalysis={handleImageAnalysis} // Water 분석
                  onManualEdit={handleManualLogUpdate} // Water 수정
                  isDarkMode={isDarkMode}
                />
              )}

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

              {/* [FIX] BookStudyDetail 연결부 수정 */}
              {view === "detail-study-book" && (
                <BookStudyDetail
                  logs={bookLogs}
                  isDarkMode={isDarkMode}
                  onBack={() => setView("detail-study")}
                  // [중요] 저장 함수 연결 (onUpdateLog -> onUpdateBook)
                  onUpdateBook={handleUpdateBookInfo} 
                  // [중요] AI 분석 함수 연결
                  onImageAnalysis={handleStudyImageAnalysis} 
                />
              )}

              {view === "detail-study-laptop" && (
                <LaptopStudyDetail
                  logs={laptopLogs}
                  isDarkMode={isDarkMode}
                  onUpdateLog={updateLaptopLog}
                  onBack={() => setView("detail-study")}
                  onImageAnalysis={handleStudyImageAnalysis}  // ★ 추가
                />
              )}


              {view === "detail-food" && (
                <ComingSoon
                  title="Meals & Calories"
                  icon={<Utensils size={40} />}
                  onBack={() => setView("dashboard")}
                />
              )}

              {view === "profile" && (
                <Profile
                  user={currentUser}
                  onLoadHistory={handleLoadHistory}
                  onUpdateGoals={onUpdateGoals}
                  onDeleteHistory={onDeleteHistory}
                  onLogout={onLogout}
                  onUpdateProfile={onUpdateProfile}
                  onUpdateHistory={updateHistory}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>

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
