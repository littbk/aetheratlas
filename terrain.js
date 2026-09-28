'use strict';
// A four-pixel heightfield keeps editing and project files compact.
const Terrain = (() => {
  const step = 4, width = 400, height = 275, length = width * height;
  const biomes = ['auto', 'grass', 'forest', 'sand', 'rock', 'snow', 'water', 'lava', 'palms', 'pines', 'magic', 'autumn', 'jungle', 'snowForest'];
  const defaults = [120,120,240,25,1000,2000,-80,35,25,240,180,180,120,240];
  const defaultTheme={grass:'#87a56b',trees:'#336349',water:'#347787',lava:'#d84a1c',sand:'#d3c18e',rock:'#8c978b',snow:'#e0ebe6',forest:'#2c5944',palms:'#68ad63',pines:'#296d63',magic:'#b47fe5',autumn:'#e29848',jungle:'#278958',snowForest:'#376458',trunk:'#70503b'};
  let theme={...defaultTheme},themeRevision=0,autoStops=null;
  const hexRgb=value=>{const m=/^#([0-9a-f]{6})$/i.exec(value||'');return m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)]:null;};
  const mix=(rgb,amount)=>rgb.map(v=>Math.max(0,Math.min(255,Math.round(v+amount))));
  function setTheme(next={}){theme={...defaultTheme};for(const key of Object.keys(defaultTheme))if(hexRgb(next[key]))theme[key]=next[key];themeRevision++;autoStops=null;}
  function getTheme(){return {...theme};}
  function palette(){const grass=hexRgb(theme.grass),trees=hexRgb(theme.trees),water=hexRgb(theme.water),lava=hexRgb(theme.lava);return [[135,165,107],grass,hexRgb(theme.forest)||trees,hexRgb(theme.sand),hexRgb(theme.rock),hexRgb(theme.snow),water,lava,...['palms','pines','magic','autumn','jungle','snowForest'].map(key=>key==='snowForest'?hexRgb(theme.snow):key==='palms'?hexRgb(theme.sand):hexRgb(theme[key]).map(v=>v*.62))];}
  const noise = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
  function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return (noise(ix,iy)*(1-u)+noise(ix+1,iy)*u)*(1-v)+(noise(ix,iy+1)*(1-u)+noise(ix+1,iy+1)*u)*v;}
  const grain=new Float32Array(length),detail=new Float32Array(length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=y*width+x;grain[k]=smoothNoise(x*.07,y*.07)*.55+smoothNoise(x*.19,y*.19)*.3+smoothNoise(x*.51,y*.51)*.15;detail[k]=noise(x,y);}
  function create() {
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const surface=document.createElement('canvas');surface.width=1600;surface.height=1100;
    return {heights:new Float32Array(length), coverage:new Uint8Array(length), biomes:new Uint8Array(length),waterLevels:{},waterColors:{},fog:new Uint8Array(length), treeStyleIds:new Uint16Array(length),treeStyles:[],treeExclusions:new Set(),canvas, surface, dirty:true, view:''};
  }
  function copy(t) { freezeTreeColors(t);return {fog:t.fog.slice(),waterLevels:{...(t.waterLevels||{})},waterColors:{...(t.waterColors||{})},heights:t.heights.slice(),coverage:t.coverage.slice(),biomes:t.biomes.slice(),treeStyleIds:t.treeStyleIds.slice(),treeStyles:t.treeStyles.map(s=>({...s})),treeExclusions:[...t.treeExclusions]}; }
  function restore(data) { const t=create(); if(data){if(data.fog)t.fog.set(data.fog);t.waterLevels={...(data.waterLevels||{})};t.waterColors={...(data.waterColors||{})};t.heights.set(data.heights);t.coverage.set(data.coverage);t.biomes.set(data.biomes);if(data.treeStyleIds)t.treeStyleIds.set(data.treeStyleIds);t.treeStyles=(data.treeStyles||[]).map(s=>({...s}));t.treeExclusions=new Set(data.treeExclusions||[]);}return t; }
  function serialize(t) {freezeTreeColors(t);return {...(t.fog.some(v=>v)?{fog:Array.from(t.fog)}:{}),waterLevels:{...(t.waterLevels||{})},waterColors:{...(t.waterColors||{})},heights:Array.from(t.heights,v=>Math.round(v*10)/10),coverage:Array.from(t.coverage),biomes:Array.from(t.biomes),treeStyleIds:Array.from(t.treeStyleIds),treeStyles:t.treeStyles.map(s=>({...s})),treeExclusions:[...t.treeExclusions]};}
  function styleId(t,type){
    const key=type===2?'trees':biomes[type],rgb=type===2?hexRgb(theme.forest):type===13?hexRgb(theme.snow):type===8?hexRgb(theme.sand):hexRgb(theme[key]).map(v=>Math.round(v*.62));
    const style={foliage:theme[key],trunk:theme.trunk,ground:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')};
    let id=t.treeStyles.findIndex(s=>s.foliage===style.foliage&&s.trunk===style.trunk&&s.ground===style.ground);
    if(id<0){if(t.treeStyles.length>=65535)throw Error('Limite de cores de vegetação atingido nesta camada.');id=t.treeStyles.push(style)-1;}return id+1;
  }
  function freezeTreeColors(t){
    const ids={};for(let i=0;i<length;i++){const type=t.biomes[i];if(t.coverage[i]&&(type===2||type>=8)&&!t.treeStyleIds[i]){t.treeStyleIds[i]=ids[type]||(ids[type]=styleId(t,type));t.dirty=true;}}
  }
  function freezeLayers(layers){for(const l of layers){freezeTreeColors(l.terrain);for(const t of l.tiles||[])freezeTreeColors(t.terrain);}}
  function validate(data) {
    if(!data || !['heights','coverage','biomes'].every(k=>Array.isArray(data[k])&&data[k].length===length)) throw Error('Dados de relevo inválidos.');
    for(let i=0;i<length;i++) if(!Number.isFinite(data.heights[i])||data.heights[i]<-500||data.heights[i]>3000||!Number.isInteger(data.coverage[i])||data.coverage[i]<0||data.coverage[i]>255||!Number.isInteger(data.biomes[i])||data.biomes[i]<0||data.biomes[i]>=biomes.length) throw Error('Altitude ou textura inválida.');
    if(data.treeStyles!==undefined||data.treeStyleIds!==undefined){
      if(!Array.isArray(data.treeStyles)||data.treeStyles.length>65535||data.treeStyles.some(s=>!s||!['foliage','trunk','ground'].every(k=>hexRgb(s[k])))||!Array.isArray(data.treeStyleIds)||data.treeStyleIds.length!==length||data.treeStyleIds.some(id=>!Number.isInteger(id)||id<0||id>data.treeStyles.length))throw Error('Cores de vegetação inválidas.');
    }
    if(data.treeExclusions!==undefined&&(!Array.isArray(data.treeExclusions)||data.treeExclusions.length>length||data.treeExclusions.some(i=>!Number.isInteger(i)||i<0||i>=length)))throw Error('Árvores removidas inválidas.');
    if(data.waterLevels!==undefined&&(!data.waterLevels||Array.isArray(data.waterLevels)||typeof data.waterLevels!=='object'||Object.keys(data.waterLevels).length>length||Object.entries(data.waterLevels).some(([k,v])=>! /^(0|[1-9][0-9]*)$/.test(k)||+k>=length||!Number.isFinite(v)||v< -500||v>3000)))throw Error('Nível de água inválido.');
    if(data.waterColors!==undefined&&(!data.waterColors||Array.isArray(data.waterColors)||typeof data.waterColors!=='object'||Object.keys(data.waterColors).length>length||Object.entries(data.waterColors).some(([k,v])=>!/^(0|[1-9][0-9]*)$/.test(k)||+k>=length||!hexRgb(v))))throw Error('Cor de água inválida.');
    if(data.fog!==undefined&&(!Array.isArray(data.fog)||data.fog.length!==length||data.fog.some(v=>v!==0&&v!==255)))throw Error('Cobertura FOG inválida.');
    return restore(data);
  }
  function index(x,y) {return Math.max(0,Math.min(height-1,Math.floor(y/step)))*width+Math.max(0,Math.min(width-1,Math.floor(x/step)));}
  function fogStamp(t,x,y,size,reveal=false,stretch=1){const radius=Math.max(2,size/2);for(let j=Math.max(0,Math.floor((y-radius)/step));j<=Math.min(height-1,Math.ceil((y+radius)/step));j++)for(let i=Math.max(0,Math.floor((x-radius*stretch)/step));i<=Math.min(width-1,Math.ceil((x+radius*stretch)/step));i++)if(Math.hypot((i*step+2-x)/stretch,j*step+2-y)<=radius)t.fog[j*width+i]=reveal?0:255;t.dirty=true;}
  function seaErase(layers,x,y,size,stretch=1){const radius=Math.max(2,size/2);let changed=false;for(const layer of layers){if(layer.locked)continue;const t=layer.terrain;let layerChanged=false;for(let j=Math.max(0,Math.floor((y-radius)/step));j<=Math.min(height-1,Math.ceil((y+radius)/step));j++)for(let i=Math.max(0,Math.floor((x-radius*stretch)/step));i<=Math.min(width-1,Math.ceil((x+radius*stretch)/step));i++){if(Math.hypot((i*step+2-x)/stretch,j*step+2-y)>radius)continue;const k=j*width+i;t.coverage[k]=0;t.heights[k]=0;t.biomes[k]=0;t.treeStyleIds[k]=0;t.treeExclusions.delete(k);delete t.waterLevels[k];delete t.waterColors[k];layerChanged=true;}if(layerChanged)t.dirty=true;changed=changed||layerChanged;}return changed;}
  function fogAt(layers,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;if(typeof WorldSurface!=='undefined'&&layers.some(l=>l.planet?.enabled)){const {gx,gy}=WorldSurface.locate(x,y);return fogAt(WorldSurface.group(layers,gx,gy),x-gx*1600,y-gy*1100);}if(x<0||y<0||x>=1600||y>=1100)return false;return layers.some(l=>l.visible!==false&&l.opacity!==0&&l.terrain?.fog?.[index(x,y)]===255);}
  function fogTexture(t,color){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d'),im=g.createImageData(width,height);if(color){const rgb=hexRgb(color);for(let k=0;k<length;k++)if(t.fog?.[k]){im.data.set(rgb,k*4);im.data[k*4+3]=255;}}else{const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);},noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx)*(1-sy)+(hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx)*sy;};for(let k=0;k<length;k++)if(t.fog?.[k]){const x=k%width,y=Math.floor(k/width),billow=noise(x*.064,y*.064)*.55+noise(x*.164,y*.164)*.3+noise(x*.384,y*.384)*.15,shade=Math.round(184+billow*69),p=k*4;im.data[p]=shade;im.data[p+1]=Math.min(255,shade+5);im.data[p+2]=Math.min(255,shade+9);im.data[p+3]=255;}}g.putImageData(im,0,0);return c;}
  function drawFog(g,layers,alpha=1){g.save();g.imageSmoothingEnabled=false;g.globalAlpha=alpha;for(const l of layers)if(l.visible!==false&&l.opacity!==0&&l.terrain?.fog?.some(v=>v))g.drawImage(fogTexture(l.terrain),0,0,1600,1100);g.restore();}
  function waterFill(layers,x,y,level=null){
    const ground=new Float32Array(length);for(let k=0;k<length;k++)ground[k]=sample(layers,k%width*step+2,Math.floor(k/width)*step+2)??0;
    const start=index(x,y),neighbors=k=>[k%width?k-1:-1,k%width<width-1?k+1:-1,k>=width?k-width:-1,k<length-width?k+width:-1].filter(n=>n>=0);
    if(level===null){
      const heap=[],seen=new Uint8Array(length),push=(k,h)=>{let i=heap.length;heap.push({k,h});while(i){const parent=(i-1)>>1;if(heap[parent].h<=h)break;heap[i]=heap[parent];i=parent;}heap[i]={k,h};},pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].h<heap[child].h)child++;if(heap[child].h>=last.h)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;};
      push(start,ground[start]);seen[start]=1;
      while(heap.length){const p=pop();if(p.k%width===0||p.k%width===width-1||p.k<width||p.k>=length-width){level=p.h;break;}for(const n of neighbors(p.k))if(!seen[n]){seen[n]=1;push(n,Math.max(p.h,ground[n]));}}
    }
    if(!Number.isFinite(level)||level< -500||level>3000||ground[start]>=level)return {level,cells:[]};
    const seen=new Uint8Array(length),queue=[start];seen[start]=1;for(let i=0;i<queue.length;i++)for(const n of neighbors(queue[i]))if(!seen[n]&&ground[n]<level){seen[n]=1;queue.push(n);}
    return {level,cells:queue};
  }
  function waterMesh(layers,planet=false){
    const vertices=[],colors=[],push=(x,y,h,color)=>{const wx=x+(planet?3200:0),wy=y+(planet?1650:0);vertices.push(wx,wy,Math.max(0,h)*.065+.06,wx/(planet?8000:1600),wy/(planet?4400:1100),1);colors.push(...hexRgb(color).map(v=>v/255));};
    const groups=new Map();
    for(const l of layers)if(l.visible&&l.opacity)for(const [key,level] of Object.entries(l.terrain.waterLevels||{})){const k=+key;if((sample(layers,k%width*step+2,Math.floor(k/width)*step+2)??0)>=level)continue;const color=l.terrain.waterColors?.[k]||theme.water,groupKey=level+'|'+color;if(!groups.has(groupKey))groups.set(groupKey,new Set());groups.get(groupKey).add(k);}
    for(const [key,wet] of groups){const [heightValue,color]=key.split('|'),level=Number(heightValue);
      const cells=new Map(),nodes=new Map();for(const k of wet){const x=k%width,y=Math.floor(k/width);for(const [dx,dy] of [[-1,-1],[0,-1],[-1,0],[0,0]])cells.set((x+dx)+','+(y+dy),[x+dx,y+dy]);}
      const node=(x,y)=>{const key=x+','+y;if(nodes.has(key))return nodes.get(key);const inside=x>=0&&x<width&&y>=0&&y<height,k=y*width+x,ground=inside?(sample(layers,x*step+2,y*step+2)??0):level+1,depth=level-ground;
        const p={x:Math.max(0,Math.min(1600,x*step+2)),y:Math.max(0,Math.min(1100,y*step+2)),value:inside&&wet.has(k)?Math.max(.001,depth):-Math.max(.001,Math.abs(depth))};nodes.set(key,p);return p;};
      const clip=triangle=>{const out=[];for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],ia=a.value>0,ib=b.value>0;if(ia)out.push(a);if(ia!==ib){const t=a.value/(a.value-b.value);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;};
      for(const [x,y] of cells.values()){const a=node(x,y),b=node(x+1,y),c=node(x,y+1),d=node(x+1,y+1);for(const triangle of [[a,b,c],[b,d,c]]){const polygon=clip(triangle);for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]])push(p.x,p.y,level,color);}}
    }
    const mesh=new Float32Array(vertices);mesh.colors=new Float32Array(colors);return mesh;
  }
  function waterRegion(t,x,y){
    const levels=t.waterLevels||{},present=k=>Object.hasOwn(levels,k);let start=index(x,y);
    if(!present(start)){const cx=start%width,cy=Math.floor(start/width),near=[];for(let j=Math.max(0,cy-1);j<=Math.min(height-1,cy+1);j++)for(let i=Math.max(0,cx-1);i<=Math.min(width-1,cx+1);i++)if(present(j*width+i))near.push(j*width+i);near.sort((a,b)=>Math.hypot(a%width*step+2-x,Math.floor(a/width)*step+2-y)-Math.hypot(b%width*step+2-x,Math.floor(b/width)*step+2-y));if(!near.length)return [];start=near[0];}
    const seen=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++){const k=queue[i];for(const n of [k%width?k-1:-1,k%width<width-1?k+1:-1,k>=width?k-width:-1,k<length-width?k+width:-1])if(n>=0&&!seen.has(n)&&present(n)){seen.add(n);queue.push(n);}}return queue;
  }
  function sample(layers,x,y,limit=layers.length) {
    if(x<0||y<0||x>=1600||y>=1100){if(typeof WorldSurface!=='undefined'&&layers.some(l=>l.planet?.enabled)&&x>=-3200&&x<4800&&y>=-1650&&y<2750)return WorldSurface.sample(layers,x,y);return null;}
    const i=index(x,y);let value=0,known=false;
    for(let n=0;n<limit;n++){const l=layers[n];if(!l.visible||!l.opacity)continue;const a=l.terrain.coverage[i]/255*l.opacity;if(a){value=value*(1-a)+l.terrain.heights[i]*a;known=true;}}
    return known?value:null;
  }
  function stamp(layers,active,x,y,options) {
    const t=layers[active].terrain, radius=Math.max(3,options.size/2), strength=options.strength,stretch=Math.max(1,Math.min(12,options.stretch||1));
    freezeTreeColors(t);
    const paintedBiome=biomes.indexOf(options.biome),paintedStyle=options.mode==='brush'&&(paintedBiome===2||paintedBiome>=8)?styleId(t,paintedBiome):0;
    const x0=Math.max(0,Math.floor((x-radius*stretch)/step)),x1=Math.min(width-1,Math.ceil((x+radius*stretch)/step));
    const y0=Math.max(0,Math.floor((y-radius)/step)),y1=Math.min(height-1,Math.ceil((y+radius)/step));
    const old=['smooth','blend'].includes(options.mode)?t.heights.slice():null,oldCoverage=options.mode==='blend'?t.coverage.slice():null;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const px=i*step+2,py=j*step+2,d=Math.hypot((px-x)/stretch,py-y)/radius;if(d>=1)continue;
      const k=j*width+i,fall=Math.pow(1-d*d,options.soft?2:0.4),a=Math.min(1,fall*strength);
      if(options.mode==='blend'){
        let coverageSum=0,heightSum=0,count=0,nearestBiome=t.biomes[k],nearestDistance=Infinity;
        for(let yy=Math.max(0,j-2);yy<=Math.min(height-1,j+2);yy++)for(let xx=Math.max(0,i-2);xx<=Math.min(width-1,i+2);xx++){
          const q=yy*width+xx,c=oldCoverage[q],distance=Math.hypot(xx-i,yy-j);coverageSum+=c;heightSum+=c?old[q]:(sample(layers,xx*step+2,yy*step+2,active)??0);count++;
          if(c&&distance<nearestDistance){nearestDistance=distance;nearestBiome=t.biomes[q];}
        }
        const nextCoverage=Math.round(oldCoverage[k]+(coverageSum/count-oldCoverage[k])*a);
        t.coverage[k]=nextCoverage;t.heights[k]=Math.max(-500,Math.min(3000,(oldCoverage[k]?old[k]:(sample(layers,px,py,active)??0))*(1-a)+heightSum/count*a));
        if(nextCoverage){t.biomes[k]=nearestBiome;}else{t.heights[k]=0;t.biomes[k]=0;t.treeStyleIds[k]=0;}
        continue;
      }
      if(options.mode==='erase'){delete t.waterLevels[k];delete t.waterColors[k];t.coverage[k]=Math.round(t.coverage[k]*(1-a));if(t.coverage[k]<3){t.coverage[k]=0;t.heights[k]=0;t.treeStyleIds[k]=0;t.treeExclusions.delete(k);}continue;}
      const covered=t.coverage[k]>0,base=covered?t.heights[k]:(sample(layers,px,py,active)??0);
      let next=base,biome=t.biomes[k];
      if(options.mode==='mountain') {const peak=Math.max(0,1-d)*options.amount;next=base+(Math.max(0,peak-base)*a);biome=4;}
      else if(options.mode==='volcano') {const crater=Math.exp(-Math.pow(d/.24,2));const cone=(1-Math.max(0,(d-.28)/.72))*options.amount;next=base+(Math.max(-options.amount*.22,cone-crater*options.amount*.4-base)*a);biome=d<.25?7:4;}
      else if(options.mode==='raise'||options.mode==='lower') {next=base+(options.mode==='raise'?1:-1)*options.amount*a;biome=0;}
      else if(options.mode==='smooth'){
        let sum=0,count=0;
        for(let yy=Math.max(0,j-2);yy<=Math.min(height-1,j+2);yy++)for(let xx=Math.max(0,i-2);xx<=Math.min(width-1,i+2);xx++) {const q=yy*width+xx;sum+=t.coverage[q]?old[q]:(sample(layers,xx*step,yy*step,active)??0);count++;}
        next=base+(sum/count-base)*a;biome=0;
      } else if(options.mode==='plateau') {next=base+(options.target-base)*a;biome=0;}
      else {biome=biomes.indexOf(options.biome);if(biome<0)biome=1;next=options.integrate?base+(defaults[biome]-base)*a:base;}
      t.heights[k]=Math.max(-500,Math.min(3000,next));t.biomes[k]=biome;
      if(options.mode==='brush'){t.treeStyleIds[k]=paintedStyle;t.treeExclusions.delete(k);}else if(biome!==2&&biome<8)t.treeStyleIds[k]=0;
      t.coverage[k]=Math.min(255,Math.round(t.coverage[k]+(255-t.coverage[k])*a));
    }
    t.dirty=true;
  }
  function autoColor(h) {
    const stops=autoStops||(autoStops=[[-500,mix(hexRgb(theme.water),-30)],[0,mix(hexRgb(theme.water),20)],[15,hexRgb(theme.sand)],[70,mix(hexRgb(theme.grass),14)],[350,mix(hexRgb(theme.grass),-10)],[800,mix(hexRgb(theme.grass),-22)],[1300,hexRgb(theme.rock)],[1900,mix(hexRgb(theme.rock),30)],[2300,hexRgb(theme.snow)],[3000,mix(hexRgb(theme.snow),15)]]);
    for(let i=1;i<stops.length;i++)if(h<=stops[i][0]){const [lo,a]=stops[i-1],[hi,b]=stops[i],f=Math.max(0,(h-lo)/(hi-lo));return a.map((v,k)=>v+(b[k]-v)*f);}return stops.at(-1)[1];
  }
  function render(t,settings) {
    freezeTreeColors(t);
    const key=JSON.stringify(settings)+themeRevision;if(!t.dirty&&t.view===key)return t.surface;
    const c=t.canvas.getContext('2d'),image=c.createImageData(width,height),p=image.data,colorPalette=palette();
    const hAt=(x,y,fallback)=>{const k=Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x));return t.coverage[k]?t.heights[k]:fallback;};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;if(!t.coverage[i])continue;const h=t.heights[i],biome=t.biomes[i];
      const treeStyle=t.treeStyles[t.treeStyleIds[i]-1];
      let rgb=(settings.altitude||biome===0)?autoColor(h):treeStyle&&(biome===2||biome>=8)?hexRgb(treeStyle.ground):colorPalette[biome].slice();
      const dx=(hAt(x+1,y,h)-hAt(x-1,y,h))/32,dy=(hAt(x,y+1,h)-hAt(x,y-1,h))/32;
      let light=settings.shade?Math.max(.52,Math.min(1.38,.9+(-dx-dy+2)*.23/Math.sqrt(4+dx*dx+dy*dy))):1;
      if(settings.texture){light+=(grain[i]-.5)*.12;}
      if(settings.contours&&h>0){const interval=settings.interval,level=Math.floor(h/interval);if(level!==Math.floor(hAt(x+1,y,h)/interval)||level!==Math.floor(hAt(x,y+1,h)/interval))light*=.88;}
      for(let k=0;k<3;k++)p[i*4+k]=Math.max(0,Math.min(255,rgb[k]*light));p[i*4+3]=t.coverage[i];
    }
    c.putImageData(image,0,0);
    const g=t.surface.getContext('2d');g.clearRect(0,0,1600,1100);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(t.canvas,0,0,1600,1100);
    t.dirty=false;t.view=key;return t.surface;
  }
  function seed(t,raster) {
    const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d');g.drawImage(raster,0,0,width,height);const p=g.getImageData(0,0,width,height).data;
    const coast=new Float32Array(length);coast.fill(999);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(p[i*4+3]<180)coast[i]=0;else coast[i]=Math.min(x?coast[i-1]+1:1,y?coast[i-width]+1:1);}
    for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;coast[i]=Math.min(coast[i],x<width-1?coast[i+1]+1:1,y<height-1?coast[i+width]+1:1);}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {const i=y*width+x;if(p[i*4+3]<180)continue;const wx=x*step,wy=y*step;
      const spine=350+Math.sin(wx*.013)*32;const ridge=2400*Math.exp(-Math.pow((wx-750)/245,2)-Math.pow((wy-spine)/100,2));const crags=.55+Math.abs(smoothNoise(x*.1,y*.1)-.5)*1.8;
      t.heights[i]=Math.min(3000,(45+ridge*crags+grain[i]*210)*Math.min(1,coast[i]/10));t.coverage[i]=p[i*4+3];t.biomes[i]=t.heights[i]<40?3:t.heights[i]<530&&coast[i]>9&&grain[i]>.51?2:0;
    }t.dirty=true;
  }
  let highDetail;
  function detailTexture(){
    if(highDetail)return highDetail;const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),image=g.createImageData(512,512);
    const field=(x,y,frequency)=>{const period=frequency,px=(x/512*period+period)%period,py=(y/512*period+period)%period,ix=Math.floor(px),iy=Math.floor(py);let u=px-ix,v=py-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const n=(x,y)=>noise(x%period,y%period);return(n(ix,iy)*(1-u)+n(ix+1,iy)*u)*(1-v)+(n(ix,iy+1)*(1-u)+n(ix+1,iy+1)*u)*v;};
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const i=(y*512+x)*4,broad=field(x,y,8),fine=field(x,y,64),rock=field(x,y,24),warp=field(x,y,16);
      image.data[i]=Math.round(255*(.35+broad*.35+fine*.3));
      image.data[i+1]=Math.round(255*(.5+.25*Math.sin(y/512*Math.PI*24+(warp-.5)*3)+.1*Math.sin((x+y)/512*Math.PI*48)));
      const crust=field(x+warp*30,y+broad*20,12),vein=Math.max(0,1-Math.abs(crust-.5)*16);
      image.data[i+2]=Math.round(255*vein*vein);
      image.data[i+3]=Math.round(255*(.28+rock*.55+fine*.17));
    }
    g.putImageData(image,0,0);return highDetail=c;
  }
  // Independent continuous masks avoid interpolating categorical biome IDs.
  function biomeTexture(t){const c=document.createElement('canvas');c.width=400;c.height=275;const g=c.getContext('2d'),im=g.createImageData(400,275);for(let i=0;i<length;i++){const h=t.heights[i],biome=t.biomes[i]||(h<0?6:h<45?3:h<700?1:h<1900?4:5),coverage=t.coverage[i];im.data[i*4]=biome===7?255:0;im.data[i*4+1]=biome===6?255:0;im.data[i*4+2]=biome===4||biome===5?255:0;im.data[i*4+3]=coverage;}g.putImageData(im,0,0);return c;}

  return {create,copy,restore,serialize,validate,sample,fogStamp,seaErase,fogAt,fogTexture,drawFog,waterFill,waterMesh,waterRegion,stamp,render,seed,index,length,setTheme,getTheme,defaultTheme,biomes,freezeTreeColors,freezeLayers,detailTexture,biomeTexture};
})();

