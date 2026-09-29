'use strict';
// Keep complete centerlines: stroke every bank before any interior, including junctions.
const MapPaths=(()=>{
  // Waterfall heights are derived from the current terrain, not baked into the project.
  function waterSurface(layers,p){
    const ground=Math.max(0,Terrain.sample(layers,p.x,p.y)||0),k=Terrain.index(p.x,p.y);let level=ground,water=ground<=0,color=Terrain.getTheme().water;
    for(const l of layers)if(l.visible&&l.opacity){const t=l.terrain,h=t.waterLevels?.[k];if(Number.isFinite(h)&&h>=ground){level=Math.max(level,h);water=true;color=t.waterColors?.[k]||color;}if(t.coverage[k]&&t.biomes[k]===6)water=true;}
    return {level,water,color};
  }
  function snapWater(layers,p,radius,inlet=false){
    let best=null,score=Infinity;
    const visit=(q,extra={})=>{const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<=radius&&d<score){best={...q,...extra};score=d;}};
    for(const l of layers)if(l.visible&&l.opacity)for(const r of l.routes||[])if(r.kind==='river')for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      visit({x:a.x+dx*t,y:a.y+dy*t},{river:true});
    }
    if(!inlet){
      for(let y=Math.max(2,p.y-radius);y<Math.min(1099,p.y+radius);y+=4)for(let x=Math.max(2,p.x-radius);x<Math.min(1599,p.x+radius);x+=4){const q={x,y};if(waterSurface(layers,q).water)visit(q,{water:true});}
    }
    return best||{x:p.x,y:p.y};
  }
  function createWaterfall(layers,a,b,width=24,auto=true){
    a={x:a.x,y:a.y};b={x:b.x,y:b.y};
    if(waterSurface(layers,a).level<waterSurface(layers,b).level)[a,b]=[b,a];
    if(auto){const radius=Math.max(48,Math.min(100,width*2));a=snapWater(layers,a,radius,true);b=snapWater(layers,b,radius);}
    if(Math.hypot(a.x-b.x,a.y-b.y)<4)throw Error('Escolha dois pontos separados para a queda.');
    if(waterSurface(layers,a).level-waterSurface(layers,b).level<5)throw Error('Escolha uma origem mais alta e uma saída abaixo dela (mínimo de 5 m).');
    return {kind:'waterfall',width,points:[{x:a.x,y:a.y},{x:b.x,y:b.y}]};
  }
  function trace(g,points){
    g.beginPath();g.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];g.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);}
    const last=points.at(-1);g.lineTo(last.x,last.y);
  }
  function draw(g,routes){
    g.save();g.lineCap='round';g.lineJoin='round';g.setLineDash([]);
    for(const kind of ['river','path','waterfall']){
      const group=routes.filter(r=>r.kind===kind&&r.points.length>1);
      for(const outer of [true,false])for(const r of group){
        trace(g,r.points);g.lineWidth=r.width+(outer?(kind==='river'?5:4):0);
        g.strokeStyle=kind==='waterfall'?(outer?'#d3ecea':'#63b5c7'):kind==='river'?(outer?'#8fae96':'#498e9f'):(outer?'#7f8967':'#dfcc9c');g.stroke();
      }
      if(kind==='waterfall')for(const r of group){trace(g,r.points);g.lineWidth=Math.max(1,r.width*.16);g.strokeStyle='#e6faf1';g.stroke();}
    }
    g.restore();
  }
  function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
  function erase(routes,a,b,radius){
    const result=[];
    for(const route of routes){
      let run=[],hit=false;const pieces=[];
      const visit=p=>{if(distance(p,a,b)<=radius+route.width/2){hit=true;if(run.length>1)pieces.push({...route,points:run});run=[];}else run.push(p);};
      visit(route.points[0]);
      for(let i=1;i<route.points.length;i++){
        const p=route.points[i-1],q=route.points[i],steps=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/3));
        for(let j=1;j<=steps;j++)visit({x:p.x+(q.x-p.x)*j/steps,y:p.y+(q.y-p.y)*j/steps});
      }
      if(!hit)result.push(route);else{if(run.length>1)pieces.push({...route,points:run});result.push(...pieces);}
    }
    return result;
  }
  function validate(routes){
    if(!Array.isArray(routes)||routes.length>2000)throw Error('Trajetos inválidos.');
    let count=0;
    return routes.map(r=>{
      if(!r||!['river','path','waterfall'].includes(r.kind)||!Number.isFinite(r.width)||r.width<1||r.width>180||!Array.isArray(r.points)||r.points.length<2||(count+=r.points.length)>100000)throw Error('Trajeto inválido.');
      const points=r.points.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>=1600||p.y<0||p.y>=1100)throw Error('Ponto de trajeto inválido.');return {x:p.x,y:p.y};});
      return {kind:r.kind,width:r.width,points};
    });
  }
  function build(layers,planet,include=null){
    const vertices=[],hex=c=>c.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
    // Match the coarse rendered triangles so roads do not sink into slopes.
    const ground=p=>{const x=Math.floor(p.x/20)*20,y=Math.floor(p.y/20)*20,u=(p.x-x)/20,v=(p.y-y)/20,h=(x,y)=>Math.max(0,Terrain.sample(layers,Math.max(0,Math.min(1599,x)),Math.max(0,Math.min(1099,y)))||0)*.065,a=h(x,y),b=h(x+20,y),c=h(x,y+20),d=h(x+20,y+20);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};
    const vertex=(p,color,kind,u,v,lift)=>{const x=p.x+(planet?3200:0),y=p.y+(planet?1650:0),h=ground(p);vertices.push(x,y,h,x/(planet?8000:1600),y/(planet?4400:1100),kind,...color,lift*(planet?.37:1),0,0,1,u,v);};
    for(const layer of layers)if(layer.visible&&layer.opacity)for(const route of layer.routes||[]){
      if(route.kind==='waterfall'||(include&&!include(route,'route')))continue;
      const points=[route.points[0]];
      for(let i=1;i<route.points.length-1;i++){const a=points.at(-1),b=route.points[i],c={x:(b.x+route.points[i+1].x)/2,y:(b.y+route.points[i+1].y)/2},steps=Math.max(1,Math.ceil((Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(c.x-b.x,c.y-b.y))/6));for(let j=1;j<=steps;j++){const t=j/steps,q=1-t;points.push({x:q*q*a.x+2*q*t*b.x+t*t*c.x,y:q*q*a.y+2*q*t*b.y+t*t*c.y});}}
      {const a=points.at(-1),b=route.points.at(-1),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));for(let j=1;j<=steps;j++)points.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});}
      for(const bank of [true,false]){let distance=0;for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<.01)continue;const width=route.width+(bank?4:0),nx=-(b.y-a.y)/len*width/2,ny=(b.x-a.x)/len*width/2;
        const p=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}],color=hex(bank?(route.kind==='river'?'#8fae96':'#7f8967'):route.kind==='river'?'#498e9f':'#d6c29b'),kind=route.kind==='river'&&!bank?10:9;
        for(const k of [0,1,2,0,2,3])vertex(p[k],color,kind,distance+(k===1||k===2?len:0),k<2?0:1,bank?.2:.3);distance+=len;
      }}
    }
    return{vertices:new Float32Array(vertices)};
  }
  function buildWaterfalls(layers,planet,include=null){
    const vertices=[];
    // Match the editor's coarse terrain triangles as well as the detailed heightfield.
    const height=p=>{
      const surface=waterSurface(layers,p).level*.065,x=Math.floor(p.x/20)*20,y=Math.floor(p.y/20)*20,u=(p.x-x)/20,v=(p.y-y)/20;
      const h=(x,y)=>Math.max(0,Terrain.sample(layers,Math.max(0,Math.min(1599,x)),Math.max(0,Math.min(1099,y)))||0)*.065;
      const a=h(x,y),b=h(x+20,y),c=h(x,y+20),d=h(x+20,y+20),ground=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
      return Math.max(surface,ground)+.45;
    };
    const vertex=(p,z,tint,kind,u,v,n)=>{const x=p.x+(planet?3200:0),y=p.y+(planet?1650:0);vertices.push(x,y,z,x/(planet?8000:1600),y/(planet?4400:1100),kind,...tint,0,...n,u,v);};
    const triangle=(a,b,c,tint,kind)=>{const u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[c.x-a.x,c.y-a.y,c.z-a.z],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;for(let i=0;i<3;i++)n[i]/=len;for(const p of [a,b,c])vertex(p,p.z,tint,kind,p.u,p.v,n);};
    const quad=(a,b,c,d,tint,kind)=>{triangle(a,b,c,tint,kind);triangle(a,c,d,tint,kind);};
    for(const layer of layers)if(layer.visible&&layer.opacity)for(const r of layer.routes||[])if(r.kind==='waterfall'){
      if(include&&!include(r,'structure'))continue;
      let distance=0;
      for(let i=1;i<r.points.length;i++){
        const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.01)continue;
        const nx=-dy/len,ny=dx/len,steps=Math.max(2,Math.ceil(len/4)),bands=Math.max(4,Math.min(24,Math.ceil(r.width/4)));
        const point=(t,s)=>{const p={x:Math.max(0,Math.min(1599.999,a.x+dx*t+nx*s)),y:Math.max(0,Math.min(1099.999,a.y+dy*t+ny*s))};return {...p,z:height(p),u:distance+t*len,v:s};};
        for(let j=0;j<steps;j++)for(let k=0;k<bands;k++){
          const s=-r.width/2+k*r.width/bands,q=s+r.width/bands;
          quad(point(j/steps,s),point((j+1)/steps,s),point((j+1)/steps,q),point(j/steps,q),[.35,.68,.77],11);
        }
        distance+=len;
      }
      const b=r.points.at(-1),a=r.points.at(-2),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,z=height(b)+.18;
      const center={...b,z,u:0,v:0},rx=r.width*.8,ry=r.width*.46;
      for(let j=0;j<20;j++){const at=t=>{const side=Math.cos(t)*rx,along=Math.sin(t)*ry,p={x:Math.max(0,Math.min(1599.999,b.x+nx*side+dx/len*along)),y:Math.max(0,Math.min(1099.999,b.y+ny*side+dy/len*along))};return {...p,z:Math.max(z,height(p)+.1),u:side,v:along};};triangle(center,at(j*Math.PI/10),at((j+1)*Math.PI/10),[.78,.94,.94],12);}
    }
    return {vertices:new Float32Array(vertices)};
  }
  return {draw,erase,validate,distance,build,createWaterfall,buildWaterfalls,waterSurface,snapWater};
})();
