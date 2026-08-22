const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 7;          // 7 days
const BACKUP_TTL_SECONDS = 60 * 60 * 24 * 30;        // 30 days
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;          // 7 days for place/region cache
const MAX_SHARE_BYTES = 50 * 1024;                   // 50KB
const MAX_BACKUP_BYTES = 200 * 1024;                 // 200KB
const MAX_CACHE_BYTES = 4 * 1024;                    // 4KB per place/region cache entry

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 4;
const BACKUP_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const BACKUP_CODE_LENGTH = 8;

// --- utilities ---

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

function generateId() {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return id;
}

function generateBackupCode() {
  const bytes = new Uint8Array(BACKUP_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += BACKUP_CODE_ALPHABET[bytes[i] % BACKUP_CODE_ALPHABET.length];
  }
  return code;
}

function normalizeBackupCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeCacheKey(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}·•.,'"`!?\-]/g, '');
}

// 분 단위 rate limit 카운터 (best-effort, KV 일관성 범위 내).
// 한도 초과 시 429 Response 반환, 통과 시 null.
async function checkRateLimit(env, ip, route, limitPerMin) {
  if (!env.SHARE_KV || !ip) return null;
  const d = new Date();
  const minute = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const key = `rl:${ip}:${route}:${minute}`;
  const current = parseInt((await env.SHARE_KV.get(key)) || '0', 10);
  if (current >= limitPerMin) {
    return jsonResponse(
      { error: 'rate limit exceeded', retryAfterSeconds: 60 },
      429,
      { 'Retry-After': '60' }
    );
  }
  await env.SHARE_KV.put(key, String(current + 1), { expirationTtl: 120 });
  return null;
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
}

// --- share (단축 공유 링크) ---

async function handleShareSave(request, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'share storage not configured' }, 500);
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_SHARE_BYTES) return jsonResponse({ error: 'payload too large' }, 413);
  const body = await request.text();
  if (!body || body.length > MAX_SHARE_BYTES) return jsonResponse({ error: 'payload too large or empty' }, 413);

  // body에 __ttlDays가 들어있으면 TTL로 해석(1~30일), 저장 전 필드 제거.
  let ttl = SHARE_TTL_SECONDS;
  let saved = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && typeof parsed.__ttlDays === 'number') {
      const days = Math.max(1, Math.min(30, Math.floor(parsed.__ttlDays)));
      ttl = days * 24 * 60 * 60;
      delete parsed.__ttlDays;
      saved = JSON.stringify(parsed);
    }
  } catch {
    // body가 JSON이 아니면 그대로 저장 + 기본 TTL.
  }

  let id = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    id = generateId();
    const existing = await env.SHARE_KV.get(id);
    if (!existing) break;
  }

  await env.SHARE_KV.put(id, saved, { expirationTtl: ttl });
  return jsonResponse({ id, ttlSeconds: ttl });
}

async function handleShareGet(id, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'share storage not configured' }, 500);
  const data = await env.SHARE_KV.get(id);
  if (!data) return jsonResponse({ error: 'not found or expired' }, 404);
  return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

// --- backup ---

async function handleBackupSave(request, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'backup storage not configured' }, 500);
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BACKUP_BYTES) return jsonResponse({ error: 'payload too large' }, 413);
  const body = await request.text();
  if (!body || body.length > MAX_BACKUP_BYTES) return jsonResponse({ error: 'payload too large or empty' }, 413);

  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateBackupCode();
    const existing = await env.SHARE_KV.get(`backup:${code}`);
    if (!existing) break;
  }

  await env.SHARE_KV.put(`backup:${code}`, body, { expirationTtl: BACKUP_TTL_SECONDS });
  return jsonResponse({ code, ttlSeconds: BACKUP_TTL_SECONDS });
}

async function handleBackupGet(rawCode, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'backup storage not configured' }, 500);
  const code = normalizeBackupCode(rawCode);
  if (code.length !== BACKUP_CODE_LENGTH) return jsonResponse({ error: 'invalid code' }, 400);
  const data = await env.SHARE_KV.get(`backup:${code}`);
  if (!data) return jsonResponse({ error: 'not found or expired' }, 404);
  return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

// --- place/region 캐시 (verifyPlace/verifyRegion 결과 재사용) ---

