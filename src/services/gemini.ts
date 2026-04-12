import { Gathering, Recommendation } from '../types';
import { buildPrompt, parseRecommendations } from '../utils/prompt';
import { loadSettings } from './storage';

const MODEL = 'gemini-2.5-flash-lite';
const MAX_RETRIES = 2;

function parseRetryDelay(errText: string): number {
  const match = errText.match(/retry in (\d+)/i);
  return match ? Math.min(parseInt(match[1], 10) + 1, 30) : 10;
}

function sleep(sec: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

async function callViaProxy(proxyUrl: string, prompt: string): Promise<string> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429 || errText.includes('quota')) {
      const delay = parseRetryDelay(errText);
      throw { message: errText, isQuota: true, retryDelay: delay };
    }
    throw { message: errText, isQuota: false, retryDelay: 0 };
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callDirect(apiKey: string, prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model: MODEL });
  const result = await m.generateContent(prompt);
  return result.response.text();
}

export async function getRecommendations(
  _apiKey: string,
  gathering: Gathering,
  onRetry?: (sec: number) => void
): Promise<Recommendation[]> {
  const settings = loadSettings();
  const proxyUrl = settings.proxyUrl;
  const apiKey = settings.geminiApiKey;
  const prompt = buildPrompt(gathering);

  if (!proxyUrl && !apiKey) {
    throw new Error('Gemini API 키 또는 프록시 URL을 설정해주세요. (설정 페이지)');
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let text: string;
      if (proxyUrl) {
        text = await callViaProxy(proxyUrl, prompt);
      } else {
        text = await callDirect(apiKey, prompt);
      }
      return parseRecommendations(text);
    } catch (err: any) {
      const isQuota = err?.isQuota || err?.message?.includes('429') || err?.message?.includes('quota');
      if (isQuota && attempt < MAX_RETRIES) {
        const delay = err?.retryDelay || 10;
        onRetry?.(delay);
        await sleep(delay);
        continue;
      }
      if (isQuota) {
        throw new Error('Gemini API 분당 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(err.message?.includes('설정해주세요') ? err.message : `AI 추천 중 오류가 발생했습니다: ${err.message?.slice(0, 100)}`);
    }
  }

  throw new Error('요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
}
