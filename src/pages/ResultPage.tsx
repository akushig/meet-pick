import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Gathering } from '../types';
import { getGathering, upsertGathering } from '../services/storage';
import KakaoMap from '../components/KakaoMap';
import PlaceCard from '../components/PlaceCard';
import Toast from '../components/Toast';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '' });

  useEffect(() => {
    if (!id) return;
    const g = getGathering(id);
    if (!g || !g.recommendations) {
      navigate(`/gathering/${id}`);
      return;
    }
    setGathering(g);
  }, [id, navigate]);

  const handleToastDone = useCallback(() => {
    setToast({ visible: false, message: '' });
    navigate(`/gathering/${id}`);
  }, [navigate, id]);

  const handleSelect = (regionIndex: number, placeIndex: number) => {
    if (!gathering || !gathering.recommendations) return;
    const rec = gathering.recommendations[regionIndex];
    const place = rec.places[placeIndex];
    const updated = { ...gathering, selectedPlace: { regionIndex, placeIndex } };
    setGathering(updated);
    upsertGathering(updated);

    const placeName = `${rec.region} · ${place.name}`;
    setToast({ visible: true, message: `"${placeName}" 선택 완료` });
  };

  if (!gathering || !gathering.recommendations) return null;

  const sel = gathering.selectedPlace;

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast
        message={toast.message}
        visible={toast.visible}
        onDone={handleToastDone}
      />

      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(`/gathering/${id}`)} className="text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-gray-800">추천 결과</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* 모임 정보 요약 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-medium text-gray-800">{gathering.purpose}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {gathering.meetingDate} {gathering.meetingTime} · 참여자 {gathering.participants.length}명
          </p>
          {sel && gathering.recommendations[sel.regionIndex] && (
            <div className="mt-2 px-3 py-2 bg-primary-50 rounded-lg">
              <p className="text-xs text-primary-600 font-medium">
                선택된 장소: {gathering.recommendations[sel.regionIndex].region} · {gathering.recommendations[sel.regionIndex].places[sel.placeIndex]?.name}
              </p>
            </div>
          )}
        </div>

        {/* 지도 */}
        <KakaoMap
          recommendations={gathering.recommendations}
          participants={gathering.participants}
        />

        {/* 범례 */}
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> 출발지
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 추천 지역
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 추천 장소
          </span>
        </div>

        <p className="text-xs text-gray-400 text-center">장소를 탭하면 모임 장소로 선택됩니다</p>

        {/* 추천 지역별 장소 */}
        {gathering.recommendations.map((rec, i) => (
          <section key={i} className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-600">
              {i + 1}. {rec.region}
            </h3>
            {rec.places.map((place, j) => {
              const isSelected = sel?.regionIndex === i && sel?.placeIndex === j;
              const rank = place.rank;
              return (
                <PlaceCard
                  key={j}
                  place={place}
                  rank={rank && rank <= 3 ? rank : undefined}
                  selected={isSelected}
                  onClick={() => handleSelect(i, j)}
                />
              );
            })}
          </section>
        ))}

        {/* 다시 추천 */}
        <button
          onClick={() => navigate(`/gathering/${id}`)}
          className="w-full bg-white border border-primary-300 text-primary-600 hover:bg-primary-50 py-3 rounded-xl font-medium transition-colors"
        >
          다시 추천받기
        </button>
      </main>
    </div>
  );
}
