'use strict';
// A four-pixel heightfield keeps editing and project files compact.
const Terrain = (() => {
  const step = 4, width = 400, height = 275, length = width * height;
  const biomes = ['auto', 'grass', 'forest', 'sand', 'rock', 'snow', 'water', 'lava'];
  const defaults = [120,120,240,25,1000,2000,-80,35];
  const defaultTheme={grass:'#87a56b',trees:'#336349',water:'#347787',lava:'#d84a1c'};
  let theme={...defaultTheme},themeRevision=0;
  const hexRgb=value=>{const m=/^#([0-9a-f]{6})$/i.exec(value||'');return m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)]:null;};
  const mix=(rgb,amount)=>rgb.map(v=>Math.max(0,Math.min(255,Math.round(v+amount))));
  function setTheme(next={}){for(const key of Object.keys(defaultTheme))if(hexRgb(next[key]))theme[key]=next[key];themeRevision++;}
  function getTheme(){return {...theme};}
  function palette(){const grass=hexRgb(theme.grass),trees=hexRgb(theme.trees),water=hexRgb(theme.water),lava=hexRgb(theme.lava);return [[135,165,107],grass,trees,[211,193,142],[140,151,139],[224,235,230],water,lava];}
  const noise = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
  function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return (noise(ix,iy)*(1-u)+noise(ix+1,iy)*u)*(1-v)+(noise(ix,iy+1)*(1-u)+noise(ix+1,iy+1)*u)*v;}
  const grain=new Float32Array(length),detail=new Float32Array(length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=y*width+x;grain[k]=smoothNoise(x*.07,y*.07)*.55+smoothNoise(x*.19,y*.19)*.3+smoothNoise(x*.51,y*.51)*.15;detail[k]=noise(x,y);}
  function create() {
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const surface=document.createElement('canvas');surface.width=1600;surface.height=1100;
    return {heights:new Float32Array(length), coverage:new Uint8Array(length), biomes:new Uint8Array(length), canvas, surface, dirty:true, view:''};
  }
  function copy(t) { return {heights:t.heights.slice(),coverage:t.coverage.slice(),biomes:t.biomes.slice()}; }
  function restore(data) { const t=create(); if(data){t.heights.set(data.heights);t.coverage.set(data.coverage);t.biomes.set(data.biomes);}return t; }
  function serialize(t) {return {heights:Array.from(t.heights,v=>Math.round(v*10)/10),coverage:Array.from(t.coverage),biomes:Array.from(t.biomes)};}
  function validate(data) {
    if(!data || !['heights','coverage','biomes'].every(k=>Array.isArray(data[k])&&data[k].length===length)) throw Error('Dados de relevo inválidos.');
    for(let i=0;i<length;i++) if(!Number.isFinite(data.heights[i])||data.heights[i]<-500||data.heights[i]>3000||!Number.isInteger(data.coverage[i])||data.coverage[i]<0||data.coverage[i]>255||!Number.isInteger(data.biomes[i])||data.biomes[i]<0||data.biomes[i]>7) throw Error('Altitude ou textura inválida.');
    return restore(data);
  }
  function index(x,y) {return Math.max(0,Math.min(height-1,Math.floor(y/step)))*width+Math.max(0,Math.min(width-1,Math.floor(x/step)));}
  function sample(layers,x,y,limit=layers.length) {
    if(x<0||y<0||x>=1600||y>=1100)return null;
    const i=index(x,y);let value=0,known=false;
    for(let n=0;n<limit;n++){const l=layers[n];if(!l.visible||!l.opacity)continue;const a=l.terrain.coverage[i]/255*l.opacity;if(a){value=value*(1-a)+l.terrain.heights[i]*a;known=true;}}
    return known?value:null;
  }
  function stamp(layers,active,x,y,options) {
    const t=layers[active].terrain, radius=Math.max(3,options.size/2), strength=options.strength;
    const x0=Math.max(0,Math.floor((x-radius)/step)),x1=Math.min(width-1,Math.ceil((x+radius)/step));
    const y0=Math.max(0,Math.floor((y-radius)/step)),y1=Math.min(height-1,Math.ceil((y+radius)/step));
    const old=options.mode==='smooth'?t.heights.slice():null;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const px=i*step+2,py=j*step+2,d=Math.hypot(px-x,py-y)/radius;if(d>=1)continue;
      const k=j*width+i,fall=Math.pow(1-d*d,options.soft?2:0.4),a=Math.min(1,fall*strength);
      if(options.mode==='erase'){t.coverage[k]=Math.round(t.coverage[k]*(1-a));if(t.coverage[k]<3){t.coverage[k]=0;t.heights[k]=0;}continue;}
      const covered=t.coverage[k]>0,base=covered?t.heights[k]:(sample(layers,px,py,active)??0);
      let next=base,biome=t.biomes[k];
      if(options.mode==='raise'||options.mode==='lower') {next=base+(options.mode==='raise'?1:-1)*options.amount*a;biome=0;}
      else if(options.mode==='smooth'){
        let sum=0,count=0;
        for(let yy=Math.max(0,j-2);yy<=Math.min(height-1,j+2);yy++)for(let xx=Math.max(0,i-2);xx<=Math.min(width-1,i+2);xx++) {const q=yy*width+xx;sum+=t.coverage[q]?old[q]:(sample(layers,xx*step,yy*step,active)??0);count++;}
        next=base+(sum/count-base)*a;biome=0;
      } else if(options.mode==='plateau') {next=base+(options.target-base)*a;biome=0;}
      else {biome=biomes.indexOf(options.biome);if(biome<0)biome=1;next=options.integrate?base+(defaults[biome]-base)*a:base;}
      t.heights[k]=Math.max(-500,Math.min(3000,next));t.biomes[k]=biome;
      t.coverage[k]=Math.min(255,Math.round(t.coverage[k]+(255-t.coverage[k])*a));
    }
    t.dirty=true;
  }
  function autoColor(h) {
    const stops=[[-500,[34,77,100]],[0,[81,139,151]],[15,[212,201,151]],[70,[166,185,129]],[350,[116,155,104]],[800,[109,132,105]],[1300,[152,158,141]],[1900,[187,192,177]],[2300,[230,234,224]],[3000,[245,245,237]]];
    for(let i=1;i<stops.length;i++)if(h<=stops[i][0]){const [lo,a]=stops[i-1],[hi,b]=stops[i],f=Math.max(0,(h-lo)/(hi-lo));return a.map((v,k)=>v+(b[k]-v)*f);}return stops.at(-1)[1];
  }
  function render(t,settings) {
    const key=JSON.stringify(settings)+themeRevision;if(!t.dirty&&t.view===key)return t.surface;
    const c=t.canvas.getContext('2d'),image=c.createImageData(width,height),p=image.data,colorPalette=palette();
    const hAt=(x,y,fallback)=>{const k=Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x));return t.coverage[k]?t.heights[k]:fallback;};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;if(!t.coverage[i])continue;const h=t.heights[i],biome=t.biomes[i];
      let rgb=(settings.altitude||biome===0)?autoColor(h):colorPalette[biome].slice();
      const dx=(hAt(x+1,y,h)-hAt(x-1,y,h))/32,dy=(hAt(x,y+1,h)-hAt(x,y-1,h))/32;
      let light=settings.shade?Math.max(.52,Math.min(1.38,.9+(-dx-dy+2)*.23/Math.sqrt(4+dx*dx+dy*dy))):1;
      if(settings.texture){const n=detail[i]-.5;light+=(grain[i]-.5)*.25+n*.055;
        const type=biome|| (h<0?6:h<45?3:h<700?1:h<1900?4:5);
        if(type===2){light+=(detail[i]>.55?-.08:.03);}
        if(type===1){rgb[1]+=grain[i]*8;light+=Math.sin(x*.11+y*.09)*.025;}
        if(type===3)light+=Math.sin(x*.28+y*.9+grain[i]*9)*.05;
        if(type===4)light+=Math.sin(x*.35-y*.48+grain[i]*14)*.09;
        if(type===6)light+=Math.sin(y*1.8+Math.sin(x*.15))*.035;
        if(type===7)light+=Math.sin(x*.7+y*.95)*.13+(detail[i]>.6?.09:-.05);
      }
      if(settings.contours&&h>0){const interval=settings.interval,level=Math.floor(h/interval);if(level!==Math.floor(hAt(x+1,y,h)/interval)||level!==Math.floor(hAt(x,y+1,h)/interval))light*=.88;}
      for(let k=0;k<3;k++)p[i*4+k]=Math.max(0,Math.min(255,rgb[k]*light));p[i*4+3]=t.coverage[i];
    }
    c.putImageData(image,0,0);
    const g=t.surface.getContext('2d');g.clearRect(0,0,1600,1100);g.drawImage(t.canvas,0,0,1600,1100);
    if(settings.texture){
      // World-aligned fine strokes add detail independently of heightfield resolution.
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
        const i=y*width+x;if(t.coverage[i]<220)continue;
        const h=t.heights[i],n=detail[i],type=t.biomes[i]||(h<0?6:h<45?3:h<700?1:h<1900?4:5);
        const px=x*4+(n-.5)*6,py=y*4+(detail[Math.max(0,i-1)]-.5)*6;
        if(type===1&&n>.62){g.strokeStyle=n>.88?'#e0dba339':'#234d342c';g.lineWidth=.65;g.beginPath();g.moveTo(px,py);g.lineTo(px+1,py-2.4);g.stroke();}
        if(type===2&&x%2===0&&y%2===0){
          const r=3+n*2.4,tree=hexRgb(theme.trees);g.fillStyle='#153c355e';g.beginPath();g.ellipse(px+1,py+2,r+1,r*.75,0,0,Math.PI*2);g.fill();
          g.fillStyle=`rgb(${mix(tree,n>.5?16:-12).join(',')})`;g.beginPath();g.arc(px,py,r,0,Math.PI*2);g.fill();
          g.fillStyle=`rgb(${mix(tree,55).join(',')})88`;g.beginPath();g.arc(px-1,py-1,r*.55,0,Math.PI*2);g.fill();
        }
        if((type===4||type===5)&&n>.68){g.strokeStyle=type===5?'#ffffff60':'#e2ddc955';g.lineWidth=.8;g.beginPath();g.moveTo(px-2,py+2);g.lineTo(px,py);g.lineTo(px+4,py-1);g.stroke();}
        if(type===3&&n>.65){g.fillStyle='#fff0c544';g.fillRect(px,py,1,.7);}
        if(type===6&&n>.94){g.strokeStyle='#a6e1db30';g.lineWidth=.8;g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(px+3,py-1,px+7,py);g.stroke();}
        if(type===7&&n>.55){g.strokeStyle='#ffd35a';g.lineWidth=.9;g.beginPath();g.moveTo(px-2,py+1);g.quadraticCurveTo(px+2,py-3,px+5,py);g.stroke();}
      }
    }
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
  return {create,copy,restore,serialize,validate,sample,stamp,render,seed,index,length,setTheme,getTheme,defaultTheme};
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
