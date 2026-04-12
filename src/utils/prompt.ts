import { Gathering, Participant, Recommendation } from '../types';

const TRANSPORT_LABELS: Record<string, string> = {
  car: '자차',
  subway: '지하철',
  bus: '버스',
  bike: '자전거',
  walk: '도보',
};

const DAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '크리스마스',
};

function getDateInfo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const dayOfWeek = DAY_LABELS[date.getDay()];
  const mmdd = dateStr.slice(5);
  const holiday = FIXED_HOLIDAYS[mmdd];
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  let info = `${dateStr} (${dayOfWeek})`;
  if (holiday) info += ` [공휴일: ${holiday}]`;
  else if (isWeekend) info += ' [주말]';
  else info += ' [평일]';
  return info;
}

export function buildPrompt(gathering: Gathering): string {
  const meetingDateInfo = getDateInfo(gathering.meetingDate);

  const participantInfo = gathering.participants
    .map((p: Participant, i: number) => {
      const modes = p.transportModes.map(m => TRANSPORT_LABELS[m]).join(', ');
      return `참여자${i + 1}: ${p.name}
  - 출발지: ${p.departure}${p.departureCoord ? ` (위도: ${p.departureCoord.lat}, 경도: ${p.departureCoord.lng})` : ''}
  - 출발 예정 시간: ${p.departureTime}
  - 이동 방식: ${modes}`;
    })
    .join('\n');

  // 모임일 기반 교통상황 힌트
  let trafficHint = '';
  if (gathering.meetingDate) {
    const date = new Date(gathering.meetingDate);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const mmdd = gathering.meetingDate.slice(5);
    const holiday = FIXED_HOLIDAYS[mmdd];
    if (holiday) {
      trafficHint = `\n\n## 교통상황 참고\n모임일(${gathering.meetingDate})은 공휴일(${holiday})이므로 평소보다 도로 정체가 심할 수 있고, 대중교통 배차 간격이 길 수 있습니다.`;
    } else if (isWeekend) {
      trafficHint = `\n\n## 교통상황 참고\n모임일(${gathering.meetingDate})은 주말이므로 대중교통 배차 간격이 평일보다 길고, 도로 상황은 지역에 따라 다를 수 있습니다.`;
    } else {
      trafficHint = `\n\n## 교통상황 참고\n모임일(${gathering.meetingDate})은 평일이므로 출퇴근 시간대(07:30~09:30, 17:30~19:30) 교통 혼잡을 고려해주세요.`;
    }
  }

  return `당신은 모임 장소 추천 전문가입니다.

아래 모임 정보를 바탕으로 모든 참여자가 만나기 좋은 중간 지역과 장소를 추천해주세요.

## 모임 정보
- 목적: ${gathering.purpose}
- 설명: ${gathering.description || '없음'}
- 모임 예정일시: ${meetingDateInfo} ${gathering.meetingTime}

## 참여자 정보
${participantInfo}${trafficHint}

## 추천 규칙
1. **지역이 최우선**: 모든 참여자의 출발지, 출발 예정 시간, 이동 방식을 고려하여 이동 시간이 비슷한 중간 지역을 선정하세요.
2. **교통상황 반영**: 모임 예정일의 요일(평일/주말/공휴일)과 출발 시간대의 교통 혼잡도를 고려하세요. 자차 이용자는 도로 정체를, 대중교통 이용자는 배차 간격을 감안하세요.
3. **장소는 목적에 맞게**: 모임 목적에 맞는 장소(카페, 식당, 공원, 편의점 등)를 추천하세요.
4. **실제 존재하는 장소**: 한국에 실제로 존재하는 지역과 장소를 추천하세요.
5. 2~3개의 지역을 추천하고, 각 지역마다 2~3개의 구체적인 장소를 추천하세요.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
각 장소에는 지역과 장소를 종합적으로 고려한 추천 순위(rank)를 1부터 매겨주세요. 1이 가장 추천하는 장소입니다. 모든 지역의 모든 장소를 통틀어 순위를 매겨주세요.

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
        "reason": "추천 이유 (이동 시간, 교통상황, 접근성 등 포함)",
        "rank": 순위숫자
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
