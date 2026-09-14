import { get, put } from '@vercel/blob';
import { adminOnly, json } from './_auth.js';

const metadataPath = 'atlas-do-reino/current.json';
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

async function current() {
  try {
    const result = await get(metadataPath, { access: 'public' });
    if (!result) return null;
    const map = await result.json();
    return map.imageUrl ? map : null;
  } catch { return null; }
}

export default async function handler(request) {
  if (request.method === 'GET') return json({ map: await current() }, 200, { 'Cache-Control': 'no-store' });
  const denied = adminOnly(request);
  if (denied) return denied;
  if (request.method === 'DELETE') {
    await put(metadataPath, JSON.stringify({}), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    return json({ ok: true });
  }
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const form = await request.formData();
  const image = form.get('image');
  const title = String(form.get('title') || 'Mapa do Reino').trim().slice(0, 90);
  const note = String(form.get('note') || '').trim().slice(0, 240);
  if (!(image instanceof File) || !image.size) return json({ error: 'Escolha uma imagem do mapa.' }, 400);
  if (!imageTypes.has(image.type) || image.size > 4 * 1024 * 1024) return json({ error: 'Use PNG, JPG ou WebP de até 4 MB.' }, 400);
  const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const imageBlob = await put(`atlas-do-reino/mapas/${crypto.randomUUID()}.${extension}`, image, { access: 'public', contentType: image.type });
  const project = form.get('project');
  let projectUrl = '';
  if (project instanceof File && project.size && project.size <= 4 * 1024 * 1024 && (project.type === 'application/json' || project.name.endsWith('.json'))) {
    const saved = await put(`atlas-do-reino/projetos/${crypto.randomUUID()}.json`, project, { access: 'private', contentType: 'application/json' });
    projectUrl = saved.url;
  }
  const map = { title, note, imageUrl: imageBlob.url, projectUrl, updatedAt: new Date().toISOString() };
  await put(metadataPath, JSON.stringify(map), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  return json({ ok: true, map });
}