async function handlePlaceGet(url, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'cache not configured' }, 500);
  const q = url.searchParams.get('q') || '';
  const hint = url.searchParams.get('hint') || '';
  if (!q) return jsonResponse({ error: 'missing q' }, 400);
  const key = `place:${normalizeCacheKey(q)}|${normalizeCacheKey(hint)}`;
  const data = await env.SHARE_KV.get(key);
  if (!data) return jsonResponse({ error: 'miss' }, 404);
  return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

async function handlePlaceSave(request, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'cache not configured' }, 500);
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_CACHE_BYTES) return jsonResponse({ error: 'payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid json' }, 400); }
  const { q, hint, value } = body || {};
  if (!q || !value) return jsonResponse({ error: 'missing q/value' }, 400);
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_CACHE_BYTES) return jsonResponse({ error: 'value too large' }, 413);
  const key = `place:${normalizeCacheKey(q)}|${normalizeCacheKey(hint || '')}`;
  await env.SHARE_KV.put(key, serialized, { expirationTtl: CACHE_TTL_SECONDS });
  return jsonResponse({ ok: true });
}

async function handleRegionGet(url, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'cache not configured' }, 500);
  const q = url.searchParams.get('q') || '';
  if (!q) return jsonResponse({ error: 'missing q' }, 400);
  const key = `region:${normalizeCacheKey(q)}`;
  const data = await env.SHARE_KV.get(key);
  if (!data) return jsonResponse({ error: 'miss' }, 404);
  return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}

async function handleRegionSave(request, env) {
  if (!env.SHARE_KV) return jsonResponse({ error: 'cache not configured' }, 500);
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_CACHE_BYTES) return jsonResponse({ error: 'payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid json' }, 400); }
  const { q, value } = body || {};
  if (!q || !value) return jsonResponse({ error: 'missing q/value' }, 400);
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_CACHE_BYTES) return jsonResponse({ error: 'value too large' }, 413);
  const key = `region:${normalizeCacheKey(q)}`;
  await env.SHARE_KV.put(key, serialized, { expirationTtl: CACHE_TTL_SECONDS });
  return jsonResponse({ ok: true });
}

// --- Gemini proxy (기존) ---

async function handleGemini(request, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'API key not configured' }, 500);
  try {
    const body = await request.json();
    const model = body.model || 'gemini-2.5-flash-lite';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: body.contents }),
      }
    );
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// --- router ---

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const ip = getClientIp(request);

    // /share
    if (path === '/share' && method === 'POST') {
      const rl = await checkRateLimit(env, ip, 'share', 30);
      if (rl) return rl;
      return handleShareSave(request, env);
    }
    const shareGetMatch = path.match(/^\/share\/([A-Za-z0-9]+)$/);
    if (shareGetMatch && method === 'GET') {
      const rl = await checkRateLimit(env, ip, 'share-get', 120);
      if (rl) return rl;
      return handleShareGet(shareGetMatch[1], env);
    }

    // /backup
    if (path === '/backup' && method === 'POST') {
      const rl = await checkRateLimit(env, ip, 'backup', 5);
      if (rl) return rl;
      return handleBackupSave(request, env);
    }
    const backupGetMatch = path.match(/^\/backup\/([A-Za-z0-9-]+)$/);
    if (backupGetMatch && method === 'GET') {
      const rl = await checkRateLimit(env, ip, 'backup-get', 30);
      if (rl) return rl;
      return handleBackupGet(backupGetMatch[1], env);
    }

    // /place (cache)
    if (path === '/place' && method === 'GET') {
      const rl = await checkRateLimit(env, ip, 'place-get', 200);
      if (rl) return rl;
      return handlePlaceGet(url, env);
    }
    if (path === '/place' && method === 'POST') {
      const rl = await checkRateLimit(env, ip, 'place-put', 200);
      if (rl) return rl;
      return handlePlaceSave(request, env);
    }

    // /region (cache)
    if (path === '/region' && method === 'GET') {
      const rl = await checkRateLimit(env, ip, 'region-get', 200);
      if (rl) return rl;
      return handleRegionGet(url, env);
    }
    if (path === '/region' && method === 'POST') {
      const rl = await checkRateLimit(env, ip, 'region-put', 200);
      if (rl) return rl;
      return handleRegionSave(request, env);
    }

    // Legacy Gemini proxy — any other POST
    if (method === 'POST') {
      const rl = await checkRateLimit(env, ip, 'gemini', 30);
      if (rl) return rl;
      return handleGemini(request, env);
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  },
};
