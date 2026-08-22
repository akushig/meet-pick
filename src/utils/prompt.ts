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

export const DEFAULT_REGION_COUNT = 5;
export const DEFAULT_PLACES_PER_REGION = 3;

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
  const regionCount = gathering.regionCount || DEFAULT_REGION_COUNT;
  const placesPerRegion = gathering.placesPerRegion || DEFAULT_PLACES_PER_REGION;
  const totalPlaces = regionCount * placesPerRegion;

  const participantNameList = gathering.participants.map(p => p.name).filter(Boolean).join(', ');

  const participantInfo = gathering.participants
    .map((p: Participant, i: number) => {
      const modes = p.transportModes.map(m => TRANSPORT_LABELS[m]).join(', ');
      let arrivalBlock = '';
      if (p.arrival || p.arrivalCoord || p.arrivalTime || (p.arrivalTransportModes && p.arrivalTransportModes.length > 0)) {
        const arrivalCoordStr = p.arrivalCoord ? ` (위도: ${p.arrivalCoord.lat}, 경도: ${p.arrivalCoord.lng})` : '';
        const arrivalTimeStr = p.arrivalTime ? `, 도착 예정 시간: ${p.arrivalTime}` : '';
        const arrivalModes = p.arrivalTransportModes && p.arrivalTransportModes.length > 0
          ? p.arrivalTransportModes.map(m => TRANSPORT_LABELS[m]).join(', ')
          : '';
        arrivalBlock = `\n  - 도착지(모임 후 이동할 장소): ${p.arrival || '미입력'}${arrivalCoordStr}${arrivalTimeStr}`;
        if (arrivalModes) arrivalBlock += `\n  - 도착 이동 방식: ${arrivalModes}`;
      }
      return `참여자${i + 1} (실명: ${p.name}): ${p.name}
  - 출발지: ${p.departure}${p.departureCoord ? ` (위도: ${p.departureCoord.lat}, 경도: ${p.departureCoord.lng})` : ''}
  - 출발 예정 시간: ${p.departureTime}
  - 이동 방식: ${modes}${arrivalBlock}`;
    })
    .join('\n');

  const hasAnyArrival = gathering.participants.some(p => p.arrival);
  const arrivalNote = hasAnyArrival
    ? '\n\n## 도착지 고려\n일부 참여자는 모임 후 이동할 "도착지"와 "도착 예정 시간"을 명시했습니다. 추천 장소는 참여자의 출발지뿐 아니라 도착지까지의 이동 동선도 함께 고려하세요 — 모임이 끝난 뒤 도착지로 이어지는 동선이 무리가 없는 지역·장소를 우선 추천합니다. reason에도 이 관점을 자연스럽게 녹여주세요.'
    : '';

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
- 모임 예정일: ${meetingDateInfo}
- 모임 시작 시간: ${gathering.meetingTime}${gathering.meetingEndTime ? `\n- 모임 종료 예정 시간: ${gathering.meetingEndTime}` : ''}

## 참여자 정보
${participantInfo}

참여자 실명 목록: ${participantNameList}${trafficHint}${arrivalNote}

