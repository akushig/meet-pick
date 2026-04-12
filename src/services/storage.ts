import { Gathering } from '../types';

const STORAGE_KEY = 'meetpick_gatherings';
const SETTINGS_KEY = 'meetpick_settings';
const SAVED_PARTICIPANTS_KEY = 'meetpick_saved_participants';

export interface SavedParticipant {
  name: string;
  departure: string;
  departureCoord?: { lat: number; lng: number };
}

export interface AppSettings {
  geminiApiKey: string;
  kakaoApiKey: string;
  proxyUrl: string;
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
  const envProxy = import.meta.env.VITE_GEMINI_PROXY_URL || '';
  const raw = localStorage.getItem(SETTINGS_KEY);
  const stored: AppSettings = raw ? JSON.parse(raw) : { geminiApiKey: '', kakaoApiKey: '', proxyUrl: '' };
  return {
    geminiApiKey: envGemini || stored.geminiApiKey,
    kakaoApiKey: envKakao || stored.kakaoApiKey,
    proxyUrl: envProxy || stored.proxyUrl || '',
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 참여자 즐겨찾기 (이름+출발지 조합으로 고유)
export function loadSavedParticipants(): SavedParticipant[] {
  const raw = localStorage.getItem(SAVED_PARTICIPANTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSavedParticipant(p: SavedParticipant) {
  const list = loadSavedParticipants();
  const key = `${p.name}|${p.departure}`;
  const exists = list.some(s => `${s.name}|${s.departure}` === key);
  if (!exists) {
    list.push(p);
    localStorage.setItem(SAVED_PARTICIPANTS_KEY, JSON.stringify(list));
  }
}

export function removeSavedParticipant(name: string, departure: string) {
  const list = loadSavedParticipants().filter(s => !(s.name === name && s.departure === departure));
  localStorage.setItem(SAVED_PARTICIPANTS_KEY, JSON.stringify(list));
}