// Native canvas icons remain crisp at any marker size and need no external assets.
const Buildings = (()=>{
  const names={house:'Casa',village:'Vila',tower:'Torre',castle:'Castelo',temple:'Templo',bridge:'Ponte',camp:'Acampamento',ruin:'Ruínas',windmill:'Moinho',tunnel:'Portal',cave:'Caverna'};
  function draw(c,x,y,type,size=38,rotation=0){
    c.save();c.translate(x,y);c.rotate(rotation*Math.PI/180);c.scale(size/40,size/40);c.lineJoin='round';c.lineCap='round';c.lineWidth=2;c.strokeStyle='#344b47';
    c.fillStyle='#233f3d35';c.beginPath();c.ellipse(3,16,24,8,0,0,Math.PI*2);c.fill();
    const poly=(points,fill)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.stroke();};
    const rect=(x,y,w,h,fill='#e3d4ae')=>{c.fillStyle=fill;c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);};
    const line=(a,b)=>{c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();};
    const house=(x,y,s=1)=>{c.save();c.translate(x,y);c.scale(s,s);rect(-13,-3,26,22);poly([[-18,-3],[0,-19],[18,-3]],'#9c6c51');rect(-3,7,7,12,'#56706a');c.restore();};
    const tower=(x,y,s=1)=>{c.save();c.translate(x,y);c.scale(s,s);rect(-9,-17,18,35);rect(-13,-20,26,8);for(let j=-12;j<=8;j+=10)rect(j,-26,5,7);rect(-3,6,6,12,'#56706a');line([-3,-8],[3,-8]);c.restore();};
    if(type==='tunnel'||type==='cave'){
      poly([[-25,18],[-23,-3],[-14,-20],[5,-25],[21,-13],[26,18]],type==='cave'?'#778379':'#aeb29b');
      c.fillStyle='#132e32';c.beginPath();c.moveTo(-13,19);c.lineTo(-13,0);c.bezierCurveTo(-13,-19,13,-19,13,0);c.lineTo(13,19);c.fill();c.stroke();
      c.strokeStyle='#e4d2ab';c.lineWidth=4;c.beginPath();c.moveTo(-16,17);c.lineTo(-16,0);c.bezierCurveTo(-16,-23,16,-23,16,0);c.lineTo(16,17);c.stroke();
      c.strokeStyle='#596a62';c.lineWidth=1;for(let j=-12;j<=12;j+=8)line([j,-20],[j,-15]);
      poly([[-10,19],[10,19],[18,28],[-18,28]],'#b5a787');
      for(const x of [-20,20]){c.fillStyle='#6d5942';c.fillRect(x-1,4,2,10);c.fillStyle='#ffd78a';c.beginPath();c.ellipse(x,3,2,4,0,0,Math.PI*2);c.fill();}
    }
    if(type==='house')house(0,0);
    if(type==='village'){house(-13,-8,.7);house(13,-4,.7);house(0,9,.75);}
    if(type==='tower')tower(0,0);
    if(type==='castle'){rect(-19,-4,38,23);tower(-20,2,.7);tower(20,2,.7);tower(0,-8,.85);}
    if(type==='temple'){rect(-18,-2,36,19);poly([[-24,-3],[0,-20],[24,-3]],'#779890');for(let j=-12;j<=12;j+=12)rect(j-2,0,4,17);rect(-23,18,46,4);}
    if(type==='bridge'){poly([[-25,-9],[25,-9],[25,12],[-25,12]],'#c7b487');for(let j=-20;j<=20;j+=8)line([j,-9],[j,12]);c.lineWidth=4;line([-25,-12],[25,-12]);line([-25,15],[25,15]);}
    if(type==='camp'){poly([[-23,17],[0,-20],[23,17]],'#ceaa71');poly([[-8,17],[0,-8],[9,17]],'#526d60');line([0,-25],[0,-20]);}
    if(type==='ruin'){poly([[-20,18],[-20,-14],[-12,-9],[-8,-18],[-4,18]],'#b3baa3');poly([[5,18],[8,-5],[16,-12],[21,18]],'#9ba98f');line([-21,19],[23,19]);}
    if(type==='windmill'){poly([[-12,19],[-7,-16],[7,-16],[12,19]],'#e0ce9f');c.lineWidth=4;line([-19,-26],[19,5]);line([19,-26],[-19,5]);c.fillStyle='#5f796d';c.beginPath();c.arc(0,-10,4,0,Math.PI*2);c.fill();}
    c.restore();
  }
  return {names,draw};
})();
