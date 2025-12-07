import { createOpenAIClient, SMALL_MODEL } from './openaiClient.js';

// 1. 데일리 텍스트 리포트
export const generateDailyReport = async (logData, water, otherDrink, name) => {
  const openai = createOpenAIClient();
  const timeline = logData
    .map(l => `- ${l.time}: ${l.isDrink ? '음료수' : '물'} 섭취 (예상 ${l.amount || 0}ml)`)
    .join('\n');

  const prompt = `당신은 ${name} 사용자의 AI 헬스코치입니다.
다음은 수분 섭취 로그입니다.

${timeline}

오늘 총 물 섭취량: ${water}ml
기타 음료 섭취 횟수: ${otherDrink}회

1) 하루 일과를 시간 순서로 짧게 요약하고,
2) 수분 섭취 패턴에 대해 칭찬/아쉬운 점을 말해주고,
3) 내일을 위한 구체적인 행동 팁 2가지를 bullet 형식으로 제안하세요.
한국어로 7줄 이내로 답변하세요.`;

  const res = await openai.chat.completions.create({
    model: SMALL_MODEL,
    messages: [{ role: "user", content: prompt }]
  });
  return res.choices[0].message.content;
};

// 2. 일반 챗봇 대화
export const sendChatMessage = async (history, userMessage, contextData) => {
  const openai = createOpenAIClient();
  const systemPrompt = `당신은 ${contextData.name}님의 개인 헬스케어 AI 비서입니다.
현재 상태: 수분 ${contextData.water}ml / 목표 ${contextData.goal}ml, 날짜 ${contextData.date}, 음료(콜라 등) 섭취 ${contextData.drinkCount}회.
친절하고 전문적으로, 부담스럽지 않게 한글로 답변하세요.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage }
  ];

  const res = await openai.chat.completions.create({
    model: SMALL_MODEL,
    messages
  });
  return res.choices[0].message.content;
};

// 3. 기간 리포트 (일간/주간/월간)
export const generateHydrationReport = async (period, context) => {
  const openai = createOpenAIClient();
  const periodLabel =
    period === 'weekly' ? '이번 주'
    : period === 'monthly' ? '이번 달'
    : '오늘';

  const prompt = `당신은 ${context.name}님의 수분 섭취 코치입니다.
기간: ${periodLabel}
요약 데이터(JSON): 
${JSON.stringify(context.summary, null, 2)}

위 데이터를 기반으로,
1) ${periodLabel} 동안의 수분 섭취 패턴을 3줄 이내로 요약하고,
2) 잘한 점 2가지,
3) 개선하면 좋을 점 2가지,
4) 다음 ${periodLabel}을 위한 구체적인 행동 계획 3가지를 bullet 리스트로 제안하세요.
모두 한국어로, 전체 12줄 이내로 작성하세요.`;

  const res = await openai.chat.completions.create({
    model: SMALL_MODEL,
    messages: [{ role: "user", content: prompt }]
  });
  return res.choices[0].message.content;
};

// 4. 날씨 기반 AI 조언 (현재는 사용 X, 향후 확장용)
export const getWeatherAdvice = async (temp, condition) => {
  try {
    const openai = createOpenAIClient();
    const prompt = `현재 날씨: ${condition}, 현재 기온: ${temp}°C.
사용자에게 오늘 어떤 식으로 물을 챙겨 마시면 좋을지 한국어 한 문장으로만 조언하세요.`;

    const res = await openai.chat.completions.create({
      model: SMALL_MODEL,
      messages: [{ role: "user", content: prompt }]
    });
    return res.choices[0].message.content;
  } catch {
    return "날씨 기반 AI 조언을 가져오지 못했습니다.";
  }
};


