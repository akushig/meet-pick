import { HashRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import GatheringPage from './pages/GatheringPage';
import ResultPage from './pages/ResultPage';
import SettingsPage from './pages/SettingsPage';
import { fetchSharedGathering, importFromShareUrl, ImportedShare } from './utils/share';

function buildRedirectPath(imported: ImportedShare): string {
  const { gathering, target, sharedPlace } = imported;
  if (target === 'result') {
    const qs = sharedPlace
      ? `?shared=1&sp=${sharedPlace.regionIndex}-${sharedPlace.placeIndex}`
      : '?shared=1';
    return `/gathering/${gathering.id}/result${qs}`;
  }
  return `/gathering/${gathering.id}`;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-gray-500">
      공유된 모임을 불러오는 중...
    </div>
  );
}

// 신규 짧은 경로: /#/<shareId>[?to=result&p=ri-pi]
function ShareByPath() {
  const { shareId } = useParams<{ shareId: string }>();
  const location = useLocation();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareId) {
        setRedirectTo('/');
        return;
      }
      const params = new URLSearchParams(location.search);
      const imported = await fetchSharedGathering(shareId, params);
      if (cancelled) return;
      setRedirectTo(imported ? buildRedirectPath(imported) : '/');
    })();
    return () => { cancelled = true; };
  }, [shareId, location.search]);

  if (!redirectTo) return <LoadingScreen />;
  return <Navigate to={redirectTo} replace />;
}

// 레거시 경로: /#/share?id=... or /#/share?data=...
function LegacyShareRedirect() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const imported = await importFromShareUrl();
      if (cancelled) return;
      setRedirectTo(imported ? buildRedirectPath(imported) : '/');
    })();
    return () => { cancelled = true; };
  }, []);

  if (!redirectTo) return <LoadingScreen />;
  return <Navigate to={redirectTo} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gathering/:id" element={<GatheringPage />} />
        <Route path="/gathering/:id/result" element={<ResultPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/share" element={<LegacyShareRedirect />} />
        <Route path="/:shareId" element={<ShareByPath />} />
      </Routes>
    </HashRouter>
  );
}
