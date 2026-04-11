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
