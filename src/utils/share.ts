import { Gathering } from '../types';
import { loadSettings, upsertGathering } from '../services/storage';

function getShareApiBase(): string | null {
  const { proxyUrl } = loadSettings();
  if (!proxyUrl) return null;
  try {
    return new URL(proxyUrl).origin;
  } catch {
    return null;
  }
}

interface SharePayload {
  id: string;
  purpose: string;
  description: string;
  meetingDate: string;
  meetingTime: string;
  meetingEndTime?: string;
  meetingEndTimeEdited?: boolean;
  participants: Gathering['participants'];
  recommendations?: Gathering['recommendations'];
  recommendationSummary?: string;
  selectedPlace?: Gathering['selectedPlace'];
  regionCount?: number;
  placesPerRegion?: number;
  createdAt: string;
}

function buildPayload(gathering: Gathering): SharePayload {
  return {
    id: gathering.id,
    purpose: gathering.purpose,
    description: gathering.description,
    meetingDate: gathering.meetingDate,
    meetingTime: gathering.meetingTime,
    meetingEndTime: gathering.meetingEndTime,
    meetingEndTimeEdited: gathering.meetingEndTimeEdited,
    participants: gathering.participants.map(p => ({
      id: p.id,
      name: p.name,
      departure: p.departure,
      departureCoord: p.departureCoord,
      departureTime: p.departureTime,
      transportModes: p.transportModes,
      arrival: p.arrival,
      arrivalCoord: p.arrivalCoord,
      arrivalTime: p.arrivalTime,
      arrivalTimeEdited: p.arrivalTimeEdited,
      arrivalTransportModes: p.arrivalTransportModes,
    })),
    recommendations: gathering.recommendations,
    recommendationSummary: gathering.recommendationSummary,
    selectedPlace: gathering.selectedPlace,
    regionCount: gathering.regionCount,
    placesPerRegion: gathering.placesPerRegion,
    createdAt: gathering.createdAt,
  };
}

function payloadToGathering(raw: any): Gathering | null {
  if (!raw) return null;
  try {
    let recommendations: Gathering['recommendations'] = raw.recommendations;
    let selectedPlace: Gathering['selectedPlace'] = raw.selectedPlace;

    // Legacy format: selectedPlaceInfo 만 담겨 있던 경우 — 단일 region/place로 복원
    if (!recommendations && raw.selectedPlaceInfo) {
      recommendations = [{
        region: raw.selectedPlaceInfo.region,
        regionCoord: raw.selectedPlaceInfo.place.coord,
        places: [raw.selectedPlaceInfo.place],
      }];
      selectedPlace = { regionIndex: 0, placeIndex: 0 };
    }

    return {
      id: crypto.randomUUID(),
      purpose: raw.purpose,
      description: raw.description,
      meetingDate: raw.meetingDate,
      meetingTime: raw.meetingTime,
      meetingEndTime: raw.meetingEndTime,
      meetingEndTimeEdited: raw.meetingEndTimeEdited,
      participants: raw.participants,
      recommendations,
      recommendationSummary: raw.recommendationSummary,
      selectedPlace,
      regionCount: raw.regionCount,
      placesPerRegion: raw.placesPerRegion,
      createdAt: raw.createdAt,
    };
  } catch {
    return null;
  }
}

export type ShareTarget = 'detail' | 'result';

/**
 * Cloudflare Workers KV 기반 단축 공유 URL 생성.
 * `{proxyOrigin}/share`에 전체 모임 페이로드를 올리고 짧은 ID를 받아 URL을 만든다.
 * TTL 7일 — 만료된 링크는 자동 제거.
 *
 * @param target 수신자가 링크 열었을 때 진입할 화면. 'detail'(모임 상세, 기본)·'result'(추천 결과).
 */
