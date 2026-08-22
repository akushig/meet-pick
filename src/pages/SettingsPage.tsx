import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings, AppSettings } from '../services/storage';
import { createBackup, formatBackupCode, restoreBackup } from '../services/backup';
import { copyToClipboard } from '../utils/share';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const [backupCode, setBackupCode] = useState<string | null>(null);
  const [backupTtlDays, setBackupTtlDays] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const [restoreInput, setRestoreInput] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreDone, setRestoreDone] = useState(false);

  const envProxy = import.meta.env.VITE_GEMINI_PROXY_URL || '';

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreateBackup = async () => {
    setBackupBusy(true);
    setBackupError('');
    setBackupCode(null);
    setCodeCopied(false);
    try {
      const { code, ttlSeconds } = await createBackup(false);
      setBackupCode(code);
      setBackupTtlDays(Math.round(ttlSeconds / 86400));
    } catch (err: any) {
      setBackupError(err?.message || '백업 생성에 실패했습니다.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!backupCode) return;
    const ok = await copyToClipboard(formatBackupCode(backupCode));
    if (ok) {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleRestore = async () => {
    setRestoreError('');
    setRestoreDone(false);
    if (!confirm('현재 앱의 모든 데이터(모임·참여자·설정)가 이 코드의 백업 내용으로 교체됩니다. 계속할까요?')) {
      return;
    }
    setRestoreBusy(true);
    try {
      await restoreBackup(restoreInput);
      setRestoreDone(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setRestoreError(err?.message || '복원에 실패했습니다.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const hasProxy = !!(envProxy || settings.proxyUrl);
  const backupReady = hasProxy;

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
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-600">공유 링크 유효기간</h2>
          <p className="text-xs text-gray-400">이 기기에서 새로 만드는 공유 링크의 기본 만료 기간입니다. 기존 링크에는 영향 없음.</p>
          <select
            value={settings.shareTtlDays ?? 7}
            onChange={e => setSettings({ ...settings, shareTtlDays: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value={1}>1일</option>
            <option value={7}>7일 (기본)</option>
            <option value={30}>30일</option>
          </select>
        </section>

        <button
          onClick={handleSave}
          className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {saved ? '저장 완료!' : '저장'}
        </button>

        <section className="space-y-3 pt-2 border-t border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-600">데이터 백업 코드 생성</h2>
            <p className="text-xs text-gray-400 mt-1">
              모든 모임·참여자·설정을 서버에 안전하게 저장하고 짧은 코드를 받습니다. 다른 기기에서 아래 "복원"으로 되돌릴 수 있어요.
            </p>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={!backupReady || backupBusy}
            className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {backupBusy ? '백업 중...' : '백업 코드 생성'}
          </button>

          {!backupReady && (
            <p className="text-xs text-red-500">프록시 URL이 먼저 설정돼야 백업을 만들 수 있어요.</p>
          )}

          {backupError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {backupError}
            </div>
          )}

          {backupCode && (
            <div className="px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl">
              <p className="text-xs text-primary-600 mb-1">백업 코드 (유효기간 {backupTtlDays ?? 30}일)</p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-xl font-mono font-bold tracking-wider text-primary-900 select-all">
                  {formatBackupCode(backupCode)}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-white border border-primary-300 text-primary-600 hover:bg-primary-100"
                >
                  {codeCopied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="text-[11px] text-primary-500 mt-2">
                이 코드를 다른 기기의 "백업 복원"에 입력하면 현재 데이터가 그 기기로 옮겨집니다.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-600">백업 복원</h2>
            <p className="text-xs text-gray-400 mt-1">
              백업 코드를 입력하면 현재 앱 데이터가 그 백업 내용으로 <span className="text-red-500 font-medium">덮어써집니다.</span>
            </p>
          </div>

          <input
            type="text"
            value={restoreInput}
            onChange={e => setRestoreInput(e.target.value)}
            placeholder="예: ABCD-EFGH"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-primary-300"
          />

          <button
            onClick={handleRestore}
            disabled={!backupReady || restoreBusy || !restoreInput.trim()}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {restoreBusy ? '복원 중...' : '복원하기'}
          </button>

          {restoreError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {restoreError}
            </div>
          )}

          {restoreDone && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              복원 완료! 앱을 새로고침합니다...
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
