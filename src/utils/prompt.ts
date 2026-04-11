import { Gathering, Participant, Recommendation } from '../types';

const TRANSPORT_LABELS: Record<string, string> = {
  car: '자차',
  subway: '지하철',
  bus: '버스',
  walk: '도보',
};

export function buildPrompt(gathering: Gathering): string {
  const participantInfo = gathering.participants
    .map((p: Participant, i: number) => {
      const modes = p.transportModes.map(m => TRANSPORT_LABELS[m]).join(', ');
      return `참여자${i + 1}: ${p.name}
  - 출발지: ${p.departure}${p.departureCoord ? ` (위도: ${p.departureCoord.lat}, 경도: ${p.departureCoord.lng})` : ''}
  - 출발 예정 시간: ${p.departureTime}
  - 이동 방식: ${modes}`;
    })
    .join('\n');

  return `당신은 모임 장소 추천 전문가입니다.

아래 모임 정보를 바탕으로 모든 참여자가 만나기 좋은 중간 지역과 장소를 추천해주세요.

## 모임 정보
- 목적: ${gathering.purpose}
- 설명: ${gathering.description || '없음'}

## 참여자 정보
${participantInfo}

## 추천 규칙
1. **지역이 최우선**: 모든 참여자의 출발지, 출발 예정 시간, 이동 방식을 고려하여 이동 시간이 비슷한 중간 지역을 선정하세요.
2. **장소는 목적에 맞게**: 모임 목적에 맞는 장소(카페, 식당, 공원, 편의점 등)를 추천하세요.
3. **실제 존재하는 장소**: 한국에 실제로 존재하는 지역과 장소를 추천하세요.
4. 2~3개의 지역을 추천하고, 각 지역마다 2~3개의 구체적인 장소를 추천하세요.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
[
  {
    "region": "추천 지역명 (예: 강남역, 홍대입구 등)",
    "regionCoord": { "lat": 위도, "lng": 경도 },
    "places": [
      {
        "name": "장소명",
        "category": "카테고리 (카페/식당/공원 등)",
        "address": "상세 주소",
        "coord": { "lat": 위도, "lng": 경도 },
        "reason": "추천 이유 (이동 시간, 접근성 등 포함)"
      }
    ]
  }
]
\`\`\``;
}

export function parseRecommendations(text: string): Recommendation[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
  return JSON.parse(jsonMatch[0]);
}