export async function createShareUrl(
  gathering: Gathering,
  target: ShareTarget = 'detail',
  sharedPlace?: { regionIndex: number; placeIndex: number }
): Promise<string> {
  const base = getShareApiBase();
  if (!base) {
    throw new Error('공유 서버(프록시 URL)가 설정되지 않아 공유 링크를 만들 수 없습니다. 설정 페이지에서 프록시 URL을 확인해주세요.');
  }

  const payload = buildPayload(gathering);
  const { shareTtlDays } = loadSettings();
  const ttlClamped = typeof shareTtlDays === 'number'
    ? Math.max(1, Math.min(30, Math.floor(shareTtlDays)))
    : undefined;
  const wirePayload: Record<string, unknown> = { ...payload };
  if (ttlClamped) wirePayload.__ttlDays = ttlClamped;

  const res = await fetch(`${base}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wirePayload),
  });

  if (!res.ok) {
    throw new Error(`공유 링크 생성에 실패했습니다 (HTTP ${res.status}).`);
  }

  const { id } = await res.json();
  if (!id) {
    throw new Error('공유 링크 생성에 실패했습니다.');
  }

  const appBase = window.location.origin + window.location.pathname;
  const parts: string[] = [];
  if (target === 'result') parts.push('to=result');
  if (sharedPlace) parts.push(`p=${sharedPlace.regionIndex}-${sharedPlace.placeIndex}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  return `${appBase}#/${id}${qs}`;
}

/**
 * 공유 서버에서 ID로 페이로드를 가져와 gathering으로 복원.
 * target과 sharedPlace는 URL 쿼리스트링에서 읽는다.
 */
export async function fetchSharedGathering(
  shareId: string,
  urlParams: URLSearchParams
): Promise<ImportedShare | null> {
  const base = getShareApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/share/${shareId}`);
    if (!res.ok) return null;
    const raw = await res.json();
    const imported = payloadToGathering(raw);
    if (!imported) return null;
    upsertGathering(imported);

    const target: ShareTarget = urlParams.get('to') === 'result' ? 'result' : 'detail';
    let sharedPlace: { regionIndex: number; placeIndex: number } | undefined;
    const p = urlParams.get('p');
    if (p) {
      const m = p.match(/^(\d+)-(\d+)$/);
      if (m) sharedPlace = { regionIndex: Number(m[1]), placeIndex: Number(m[2]) };
    }
    return { gathering: imported, target, sharedPlace };
  } catch {
    return null;
  }
}

export interface ImportedShare {
  gathering: Gathering;
  target: ShareTarget;
  sharedPlace?: { regionIndex: number; placeIndex: number };
}

/**
 * 공유 URL에서 모임 정보 복원. `?id=<short>[&to=result][&p=<ri>-<pi>]` 지원. 레거시 `?data=<base64>`도 지원.
 */
export async function importFromShareUrl(): Promise<ImportedShare | null> {
  const hash = window.location.hash;

  const match = hash.match(/\/share\?(.+)$/);
  if (match) {
    const params = new URLSearchParams(match[1]);
    const shareId = params.get('id');
    if (shareId) {
      const base = getShareApiBase();
      if (!base) return null;
      try {
        const res = await fetch(`${base}/share/${shareId}`);
        if (!res.ok) return null;
        const raw = await res.json();
        const imported = payloadToGathering(raw);
        if (imported) {
          upsertGathering(imported);
          const target: ShareTarget = params.get('to') === 'result' ? 'result' : 'detail';
          let sharedPlace: { regionIndex: number; placeIndex: number } | undefined;
          const p = params.get('p');
          if (p) {
            const m = p.match(/^(\d+)-(\d+)$/);
            if (m) sharedPlace = { regionIndex: Number(m[1]), placeIndex: Number(m[2]) };
          }
          return { gathering: imported, target, sharedPlace };
        }
      } catch {
        return null;
      }
      return null;
    }

    // 레거시 ?data=base64 링크
    const dataVal = params.get('data');
    if (dataVal) {
      try {
        const json = decodeURIComponent(escape(atob(dataVal)));
        const imported = payloadToGathering(JSON.parse(json));
        if (imported) {
          upsertGathering(imported);
          return { gathering: imported, target: 'detail' };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * OS 네이티브 공유 → 실패·미지원 시 클립보드 복사 폴백.
 * 반환값으로 어떤 동작이 일어났는지 알 수 있어 호출 쪽에서 토스트 문구를 맞출 수 있다.
 */
export async function nativeShare(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'shared';
    }
  }
  const ok = await copyToClipboard(data.url);
  return ok ? 'copied' : 'failed';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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
