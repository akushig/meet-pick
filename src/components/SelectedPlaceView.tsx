import { useEffect, useRef } from 'react';
import { Place } from '../types';
import { loadKakaoMap, createMap, addMarker } from '../services/kakaoMap';
import { openInKakaoMap } from '../utils/openKakaoMap';

interface Props {
  region: string;
  place: Place;
  onClose: () => void;
}

export default function SelectedPlaceView({ region, place, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    loadKakaoMap().then(() => {
      const map = createMap(mapRef.current!, place.coord.lat, place.coord.lng, 3);
      addMarker(map, place.coord.lat, place.coord.lng, place.name);
    });
  }, [place]);

  const handleOpenKakaoMap = () => {
    openInKakaoMap(place);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{region} · {place.name}</h3>
            <p className="text-xs text-gray-500">{place.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">
            ✕
          </button>
        </div>

        <div ref={mapRef} className="w-full h-[300px]" />

        <div className="px-4 py-3 space-y-2">
          <button
            onClick={handleOpenKakaoMap}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            카카오맵에서 보기
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
