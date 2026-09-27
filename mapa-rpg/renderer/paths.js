'use strict';
// Keep complete centerlines: stroke every bank before any interior, including junctions.
const MapPaths=(()=>{
  function trace(g,points){
    g.beginPath();g.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];g.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);}
    const last=points.at(-1);g.lineTo(last.x,last.y);
  }
  function draw(g,routes){
    g.save();g.lineCap='round';g.lineJoin='round';g.setLineDash([]);
    for(const kind of ['river','path']){
      const group=routes.filter(r=>r.kind===kind&&r.points.length>1);
      for(const outer of [true,false])for(const r of group){
        trace(g,r.points);g.lineWidth=r.width+(outer?(kind==='river'?5:4):0);
        g.strokeStyle=kind==='river'?(outer?'#8fae96':'#498e9f'):(outer?'#7f8967':'#dfcc9c');g.stroke();
      }
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
      if(!r||!['river','path'].includes(r.kind)||!Number.isFinite(r.width)||r.width<1||r.width>180||!Array.isArray(r.points)||r.points.length<2||(count+=r.points.length)>100000)throw Error('Trajeto inválido.');
      const points=r.points.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>=1600||p.y<0||p.y>=1100)throw Error('Ponto de trajeto inválido.');return {x:p.x,y:p.y};});
      return {kind:r.kind,width:r.width,points};
    });
  }
  function build(layers,planet){
    const vertices=[],hex=c=>c.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
    const vertex=(p,color,kind,u,v,lift)=>{const x=p.x+(planet?3200:0),y=p.y+(planet?1650:0),h=Math.max(0,Terrain.sample(layers,p.x,p.y)||0)*.065;vertices.push(x,y,h,x/(planet?8000:1600),y/(planet?4400:1100),kind,...color,lift*(planet?.37:1),0,0,1,u,v);};
    for(const layer of layers)if(layer.visible&&layer.opacity)for(const route of layer.routes||[]){
      const points=[route.points[0]];
      for(let i=1;i<route.points.length-1;i++){const a=points.at(-1),b=route.points[i],c={x:(b.x+route.points[i+1].x)/2,y:(b.y+route.points[i+1].y)/2},steps=Math.max(1,Math.ceil((Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(c.x-b.x,c.y-b.y))/6));for(let j=1;j<=steps;j++){const t=j/steps,q=1-t;points.push({x:q*q*a.x+2*q*t*b.x+t*t*c.x,y:q*q*a.y+2*q*t*b.y+t*t*c.y});}}
      {const a=points.at(-1),b=route.points.at(-1),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));for(let j=1;j<=steps;j++)points.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});}
      for(const bank of [true,false]){let distance=0;for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<.01)continue;const width=route.width+(bank?4:0),nx=-(b.y-a.y)/len*width/2,ny=(b.x-a.x)/len*width/2;
        const p=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}],color=hex(bank?(route.kind==='river'?'#8fae96':'#7f8967'):route.kind==='river'?'#498e9f':'#d6c29b'),kind=route.kind==='river'&&!bank?10:9;
        for(const k of [0,1,2,0,2,3])vertex(p[k],color,kind,distance+(k===1||k===2?len:0),k<2?0:width,bank?.2:.3);distance+=len;
      }}
    }
    return{vertices:new Float32Array(vertices)};
  }
  return {draw,erase,validate,distance,build};
})();
