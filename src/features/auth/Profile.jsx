import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { User, Calendar, Edit2, Save, ChevronDown, ChevronRight, Trash2, PenTool, Settings, Camera, Droplets, BookOpen, Utensils, TrendingUp, Activity, Award, Target } from 'lucide-react';
import CalendarView from './components/CalendarView';
import { recalculateHistoryScores } from './utils/historyUtils';

export default function Profile({ user, onLoadHistory, onUpdateGoals, onDeleteHistory, isDarkMode, onLogout, onUpdateProfile, onUpdateHistory }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoals, setTempGoals] = useState({ ...user.goals });
  
  // 처음에 3개만 보여주고, 더보기 누르면 7개 다 보여줌
  const [visibleCount, setVisibleCount] = useState(3);
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [newPassword, setNewPassword] = useState('');

  const handleSave = () => {
    // 목표와 재계산된 히스토리를 한 번에 업데이트 (Race Condition 방지)
    const updates = { goals: tempGoals };
    
    if (user.history) {
      updates.history = recalculateHistoryScores(user.history, tempGoals.water, tempGoals.study);
    }

    // useAuth의 updateUser를 통해 일괄 업데이트 및 저장
    if (onUpdateProfile) {
      onUpdateProfile(updates);
    } else {
      // Fallback (개별 업데이트)
      onUpdateGoals(tempGoals);
      if (onUpdateHistory && updates.history) {
        onUpdateHistory(updates.history);
      }
    }

    setIsEditing(false);
  };

  // 더보기 누르면 7개 전체 보여주기
  const handleShowMore = () => setVisibleCount(7);

  const handleProfileUpdate = () => {
    if (editName.trim()) {
      onUpdateProfile?.({ name: editName, password: newPassword || undefined });
    }
    setShowEditProfile(false);
    setShowProfileMenu(false);
  };

  const handleDeleteAccount = () => {
    if (window.confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) {
      onLogout?.();
    }
  };

  const handleEditHistory = (date) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onLoadHistory(date);
  };

  // 오늘 기준 최근 7일 필터링
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const recentHistory = user.history.filter(record => {
    const recordDate = new Date(record.date + 'T00:00:00');
    return recordDate >= sevenDaysAgo && recordDate <= today;
  });

  const sortedHistory = recentHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  const theme = {
    card: isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200',
    text: isDarkMode ? 'text-slate-100' : 'text-slate-800',
    subText: isDarkMode ? 'text-slate-400' : 'text-slate-500',
  };

  // 점수 계산 (업데이트된 히스토리 반영됨)
  // 실제 데이터가 있는 날만 카운트 (water > 0 || study > 0 || calories > 0)
  const recordsWithData = user.history.filter(h => 
    (h.water || 0) > 0 || (h.study || 0) > 0 || (h.calories || 0) > 0
  );
  const avgScore = recordsWithData.length > 0
    ? Math.round(recordsWithData.reduce((sum, h) => sum + (h.score || 0), 0) / recordsWithData.length)
    : 0;
  const successDays = recordsWithData.filter(h => (h.score || 0) >= 90).length;
  const totalRecords = recordsWithData.length;

  // 프로필 수정 모달 - Portal로 body에 직접 렌더링 (배경 없음, 모달만 표시)
  const ProfileEditModal = showEditProfile ? ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={() => setShowEditProfile(false)}
    >
      <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <h3 className={`text-lg font-bold mb-4 ${theme.text}`}>프로필 수정</h3>
        <div className="space-y-4">
          <div>
            <label className={`text-xs font-semibold mb-1 block ${theme.subText}`}>이름</label>
            <input 
              type="text" 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)}
              className={`w-full p-3 rounded-xl border outline-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold mb-1 block ${theme.subText}`}>새 비밀번호 (선택)</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="변경할 경우에만 입력"
              className={`w-full p-3 rounded-xl border outline-none ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 focus:border-blue-500'}`}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowEditProfile(false)} className={`flex-1 py-3 rounded-xl font-medium ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>취소</button>
            <button onClick={handleProfileUpdate} className="flex-1 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500">저장</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {ProfileEditModal}

      <div className="space-y-6 animate-fade-in pb-10">
      
      {/* 1. 프로필 헤더 */}
      <div className={`rounded-3xl border shadow-sm ${theme.card}`}>
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5 group">
              <div className={`w-36 h-36 rounded-full overflow-hidden border-4 shadow-lg transition-transform duration-300 group-hover:scale-105 ${
                isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-100'
              }`}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={56} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                  </div>
                )}
              </div>
              
              {/* 프로필 이미지 수정 버튼 */}
              <button
                onClick={() => document.getElementById('avatarInput').click()}
                className={`absolute bottom-0 right-0 w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg transition-all transform group-hover:scale-110 ${
                  isDarkMode ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="프로필 이미지 변경"
              >
                <Camera size={18} />
              </button>
              <input id="avatarInput" type="file" accept="image/*" className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => onUpdateProfile && onUpdateProfile({ avatar: ev.target?.result });
                    reader.readAsDataURL(file);
                  }
                }} 
              />
            </div>

            <div className="relative text-center">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`text-2xl font-bold flex items-center gap-2 hover:opacity-80 transition ${theme.text}`}
              >
                {user.name}
                <ChevronDown size={18} className={`transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''} ${theme.subText}`} />
              </button>
              <p className={`text-sm mt-1 ${theme.subText}`}>@{user.id}</p>

              {showProfileMenu && (
                <div className={`absolute top-full mt-3 left-1/2 transform -translate-x-1/2 w-44 rounded-2xl shadow-xl border overflow-hidden z-50 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  <div className="p-2">
                    <button
                      onClick={() => { setShowEditProfile(true); setShowProfileMenu(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition ${
                        isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Settings size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} /> 
                      프로필 수정
                    </button>
                    <div className={`h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`} />
                    <button
                      onClick={handleDeleteAccount}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-500 transition ${
                        isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                      }`}
                    >
                      <Trash2 size={16} /> 탈퇴하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Award size={18} />} label="평균 점수" value={avgScore} suffix="점" color="text-amber-500" bg="bg-amber-100" isDarkMode={isDarkMode} />
            <StatCard icon={<Target size={18} />} label="목표 달성" value={successDays} suffix="일" color="text-emerald-500" bg="bg-emerald-100" isDarkMode={isDarkMode} />
            <StatCard icon={<Activity size={18} />} label="총 기록" value={totalRecords} suffix="일" color="text-blue-500" bg="bg-blue-100" isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>

      {/* 2. 목표 설정 */}
      <div className={`rounded-3xl border shadow-sm p-6 ${theme.card}`}>
        <div className="flex justify-between items-center mb-5">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
            <Target size={20} className="text-blue-500" />
            Daily Goals
          </h3>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className={`text-xs font-semibold flex items-center gap-1.5 px-4 py-2 rounded-full transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Edit2 size={14} /> 수정
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setIsEditing(false); setTempGoals({ ...user.goals }); }} className={`text-xs font-semibold px-4 py-2 rounded-full transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>취소</button>
              <button onClick={handleSave} className="text-xs font-semibold px-4 py-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-1.5"><Save size={14} /> 저장</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GoalCard icon={<Droplets size={22} />} label="물 섭취량" value={tempGoals.water} unit="ml" color="blue" isEditing={isEditing} onChange={(v) => setTempGoals({...tempGoals, water: Number(v)})} isDarkMode={isDarkMode} />
          <GoalCard icon={<BookOpen size={22} />} label="공부 시간" value={tempGoals.study} unit="min" color="amber" isEditing={isEditing} onChange={(v) => setTempGoals({...tempGoals, study: Number(v)})} isDarkMode={isDarkMode} />
          <GoalCard icon={<Utensils size={22} />} label="칼로리" value={tempGoals.calories} unit="kcal" color="green" isEditing={isEditing} onChange={(v) => setTempGoals({...tempGoals, calories: Number(v)})} isDarkMode={isDarkMode} />
        </div>
      </div>

      {/* 3. 리포트 배너 */}
      <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); onLoadHistory?.('report'); }} className={`w-full rounded-3xl border shadow-sm p-5 transition-all hover:shadow-md active:scale-[0.99] ${theme.card}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
              <TrendingUp size={22} className="text-sky-500" />
            </div>
            <div className="text-left">
              <h3 className={`font-bold ${theme.text}`}>Health Report</h3>
              <p className={`text-sm ${theme.subText}`}>일간/주간/월간 분석 보기</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-sky-500" />
        </div>
      </button>

      {/* 4. 달력 */}
      <CalendarView history={user.history} goals={user.goals} onDateClick={handleEditHistory} isDarkMode={isDarkMode} />

      {/* 5. 최근 기록 리스트 */}
      <div className={`rounded-3xl border shadow-sm p-6 ${theme.card}`}>
        <h3 className={`text-lg font-bold mb-5 flex items-center gap-2 ${theme.text}`}>
          <Calendar size={20} className="text-violet-600" /> 
          Recent History
          <span className={`text-xs font-normal ${theme.subText}`}>(최근 7일)</span>
        </h3>

        <div className="space-y-3">
          {sortedHistory.length > 0 ? (
            sortedHistory.slice(0, visibleCount).map((record, idx) => {
              const hasScore = typeof record.score === 'number' && !Number.isNaN(record.score);
              const scoreDisplay = hasScore ? record.score : 0;
              const waterMl = record.water || 0;
              const studyMin = record.study || 0;
              const waterGoal = user.goals?.water || 2000;
              const studyGoal = user.goals?.study || 300;
              const waterPct = waterGoal > 0 ? Math.min(Math.round((waterMl / waterGoal) * 100), 100) : 0;
              const studyPct = studyGoal > 0 ? Math.min(Math.round((studyMin / studyGoal) * 100), 100) : 0;
              
              return (
                <div key={idx} className={`group flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-sm ${isDarkMode ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-700/50' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => handleEditHistory(record.date)}>
                    <ScoreBadge score={scoreDisplay} hasData={waterMl > 0 || studyMin > 0} isDarkMode={isDarkMode} />
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${theme.text}`}>{record.date}</p>
                      <div className={`flex items-center gap-3 text-sm ${theme.subText}`}>
                        <span className="text-blue-500">Water {waterMl}ml ({waterPct}%)</span>
                        <span className="text-violet-500">Study {studyMin}min ({studyPct}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleEditHistory(record.date); }} className={`p-2.5 rounded-xl transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`} title="수정"><PenTool size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteHistory(record.date); }} className={`p-2.5 rounded-xl transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white' : 'bg-slate-200 text-slate-500 hover:bg-red-500 hover:text-white'}`} title="초기화"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className={`text-center py-10 ${theme.subText}`}>최근 7일간 기록이 없습니다</p>
          )}
        </div>

        {/* 3개 이상이면 더보기 버튼 표시 */}
        {sortedHistory.length > visibleCount && (
          <button 
            onClick={handleShowMore}
            className={`w-full mt-5 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition ${isDarkMode ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            더 보기 <ChevronDown size={16} />
          </button>
        )}
      </div>

    </div>
    </>
  );
}

function StatCard({ icon, label, value, suffix, color, bg, isDarkMode }) {
  return (
    <div className={`p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className={`inline-flex p-2 rounded-xl mb-2 ${isDarkMode ? 'bg-slate-700/50 text-slate-400' : bg}`}>
        {React.cloneElement(icon, { className: isDarkMode ? color : color.replace('500', '600') })}
      </div>
      <p className={`text-xs font-medium mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
        {value}<span className="text-xs font-normal ml-0.5 opacity-60">{suffix}</span>
      </p>
    </div>
  );
}

function GoalCard({ icon, label, value, unit, color, isEditing, onChange, isDarkMode }) {
  const colorMap = {
    blue: isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
    amber: isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600',
    green: isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
        <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
      </div>
      {isEditing ? (
        <div className="relative">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full p-2 rounded-lg border text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          />
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</span>
        </div>
      ) : (
        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          {value.toLocaleString()}
          <span className={`text-sm font-normal ml-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>
        </p>
      )}
    </div>
  );
}

function ScoreBadge({ score, hasData, isDarkMode }) {
  if (!hasData) return <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>-</div>;
  
  let colorClass = '';
  if (score >= 90) colorClass = isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-600 border-emerald-200';
  else if (score >= 70) colorClass = isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-600 border-blue-200';
  else if (score >= 40) colorClass = isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-600 border-amber-200';
  else colorClass = isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-600 border-red-200';

  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${colorClass}`}>
      {score}
    </div>
  );
}
