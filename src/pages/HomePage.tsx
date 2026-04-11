import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gathering } from '../types';
import { loadGatherings, deleteGathering } from '../services/storage';

export default function HomePage() {
  const [gatherings, setGatherings] = useState<Gathering[]>([]);

  useEffect(() => {
    setGatherings(loadGatherings());
  }, []);

  const handleDelete = (id: string) => {
    if (!confirm('이 모임을 삭제할까요?')) return;
    deleteGathering(id);
    setGatherings(loadGatherings());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">MeetPick</h1>
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
          <div className="space-y-3">
            {gatherings.map(g => (
              <div
                key={g.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <Link to={`/gathering/${g.id}`} className="flex-1">
                    <h3 className="font-medium text-gray-800">{g.purpose || '목적 미정'}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      참여자 {g.participants.length}명
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(g.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    {g.recommendations && g.recommendations.length > 0 && (
                      <Link
                        to={`/gathering/${g.id}/result`}
                        className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1"
                      >
                        결과보기
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
