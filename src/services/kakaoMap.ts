import { loadSettings } from './storage';

declare global {
  interface Window {
    kakao: any;
  }
}

let mapLoaded = false;
let loadPromise: Promise<void> | null = null;

export function loadKakaoMap(): Promise<void> {
  if (mapLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const { kakaoApiKey } = loadSettings();
  if (!kakaoApiKey) return Promise.reject(new Error('Kakao API 키가 설정되지 않았습니다.'));

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoApiKey}&autoload=false&libraries=services`;
    script.onload = () => {
      window.kakao.maps.load(() => {
        mapLoaded = true;
        resolve();
      });
    };
    script.onerror = () => reject(new Error('Kakao Map SDK 로드 실패'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function createMap(container: HTMLElement, lat: number, lng: number, level = 7) {
  const options = {
    center: new window.kakao.maps.LatLng(lat, lng),
    level,
  };
  return new window.kakao.maps.Map(container, options);
}

export function addMarker(
  map: any,
  lat: number,
  lng: number,
  title: string,
  color: 'red' | 'blue' | 'green' = 'red'
) {
  const markerImage = color !== 'red'
    ? new window.kakao.maps.MarkerImage(
        `https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_${color === 'blue' ? 'blue' : 'green'}.png`,
        new window.kakao.maps.Size(33, 44)
      )
    : undefined;

  const marker = new window.kakao.maps.Marker({
    map,
    position: new window.kakao.maps.LatLng(lat, lng),
    title,
    ...(markerImage ? { image: markerImage } : {}),
  });

  const infowindow = new window.kakao.maps.InfoWindow({
    content: `<div style="padding:5px;font-size:12px;white-space:nowrap;">${title}</div>`,
  });

  window.kakao.maps.event.addListener(marker, 'click', () => {
    infowindow.open(map, marker);
  });

  return marker;
}

export function fitBounds(map: any, coords: { lat: number; lng: number }[]) {
  if (coords.length === 0) return;
  const bounds = new window.kakao.maps.LatLngBounds();
  coords.forEach(c => bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng)));
  map.setBounds(bounds);
}

export function coordToAddress(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
        const addr = result[0].road_address
          ? result[0].road_address.address_name
          : result[0].address.address_name;
        resolve(addr);
      } else {
        resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  });
}

export function searchAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(address, (data: any[], status2: string) => {
          if (status2 === window.kakao.maps.services.Status.OK && data.length > 0) {
            resolve({ lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) });
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

export interface VerifiedPlace {
  name: string;
  address: string;
  category: string;
  coord: { lat: number; lng: number };
}

/**
 * 두 좌표간 거리(km). Haversine.
 */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mapKakaoResult(r: any): VerifiedPlace {
  const categoryName: string = r.category_name || '';
  const lastCat = categoryName.split('>').map(s => s.trim()).filter(Boolean).pop() || '';
  return {
    name: r.place_name,
    address: r.road_address_name || r.address_name || '',
    category: r.category_group_name || lastCat,
    coord: { lat: parseFloat(r.y), lng: parseFloat(r.x) },
  };
}

function keywordSearch(query: string): Promise<any[]> {
  return new Promise((resolve) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(query, (data: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        resolve(data);
      } else {
        resolve([]);
      }
    });
  });
}

function addressSearch(address: string): Promise<any[]> {
  return new Promise((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
        resolve(result);
      } else {
        resolve([]);
      }
    });
  });
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, '').replace(/[()[\]{}·•.,'"`!?-]/g, '');
}

function nameMatches(aiName: string, kakaoName: string): boolean {
  const a = normalize(aiName);
  const b = normalize(kakaoName);
  if (!a || !b) return false;
  if (a === b || b.includes(a) || a.includes(b)) return true;
  // 토큰 기반 매칭: 주요 토큰이 상대 문자열에 포함되는지 확인
  const tokens = normalize(aiName).match(/.{2,}/g) || [];
  const aiTokens = aiName.split(/\s+/).filter(t => t.length >= 2).map(normalize);
  const combined = Array.from(new Set([...tokens, ...aiTokens]));
  const matched = combined.filter(t => b.includes(t)).length;
  return matched >= Math.min(1, combined.length);
}

