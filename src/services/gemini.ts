import { GoogleGenerativeAI } from '@google/generative-ai';
import { Gathering, Recommendation } from '../types';
import { buildPrompt, parseRecommendations } from '../utils/prompt';

export async function getRecommendations(
  apiKey: string,
  gathering: Gathering
): Promise<Recommendation[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = buildPrompt(gathering);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseRecommendations(text);
}
