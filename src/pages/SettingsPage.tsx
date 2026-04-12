import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings, AppSettings } from '../services/storage';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const envProxy = import.meta.env.VITE_GEMINI_PROXY_URL || '';
  const envKakao = import.meta.env.VITE_KAKAO_API_KEY || '';

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasProxy = !!(envProxy || settings.proxyUrl);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-gray-800">설정</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">AI 추천 (Gemini)</h2>
          {envProxy ? (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              프록시 서버로 연결됨 (API 키 안전)
            </div>
          ) : hasProxy ? (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              프록시 서버 설정됨
            </div>
          ) : (
            <>
              <input
                type="text"
                value={settings.proxyUrl}
                onChange={e => setSettings({ ...settings, proxyUrl: e.target.value })}
                placeholder="프록시 URL (권장)"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-xs text-gray-400">또는</p>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                placeholder="Gemini API 키 (직접 입력)"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-xs text-gray-400">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-500 underline">
                  Google AI Studio
                </a>
                에서 무료로 API 키를 발급받을 수 있습니다.
              </p>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">Kakao Map API</h2>
          {envKakao ? (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              환경변수로 설정됨
            </div>
          ) : (
            <>
              <input
                type="password"
                value={settings.kakaoApiKey}
                onChange={e => setSettings({ ...settings, kakaoApiKey: e.target.value })}
                placeholder="Kakao JavaScript 키 입력"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-xs text-gray-400">
                <a href="https://developers.kakao.com/console/app" target="_blank" rel="noopener noreferrer" className="text-primary-500 underline">
                  Kakao Developers
                </a>
                에서 앱을 생성하고 JavaScript 키를 사용하세요.
              </p>
            </>
          )}
        </section>

        {(!envProxy || !envKakao) && (
          <button
            onClick={handleSave}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {saved ? '저장 완료!' : '저장'}
          </button>
        )}
      </main>
    </div>
  );
}
