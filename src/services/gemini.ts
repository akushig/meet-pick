import { Gathering, Place, Recommendation } from '../types';
import { buildPrompt, parseRecommendations } from '../utils/prompt';
import { loadSettings } from './storage';
import { distanceKm, loadKakaoMap, verifyPlace, verifyRegion } from './kakaoMap';

const MODEL = 'gemini-2.5-flash-lite';
const MAX_RETRIES = 2;
// 지역 중심 ↔ 장소 좌표 허용 거리 (km). 이 값을 넘으면 지역-장소 괴리로 보고 제외.
const REGION_PLACE_MAX_KM = 2.5;

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

export interface RecommendationResult {
  summary: string;
  recommendations: Recommendation[];
}

interface ValidateOpts {
  onProgress?: (msg: string) => void;
}

/**
 * AI 추천 결과를 카카오맵으로 검증·보정 (region/place 모두 병렬).
 * - region·place 검증을 Promise.all로 동시 실행 (기존: for-of 직렬)
 * - verifyRegion 실패 region 제외, verifyPlace 실패/거리 초과 place 제외
 * - 통과 항목은 카카오 정식 주소/좌표/카테고리로 교체
 * - AI 순서(regions, places) 유지 (Promise.all 결과는 입력 순서 보존)
 * - rank(1/2/3)는 상위 3개 지역의 각 첫 장소에 재할당
 */
async function validateAndEnrich(recs: Recommendation[], opts?: ValidateOpts): Promise<Recommendation[]> {
  await loadKakaoMap();

  const totalPlaces = recs.reduce((n, r) => n + r.places.length, 0);
  let doneCount = 0;
  const tick = () => {
    doneCount++;
    opts?.onProgress?.(`Kakao 지도에서 장소 검증 중 (${doneCount}/${totalPlaces})...`);
  };

  const validatedMaybe: (Recommendation | null)[] = await Promise.all(
    recs.map(async (rec): Promise<Recommendation | null> => {
      const regionResult = await verifyRegion(rec.region);
      if (!regionResult) {
        // 지역이 조회 안 되면 place 검증 없이 스킵하지만, 진행률은 진행
        rec.places.forEach(() => tick());
        return null;
      }
      const placeResults = await Promise.all(
        rec.places.map(async (p): Promise<Place | null> => {
          const v = await verifyPlace(p.name, rec.region);
          tick();
          if (!v) return null;
          const dist = distanceKm(regionResult.coord, v.coord);
          if (dist > REGION_PLACE_MAX_KM) return null;
          return {
            name: v.name,
            category: p.category || v.category || '',
            address: v.address || p.address,
            coord: v.coord,
            reason: p.reason,
            travelTimes: p.travelTimes,
          };
        })
      );
      const validPlaces = placeResults.filter((p): p is Place => p !== null);
      if (validPlaces.length === 0) return null;
      return {
        region: rec.region,
        regionCoord: regionResult.coord,
        places: validPlaces,
      };
    })
  );

  opts?.onProgress?.('결과 정리 중...');

  const validated = validatedMaybe.filter((v): v is Recommendation => v !== null);

  for (let i = 0; i < Math.min(3, validated.length); i++) {
    const first = validated[i].places[0];
    if (first) first.rank = i + 1;
  }

  return validated;
}

export async function getRecommendations(
  _apiKey: string,
  gathering: Gathering,
  onRetry?: (sec: number) => void,
  onProgress?: (msg: string) => void
): Promise<RecommendationResult> {
  const settings = loadSettings();
  const proxyUrl = settings.proxyUrl;
  const apiKey = settings.geminiApiKey;
  const prompt = buildPrompt(gathering);

  if (!proxyUrl && !apiKey) {
    throw new Error('Gemini API 키 또는 프록시 URL을 설정해주세요. (설정 페이지)');
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(attempt === 0 ? 'AI에게 추천 요청 중...' : 'AI에게 다시 요청 중...');
      let text: string;
      if (proxyUrl) {
        text = await callViaProxy(proxyUrl, prompt);
      } else {
        text = await callDirect(apiKey, prompt);
      }
      onProgress?.('AI 응답 해석 중...');
      const parsed = parseRecommendations(text);
      const validated = await validateAndEnrich(parsed.recommendations, { onProgress });
      if (validated.length === 0) {
        throw new Error('추천 결과 중 카카오맵에서 확인 가능한 장소를 찾지 못했습니다. 다시 시도해주세요.');
      }
      return { summary: parsed.summary, recommendations: validated };
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
      throw new Error(err.message?.includes('설정해주세요') || err.message?.includes('카카오맵') ? err.message : `AI 추천 중 오류가 발생했습니다: ${err.message?.slice(0, 100)}`);
    }
  }

  throw new Error('요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
}
