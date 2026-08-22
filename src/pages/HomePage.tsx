import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gathering } from '../types';
import { loadGatherings, deleteGathering, togglePinGathering } from '../services/storage';
import { createShareUrl, copyToClipboard, nativeShare } from '../utils/share';
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
    const compareBySort = (a: Gathering, b: Gathering) => {
      switch (sortMode) {
        case 'recent':
          return b.createdAt.localeCompare(a.createdAt);
        case 'meeting':
          return (b.meetingDate || '').localeCompare(a.meetingDate || '');
        case 'title':
          return (a.purpose || '').localeCompare(b.purpose || '');
      }
    };
    return [...gatherings].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        const diff = (b.pinnedAt || '').localeCompare(a.pinnedAt || '');
        if (diff !== 0) return diff;
      }
      return compareBySort(a, b);
    });
  }, [gatherings, sortMode]);

  const handleDelete = (id: string) => {
    if (!confirm('이 모임을 삭제할까요?')) return;
    deleteGathering(id);
    setGatherings(loadGatherings());
  };

  const handleTogglePin = (id: string) => {
    togglePinGathering(id);
    setGatherings(loadGatherings());
  };

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevTops = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const newTops = new Map<string, number>();
    itemRefs.current.forEach((el, id) => {
      newTops.set(id, el.offsetTop);
    });
    newTops.forEach((currTop, id) => {
      const prevTop = prevTops.current.get(id);
      const el = itemRefs.current.get(id);
      if (el && prevTop !== undefined && prevTop !== currTop) {
        const dy = prevTop - currTop;
        el.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
          { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      }
    });
    prevTops.current = newTops;
  });

  const handleCopyLink = async (g: Gathering) => {
    try {
      const url = await createShareUrl(g, 'detail');
      const ok = await copyToClipboard(url);
      if (ok) {
        setToast({ visible: true, message: '링크가 복사되었습니다' });
      }
    } catch (err: any) {
      setToast({ visible: true, message: err?.message || '링크 생성에 실패했습니다' });
    }
  };

  const handleShare = async (g: Gathering) => {
    try {
      const url = await createShareUrl(g, 'detail');
      const result = await nativeShare({
        title: g.purpose || 'MeetPick 모임',
        text: `${g.purpose || '모임'} — ${g.meetingDate} ${g.meetingTime}`,
        url,
      });
      if (result === 'copied') {
        setToast({ visible: true, message: '공유 링크가 복사되었습니다' });
      }
    } catch (err: any) {
      setToast({ visible: true, message: err?.message || '공유에 실패했습니다' });
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
                    ref={el => {
                      if (el) itemRefs.current.set(g.id, el);
                      else itemRefs.current.delete(g.id);
                    }}
                    className={`bg-white rounded-xl border p-4 transition-colors ${
                      g.pinned ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'
                    }`}
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
                      </Link>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleTogglePin(g.id)}
                          className={`transition-colors p-1 ${
                            g.pinned
                              ? 'text-primary-600 hover:text-primary-700'
                              : 'text-gray-300 hover:text-primary-400'
                          }`}
                          title={g.pinned ? '고정 해제' : '상단 고정'}
                          aria-label={g.pinned ? '고정 해제' : '상단 고정'}
                          aria-pressed={!!g.pinned}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 01.16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 01-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 010-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 011.013.16l3.134-3.133a2.772 2.772 0 01-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 01.353-.146z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleCopyLink(g)}
                          className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                          title="링크 복사"
                          aria-label="링크 복사"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleShare(g)}
                          className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                          title="다른 앱으로 공유"
                          aria-label="다른 앱으로 공유"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3 mt-1">
                      <Link to={`/gathering/${g.id}`} className="flex-1 min-w-0">
                        {participantNames && (
                          <p className="text-xs text-gray-500 truncate">
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
                      <div className="flex items-center gap-3 shrink-0">
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
