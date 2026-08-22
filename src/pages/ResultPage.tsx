import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Gathering } from '../types';
import { getGathering, upsertGathering } from '../services/storage';
import KakaoMap from '../components/KakaoMap';
import PlaceCard from '../components/PlaceCard';
import SelectedPlaceView from '../components/SelectedPlaceView';
import Toast from '../components/Toast';
import { createShareUrl, copyToClipboard, nativeShare } from '../utils/share';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', navigateBack: false });
  const [peek, setPeek] = useState<{ regionIndex: number; placeIndex: number } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // 공유 링크 진입 시의 일회성 강조 상태 (저장 X, 탭 네비 시 리셋)
  const [sharedPlace, setSharedPlace] = useState<{ regionIndex: number; placeIndex: number } | null>(null);
  const [pulseShared, setPulseShared] = useState(false);
  const sharedHandledRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    const g = getGathering(id);
    if (!g || !g.recommendations) {
      navigate(`/gathering/${id}`);
      return;
    }
    setGathering(g);
  }, [id, navigate]);

  useEffect(() => {
    if (!gathering) return;
    if (sharedHandledRef.current) return;
    if (searchParams.get('shared') !== '1') return;
    sharedHandledRef.current = true;

    // 공유된 장소 인덱스: `sp=ri-pi` 쿼리에서 파싱 (구버전 링크는 selectedPlace로 폴백)
    let target: { regionIndex: number; placeIndex: number } | null = null;
    const sp = searchParams.get('sp');
    if (sp) {
      const m = sp.match(/^(\d+)-(\d+)$/);
      if (m) target = { regionIndex: Number(m[1]), placeIndex: Number(m[2]) };
    }
    if (!target && gathering.selectedPlace) target = gathering.selectedPlace;

    const cleared = new URLSearchParams(searchParams);
    cleared.delete('shared');
    cleared.delete('sp');
    setSearchParams(cleared, { replace: true });

    if (!target) return;
    const rec = gathering.recommendations?.[target.regionIndex];
    const place = rec?.places[target.placeIndex];
    if (!rec || !place) return;

    const goal = target;
    setSharedPlace(goal);
    setPulseShared(true);
    setTimeout(() => {
      document
        .getElementById(`place-${goal.regionIndex}-${goal.placeIndex}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    setTimeout(() => setPulseShared(false), 4000);
  }, [gathering, searchParams, setSearchParams]);

  const handleToastDone = useCallback(() => {
    const shouldNav = toast.navigateBack;
    setToast({ visible: false, message: '', navigateBack: false });
    if (shouldNav) navigate(`/gathering/${id}`);
  }, [toast.navigateBack, navigate, id]);

  const handleToggleSelect = (regionIndex: number, placeIndex: number) => {
    if (!gathering || !gathering.recommendations) return;
    const sel = gathering.selectedPlace;
    const alreadySelected = sel?.regionIndex === regionIndex && sel?.placeIndex === placeIndex;

    if (alreadySelected) {
      const updated = { ...gathering, selectedPlace: undefined };
      setGathering(updated);
      upsertGathering(updated);
      setToast({ visible: true, message: '선택이 해제되었습니다', navigateBack: false });
      return;
    }

    const rec = gathering.recommendations[regionIndex];
    const place = rec.places[placeIndex];
    const updated = { ...gathering, selectedPlace: { regionIndex, placeIndex } };
    setGathering(updated);
    upsertGathering(updated);
    setToast({ visible: true, message: `"${rec.region} · ${place.name}" 선택 완료`, navigateBack: true });
  };

  const handleViewMap = (regionIndex: number, placeIndex: number) => {
    setPeek({ regionIndex, placeIndex });
  };

  const buildShareUrlForPlace = async (regionIndex: number, placeIndex: number): Promise<string | null> => {
    if (!gathering || !gathering.recommendations) return null;
    try {
      return await createShareUrl(gathering, 'result', { regionIndex, placeIndex });
    } catch (err: any) {
      setToast({
        visible: true,
        message: err?.message || '공유 링크 생성에 실패했습니다',
        navigateBack: false,
      });
      return null;
    }
  };

  const handleCopyLinkPlace = async (regionIndex: number, placeIndex: number) => {
    const url = await buildShareUrlForPlace(regionIndex, placeIndex);
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      setToast({ visible: true, message: '링크가 복사되었습니다', navigateBack: false });
    }
  };

  const handleSharePlace = async (regionIndex: number, placeIndex: number) => {
    if (!gathering || !gathering.recommendations) return;
    const rec = gathering.recommendations[regionIndex];
    const place = rec.places[placeIndex];

    const url = await buildShareUrlForPlace(regionIndex, placeIndex);
    if (!url) return;

    const result = await nativeShare({
      title: `${gathering.purpose || '모임 장소'}`,
      text: `${rec.region} · ${place.name}\n${place.address}`,
      url,
    });
    if (result === 'copied') {
      setToast({ visible: true, message: '공유 링크가 복사되었습니다', navigateBack: false });
    }
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

        {/* 종합 피드백 */}
        {gathering.recommendationSummary && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary-500">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-primary-700">종합 피드백</h3>
            </div>
            <p className="text-sm text-primary-900 leading-relaxed whitespace-pre-wrap">
              {gathering.recommendationSummary}
            </p>
          </div>
        )}

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

        <p className="text-xs text-gray-400 text-center">
          좌측 체크박스로 모임 장소를 선택하고, 우측 아이콘으로 공유할 수 있어요
        </p>

        {/* 추천 지역별 장소 */}
        {gathering.recommendations.map((rec, i) => (
          <section key={i} className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-600">
              {i + 1}. {rec.region}
            </h3>
            {rec.places.map((place, j) => {
              const isSelected = sel?.regionIndex === i && sel?.placeIndex === j;
              const isShared = sharedPlace?.regionIndex === i && sharedPlace?.placeIndex === j;
              const rank = place.rank;
              return (
                <div key={j} id={`place-${i}-${j}`} className="scroll-mt-20 relative">
                  <PlaceCard
                    place={place}
                    rank={rank && rank <= 3 ? rank : undefined}
                    selected={isSelected}
                    onToggleSelect={() => handleToggleSelect(i, j)}
                    onViewMap={() => handleViewMap(i, j)}
                    onCopyLink={() => handleCopyLinkPlace(i, j)}
                    onShare={() => handleSharePlace(i, j)}
                  />
                  {isShared && pulseShared && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl ring-4 ring-primary-400 pointer-events-none animate-pulse"
                    />
                  )}
                  {isShared && (
                    <div className="absolute -top-3 left-4 z-10 flex items-center gap-1 bg-primary-500 text-white text-[11px] font-semibold pl-2 pr-2.5 py-1 rounded-full shadow-md pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span>공유받은 장소</span>
                    </div>
                  )}
                </div>
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

      {peek && gathering.recommendations[peek.regionIndex] && gathering.recommendations[peek.regionIndex].places[peek.placeIndex] && (
        <SelectedPlaceView
          region={gathering.recommendations[peek.regionIndex].region}
          place={gathering.recommendations[peek.regionIndex].places[peek.placeIndex]}
          onClose={() => setPeek(null)}
        />
      )}
    </div>
  );
}
