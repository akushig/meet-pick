import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import GatheringPage from './pages/GatheringPage';
import ResultPage from './pages/ResultPage';
import SettingsPage from './pages/SettingsPage';
import { importFromShareUrl } from './utils/share';

function ShareRedirect() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const imported = importFromShareUrl();
    if (imported) {
      setRedirectTo(`/gathering/${imported.id}`);
    } else {
      setRedirectTo('/');
    }
  }, []);

  if (!redirectTo) return null;
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
        <Route path="/share" element={<ShareRedirect />} />
      </Routes>
    </HashRouter>
  );
}
