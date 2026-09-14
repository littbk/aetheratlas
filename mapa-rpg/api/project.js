import { get } from '@vercel/blob';
import { currentMap, storageOptions } from '../lib/storage.js';
import { json } from '../lib/auth.js';

export async function GET() {
  try {
    const map = await currentMap();
    if (!map?.projectPath) return json({ error: 'Nenhum projeto anexado.' }, 404);
    const file = await get(map.projectPath, storageOptions());
    if (!file) return json({ error: 'Projeto não encontrado.' }, 404);
    return new Response(file.stream, { headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch { return json({ error: 'Projeto temporariamente indisponível.' }, 503); }
}
