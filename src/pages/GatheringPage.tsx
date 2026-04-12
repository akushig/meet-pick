import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gathering, Participant } from '../types';
import { getGathering, upsertGathering, loadSettings, saveSavedParticipant } from '../services/storage';
import { searchAddress, loadKakaoMap } from '../services/kakaoMap';
import { getRecommendations } from '../services/gemini';
import ParticipantForm from '../components/ParticipantForm';
import Toast from '../components/Toast';
import SelectedPlaceView from '../components/SelectedPlaceView';
import { createShareUrl, copyToClipboard } from '../utils/share';

function getDefaultDepartureTime(meetingTime: string): string {
  if (!meetingTime) return '11:00';
  const [h, m] = meetingTime.split(':').map(Number);
  const totalMin = h * 60 + m - 60;
  const adjMin = totalMin < 0 ? totalMin + 1440 : totalMin;
  const hh = String(Math.floor(adjMin / 60)).padStart(2, '0');
  const mm = String(adjMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function newParticipant(meetingTime: string): Participant {
  return {
    id: crypto.randomUUID(),
    name: '',
    departure: '',
    departureTime: getDefaultDepartureTime(meetingTime),
    transportModes: ['subway'],
  };
}

export default function GatheringPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [showPlaceMap, setShowPlaceMap] = useState(false);

  const [gathering, setGathering] = useState<Gathering>(() => {
    const existing = id ? getGathering(id) : undefined;
    return existing || {
      id: id || crypto.randomUUID(),
      purpose: '',
      description: '',
      meetingDate: new Date().toISOString().split('T')[0],
      meetingTime: '12:00',
      participants: [newParticipant('12:00')],
      createdAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    if (gathering.purpose || gathering.participants.some(p => p.name)) {
      upsertGathering(gathering);
    }
  }, [gathering]);

  // 참여자 정보가 변경될 때 즐겨찾기에 자동 저장
  useEffect(() => {
    gathering.participants.forEach(p => {
      if (p.name && p.departure) {
        saveSavedParticipant({ name: p.name, departure: p.departure, departureCoord: p.departureCoord });
      }
    });
  }, [gathering.participants]);

  const updateGathering = (fields: Partial<Gathering>) => {
    setGathering(prev => ({ ...prev, ...fields }));
  };

  const handleMeetingTimeChange = (newTime: string) => {
    const defaultDep = getDefaultDepartureTime(newTime);
    const oldDefault = getDefaultDepartureTime(gathering.meetingTime);
    const updatedParticipants = gathering.participants.map(p =>
      p.departureTime === oldDefault ? { ...p, departureTime: defaultDep } : p
    );
    updateGathering({ meetingTime: newTime, participants: updatedParticipants });
  };

  const handleShare = async () => {
    const url = createShareUrl(gathering);
    const ok = await copyToClipboard(url);
    if (ok) {
      setToast({ visible: true, message: '공유 링크가 복사되었습니다' });
    }
  };

  const addParticipant = () => {
    updateGathering({ participants: [...gathering.participants, newParticipant(gathering.meetingTime)] });
  };

  const updateParticipant = (idx: number, p: Participant) => {
    const list = [...gathering.participants];
    list[idx] = p;
    updateGathering({ participants: list });
  };

  const removeParticipant = (idx: number) => {
    if (gathering.participants.length <= 1) return;
    updateGathering({ participants: gathering.participants.filter((_, i) => i !== idx) });
  };

  const handleRecommend = async () => {
    const settings = loadSettings();
    if (!settings.geminiApiKey && !settings.proxyUrl) {
      setError('Gemini API 키 또는 프록시 URL을 설정해주세요. (설정 페이지)');
      return;
    }
    if (!settings.kakaoApiKey) {
      setError('Kakao API 키를 설정해주세요. (설정 페이지)');
      return;
    }
    if (gathering.participants.length < 2) {
      setError('참여자를 2명 이상 추가해주세요.');
      return;
    }
    if (gathering.participants.some(p => !p.name || !p.departure)) {
      setError('모든 참여자의 이름과 출발지를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loadKakaoMap();
      const updatedParticipants = await Promise.all(
        gathering.participants.map(async (p) => {
          if (p.departureCoord) return p;
          const coord = await searchAddress(p.departure);
          return coord ? { ...p, departureCoord: coord } : p;
        })
      );

      const updated = { ...gathering, participants: updatedParticipants };
      setGathering(updated);

      const recommendations = await getRecommendations(settings.geminiApiKey, updated, (sec) => {
        setError(`분당 요청 한도 도달. ${sec}초 후 자동 재시도합니다...`);
      });
      setError('');
      const final = { ...updated, recommendations, selectedPlace: undefined };
      setGathering(final);
      upsertGathering(final);

      navigate(`/gathering/${gathering.id}/result`);
    } catch (err: any) {
      setError(err.message || '추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleToastDone = useCallback(() => {
    setToast({ visible: false, message: '' });
  }, []);

  // 선택된 장소 정보 추출
  const selectedPlaceData = (() => {
    if (!gathering.selectedPlace || !gathering.recommendations) return null;
    const { regionIndex, placeIndex } = gathering.selectedPlace;
    const rec = gathering.recommendations[regionIndex];
    if (!rec) return null;
    const place = rec.places[placeIndex];
    if (!place) return null;
    return { region: rec.region, place };
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast message={toast.message} visible={toast.visible} onDone={handleToastDone} />

      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
              ← 뒤로
            </button>
            <h1 className="text-lg font-bold text-gray-800">모임 설정</h1>
          </div>
          <button
            onClick={handleShare}
            className="text-gray-400 hover:text-primary-500 transition-colors"
            title="모임 공유"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* 모임 정보 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">모임 정보</h2>
          <input
            type="text"
            value={gathering.purpose}
            onChange={e => updateGathering({ purpose: e.target.value })}
            placeholder="모임 목적 (예: 점심 식사, 스터디)"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <textarea
            value={gathering.description}
            onChange={e => updateGathering({ description: e.target.value })}
            placeholder="상세 설명 (선택)"
            rows={2}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">모임 예정일</label>
              <input
                type="date"
                value={gathering.meetingDate}
                onChange={e => updateGathering({ meetingDate: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">모임 예정 시간</label>
              <input
                type="time"
                value={gathering.meetingTime}
                onChange={e => handleMeetingTimeChange(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
        </section>

        {/* 참여자 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-600">
              참여자 ({gathering.participants.length}명)
            </h2>
            <button
              onClick={addParticipant}
              className="text-sm text-primary-500 hover:text-primary-700 font-medium"
            >
              + 추가
            </button>
          </div>
          {gathering.participants.map((p, i) => (
            <ParticipantForm
              key={p.id}
              participant={p}
              onChange={(updated) => updateParticipant(i, updated)}
              onRemove={() => removeParticipant(i)}
            />
          ))}
          <button
            onClick={addParticipant}
            className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
          >
            + 참여자 추가
          </button>
        </section>

        {/* 선택된 장소 표시 */}
        {selectedPlaceData && (
          <div
            onClick={() => setShowPlaceMap(true)}
            className="bg-primary-50 border border-primary-200 rounded-xl p-4 cursor-pointer hover:bg-primary-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-400 mb-1">선택된 모임 장소 (탭하여 지도 보기)</p>
                <p className="text-sm font-medium text-primary-700">{selectedPlaceData.region} · {selectedPlaceData.place.name}</p>
                <p className="text-xs text-primary-500 mt-1">{selectedPlaceData.place.address}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary-400 shrink-0">
                <path fillRule="evenodd" d="M8.157 2.175a1.5 1.5 0 00-1.147 0l-4.084 1.69A1.5 1.5 0 002 5.251v10.877a1.5 1.5 0 002.074 1.386l3.51-1.453 4.26 1.763a1.5 1.5 0 001.146 0l4.083-1.69A1.5 1.5 0 0018 14.748V3.873a1.5 1.5 0 00-2.073-1.386l-3.51 1.452-4.26-1.763zM7.58 5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 017.58 5zm5.59 2.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* 선택된 장소 지도 모달 */}
        {showPlaceMap && selectedPlaceData && (
          <SelectedPlaceView
            region={selectedPlaceData.region}
            place={selectedPlaceData.place}
            onClose={() => setShowPlaceMap(false)}
          />
        )}

        {/* 이전 추천 결과 보기 */}
        {gathering.recommendations && gathering.recommendations.length > 0 && (
          <button
            onClick={() => navigate(`/gathering/${gathering.id}/result`)}
            className="w-full bg-white border border-primary-300 text-primary-600 hover:bg-primary-50 py-3 rounded-xl font-medium transition-colors"
          >
            이전 추천 결과 보기
          </button>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 추천 버튼 */}
        <button
          onClick={handleRecommend}
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              AI가 장소를 찾고 있어요...
            </span>
          ) : (
            '만남 장소 추천받기'
          )}
        </button>
      </main>
    </div>
  );
}
