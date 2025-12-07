// ★ 임시 버전: OpenAI 호출 제거용 Mock 서비스
// 나중에 실제 OpenAI 연동을 다시 붙일 때 이 파일에서만 교체하면 됩니다.

// 1) 이미지 분석 Mock: 항상 "Water (Mock)" 으로 반환
export const analyzeImage = async (_base64Img) => {
  // 네트워크 호출 없이 바로 응답
  return "Water (Mock)";
};

// 2) 데일리 리포트 Mock: 간단한 한국어 안내 문구
export const generateDailyReport = async (logData, water, otherDrink, name) => {
  const count = logData?.length || 0;
  return `${name}님의 오늘 로그 ${count}건이 등록되었습니다.\n` +
    `추후 OpenAI 연동이 활성화되면, 실제 AI 기반 하루 요약 리포트가 이곳에 표시됩니다.\n` +
    `(현재 집계: 물 ${water}ml, 기타 음료 ${otherDrink}회)`;
};

// 3) 일반 챗봇 대화 Mock
export const sendChatMessage = async (_history, userMessage, contextData) => {
  return `현재는 OpenAI 연동이 비활성화된 상태입니다.\n` +
    `그래도 간단히 답을 드리면, "${userMessage}" 에 대해 ` +
    `${contextData.name}님의 수분 목표는 ${contextData.goal}ml 이고 ` +
    `현재 섭취량은 ${contextData.water}ml 입니다. 오늘도 물 한 잔 더 챙겨보면 좋겠어요!`;
};

// 4) 기간 리포트 Mock (일/주/월 공통)
export const generateHydrationReport = async (period, context) => {
  const { name, summary } = context || {};
  const label =
    period === 'weekly' ? '이번 주'
    : period === 'monthly' ? '이번 달'
    : '오늘';

  return `${name ?? '사용자'}님의 ${label} 수분 리포트(임시 버전)입니다.\n` +
    `지금은 OpenAI 연결이 꺼져 있어서, 요약 데이터만 간단히 보여드립니다.\n\n` +
    `요약 데이터:\n${JSON.stringify(summary ?? {}, null, 2)}\n\n` +
    `나중에 OpenAI를 다시 활성화하면, 이 데이터를 기반으로 AI가 자연어 리포트를 생성하게 됩니다.`;
};

// 5) 날씨 기반 조언 Mock
export const getWeatherAdvice = async (temp, condition) => {
  return `현재 날씨(${condition}, ${temp}°C)를 참고했을 때, ` +
    `너무 무리하지 말고 갈증을 느끼기 전에도 조금씩 물을 마셔 주세요. (AI 조언 Mock)`;
};


