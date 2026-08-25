const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_URL = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name';
const VIDEO_URL = 'https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/virallens/oauth/start' && request.method === 'GET') return startOAuth(env);
    if (url.pathname === '/api/virallens/oauth/callback' && request.method === 'GET') return finishOAuth(request, env);
    if (url.pathname === '/api/virallens/session' && request.method === 'GET') return getSession(request, env);
    if (url.pathname === '/api/virallens/disconnect' && request.method === 'POST') return disconnect();
    return json({ error: 'Not found' }, 404);
  }
};

function requireConfig(env) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.SESSION_SECRET) throw new Error('ViralLens API is not configured');
}

function randomToken(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(data);
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${value}`, 'Path=/api/virallens', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const index = v.indexOf('=');
    return [v.slice(0, index), v.slice(index + 1)];
  }));
}

async function aesKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), encoder.encode(JSON.stringify(value)));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv); combined.set(new Uint8Array(ciphertext), iv.length);
  return base64url(combined);
}

async function unseal(value, secret) {
  try {
    const combined = fromBase64url(value);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, await aesKey(secret), combined.slice(12));
    return JSON.parse(decoder.decode(plaintext));
  } catch { return null; }
}

async function startOAuth(env) {
  try { requireConfig(env); } catch (error) { return json({ error: error.message }, 503); }
  const state = randomToken();
  const target = new URL(AUTHORIZE_URL);
  target.search = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, scope: env.TIKTOK_SCOPES, response_type: 'code', redirect_uri: env.TIKTOK_REDIRECT_URI, state, disable_auto_auth: '1' });
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Set-Cookie': cookie('vl_state', state, { maxAge: 600 }) } });
}

async function finishOAuth(request, env) {
  try { requireConfig(env); } catch (error) { return redirectError(error.message); }
  const url = new URL(request.url);
  const returnedState = url.searchParams.get('state');
  const storedState = parseCookies(request).vl_state;
  if (!returnedState || !storedState || !timingSafeEqual(returnedState, storedState)) return redirectError('State validation failed');
  if (url.searchParams.get('error')) return redirectError(url.searchParams.get('error_description') || url.searchParams.get('error'));
  const code = url.searchParams.get('code');
  if (!code) return redirectError('Authorization code missing');
  const tokenResponse = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: env.TIKTOK_REDIRECT_URI }) });
  const tokenPayload = await tokenResponse.json();
  const token = tokenPayload.data || tokenPayload;
  if (!tokenResponse.ok || !token.access_token) return redirectError(token.error_description || token.message || 'Token exchange failed');
  const session = await seal({ accessToken: token.access_token, refreshToken: token.refresh_token, openId: token.open_id, expiresAt: Date.now() + Number(token.expires_in || 86400) * 1000 }, env.SESSION_SECRET);
  const headers = new Headers({ Location: 'https://echov4ult.com/virallens/?connected=1', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie('vl_session', session, { maxAge: Math.min(Number(token.expires_in || 86400), 86400) }));
  headers.append('Set-Cookie', cookie('vl_state', '', { maxAge: 0 }));
  return new Response(null, { status: 302, headers });
}

async function getSession(request, env) {
  try { requireConfig(env); } catch (error) { return json({ error: error.message }, 503); }
  const sealed = parseCookies(request).vl_session;
  const session = sealed ? await unseal(sealed, env.SESSION_SECRET) : null;
  if (!session?.accessToken || session.expiresAt <= Date.now()) return json({ error: 'Not connected' }, 401);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const [userResponse, videoResponse] = await Promise.all([
    fetch(USER_URL, { headers }),
    fetch(VIDEO_URL, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20 }) })
  ]);
  const [userPayload, videoPayload] = await Promise.all([userResponse.json(), videoResponse.json()]);
  if (!userResponse.ok || !videoResponse.ok || userPayload.error?.code || videoPayload.error?.code) return json({ error: 'TikTok returned an API error. Reconnect and try again.' }, 502);
  return json({ user: userPayload.data?.user || {}, videos: videoPayload.data?.videos || [], observed_at: new Date().toISOString(), source: 'TikTok Display API' });
}

function disconnect() {
  return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie('vl_session', '', { maxAge: 0 }), 'Cache-Control': 'no-store' } });
}

function redirectError(message) {
  const target = new URL('https://echov4ult.com/virallens/');
  target.searchParams.set('error', String(message).slice(0, 160));
  return Response.redirect(target.toString(), 302);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
