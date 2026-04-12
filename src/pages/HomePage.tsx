import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gathering } from '../types';
import { loadGatherings, deleteGathering } from '../services/storage';
import { createShareUrl, copyToClipboard } from '../utils/share';
import Toast from '../components/Toast';

type SortMode = 'recent' | 'meeting' | 'title';

function getSelectedInfo(g: Gathering): string | null {
  if (!g.selectedPlace || !g.recommendations) return null;
  const { regionIndex, placeIndex } = g.selectedPlace;
  const rec = g.recommendations[regionIndex];
  if (!rec) return null;
  const place = rec.places[placeIndex];
  if (!place) return null;
  return `${rec.region} · ${place.name}`;
}

function getDateBadge(meetingDate: string): { label: string; className: string } | null {
  if (!meetingDate) return null;
  const today = new Date().toISOString().split('T')[0];
  if (meetingDate === today) {
    return { label: '오늘 모임', className: 'bg-primary-500 text-white' };
  }
  if (meetingDate < today) {
    return { label: '지난 모임', className: 'bg-gray-200 text-gray-500' };
  }
  return null;
}

export default function HomePage() {
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  useEffect(() => {
    setGatherings(loadGatherings());
  }, []);

  const sorted = useMemo(() => {
    const list = [...gatherings];
    switch (sortMode) {
      case 'recent':
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'meeting':
        return list.sort((a, b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''));
      case 'title':
        return list.sort((a, b) => (a.purpose || '').localeCompare(b.purpose || ''));
    }
  }, [gatherings, sortMode]);

  const handleDelete = (id: string) => {
    if (!confirm('이 모임을 삭제할까요?')) return;
    deleteGathering(id);
    setGatherings(loadGatherings());
  };

  const handleShare = async (g: Gathering) => {
    const url = createShareUrl(g);
    const ok = await copyToClipboard(url);
    if (ok) {
      setToast({ visible: true, message: '공유 링크가 복사되었습니다' });
    }
  };

  const handleToastDone = useCallback(() => {
    setToast({ visible: false, message: '' });
  }, []);

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'recent', label: '최신순' },
    { value: 'meeting', label: '모임일순' },
    { value: 'title', label: '제목순' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast message={toast.message} visible={toast.visible} onDone={handleToastDone} />

      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">
            MeetPick
            <span className="text-[10px] font-normal text-gray-400 ml-1.5">{__APP_VERSION__}</span>
          </h1>
          <Link
            to="/settings"
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            설정
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <Link
          to={`/gathering/${crypto.randomUUID()}`}
          className="block w-full bg-primary-500 hover:bg-primary-600 text-white text-center py-3 rounded-xl font-medium transition-colors"
        >
          + 새 모임 만들기
        </Link>

        {gatherings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-1">아직 모임이 없어요</p>
            <p className="text-sm">새 모임을 만들어보세요</p>
          </div>
        ) : (
          <>
            {/* 정렬 */}
            <div className="flex gap-2">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortMode(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    sortMode === opt.value
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {sorted.map(g => {
                const selectedInfo = getSelectedInfo(g);
                const participantNames = g.participants
                  .filter(p => p.name)
                  .map(p => p.name)
                  .join(', ');
                const badge = getDateBadge(g.meetingDate);

                return (
                  <div
                    key={g.id}
                    className="bg-white rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <Link to={`/gathering/${g.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-800 truncate">
                            {g.purpose || '목적 미정'}
                          </h3>
                          {badge && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>

                        {participantNames && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {participantNames}
                          </p>
                        )}

                        {g.meetingDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            {g.meetingDate} {g.meetingTime}
                          </p>
                        )}

                        {selectedInfo && (
                          <p className="text-xs text-primary-500 mt-1 truncate">
                            {selectedInfo}
                          </p>
                        )}

                        {g.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {g.description}
                          </p>
                        )}
                      </Link>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleShare(g)}
                          className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                          title="모임 공유"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
                          </svg>
                        </button>
                        {g.recommendations && g.recommendations.length > 0 && (
                          <Link
                            to={`/gathering/${g.id}/result`}
                            className="text-xs text-primary-500 hover:text-primary-700 px-1.5 py-1"
                          >
                            결과
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
