import { json } from '../lib/auth.js';
export function POST() {
  return json({ ok: true }, 200, { 'Set-Cookie': 'atlas_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
}
