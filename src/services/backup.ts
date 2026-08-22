import { loadSettings } from './storage';

const LOCAL_KEYS = [
  'meetpick_gatherings',
  'meetpick_saved_participants',
  'meetpick_settings',
] as const;

const BACKUP_VERSION = 1;

function getBackupApiBase(): string | null {
  const { proxyUrl } = loadSettings();
  if (!proxyUrl) return null;
  try {
    return new URL(proxyUrl).origin;
  } catch {
    return null;
  }
}

function maskSettingsString(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw);
    const { geminiApiKey, kakaoApiKey, ...rest } = parsed;
    void geminiApiKey;
    void kakaoApiKey;
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}

function snapshot(includeApiKeys: boolean): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const key of LOCAL_KEYS) {
    const v = localStorage.getItem(key);
    if (key === 'meetpick_settings' && !includeApiKeys) {
      data[key] = maskSettingsString(v);
    } else {
      data[key] = v;
    }
  }
  return data;
}

export function formatBackupCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 8) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function createBackup(includeApiKeys: boolean): Promise<{ code: string; ttlSeconds: number }> {
  const base = getBackupApiBase();
  if (!base) {
    throw new Error('백업 서버(프록시 URL)가 설정되지 않아 백업을 만들 수 없습니다. 설정에서 프록시 URL을 확인해주세요.');
  }

  const payload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    includeApiKeys,
    data: snapshot(includeApiKeys),
  };

  const res = await fetch(`${base}/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`백업 생성에 실패했습니다 (HTTP ${res.status}).`);
  }

  const json = await res.json();
  if (!json?.code) throw new Error('백업 코드를 받지 못했습니다.');
  return { code: json.code as string, ttlSeconds: Number(json.ttlSeconds || 0) };
}

export async function restoreBackup(codeInput: string): Promise<void> {
  const base = getBackupApiBase();
  if (!base) {
    throw new Error('백업 서버(프록시 URL)가 설정되지 않아 복원할 수 없습니다. 설정에서 프록시 URL을 먼저 저장해주세요.');
  }
  const code = normalizeBackupCode(codeInput);
  if (code.length !== 8) {
    throw new Error('코드는 8자리여야 합니다. 예: ABCD-EFGH');
  }

  const res = await fetch(`${base}/backup/${code}`);
  if (res.status === 404) {
    throw new Error('해당 코드의 백업을 찾을 수 없습니다. (만료되었거나 오타일 수 있어요)');
  }
  if (!res.ok) {
    throw new Error(`백업 조회에 실패했습니다 (HTTP ${res.status}).`);
  }

  const payload = await res.json();
  if (!payload || typeof payload !== 'object' || !payload.data) {
    throw new Error('백업 데이터 형식이 올바르지 않습니다.');
  }

  // Current proxyUrl 보존: 새 기기에서 설정해둔 proxyUrl을 복원이 덮어쓰지 않도록,
  // 복원된 settings의 proxyUrl이 비어있으면 현재 값을 유지.
  const currentProxy = loadSettings().proxyUrl;

  for (const key of LOCAL_KEYS) {
    const val = payload.data[key];
    if (key === 'meetpick_settings' && val) {
      try {
        const parsed = JSON.parse(val);
        if (!parsed.proxyUrl && currentProxy) parsed.proxyUrl = currentProxy;
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch {
        localStorage.setItem(key, val);
      }
    } else if (val === null || val === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, val);
    }
  }
}
