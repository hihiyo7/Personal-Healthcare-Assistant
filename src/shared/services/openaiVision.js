import { createOpenAIClient, SMALL_MODEL } from './openaiClient.js';

// ============================================================
// 이미지 URL을 Base64로 변환 (fetch 사용)
// ============================================================
/**
 * 이미지 URL을 Base64로 변환
 * @param {string} imageUrl - 이미지 경로 (상대 경로 또는 절대 URL)
 * @returns {Promise<string>} Base64 문자열
 */
export const imageUrlToBase64 = async (imageUrl) => {
  try {
    if (!imageUrl) return null;

    // 상대 경로면 window.location.origin 추가
    const fullUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `${window.location.origin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error(`[imageUrlToBase64] Failed to fetch: ${fullUrl}`);
      return null;
    }

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]; // "data:image/..." 제거
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[imageUrlToBase64] Error:', error);
    return null;
  }
};

// ============================================================
// 기존: 이미지에서 물(Water) vs 음료(Drink) 판별
// ============================================================
// base64 형식으로 직접 호출 (호환성 유지)
export const analyzeImage = async (base64Img) => {
  const openai = createOpenAIClient();
  
  // base64Img가 data:image 형식이면 그대로 사용, 아니면 변환
  let imageUrl;
  if (base64Img.startsWith('data:image')) {
    imageUrl = base64Img;
  } else {
    imageUrl = `data:image/jpeg;base64,${base64Img}`;
  }

  const res = await openai.chat.completions.create({
    model: SMALL_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Is this 'Water' (clear) or 'Drink' (colored/soda/beverage)? One word answer: Water or Drink." },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }]
  });
  return res.choices[0].message.content?.trim();
};

// ============================================================
// 신규: 이미지 경로로 물(Water) vs 음료(Drink) 판별
// ============================================================
/**
 * 이미지 경로로부터 물 vs 음료 분석
 * @param {string} imageUrl - 이미지 경로
 * @returns {Promise<string>} "Water" 또는 "Drink"
 */
export const analyzeImageByUrl = async (imageUrl) => {
  const base64 = await imageUrlToBase64(imageUrl);
  if (!base64) {
    console.error('[analyzeImageByUrl] Failed to convert image to base64');
    return null;
  }
  
  return analyzeImage(base64);
};

// ============================================================
// 신규: 학습 활동 분석
// ============================================================
/**
 * 학습 활동 분석 (공부 내용, 집중도 등)
 * @param {string} imageUrl - 캡처된 이미지 경로
 * @returns {Promise<Object>} { activity, confidence, details }
 */
export const analyzeStudyCapture = async (imageUrl) => {
  const openai = createOpenAIClient();
  
  const base64 = await imageUrlToBase64(imageUrl);
  if (!base64) {
    console.error('[analyzeStudyCapture] Failed to convert image to base64');
    return null;
  }

  try {
    const res = await openai.chat.completions.create({
      model: SMALL_MODEL,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `이 이미지에서 다음을 분석해주세요 (JSON 형식만 반환):
{
  "activity": "공부/독서/게임/영상시청/기타",
  "subject": "주요 과목 또는 활동 내용",
  "confidence": 0.0~1.0 사이의 숫자,
  "notes": "추가 관찰 사항"
}

반드시 유효한 JSON만 반환하세요.`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64}` }
          }
        ]
      }]
    });

    const content = res.choices[0].message.content;
    // JSON 부분만 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('[analyzeStudyCapture] Error:', error);
    return null;
  }
};

// ============================================================
// 신규: 배치 분석 - 여러 로그의 이미지 한 번에 처리
// ============================================================
/**
 * 배치 분석: 여러 로그의 이미지를 한 번에 처리
 * @param {Array} logs - 로그 배열 (captureUrl 포함)
 * @param {string} analysisType - 'water' | 'study'
 * @returns {Promise<Array>} 분석 결과가 추가된 로그 배열
 */
export const analyzeMultipleCaptures = async (logs, analysisType = 'water') => {
  if (!Array.isArray(logs)) return logs;

  const analyzeFunc = analysisType === 'water' ? analyzeImageByUrl : analyzeStudyCapture;
  
  const results = await Promise.all(
    logs.map(async (log) => {
      if (!log.captureUrl) return log;

      try {
        const analysis = await analyzeFunc(log.captureUrl);
        return {
          ...log,
          aiAnalysis: analysis,
          analyzedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error(`[analyzeMultipleCaptures] Error for log ${log.id}:`, error);
        return { ...log, aiAnalysis: null };
      }
    })
  );

  return results;
};

export default {
  analyzeImage,
  analyzeImageByUrl,
  analyzeStudyCapture,
  analyzeMultipleCaptures,
  imageUrlToBase64
};


