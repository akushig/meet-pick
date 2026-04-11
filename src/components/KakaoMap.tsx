import { useEffect, useRef, useState } from 'react';
import { Recommendation, Participant } from '../types';
import { loadKakaoMap, createMap, addMarker, fitBounds } from '../services/kakaoMap';

interface Props {
  recommendations: Recommendation[];
  participants: Participant[];
}

export default function KakaoMap({ recommendations, participants }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!mapRef.current) return;

    loadKakaoMap()
      .then(() => {
        const map = createMap(mapRef.current!, 37.5665, 126.978, 10);
        const allCoords: { lat: number; lng: number }[] = [];

        // 참여자 출발지 마커 (파란색)
        participants.forEach(p => {
          if (p.departureCoord) {
            addMarker(map, p.departureCoord.lat, p.departureCoord.lng, `${p.name} (출발지)`, 'blue');
            allCoords.push(p.departureCoord);
          }
        });

        // 추천 장소 마커 (빨간색)
        recommendations.forEach(rec => {
          rec.places.forEach(place => {
            addMarker(map, place.coord.lat, place.coord.lng, `${place.name} (${place.category})`);
            allCoords.push(place.coord);
          });
        });

        // 추천 지역 마커 (초록색)
        recommendations.forEach(rec => {
          addMarker(map, rec.regionCoord.lat, rec.regionCoord.lng, `📍 ${rec.region}`, 'green');
          allCoords.push(rec.regionCoord);
        });

        if (allCoords.length > 0) {
          fitBounds(map, allCoords);
        }
      })
      .catch(err => setError(err.message));
  }, [recommendations, participants]);

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-[400px] rounded-xl border border-gray-200 overflow-hidden"
    />
  );
}
