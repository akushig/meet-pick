import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Gathering } from '../types';
import { getGathering } from '../services/storage';
import KakaoMap from '../components/KakaoMap';
import PlaceCard from '../components/PlaceCard';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState<Gathering | null>(null);

  useEffect(() => {
    if (!id) return;
    const g = getGathering(id);
    if (!g || !g.recommendations) {
      navigate(`/gathering/${id}`);
      return;
    }
    setGathering(g);
  }, [id, navigate]);

  if (!gathering || !gathering.recommendations) return null;

  return (
    <div className="min-h-screen bg-slate-50">
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
          <p className="text-sm text-gray-500 mt-1">참여자 {gathering.participants.length}명</p>
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

        {/* 추천 지역별 장소 */}
        {gathering.recommendations.map((rec, i) => (
          <section key={i} className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-600">
              {i + 1}. {rec.region}
            </h3>
            {rec.places.map((place, j) => (
              <PlaceCard key={j} place={place} />
            ))}
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
