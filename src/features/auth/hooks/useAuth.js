// src/hooks/useAuth.js
// 사용자 인증 및 관리 커스텀 훅

import { useState, useCallback } from 'react';
import { generatePastHistory, normalizeHistory } from '../utils/historyUtils';

/**
 * 사용자 인증 및 관리 훅
 */
export const useAuth = () => {
  // ─────────────────────────────────────────────
  // 사용자 목록 (localStorage에서 로드)
  // ─────────────────────────────────────────────
  const [users, setUsers] = useState(() => {
    const savedUsers = localStorage.getItem('allUsers');
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        return parsed.map(u => {
          const goalWater = u?.goals?.water || 0;
          return { ...u, history: normalizeHistory(u.history, goalWater) };
        });
      } catch {
        // 파싱 에러 시 기본값
      }
    }
    // 기본 사용자
    return [{
      id: 'admin',
      pw: '1234',
      name: 'Gaeun Seo',
      goals: { water: 2000, study: 300, calories: 1800 },
      history: generatePastHistory(7)
    }];
  });

  // ─────────────────────────────────────────────
  // 현재 로그인한 사용자
  // ─────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const goalWater = parsed?.goals?.water || 0;
      return { ...parsed, history: normalizeHistory(parsed.history, goalWater) };
    } catch {
      return null;
    }
  });

  // ─────────────────────────────────────────────
  // 로그인
  // ─────────────────────────────────────────────
  const handleLogin = useCallback((id, pw) => {
    const user = users.find(u => u.id === id && u.pw === pw);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem("currentUser", JSON.stringify(user));
      return true;
    }
    return false;
  }, [users]);

  // ─────────────────────────────────────────────
  // 회원가입
  // ─────────────────────────────────────────────
  const handleSignup = useCallback((name, id, pw) => {
    if (users.find(u => u.id === id)) {
      return { success: false, message: "ID 중복" };
    }
    const newUser = {
      id,
      pw,
      name,
      goals: { water: 2000, study: 300, calories: 1800 },
      history: generatePastHistory(7)
    };
    const newUsers = [...users, newUser];
    setUsers(newUsers);
    localStorage.setItem("allUsers", JSON.stringify(newUsers));
    return { success: true, message: "가입 완료" };
  }, [users]);

  // ─────────────────────────────────────────────
  // 로그아웃
  // ─────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.clear();
  }, []);

  // ─────────────────────────────────────────────
  // 사용자 정보 업데이트 (공통 함수)
  // ─────────────────────────────────────────────
  const updateUser = useCallback((updates) => {
    if (!currentUser) return;

    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));

    const updatedUsers = users.map(u =>
      u.id === currentUser.id ? updatedUser : u
    );
    setUsers(updatedUsers);
    localStorage.setItem("allUsers", JSON.stringify(updatedUsers));

    return updatedUser;
  }, [currentUser, users]);

  // ─────────────────────────────────────────────
  // 목표 수정
  // ─────────────────────────────────────────────
  const handleUpdateGoals = useCallback((newGoals) => {
    return updateUser({ goals: newGoals });
  }, [updateUser]);

  // ─────────────────────────────────────────────
  // 프로필 업데이트
  // ─────────────────────────────────────────────
  const handleUpdateProfile = useCallback((profileUpdates) => {
    return updateUser(profileUpdates);
  }, [updateUser]);

  // ─────────────────────────────────────────────
  // 히스토리 업데이트
  // ─────────────────────────────────────────────
  const updateHistory = useCallback((newHistory) => {
    return updateUser({ history: newHistory });
  }, [updateUser]);

  // ─────────────────────────────────────────────
  // 기록 삭제
  // ─────────────────────────────────────────────
  const handleDeleteHistory = useCallback((date) => {
    if (!currentUser) return false;
    const newHistory = currentUser.history.filter(h => h.date !== date);
    updateUser({ history: newHistory });
    return true;
  }, [currentUser, updateUser]);

  return {
    users,
    currentUser,
    setCurrentUser,
    handleLogin,
    handleSignup,
    handleLogout,
    handleUpdateGoals,
    handleUpdateProfile,
    handleDeleteHistory,
    updateHistory,
    updateUser
  };
};

export default useAuth;


