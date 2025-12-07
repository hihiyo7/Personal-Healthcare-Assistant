// src/services/apiService.js
// ============================================================
// API 서비스 - 서버 통신 담당
// ============================================================

const API_BASE_URL = "http://localhost:8000";

// 1. 특정 날짜의 물 마시기 로그 가져오기
export const fetchWaterLogs = async (dateStr) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs/water/${dateStr}`);

    if (!response.ok) {
      console.warn("데이터를 가져오지 못했습니다. (CSV 파일이 없을 수 있음)");
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching water logs:", error);
    return [];
  }
};

// 2. 특정 날짜의 공부 로그 가져오기
// 반환: { logs: [], totalBookMin: 0, totalLaptopMin: 0 }
export const fetchStudyLogs = async (dateStr) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs/study/${dateStr}`);

    if (!response.ok) {
      console.warn("Study 데이터를 가져오지 못했습니다. (CSV 파일이 없을 수 있음)");
      return { logs: [], totalBookMin: 0, totalLaptopMin: 0 };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching study logs:", error);
    return { logs: [], totalBookMin: 0, totalLaptopMin: 0 };
  }
};

// 3. 이미지 분석 요청
export const analyzeDrinkImage = async (logId, imageFilename) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        log_id: logId,
        image_filename: imageFilename
      }),
    });

    if (!response.ok) throw new Error("Analysis failed");
    return await response.json();

  } catch (error) {
    console.error("Error analyzing image:", error);
    return { result: "Error" };
  }
};

// 4. AI Daily Summary 생성 요청 (Gemini API)
export const generateAISummary = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: data.date,
        waterMl: data.waterMl,
        waterGoal: data.waterGoal,
        studyMin: data.studyMin,
        studyGoal: data.studyGoal,
        // 책 정보 추가
        bookInfo: data.bookInfo || null,
        laptopInfo: data.laptopInfo || null
      }),
    });

    if (!response.ok) {
      console.warn("AI Summary 생성 실패");
      return null;
    }

    const result = await response.json();
    return result.summary;
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return null;
  }
};
