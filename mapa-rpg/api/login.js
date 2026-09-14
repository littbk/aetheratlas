import { json, newSession } from './_auth.js';
import { timingSafeEqual } from 'node:crypto';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) return json({ error: 'Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET na Vercel.' }, 503);
  const { password } = await request.json().catch(() => ({}));
  const expected = Buffer.from(process.env.ADMIN_PASSWORD);
  const received = Buffer.from(String(password || ''));
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return json({ error: 'Senha incorreta.' }, 401);
  return json({ ok: true }, 200, { 'Set-Cookie': `atlas_admin=${newSession()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
}
