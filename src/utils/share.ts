import { Gathering } from '../types';
import { upsertGathering } from '../services/storage';

// 모임 정보를 URL-safe 문자열로 인코딩
export function encodeGathering(gathering: Gathering): string {
  // 선택된 장소 정보 추출 (추천 전체 목록은 제외)
  let selectedPlaceInfo: { region: string; place: any } | undefined;
  if (gathering.selectedPlace && gathering.recommendations) {
    const { regionIndex, placeIndex } = gathering.selectedPlace;
    const rec = gathering.recommendations[regionIndex];
    if (rec) {
      const place = rec.places[placeIndex];
      if (place) {
        selectedPlaceInfo = { region: rec.region, place };
      }
    }
  }

  const shared = {
    id: gathering.id,
    purpose: gathering.purpose,
    description: gathering.description,
    meetingDate: gathering.meetingDate,
    meetingTime: gathering.meetingTime,
    participants: gathering.participants.map(p => ({
      id: p.id,
      name: p.name,
      departure: p.departure,
      departureCoord: p.departureCoord,
      departureTime: p.departureTime,
      transportModes: p.transportModes,
    })),
    selectedPlaceInfo,
    createdAt: gathering.createdAt,
  };
  const json = JSON.stringify(shared);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

// URL-safe 문자열에서 모임 정보 디코딩
export function decodeGathering(encoded: string): Gathering | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// 공유 URL 생성
export function createShareUrl(gathering: Gathering): string {
  const encoded = encodeGathering(gathering);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/share?data=${encoded}`;
}

// URL에서 공유 데이터 파싱 및 저장
export function importFromShareUrl(): Gathering | null {
  const hash = window.location.hash;
  const match = hash.match(/\/share\?data=(.+)/);
  if (!match) return null;

  const decoded = decodeGathering(match[1]);
  if (!decoded) return null;

  // 선택된 장소 정보가 있으면 recommendations에 복원
  const raw = decoded as any;
  let recommendations: Gathering['recommendations'];
  let selectedPlace: Gathering['selectedPlace'];

  if (raw.selectedPlaceInfo) {
    recommendations = [{
      region: raw.selectedPlaceInfo.region,
      regionCoord: raw.selectedPlaceInfo.place.coord,
      places: [raw.selectedPlaceInfo.place],
    }];
    selectedPlace = { regionIndex: 0, placeIndex: 0 };
  }

  const imported: Gathering = {
    id: crypto.randomUUID(),
    purpose: decoded.purpose,
    description: decoded.description,
    meetingDate: decoded.meetingDate,
    meetingTime: decoded.meetingTime,
    participants: decoded.participants,
    recommendations,
    selectedPlace,
    createdAt: decoded.createdAt,
  };

  upsertGathering(imported);
  return imported;
}

// 클립보드에 복사
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
