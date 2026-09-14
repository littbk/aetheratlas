import { json } from './_auth.js';
export default function handler() {
  return json({ ok: true }, 200, { 'Set-Cookie': 'atlas_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
}
