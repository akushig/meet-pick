import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GatheringPage from './pages/GatheringPage';
import ResultPage from './pages/ResultPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gathering/:id" element={<GatheringPage />} />
        <Route path="/gathering/:id/result" element={<ResultPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  );
}
