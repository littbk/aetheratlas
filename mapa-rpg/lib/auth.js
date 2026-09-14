import { createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const decode = (value) => Buffer.from(value, 'base64url').toString('utf8');
const sign = (value) => createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(value).digest('base64url');

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

export function cookie(request, name) {
  const entry = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  try { return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''; } catch { return ''; }
}

export function sessionValid(request) {
  const token = cookie(request, 'atlas_admin');
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !process.env.ADMIN_SESSION_SECRET) return false;
  const expected = sign(payload);
  const a = encoder.encode(signature), b = encoder.encode(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(decode(payload)).expires > Date.now(); } catch { return false; }
}

export function newSession() {
  const payload = Buffer.from(JSON.stringify({ expires: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function adminOnly(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origem não permitida.' }, 403);
  return sessionValid(request) ? null : json({ error: 'Sessão de administrador necessária.' }, 401);
}
