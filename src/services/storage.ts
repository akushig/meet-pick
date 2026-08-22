import { Gathering } from '../types';

const STORAGE_KEY = 'meetpick_gatherings';
const SETTINGS_KEY = 'meetpick_settings';
const SAVED_PARTICIPANTS_KEY = 'meetpick_saved_participants';
const SAVED_NAMES_KEY = 'meetpick_saved_names';
const SAVED_ADDRESSES_KEY = 'meetpick_saved_addresses';
const MIGRATION_FLAG_KEY = 'meetpick_migrated_names_addresses_v1';

export interface SavedParticipant {
  name: string;
  departure: string;
  departureCoord?: { lat: number; lng: number };
}

export interface SavedAddress {
  address: string;
  coord?: { lat: number; lng: number };
}

export interface AppSettings {
  geminiApiKey: string;
  kakaoApiKey: string;
  proxyUrl: string;
  shareTtlDays?: number;
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

export function togglePinGathering(id: string): boolean {
  const list = loadGatherings();
  const idx = list.findIndex(g => g.id === id);
  if (idx < 0) return false;
  const next = !list[idx].pinned;
  list[idx] = {
    ...list[idx],
    pinned: next,
    pinnedAt: next ? new Date().toISOString() : undefined,
  };
  saveGatherings(list);
  return next;
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
    shareTtlDays: stored.shareTtlDays,
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 참여자 즐겨찾기 (이름+출발지 조합으로 고유) — 레거시. 신규 코드는 saved names/addresses 사용.
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

// 신규: 저장된 이름·주소 풀 (분리 저장)
function migrateSavedPoolsOnce() {
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;
  try {
    const oldRaw = localStorage.getItem(SAVED_PARTICIPANTS_KEY);
    if (oldRaw) {
      const old: SavedParticipant[] = JSON.parse(oldRaw);
      const existingNamesRaw = localStorage.getItem(SAVED_NAMES_KEY);
      const existingAddrsRaw = localStorage.getItem(SAVED_ADDRESSES_KEY);
      const existingNames: string[] = existingNamesRaw ? JSON.parse(existingNamesRaw) : [];
      const existingAddrs: SavedAddress[] = existingAddrsRaw ? JSON.parse(existingAddrsRaw) : [];

      const namesSet = new Set(existingNames);
      const addrMap = new Map<string, SavedAddress>();
      for (const a of existingAddrs) addrMap.set(a.address, a);

      for (const p of old) {
        if (p.name) namesSet.add(p.name);
        if (p.departure && !addrMap.has(p.departure)) {
          addrMap.set(p.departure, { address: p.departure, coord: p.departureCoord });
        }
      }
      localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify(Array.from(namesSet)));
      localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(Array.from(addrMap.values())));
    }
  } catch {
    // ignore migration errors
  }
  localStorage.setItem(MIGRATION_FLAG_KEY, '1');
}

export function loadSavedNames(): string[] {
  migrateSavedPoolsOnce();
  const raw = localStorage.getItem(SAVED_NAMES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSavedName(name: string) {
  if (!name) return;
  const list = loadSavedNames();
  if (list.includes(name)) return;
  list.push(name);
  localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify(list));
}

export function loadSavedAddresses(): SavedAddress[] {
  migrateSavedPoolsOnce();
  const raw = localStorage.getItem(SAVED_ADDRESSES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSavedAddress(a: SavedAddress) {
  if (!a.address) return;
  const list = loadSavedAddresses();
  const idx = list.findIndex(s => s.address === a.address);
  if (idx >= 0) {
    // 좌표가 새로 들어왔으면 업데이트
    if (a.coord && !list[idx].coord) {
      list[idx] = a;
      localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(list));
    }
    return;
  }
  list.push(a);
  localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(list));
}