// Worker 캐시(해당 Worker origin)를 통한 cache-through.
// proxyUrl이 설정돼 있을 때만 캐시 시도. 실패/미설정 시엔 항상 직접 조회.
function getCacheBase(): string | null {
  const { proxyUrl } = loadSettings();
  if (!proxyUrl) return null;
  try {
    return new URL(proxyUrl).origin;
  } catch {
    return null;
  }
}

async function fetchPlaceCache(q: string, hint: string | undefined, base: string): Promise<VerifiedPlace | null> {
  try {
    const url = new URL('/place', base);
    url.searchParams.set('q', q);
    if (hint) url.searchParams.set('hint', hint);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return (await res.json()) as VerifiedPlace;
  } catch {
    return null;
  }
}

function savePlaceCache(q: string, hint: string | undefined, value: VerifiedPlace, base: string): void {
  // 적재는 fire-and-forget: 실패해도 사용자 경험에 영향 없음.
  try {
    const url = new URL('/place', base);
    fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, hint: hint || '', value }),
    }).catch(() => { /* ignore */ });
  } catch {
    /* ignore */
  }
}

async function fetchRegionCache(q: string, base: string): Promise<{ coord: { lat: number; lng: number } } | null> {
  try {
    const url = new URL('/region', base);
    url.searchParams.set('q', q);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return (await res.json()) as { coord: { lat: number; lng: number } };
  } catch {
    return null;
  }
}

function saveRegionCache(q: string, value: { coord: { lat: number; lng: number } }, base: string): void {
  try {
    const url = new URL('/region', base);
    fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, value }),
    }).catch(() => { /* ignore */ });
  } catch {
    /* ignore */
  }
}

/**
 * 카카오맵 Places API로 장소 실재 여부 확인 (Worker cache-through).
 * 1) Worker /place 캐시 조회 → 히트면 즉시 반환
 * 2) 미스면 Kakao SDK keywordSearch로 검증 → 성공 시 캐시에 적재
 * 지역 힌트를 함께 쓰면 동명이인 장소를 걸러낸다.
 */
export async function verifyPlace(
  name: string,
  regionHint?: string
): Promise<VerifiedPlace | null> {
  const base = getCacheBase();

  // 1) Cache lookup (정확 이름 + 힌트)
  if (base) {
    const cached = await fetchPlaceCache(name, regionHint, base);
    if (cached && cached.coord) return cached;
  }

  // 2) SDK 조회
  const queries = regionHint ? [`${regionHint} ${name}`, name] : [name];
  for (const q of queries) {
    const results = await keywordSearch(q);
    const hit = results.find(r => nameMatches(name, r.place_name));
    if (hit) {
      const mapped = mapKakaoResult(hit);
      if (base) savePlaceCache(name, regionHint, mapped, base);
      return mapped;
    }
  }
  return null;
}

/**
 * 추천된 지역명 실재 확인 + 좌표 반환 (Worker cache-through).
 */
export async function verifyRegion(region: string): Promise<{ coord: { lat: number; lng: number } } | null> {
  const base = getCacheBase();

  if (base) {
    const cached = await fetchRegionCache(region, base);
    if (cached && cached.coord) return cached;
  }

  const addr = await addressSearch(region);
  if (addr.length > 0) {
    const value = { coord: { lat: parseFloat(addr[0].y), lng: parseFloat(addr[0].x) } };
    if (base) saveRegionCache(region, value, base);
    return value;
  }
  const kw = await keywordSearch(region);
  if (kw.length > 0) {
    const value = { coord: { lat: parseFloat(kw[0].y), lng: parseFloat(kw[0].x) } };
    if (base) saveRegionCache(region, value, base);
    return value;
  }
  return null;
}
