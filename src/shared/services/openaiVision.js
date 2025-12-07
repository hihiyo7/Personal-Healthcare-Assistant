import { createOpenAIClient, SMALL_MODEL } from './openaiClient.js';

// 이미지에서 물(Water) vs 음료(Drink) 판별
export const analyzeImage = async (base64Img) => {
  const openai = createOpenAIClient();
  const res = await openai.chat.completions.create({
    model: SMALL_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Is this 'Water' (clear) or 'Drink' (colored/soda)? One word answer: Water or Drink." },
        { type: "image_url", image_url: { url: base64Img } }
      ]
    }]
  });
  return res.choices[0].message.content?.trim();
};


