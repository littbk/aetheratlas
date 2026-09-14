import { get } from '@vercel/blob';
import { adminOnly, json } from '../lib/auth.js';
import { currentMap, publicMap, saveMap, storageOptions } from '../lib/storage.js';
import { validateProject, MAX_PROJECT_BYTES, projectPathPattern } from '../schema.js';

export async function GET() {
  try { return json({ map: publicMap(await currentMap()) }); }
  catch { return json({ error: 'Não foi possível carregar o mapa. Tente novamente.' }, 503); }
}

export async function DELETE(request) {
  const denied = adminOnly(request);
  if (denied) return denied;
  try { await saveMap({}); return json({ ok: true }); }
  catch { return json({ error: 'Não foi possível remover a publicação.' }, 503); }
}

export async function POST(request) {
  const denied = adminOnly(request);
  if (denied) return denied;
  const data = await request.json().catch(() => null);
  if (!data || !projectPathPattern.test(data.projectPath)) return json({ error: 'Projeto inválido.' }, 400);
  try {
    const file = await get(data.projectPath, { ...storageOptions(), useCache: false });
    if (!file || file.blob.size > MAX_PROJECT_BYTES) return json({ error: 'Projeto ausente ou maior que 80 MB.' }, 400);
    let project;
    try { project = validateProject(await new Response(file.stream).json()); }
    catch (error) { return json({ error: error.message || 'JSON inválido.' }, 400); }
    const map = { projectPath: data.projectPath, title: String(data.title || project.title || 'Mapa do Reino').trim().slice(0,90),
      note: String(data.note || '').trim().slice(0,240), updatedAt: new Date().toISOString() };
    await saveMap(map);
    return json({ ok: true, map: publicMap(map) });
  } catch { return json({ error: 'Não foi possível publicar o mapa. Tente novamente.' }, 503); }
}
