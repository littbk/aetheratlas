 'use strict';
// Sparse, full-resolution regions preserve the original map at its existing world position.
const WorldSurface=(()=>{
  const W=1600,H=1100,X=3200,Y=1650;let empty;
  const blank=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
  const locate=(x,y)=>({gx:Math.max(-2,Math.min(2,Math.floor(x/W))),gy:Math.max(-2,Math.min(2,Math.floor(y/H)))});
  const key=(gx,gy)=>gx+','+gy;
  function child(parent,gx,gy,create=false){
    if(!gx&&!gy)return parent;
    let tile=(parent.tiles||[]).find(t=>t.gx===gx&&t.gy===gy);
    if(!tile&&create){tile={gx,gy,c:blank(),ink:null,terrain:Terrain.create(),objects:[],routes:[],tunnels:[],structures:[]};(parent.tiles||(parent.tiles=[])).push(tile);}
    return tile;
  }
  function group(layers,gx,gy,create=-1){
    if(!empty)empty={c:blank(),ink:null,terrain:Terrain.create(),objects:[],routes:[],tunnels:[],structures:[]};
    return layers.map((parent,i)=>{const tile=child(parent,gx,gy,i===create)||empty;return {...tile,visible:parent.visible,locked:parent.locked,opacity:parent.opacity,planet:{enabled:false},source:tile,parent};});
  }
  function groups(layers){
    const keys=new Map();keys.set('0,0',{gx:0,gy:0});for(const l of layers)for(const t of l.tiles||[])keys.set(key(t.gx,t.gy),t);
    return [...keys.values()].map(({gx,gy})=>({gx,gy,x:X+gx*W,y:Y+gy*H,layers:group(layers,gx,gy)}));
  }
  function affected(x,y,radius,stretch=1){
    const out=[],centers=[{x,y}];if(y+Y-radius<0)centers.push({x:x+4000,y:-y-2*Y});if(y+Y+radius>4400)centers.push({x:x+4000,y:8800-y-2*Y});
    for(const center of centers)for(const shift of [-8000,0,8000])for(let gy=-2;gy<=2;gy++)for(let gx=-2;gx<=2;gx++){
      const cx=((center.x+X)%8000+8000)%8000-X+shift-gx*W,cy=center.y-gy*H;
      if(cx+radius*stretch>=0&&cx-radius*stretch<W&&cy+radius>=0&&cy-radius<H)out.push({gx,gy,x:cx,y:cy});
    }
    return out;
  }
  function sample(layers,x,y){const {gx,gy}=locate(x,y);return Terrain.sample(group(layers,gx,gy),x-gx*W,y-gy*H);}
  function clip(poly,gx,gy){
    let points=poly.map(p=>({x:p.x-gx*W,y:p.y-gy*H}));
    for(const [axis,bound,sign] of [['x',0,1],['x',W-.001,-1],['y',0,1],['y',H-.001,-1]]){
      const input=points;points=[];if(!input.length)break;
      const inside=p=>(p[axis]-bound)*sign>=0;
      for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],ia=inside(a),ib=inside(b);if(ia)points.push(a);if(ia!==ib){const t=(bound-a[axis])/(b[axis]-a[axis]);points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}
    }
    return points;
  }
  function geometry(items,gx,gy){
    const result=[];
    for(const part of items){
      if(part.points.every(p=>p.x>=gx*W&&p.x<(gx+1)*W&&p.y>=gy*H&&p.y<(gy+1)*H)){const translate=p=>({x:p.x-gx*W,y:p.y-gy*H});result.push({...part,points:part.points.map(translate),...(part.foundationPoints?{foundationPoints:part.foundationPoints.map(translate)}:{})});continue;}
      if(part.fill){const points=clip(part.points,gx,gy);if(points.length>=3){const p={...part,points};delete p.foundationPoints;result.push(p);}}
      else for(let i=0;i<(part.close?part.points.length:part.points.length-1);i++){
        const a=part.points[i],b=part.points[(i+1)%part.points.length];let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
        for(const [p,q] of [[-dx,a.x-gx*W],[dx,(gx+1)*W-.001-a.x],[-dy,a.y-gy*H],[dy,(gy+1)*H-.001-a.y]]){if(!p){if(q<0){high=-1;break;}}else if(p<0)low=Math.max(low,q/p);else high=Math.min(high,q/p);}
        if(low<=high&&high>=0&&low<=1){const points=[low,high].map(t=>({x:a.x+dx*t-gx*W,y:a.y+dy*t-gy*H}));if(Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)>.001){const p={...part,points,close:false};delete p.foundationPoints;result.push(p);}}
      }
    }
    return result;
  }
  function encode(array){let out='';const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
  function decode(value,Type,length){if(typeof value!=='string'||value.length>length*Type.BYTES_PER_ELEMENT*1.34+8||! /^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Região de terreno inválida.');const data=atob(value);if(data.length!==length*Type.BYTES_PER_ELEMENT)throw Error('Região de terreno inválida.');const bytes=Uint8Array.from(data,c=>c.charCodeAt(0));return Array.from(new Type(bytes.buffer));}
  function terrainData(t){Terrain.freezeLayers([{terrain:t}]);return{waterLevels:{...(t.waterLevels||{})},waterColors:{...(t.waterColors||{})},encoding:'atlas-terrain-v1',heights:encode(t.heights),coverage:encode(t.coverage),biomes:encode(t.biomes),treeStyleIds:encode(t.treeStyleIds),treeStyles:t.treeStyles,treeExclusions:[...t.treeExclusions]};}
  function terrainRestore(t){if(t?.encoding!=='atlas-terrain-v1')throw Error('Região de terreno inválida.');return Terrain.validate({...t,heights:decode(t.heights,Float32Array,Terrain.length),coverage:decode(t.coverage,Uint8Array,Terrain.length),biomes:decode(t.biomes,Uint8Array,Terrain.length),treeStyleIds:decode(t.treeStyleIds,Uint16Array,Terrain.length)});}
  function serialize(tiles=[]){return tiles.map(t=>({gx:t.gx,gy:t.gy,image:t.c.toDataURL(),overlay:t.ink?.toDataURL()||null,terrain:terrainData(t.terrain),objects:t.objects,routes:t.routes,tunnels:t.tunnels,structures:t.structures}));}
  async function restore(items=[]){
    if(!Array.isArray(items)||items.length>24)throw Error('Regiões do planeta inválidas.');const used=new Set();
    return Promise.all(items.map(async t=>{
      if(!t||!Number.isInteger(t.gx)||!Number.isInteger(t.gy)||Math.abs(t.gx)>2||Math.abs(t.gy)>2||(!t.gx&&!t.gy)||used.has(key(t.gx,t.gy)))throw Error('Região do planeta inválida.');used.add(key(t.gx,t.gy));
      if(!Array.isArray(t.tunnels||[])||(t.tunnels||[]).length>1000||(t.tunnels||[]).some(v=>!v||![v.a,v.b].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<W&&p.y>=0&&p.y<H)||!Number.isFinite(v.width)||v.width<1||v.width>200||!Number.isFinite(v.depth)||v.depth<5||v.depth>500))throw Error('Túnel de região inválido.');
      const image=async data=>{if(typeof data!=='string'||!data.startsWith('data:image/png;base64,'))throw Error('Imagem de região inválida.');const im=new Image();im.src=data;await im.decode();if(im.width!==W||im.height!==H)throw Error('Dimensão de região inválida.');const c=blank();c.getContext('2d').drawImage(im,0,0);return c;};
      return{gx:t.gx,gy:t.gy,c:await image(t.image),ink:t.overlay?await image(t.overlay):null,terrain:terrainRestore(t.terrain),objects:Billboards.validate(t.objects||[]),routes:MapPaths.validate(t.routes||[]),tunnels:t.tunnels||[],structures:Structures.validate(t.structures||[])};
    }));
  }
  const snapshot=(tiles=[])=>tiles.map(t=>({...t,terrain:Terrain.copy(t.terrain),objects:structuredClone(t.objects),routes:structuredClone(t.routes),tunnels:structuredClone(t.tunnels),structures:structuredClone(t.structures),data:t.c.getContext('2d').getImageData(0,0,W,H),inkData:t.ink?.getContext('2d').getImageData(0,0,W,H)||null,c:null,ink:null}));
  const recover=tiles=>(tiles||[]).map(t=>{const c=blank();c.getContext('2d').putImageData(t.data,0,0);const ink=t.inkData?blank():null;if(ink)ink.getContext('2d').putImageData(t.inkData,0,0);return{...t,c,ink,terrain:Terrain.restore(t.terrain),objects:structuredClone(t.objects),routes:structuredClone(t.routes),tunnels:structuredClone(t.tunnels),structures:structuredClone(t.structures)};});
  return{locate,key,child,group,groups,affected,sample,geometry,serialize,restore,snapshot,recover};
})();
