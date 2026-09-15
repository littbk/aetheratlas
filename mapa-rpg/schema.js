export const MAX_PROJECT_BYTES = 80 * 1024 * 1024;
export const projectPathPattern = /^atlas-do-reino\/projects\/[0-9a-f-]{36}\.json$/;

export function validateProject(project) {
  const fail = message => { throw new Error(message); };
  if (!project || project.format !== 'aether-atlas' || ![1, 2, 3, 4].includes(project.version) ||
      project.width !== 1600 || project.height !== 1100 || !Array.isArray(project.layers) ||
      project.layers.length < 1 || project.layers.length > 16) fail('Use o JSON gerado por Salvar projeto no Aether Atlas.');
  const inRange = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
  const point = p => p && inRange(p.x, 0, 1599.9999) && inRange(p.y, 0, 1099.9999);
  const png = v => typeof v === 'string' && v.startsWith('data:image/png;base64,');
  for (const layer of project.layers) {
    if (!layer || typeof layer.name !== 'string' || typeof layer.visible !== 'boolean' ||
        typeof layer.locked !== 'boolean' || !inRange(layer.opacity, 0, 1) || !png(layer.image) ||
        (layer.overlay && !png(layer.overlay))) fail('Camada ou pintura inválida.');
    if (project.version >= 2) {
      const t = layer.terrain;
      if (!t || !['heights', 'coverage', 'biomes'].every(k => Array.isArray(t[k]) && t[k].length === 110000)) fail('Dados de relevo inválidos.');
      for (let i = 0; i < 110000; i++) if (!inRange(t.heights[i], -500, 3000) ||
        !Number.isInteger(t.coverage[i]) || !inRange(t.coverage[i], 0, 255) ||
        !Number.isInteger(t.biomes[i]) || !inRange(t.biomes[i], 0, 7)) fail('Altitude ou bioma inválido.');
    }
    const objects = layer.objects ?? [], routes = layer.routes ?? [], tunnels = layer.tunnels ?? [];
    if (!Array.isArray(objects) || objects.length > 2000 || !Array.isArray(routes) || routes.length > 2000 ||
        !Array.isArray(tunnels) || tunnels.length > 1000) fail('Objetos do mapa inválidos.');
    const buildings = ['house','village','tower','castle','temple','bridge','camp','ruin','windmill','tunnel','cave'];
    for (const o of objects) if (!o || !['building','marker','text'].includes(o.kind) || !point(o) ||
      !inRange(o.size,8,160) || !inRange(o.rotation,-360,360) || typeof o.text !== 'string' || o.text.length > 240 ||
      !/^#[0-9a-f]{6}$/i.test(o.color) || (o.kind === 'building' && !buildings.includes(o.building)) ||
      (o.kind === 'marker' && !['◇','♜','▲','✦','♣'].includes(o.symbol))) fail('Marcador inválido.');
    let count = 0;
    for (const r of routes) if (!r || !['river','path'].includes(r.kind) || !inRange(r.width,1,180) ||
      !Array.isArray(r.points) || r.points.length < 2 || (count += r.points.length) > 100000 || !r.points.every(point)) fail('Trajeto inválido.');
    for (const t of tunnels) if (!t || !point(t.a) || !point(t.b) || !inRange(t.width,1,200) || !inRange(t.depth,5,500)) fail('Túnel inválido.');
  }
  return project;
}
