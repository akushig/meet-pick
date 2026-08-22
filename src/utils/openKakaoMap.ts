import { Place } from '../types';

function isIOS(ua: string): boolean {
  return /iPad|iPhone|iPod/i.test(ua) && !(window as any).MSStream;
}

function isAndroid(ua: string): boolean {
  return /Android/i.test(ua);
}

function webUrl(place: Place): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.coord.lat},${place.coord.lng}`;
}

/**
 * 카카오맵 앱에서 해당 장소를 연다.
 * - iOS: kakaomap:// 스킴 시도 → 페이지가 여전히 보이면(앱 미설치) 웹 URL로 폴백.
 * - Android: intent:// URI 로 앱 호출, browser_fallback_url 로 웹 폴백 자동 처리.
 * - 그 외(데스크톱): 새 탭에서 카카오맵 웹.
 *
 * iOS/Android 모두 `kakaomap://look?p=LAT,LNG` 스킴은 해당 좌표 지도 뷰를 여는 공식 스킴.
 */
export function openInKakaoMap(place: Place): void {
  const { lat, lng } = place.coord;
  const ua = navigator.userAgent;
  const fallback = webUrl(place);

  if (isAndroid(ua)) {
    const intentUrl =
      `intent://look?p=${lat},${lng}#Intent;` +
      `scheme=kakaomap;` +
      `package=net.daum.android.map;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
    window.location.href = intentUrl;
    return;
  }

  if (isIOS(ua)) {
    const appUrl = `kakaomap://look?p=${lat},${lng}`;
    let didHide = false;
    const onVisibility = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener('visibilitychange', onVisibility);

    window.location.href = appUrl;

    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (!didHide && !document.hidden) {
        window.location.href = fallback;
      }
    }, 1500);
    return;
  }

  window.open(fallback, '_blank', 'noopener');
}
