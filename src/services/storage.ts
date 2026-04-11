import { Gathering } from '../types';

const STORAGE_KEY = 'meetpick_gatherings';
const SETTINGS_KEY = 'meetpick_settings';

export interface AppSettings {
  geminiApiKey: string;
  kakaoApiKey: string;
}

export function loadGatherings(): Gathering[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveGatherings(gatherings: Gathering[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gatherings));
}

export function getGathering(id: string): Gathering | undefined {
  return loadGatherings().find(g => g.id === id);
}

export function upsertGathering(gathering: Gathering) {
  const list = loadGatherings();
  const idx = list.findIndex(g => g.id === gathering.id);
  if (idx >= 0) list[idx] = gathering;
  else list.push(gathering);
  saveGatherings(list);
}

export function deleteGathering(id: string) {
  saveGatherings(loadGatherings().filter(g => g.id !== id));
}

export function loadSettings(): AppSettings {
  const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';
  const envKakao = import.meta.env.VITE_KAKAO_API_KEY || '';
  const raw = localStorage.getItem(SETTINGS_KEY);
  const stored: AppSettings = raw ? JSON.parse(raw) : { geminiApiKey: '', kakaoApiKey: '' };
  return {
    geminiApiKey: envGemini || stored.geminiApiKey,
    kakaoApiKey: envKakao || stored.kakaoApiKey,
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
