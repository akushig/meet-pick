import { useEffect, useRef, useState, useCallback } from 'react';
import { loadKakaoMap, addMarker, coordToAddress } from '../services/kakaoMap';

interface Props {
  coord?: { lat: number; lng: number };
  onSelect: (coord: { lat: number; lng: number }, address: string) => void;
  onClose: () => void;
}

export default function DepartureMapPicker({ coord, onSelect, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const markerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  const placeMarker = useCallback(async (map: any, lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    markerRef.current = addMarker(map, lat, lng, '출발지');
    const address = await coordToAddress(lat, lng);
    setSelectedAddress(address);
    onSelect({ lat, lng }, address);
  }, [onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;

    loadKakaoMap()
      .then(() => {
        const initLat = coord?.lat ?? 37.5665;
        const initLng = coord?.lng ?? 126.978;

        const options = {
          center: new window.kakao.maps.LatLng(initLat, initLng),
          level: 5,
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
        };
        const map = new window.kakao.maps.Map(mapRef.current!, options);
        mapInstanceRef.current = map;

        // 줌 컨트롤 추가
        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        if (coord) {
          markerRef.current = addMarker(map, coord.lat, coord.lng, '출발지');
        }

        window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const latlng = mouseEvent.latLng;
          placeMarker(map, latlng.getLat(), latlng.getLng());
        });

        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(searchQuery, (data: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        const lat = parseFloat(data[0].y);
        const lng = parseFloat(data[0].x);
        const map = mapInstanceRef.current;
        map.setCenter(new window.kakao.maps.LatLng(lat, lng));
        map.setLevel(3);
        placeMarker(map, lat, lng);
      } else {
        setError('검색 결과가 없습니다.');
        setTimeout(() => setError(''), 2000);
      }
    });
  };

  // 모달 배경 클릭 시 닫기 방지 (지도 이벤트와 충돌 방지)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center"
      onClick={handleBackdropClick}
      style={{ touchAction: 'none' }}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">지도에서 출발지 선택</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">
            ✕
          </button>
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="px-4 pt-3 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="장소 또는 주소 검색"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors"
          >
            검색
          </button>
        </form>

        <p className="text-xs text-gray-500 px-4 pt-2">지도를 클릭하여 출발지를 선택하세요</p>
        {error && <p className="text-xs text-red-500 px-4 pt-1">{error}</p>}
        {loading && <p className="text-xs text-gray-400 px-4 pt-1">지도 로딩 중...</p>}
        {selectedAddress && (
          <p className="text-xs text-green-600 px-4 pt-1">선택: {selectedAddress}</p>
        )}

        <div
          ref={mapRef}
          className="w-full h-[350px] mt-2"
          style={{ touchAction: 'auto' }}
        />

        <div className="px-4 py-3">
          <button
            onClick={onClose}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            선택 완료
          </button>
        </div>
      </div>
    </div>
  );
}
