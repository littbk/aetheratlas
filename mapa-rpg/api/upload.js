import { handleUpload } from '@vercel/blob/client';
import { adminOnly, json } from '../lib/auth.js';
import { MAX_PROJECT_BYTES, projectPathPattern } from '../schema.js';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Solicitação inválida.' }, 400);
  if (body.type === 'blob.generate-client-token') {
    const denied = adminOnly(request);
    if (denied) return denied;
  }
  try {
    return json(await handleUpload({ body, request, token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async pathname => {
        if (adminOnly(request) || !projectPathPattern.test(pathname)) throw new Error('Envio não autorizado.');
        return { allowedContentTypes: ['application/json'], maximumSizeInBytes: MAX_PROJECT_BYTES,
          addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
      },
      onUploadCompleted: async () => {} // Publicação só ocorre após validar o JSON em /api/map.
    }));
  } catch { return json({ error: 'Não foi possível autorizar o envio do projeto.' }, 400); }
}
