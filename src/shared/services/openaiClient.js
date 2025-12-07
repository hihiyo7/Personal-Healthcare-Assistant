import OpenAI from 'openai';

// ★ OpenAI 클라이언트 공통 설정
// 실제 프로젝트에서는 .env에 VITE_OPENAI_API_KEY 로 넣어두고 불러오는 걸 추천합니다.
const API_KEY = import.meta.env?.VITE_OPENAI_API_KEY || "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export const createOpenAIClient = () => {
  if (!API_KEY || !API_KEY.startsWith("sk-")) {
    throw new Error("OpenAI API Key Missing");
  }
  return new OpenAI({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
};

export const SMALL_MODEL = 'gpt-4o-mini';