## 추천 규칙
1. **지역이 최우선**: 모든 참여자의 출발지, 출발 예정 시간, 이동 방식을 고려하여 이동 시간이 비슷한 중간 지역을 선정하세요.
2. **교통상황 반영**: 모임 예정일의 요일(평일/주말/공휴일)과 출발 시간대의 교통 혼잡도를 고려하세요. 자차 이용자는 도로 정체를, 대중교통 이용자는 배차 간격을 감안하세요.
3. **장소는 목적에 맞게 (카카오 카테고리 코드 의식)**: 모임 목적에 맞는 장소 카테고리를 선택하세요. 카카오맵에서 쓰는 \`category_group_code\` 중 목적별 권장 매핑:
   - 식사/점심/저녁/술자리 → **FD6**(음식점)
   - 카페/티타임/스터디/수다 → **CE7**(카페)
   - 편의점 약속 → **CS2**(편의점)
   - 공원/산책/피크닉 → **AT4**(관광명소) 또는 일반 공원
   - 문화생활(영화, 전시) → **CT1**(문화시설)
   - 숙박/모임 공간 대여 → **AD5**
   - 즉, **목적이 "점심 모임"이면 약국·문구점·은행 같은 무관 카테고리는 절대 고르지 마세요.** 선정된 장소의 실제 카테고리가 목적과 부합하는지 스스로 한 번 더 검증하세요.
4. **반드시 카카오맵에 등록된 실재 상호/주소만**:
   - 장소명은 카카오맵에서 검색했을 때 동일 상호로 찾을 수 있어야 합니다. 지점명까지 포함해 정확히 적어주세요 (예: "스타벅스 강남R점", "블루보틀 성수점").
   - 임의로 만들어낸 이름, 가상의 지점, 같은 브랜드의 존재하지 않는 지점, 폐업/이전된 과거 정보는 절대 넣지 마세요.
   - 주소는 대한민국의 도로명주소 또는 지번주소 전체를 적어주세요 (시/도 + 시/군/구 + 도로명 또는 동 + 번지/건물번호).
   - 체인점·프랜차이즈의 경우 **해당 시·군·구에 실제로 그 지점이 있는지** 확신할 수 있을 때만 추천하세요. 동일 상호가 다른 지역에도 있다고 해서 현재 지역의 지점이 있다고 가정하지 마세요.
   - 지역명(region)도 카카오맵에서 검색 가능한 실제 행정/상권명으로 기재하세요 (예: "강남역", "홍대입구역", "성수동").
5. **지역과 장소의 지리적 일치 (매우 중요)**:
   - 각 region의 places는 **반드시 그 region의 도보 이동 가능 권역 (반경 2km 이내)** 안에 있어야 합니다.
   - 예: region이 "양재역"이면 places의 주소는 서초구 양재동/우면동 등 양재역 주변이어야 하며, 경기도 이천시·수원시처럼 같은 이름·비슷한 이름의 다른 지역에 있는 동명 상호를 절대 넣지 마세요.
   - 장소 주소의 시/군/구가 region의 시/군/구와 불일치하면 그 장소는 제외하고 region 내부의 다른 실재 장소로 대체하세요.
   - region 좌표(regionCoord)와 place 좌표(coord)는 서로 2km 이내여야 합니다.
6. **자기 검증**: 응답을 내기 전에 (1) 각 장소가 실제 존재하는지 (2) 해당 장소가 정말 region 권역 안에 있는지 스스로 한번 더 점검하고, 확신이 서지 않으면 교체하세요.

## 추천 개수
- 기본값: 지역(region) **${regionCount}개**, 각 지역마다 장소(place) **${placesPerRegion}개** (총 **${totalPlaces}개** 장소).
- **단, 위 "설명(description)" 필드에 사용자가 원하는 개수를 자연어로 명시한 경우 그 개수를 최우선으로 따르세요.** 예:
  - "지역 3개만 추천해줘" → 지역 3개, 각 지역당 장소 개수는 기본값 유지.
  - "각 지역당 5곳씩" → 지역 개수는 기본값, 지역당 장소 5개.
  - "총 10개만" → 적절히 분배 (예: 지역 5개 × 장소 2개).
  - 수치 표현("개", "곳", "군데", "가지" 등)과 숫자(아라비아·한글)를 모두 인식하세요.
- description에 개수 지정이 없으면 기본값을 정확히 반환하세요.

## 정렬 규칙
- **regions 배열 순서**: 모임 연관성/적합도가 가장 높은 지역을 배열 index 0에 두고, 내림차순으로 정렬하세요.
- **지역 내 places 순서**: 각 지역의 places 배열도 해당 지역 내에서 연관성/적합도가 높은 장소가 먼저 오도록 정렬하세요.

## 순위(rank)
- 1st/2nd/3rd 뱃지용으로 **"지역 적합도 + 장소 적합도"를 종합**하여 전체 장소 중 상위 3곳에만 \`rank\`를 부여합니다.
- \`rank: 1\` = 가장 추천 지역의 가장 추천 장소, \`rank: 2\` = 그 다음, \`rank: 3\` = 그 다음.
- 나머지 장소는 \`rank\` 필드를 생략하거나 4 이상의 숫자를 주세요.

## 피드백(reason / summary) 작성 규칙
- **참여자를 언급할 때는 반드시 실명을 사용**하세요. "참여자1", "참여자2" 같은 번호 표현은 절대 쓰지 마세요.
- 특정 참여자 그룹에만 해당되는 이야기라면 그 참여자들의 이름만 적고, 전체 참여자에게 해당되는 이야기라면 "모두" 또는 전체 이름을 함께 적으세요.

### reason(각 장소 설명) 규칙 — 자연어 서술
- **자연스러운 한국어 문장으로 서술**하세요. 왜 이 장소/지역이 적합한지 참여자들의 출발지·이동수단·경로·모임 목적을 근거로 녹여서 설명합니다.
- 예시 (권장):
  - "판교에서 출발하는 홍길동, 김철수는 신분당선으로 환승 없이 닿을 수 있고, 잠실에서 오는 박영희는 2호선으로 곧장 연결되기 때문에 세 명 모두 30분 내외로 모일 수 있는 교통 요지입니다. 점심 모임 분위기에 어울리는 루프탑 카페로 평일 낮엔 여유로운 편입니다."
- 예시 (금지):
  - "홍길동(판교역 출발): 지하철 약 28분. 김철수(강남역 출발): 자차 약 18분." 같은 **"이름(주소): 모드 N분"의 딱딱한 나열 포맷은 reason에 절대 넣지 마세요.**
  - 시간 수치는 reason에 한두 문장 녹여 쓰는 건 OK지만, 표/나열 형태로 쓰지 마세요. 구체적 수치는 아래 travelTimes 필드에 담습니다.

### travelTimes(구조화된 이동시간) 규칙
- 각 장소마다 \`travelTimes\` 필드를 **반드시** 채우세요.
- **같은 출발지에서 출발하는 참여자들은 하나의 그룹으로 묶어서** 한 항목으로 반환하세요.
  - 예: 잠실에서 홍길동·김철수가 같이 출발하면 한 항목으로 묶고 names=["홍길동","김철수"].
- 각 항목은:
  - \`origin\`: 출발지의 **축약된 지역명** (동/역/상권 수준). 예: "잠실", "판교역", "성수동". 전체 주소 금지.
  - \`names\`: 해당 origin에서 출발하는 참여자 실명 배열.
  - \`modes\`: 해당 그룹 참여자들이 선택한 이동 수단의 합집합. 각 항목은 \`{ mode, minutes }\`.
    - \`mode\`: "자차" | "지하철" | "버스" | "자전거" | "도보" 중 하나 (한국어 라벨).
    - \`minutes\`: 출발지 → 해당 장소까지 예상 소요시간(분, 정수). 모임일(평일/주말/공휴일)과 출발 시간대의 혼잡도를 반영한 현실적 추정치.

## 응답 형식
반드시 아래 **JSON 오브젝트** 형식으로만 응답하세요. 다른 텍스트, 주석, 마크다운 설명은 절대 포함하지 마세요.

- \`summary\`: 추천된 전체 지역·장소에 대한 **종합 피드백**. 2~4문장 분량. 참여자 실명을 활용해 각자의 출발지·이동 수단이 이 추천 세트와 어떻게 맞아떨어지는지, 왜 이 지역들을 골랐는지, 추천 장소들의 성격이 모임 목적과 어떻게 어울리는지를 설명하세요.
- \`regions\`: 지역 배열. 각 지역은 region/regionCoord/places 필드를 가집니다.

\`\`\`json
{
  "summary": "참여자 실명을 포함한 전체 추천에 대한 종합 피드백 (2~4문장)",
  "regions": [
    {
      "region": "실제 지역명 (예: 강남역, 홍대입구역, 성수동)",
      "regionCoord": { "lat": 위도, "lng": 경도 },
      "places": [
        {
          "name": "카카오맵 검색 가능한 정확한 상호+지점명",
          "category": "카테고리 (카페/식당/공원 등)",
          "address": "대한민국 전체 주소 (도로명 또는 지번)",
          "coord": { "lat": 위도, "lng": 경도 },
          "reason": "자연스러운 한국어 서술로 이 장소를 추천하는 이유. 참여자 실명·출발지·이동수단·경로·모임 목적을 녹여 설명하되, '이름(주소): 모드 N분' 같은 딱딱한 나열 금지.",
          "travelTimes": [
            {
              "origin": "판교역",
              "names": ["홍길동", "김철수"],
              "modes": [
                { "mode": "지하철", "minutes": 28 },
                { "mode": "자차", "minutes": 22 }
              ]
            },
            {
              "origin": "잠실",
              "names": ["박영희"],
              "modes": [
                { "mode": "지하철", "minutes": 30 }
              ]
            }
          ],
          "rank": 1
        }
      ]
    }
  ]
}
\`\`\``;
}

export interface ParsedResponse {
  summary: string;
  recommendations: Recommendation[];
}

export function parseRecommendations(text: string): ParsedResponse {
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.regions)) {
        return {
          summary: typeof parsed.summary === 'string' ? parsed.summary : '',
          recommendations: parsed.regions as Recommendation[],
        };
      }
    } catch {
      // fall through to legacy array parse
    }
  }
  // Legacy: 배열만 온 경우 (구버전 캐시/응답 호환)
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    const parsed = JSON.parse(arrMatch[0]);
    return { summary: '', recommendations: parsed as Recommendation[] };
  }
  throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
}
