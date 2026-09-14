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
  return {draw,erase,validate,distance};
})();
