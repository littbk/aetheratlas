import { get, put } from '@vercel/blob';

const pathname = 'atlas-do-reino/current.json';
export const storageOptions = () => ({ access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });

export async function currentMap() {
  const result = await get(pathname, { ...storageOptions(), useCache: false });
  if (!result) return null;
  const map = await new Response(result.stream).json();
  return map.projectPath ? map : null;
}

export async function saveMap(map) {
  await put(pathname, JSON.stringify(map), {
    ...storageOptions(), addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60
  });
}

export function publicMap(map) {
  if (!map) return null;
  return { title: map.title, note: map.note, updatedAt: map.updatedAt, projectUrl: '/api/project' };
}
