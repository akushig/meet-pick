import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gathering, Participant } from '../types';
import { getGathering, upsertGathering, loadSettings } from '../services/storage';
import { searchAddress, loadKakaoMap } from '../services/kakaoMap';
import { getRecommendations } from '../services/gemini';
import ParticipantForm from '../components/ParticipantForm';

function newParticipant(): Participant {
  return {
    id: crypto.randomUUID(),
    name: '',
    departure: '',
    departureTime: '12:00',
    transportModes: ['subway'],
  };
}

export default function GatheringPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [gathering, setGathering] = useState<Gathering>(() => {
    const existing = id ? getGathering(id) : undefined;
    return existing || {
      id: id || crypto.randomUUID(),
      purpose: '',
      description: '',
      participants: [newParticipant()],
      createdAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    if (gathering.purpose || gathering.participants.some(p => p.name)) {
      upsertGathering(gathering);
    }
  }, [gathering]);

  const updateGathering = (fields: Partial<Gathering>) => {
    setGathering(prev => ({ ...prev, ...fields }));
  };

  const addParticipant = () => {
    updateGathering({ participants: [...gathering.participants, newParticipant()] });
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
    if (!settings.geminiApiKey) {
      setError('Gemini API 키를 설정해주세요. (설정 페이지)');
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
      // 출발지 좌표 검색
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

      // AI 추천
      const recommendations = await getRecommendations(settings.geminiApiKey, updated);
      const final = { ...updated, recommendations };
      setGathering(final);
      upsertGathering(final);

      navigate(`/gathering/${gathering.id}/result`);
    } catch (err: any) {
      setError(err.message || '추천 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-gray-800">모임 설정</h1>
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
        </section>

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
