export const MAX_PROJECT_BYTES = 80 * 1024 * 1024;
export const projectPathPattern = /^atlas-do-reino\/projects\/[0-9a-f-]{36}\.json$/;

export function validateProject(project) {
  const fail = message => { throw new Error(message); };
  if(project?.format==='aether-atlas-world'){
    if(project.version!==1||!project.main||!Array.isArray(project.submaps)||project.submaps.length>16)fail('Pacote de mundo inválido.');
    const ids=new Set();for(const item of project.submaps){if(!item||typeof item.id!=='string'||item.id.length>64||ids.has(item.id)||typeof item.name!=='string'||item.name.length>120||!item.project)fail('Projeto de submapa inválido.');ids.add(item.id);if(item.project.world?.type!=='flat'||(item.project.world?.patches?.length??0)>0)fail('Um submapa precisa ser plano e independente.');validateProject(item.project);}
    if(project.main.format!=='aether-atlas')fail('Mapa principal do pacote inválido.');
    for(const p of project.main.world?.patches??[])if(p.projectId&&!ids.has(p.projectId))fail('O portal não corresponde a um submapa do pacote.');
    validateProject(project.main);return project;
  }
  if (!project || project.format !== 'aether-atlas' || ![1, 2, 3, 4].includes(project.version) ||
      project.width !== 1600 || project.height !== 1100 || !Array.isArray(project.layers) ||
      project.layers.length < 1 || project.layers.length > 16) fail('Use o JSON gerado por Salvar projeto no Aether Atlas.');
  const inRange = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
  const point = p => p && inRange(p.x, 0, 1599.9999) && inRange(p.y, 0, 1099.9999);
  const png = v => typeof v === 'string' && v.startsWith('data:image/png;base64,');
  if (project.world !== undefined && !['planet','flat'].includes(project.world?.type)) fail('Tipo de mundo inválido.');
  if(project.world?.patches!==undefined){
    if(project.world.width!==8000||project.world.height!==4400||!Array.isArray(project.world.patches)||project.world.patches.length>16)fail('Mundo esférico inválido.');
    for(const p of project.world.patches){if(!p||typeof p.name!=='string'||p.name.length>120||typeof p.image!=='string'||!p.image.startsWith('data:image/png;base64,')||![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.width<100||p.height<100||p.x<0||p.y<0||p.x+p.width>8000||p.y+p.height>4400||(p.kind!==undefined&&!['image','submap'].includes(p.kind))||(p.locked!==undefined&&typeof p.locked!=='boolean')||(p.kind==='submap'&&(!p.entry||!inRange(p.entry.x,0,8000)||!inRange(p.entry.y,0,4400)))||(p.projectId!==undefined&&(p.kind!=='submap'||typeof p.projectId!=='string'||p.projectId.length>64)))fail('Mapa encaixado inválido.');if(p.project!==undefined){if(p.kind!=='submap'||!p.project||p.project.world?.type!=='flat'||(p.project.world?.patches?.length??0)>0)fail('O projeto de um submapa deve ser plano e não pode conter outro globo.');validateProject(p.project);}}
  }
  if(project.world?.playerLocation!==undefined){const p=project.world.playerLocation;
    if(!p||!inRange(p.x,0,8000)||!inRange(p.y,0,4400))fail('LOCAL ATUAL inválido.');}
  if (project.theme !== undefined) for (const [key,value] of Object.entries(project.theme))
    if (['grass','trees','water','lava','sand','rock','snow','forest','palms','pines','magic','autumn','jungle','snowForest','trunk'].includes(key) && !/^#[0-9a-f]{6}$/i.test(value)) fail('Paleta de cores inválida.');
  for (const layer of project.layers) {
    if (!layer || typeof layer.name !== 'string' || typeof layer.visible !== 'boolean' ||
        typeof layer.locked !== 'boolean' || !inRange(layer.opacity, 0, 1) || !png(layer.image) ||
        (layer.overlay && !png(layer.overlay)) || (layer.planet !== undefined && typeof layer.planet.enabled !== 'boolean')) fail('Camada ou pintura inválida.');
    if (project.version >= 2) {
      const t = layer.terrain;
      if (!t || !['heights', 'coverage', 'biomes'].every(k => Array.isArray(t[k]) && t[k].length === 110000)) fail('Dados de relevo inválidos.');
      for (let i = 0; i < 110000; i++) if (!inRange(t.heights[i], -500, 3000) ||
        !Number.isInteger(t.coverage[i]) || !inRange(t.coverage[i], 0, 255) ||
        !Number.isInteger(t.biomes[i]) || !inRange(t.biomes[i], 0, 13)) fail('Altitude ou bioma inválido.');
      if(t.treeStyles!==undefined||t.treeStyleIds!==undefined){
        if(!Array.isArray(t.treeStyles)||t.treeStyles.length>65535||t.treeStyles.some(s=>!s||!['foliage','trunk','ground'].every(k=>/^#[0-9a-f]{6}$/i.test(s[k])))||!Array.isArray(t.treeStyleIds)||t.treeStyleIds.length!==110000||t.treeStyleIds.some(id=>!Number.isInteger(id)||!inRange(id,0,t.treeStyles.length)))fail('Cores de vegetação inválidas.');
      }
      if(t.treeExclusions!==undefined&&(!Array.isArray(t.treeExclusions)||t.treeExclusions.length>110000||t.treeExclusions.some(i=>!Number.isInteger(i)||!inRange(i,0,109999))))fail('Árvores removidas inválidas.');
    }
    if(layer.tiles!==undefined){
      if(!Array.isArray(layer.tiles)||layer.tiles.length>24)fail('Regiões do planeta inválidas.');const used=new Set();
      const decode=(value,Type)=>{if(typeof value!=='string'||value.length>110000*Type.BYTES_PER_ELEMENT*1.34+8||! /^[A-Za-z0-9+/]*={0,2}$/.test(value))fail('Relevo de região inválido.');let raw;try{raw=atob(value);}catch{fail('Relevo de região inválido.');}if(raw.length!==110000*Type.BYTES_PER_ELEMENT)fail('Relevo de região inválido.');return Array.from(new Type(Uint8Array.from(raw,c=>c.charCodeAt(0)).buffer));};
      for(const tile of layer.tiles){
        if(!tile||!Number.isInteger(tile.gx)||!Number.isInteger(tile.gy)||Math.abs(tile.gx)>2||Math.abs(tile.gy)>2||(!tile.gx&&!tile.gy)||used.has(tile.gx+','+tile.gy)||tile.terrain?.encoding!=='atlas-terrain-v1')fail('Região do planeta inválida.');used.add(tile.gx+','+tile.gy);
        const t=tile.terrain,terrain={...t,heights:decode(t.heights,Float32Array),coverage:decode(t.coverage,Uint8Array),biomes:decode(t.biomes,Uint8Array),treeStyleIds:decode(t.treeStyleIds,Uint16Array)};
        validateProject({format:'aether-atlas',version:4,width:1600,height:1100,world:{type:'flat'},layers:[{...tile,tiles:undefined,name:layer.name,visible:layer.visible,locked:layer.locked,opacity:layer.opacity,planet:{enabled:false},terrain}]});
      }
    }
    const objects = layer.objects ?? [], routes = layer.routes ?? [], tunnels = layer.tunnels ?? [], structures = layer.structures ?? [];
    if (!Array.isArray(structures) || structures.length > 3000 || !Array.isArray(objects) || objects.length > 2000 || !Array.isArray(routes) || routes.length > 2000 ||
        !Array.isArray(tunnels) || tunnels.length > 1000) fail('Objetos do mapa inválidos.');
    const buildings = ['house','village','tower','castle','temple','bridge','camp','ruin','windmill','tunnel','cave'];
    for (const o of objects) if (!o || !['building','marker','text','tree'].includes(o.kind) || !point(o) ||
      !inRange(o.size,8,160) || !inRange(o.rotation,-360,360) || typeof o.text !== 'string' || o.text.length > 240 ||
      !/^#[0-9a-f]{6}$/i.test(o.color) || (o.kind === 'building' && !buildings.includes(o.building)) ||
      (o.kind === 'tree' && (!['forest','palms','pines','magic','autumn','jungle','snowForest'].includes(o.species) || !/^#[0-9a-f]{6}$/i.test(o.trunkColor) || !inRange(o.seed,0,1))) ||
      (o.kind === 'marker' && !['◇','♜','▲','✦','♣'].includes(o.symbol))) fail('Marcador inválido.');
    let count = 0;
    for (const r of routes) if (!r || !['river','path'].includes(r.kind) || !inRange(r.width,1,180) ||
      !Array.isArray(r.points) || r.points.length < 2 || (count += r.points.length) > 100000 || !r.points.every(point)) fail('Trajeto inválido.');
    for (const t of tunnels) if (!t || !point(t.a) || !point(t.b) || !inRange(t.width,1,200) || !inRange(t.depth,5,500) ||
      (t.hollow !== undefined && typeof t.hollow !== 'boolean') || (t.route !== undefined && (!Array.isArray(t.route) || t.route.length < 2 || t.route.length > 1000 || !t.route.every(p => point(p) && inRange(p.z,-500,0))))) fail('Túnel inválido.');
    let structurePoints=0;
    for(const item of structures)if(!item||(item.groupId!==undefined&&(typeof item.groupId!=='string'||item.groupId.length>100))||(item.planDynamic!==undefined&&typeof item.planDynamic!=='boolean')||(item.foundationPoints!==undefined&&(!Array.isArray(item.foundationPoints)||item.foundationPoints.length<3||item.foundationPoints.length>128||!item.foundationPoints.every(point)))||(item.base!==undefined&&!inRange(item.base,0,100))||(item.material!==undefined&&!['stone','tile','wood','glass','metal'].includes(item.material))||(item.kind!==undefined&&!['wall','room','corridor','floor','rect','rectFill','ellipse','ellipseFill','line','door','window','stairs','pillar','pit'].includes(item.kind))||!Array.isArray(item.points)||item.points.length<2||item.points.length>128||(structurePoints+=item.points.length)>100000||!item.points.every(point)||!inRange(item.width,1,180)||!inRange(item.height,-100,100)||typeof item.fill!=='boolean'||!/^#[0-9a-f]{6,8}$/i.test(item.color))fail('Construção 3D inválida.');
  }
  return project;
}
