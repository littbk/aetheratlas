'use strict';
// Architectural parts are stored as small 2D footprints and extruded against the terrain.
const Structures=(()=>{
  let nextGroup=0;
  const elevations={wall:12,room:12,corridor:8,rect:8,ellipse:8,line:1,door:11,window:10,stairs:8,pillar:12,pit:-10};
  const rgb=value=>{const hex=(value||'#888888').match(/[0-9a-f]{2}/gi)||['88','88','88'];return hex.slice(0,3).map(v=>parseInt(v,16)/255);};
  const normalize=part=>{
    const points=(part.points||[]).map(p=>Array.isArray(p)?{x:+p[0],y:+p[1]}:{x:+p.x,y:+p.y});
    if(points.length<2||points.length>128||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
    return{points,close:!!part.close,fill:part.fill||null,stroke:part.stroke||null,width:Math.max(1,Math.min(180,+part.lineWidth||2))};
  };
  function capture(kind,parts,size,options={}){
    const source=parts.map(normalize).filter(Boolean);if(!source.length)return [];
    const thickness=Math.max(3,Math.min(60,size*.32)),height=Math.max(6,Math.min(80,options.height||26));
    const primary=source.find(p=>p.fill)||source.find(p=>p.stroke&&!['#242c2b','#202927','#252c29'].includes(p.stroke))||source[0];
    const color=options.color||primary.fill||primary.stroke||'#b6ad98',wallMaterial=options.material==='wood'?'wood':'stone',floorMaterial=options.material==='wood'?'wood':'tile';
    const points=primary.points;
    const groupId=globalThis.crypto?.randomUUID?.()||'construction-'+Date.now()+'-'+(++nextGroup);
    const piece=(points,fill,lift,width=thickness,tint=color,material=fill?floorMaterial:wallMaterial,close=true,base=0)=>({points:points.map(p=>({...p})),fill,height:lift,width,color:tint,material,kind,close,base,groupId,planDynamic:true});
    if(['bridgeWood','bridgeIron','bridgeSuspension'].includes(kind))return[piece(points,false,height,thickness,color,kind==='bridgeWood'?'wood':'metal',false)];
    if(kind==='wall'||kind==='line')return[piece(points,false,kind==='line'?1:height,kind==='line'?Math.max(2,thickness*.3):thickness,color,wallMaterial,false)];
    if(kind==='room')return[piece(points,true,.8),piece(points,false,height)].map(p=>({...p,foundationPoints:points.map(v=>({...v}))}));
    if(kind==='corridor')return[piece(points,true,.8),piece([points[0],points[1]],false,height,thickness,color,wallMaterial,false),piece([points[3],points[2]],false,height,thickness,color,wallMaterial,false)];
    if(['floor','rectFill','ellipseFill'].includes(kind))return[piece(points,true,.8)];
    if(kind==='rect'||kind==='ellipse')return[piece(points,false,height)];
    if(kind==='pillar')return[piece(points,true,height,thickness,color,wallMaterial)];
    if(kind==='pit')return[piece(points,true,0,2,'#333c3e','stone'),piece(points,false,2.5,Math.max(3,thickness*.4))];
    if(kind==='stairs'){
      const x0=Math.min(...points.map(v=>v.x)),x1=Math.max(...points.map(v=>v.x)),y0=Math.min(...points.map(v=>v.y)),y1=Math.max(...points.map(v=>v.y)),horizontal=x1-x0>=y1-y0;
      const count=Math.max(3,Math.min(24,Math.round(Math.max(x1-x0,y1-y0)/12)));
      return Array.from({length:count},(_,i)=>{
        const a=horizontal?x0+(x1-x0)*i/count:y0+(y1-y0)*i/count,b=horizontal?x0+(x1-x0)*(i+1)/count:y0+(y1-y0)*(i+1)/count;
        const footprint=horizontal?[{x:a,y:y0},{x:b,y:y0},{x:b,y:y1},{x:a,y:y1}]:[{x:x0,y:a},{x:x1,y:a},{x:x1,y:b},{x:x0,y:b}];
        return{...piece(footprint,true,1+(i+1)*height/count,2,color,wallMaterial),foundationPoints:points.map(p=>({...p}))};
      });
    }
    if(kind==='door'||kind==='window'){
      const [a,b]=source[0].points,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      const segment=(start,end,width,h,base,tint,material)=>piece([{x:a.x+dx*start+nx*width/2,y:a.y+dy*start+ny*width/2},{x:a.x+dx*end+nx*width/2,y:a.y+dy*end+ny*width/2},{x:a.x+dx*end-nx*width/2,y:a.y+dy*end-ny*width/2},{x:a.x+dx*start-nx*width/2,y:a.y+dy*start-ny*width/2}],true,h,2,tint,material,true,base);
      const edge=Math.min(.22,Math.max(.08,3/len)),top=height;
      const pieces=[segment(0,edge,thickness,top,0,color,'stone'),segment(1-edge,1,thickness,top,0,color,'stone'),segment(0,1,thickness+1,top+2,top-1,color,'stone')];
      if(kind==='door'){
        pieces.push(segment(edge,1-edge,Math.max(2,thickness*.3),top-1,0,'#916642','wood'));
        for(const z of [top*.2,top*.77])pieces.push(segment(edge,1-edge,thickness*.36,z+.7,z,'#45484b','metal'));
      }else{
        pieces.push(segment(0,1,thickness+2,top*.25,top*.25-2,color,'stone'),segment(edge,1-edge,2,top-1,top*.25,'#729fa6','glass'));
        pieces.push(segment(.48,.52,3,top-1,top*.25,'#625a4c','metal'),segment(edge,1-edge,3,top*.65,top*.65-1,'#625a4c','metal'));
      }
      return pieces;
    }
    return [];
  }
  // Convex footprints use inset rings, giving masonry a real chamfer rather than a painted outline.
  const area=poly=>poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p.x*q.y-q.x*p.y;},0);
  function offsetPath(points,d,closed=true){
    return points.map((p,i)=>{
      const prev=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length];
      let ax=p.x-prev.x,ay=p.y-prev.y,bx=next.x-p.x,by=next.y-p.y;
      if(!closed&&i===0){ax=bx;ay=by;}if(!closed&&i===points.length-1){bx=ax;by=ay;}
      const al=Math.hypot(ax,ay)||1,bl=Math.hypot(bx,by)||1;ax/=al;ay/=al;bx/=bl;by/=bl;
      const den=Math.max(.25,1+ax*bx+ay*by);
      return{x:p.x+(-ay-by)*d/den,y:p.y+(ax+bx)*d/den};
    });
  }
  function footprints(part){
    if(part.fill)return [part.points];
    const l=offsetPath(part.points,part.width/2,part.close),r=offsetPath(part.points,-part.width/2,part.close),out=[];
    for(let i=0;i<(part.close?part.points.length:part.points.length-1);i++){const j=(i+1)%part.points.length;out.push([l[i],l[j],r[j],r[i]]);}
    return out;
  }
  function wallSpans(part,height,base,openings){
    const polygons=footprints(part);if(part.fill||height<7)return polygons.map(poly=>({poly,height,base}));
    const out=[];
    for(let i=0;i<polygons.length;i++){
      const a=part.points[i],b=part.points[(i+1)%part.points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)continue;
      const poly=polygons[i],cuts=[];
      for(const opening of openings){
        const [p,q,r,t]=opening.points,oa={x:(p.x+t.x)/2,y:(p.y+t.y)/2},ob={x:(q.x+r.x)/2,y:(q.y+r.y)/2},odx=ob.x-oa.x,ody=ob.y-oa.y,ol=Math.hypot(odx,ody);
        if(ol<.01||Math.abs((dx*odx+dy*ody)/(length*ol))<.95)continue;
        if(Math.abs(dx*(oa.y-a.y)-dy*(oa.x-a.x))/length>part.width*.6+Math.hypot(p.x-t.x,p.y-t.y)*.5)continue;
        const u=((oa.x-a.x)*dx+(oa.y-a.y)*dy)/(length*length),v=((ob.x-a.x)*dx+(ob.y-a.y)*dy)/(length*length),start=Math.max(0,Math.min(u,v)),end=Math.min(1,Math.max(u,v));
        if(end>start)cuts.push({start,end,bottom:opening.kind==='window'?(opening.height-2)*.25:0,top:opening.height});
      }
      const sub=(start,end,h,base)=>{if(end-start<.0001||h<=base)return;const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});out.push({poly:[lerp(poly[0],poly[1],start),lerp(poly[0],poly[1],end),lerp(poly[3],poly[2],end),lerp(poly[3],poly[2],start)],height:h,base});};
      let cursor=0;
      for(const cut of cuts.sort((a,b)=>a.start-b.start)){sub(cursor,cut.start,height,base);const start=Math.max(cursor,cut.start);sub(start,cut.end,Math.min(height,cut.bottom),base);sub(start,cut.end,height,Math.max(base,cut.top));cursor=Math.max(cursor,cut.end);}
      sub(cursor,1,height,base);
    }
    return out;
  }
  function build(layers,planet){
    Terrain.freezeLayers(layers);const vertices=[];let material=3,foundation=0;
    const openings=layers.filter(l=>l.visible!==false&&l.opacity!==0).flatMap(l=>(l.structures||[]).filter(p=>['door','window'].includes(p.kind)&&p.fill&&p.points.length===4&&p.base>3&&p.height-p.base<=3.1));
    const altitude=(x,y)=>Math.max(0,Terrain.sample(layers,x,y)||0)*.065;
    const vertex=(p,h,t,n,u,v)=>{const wx=p.x+(planet?3200:0),wy=p.y+(planet?1650:0);vertices.push(wx,wy,foundation,wx/(planet?8000:1600),wy/(planet?4400:1100),material,...t,h*(planet?.37:1),...n,u,v);};
    const face=(a,b,c,ha,hb,hc,t,uv)=>{
      const ab=[b.x-a.x,b.y-a.y,hb-ha],ac=[c.x-a.x,c.y-a.y,hc-ha],n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...n)||1;
      for(let i=0;i<3;i++)n[i]/=len;
      vertex(a,ha,t,n,...uv[0]);vertex(b,hb,t,n,...uv[1]);vertex(c,hc,t,n,...uv[2]);
    };
    const prism=(raw,h,t,base=0,bevel=.65)=>{
      if(raw.length<3||h<=base+.01)return;
      const poly=area(raw)<0?[...raw].reverse():raw,n=poly.length;
      const shortest=Math.min(...poly.map((p,i)=>Math.hypot(p.x-poly[(i+1)%n].x,p.y-poly[(i+1)%n].y)));
      bevel=Math.min(bevel,(h-base)*.22,shortest*.15);
      const top=offsetPath(poly,bevel),shoulder=h-bevel,sideMaterial=material;
      // Trim and steps have unbroken dressed-stone surfaces, while floors keep their slabs.
      if(material===3)material=8;
      for(let i=1;i<n-1;i++)face(top[0],top[i],top[i+1],h,h,h,t,[[top[0].x,top[0].y],[top[i].x,top[i].y],[top[i+1].x,top[i+1].y]]);
      material=sideMaterial;let distance=0;
      for(let i=0;i<n;i++){
        const j=(i+1)%n,a=poly[i],b=poly[j],ta=top[i],tb=top[j],len=Math.hypot(b.x-a.x,b.y-a.y),u=distance,v=distance+len;
        const ba=base===0?Math.min(0,altitude(a.x,a.y)-foundation):base,bb=base===0?Math.min(0,altitude(b.x,b.y)-foundation):base;
        face(a,b,b,ba,bb,shoulder,t,[[u,ba],[v,bb],[v,shoulder]]);
        face(a,b,a,ba,shoulder,shoulder,t,[[u,ba],[v,shoulder],[u,shoulder]]);
        const m=material;if(material===3)material=8;
        face(a,b,tb,shoulder,shoulder,h,t,[[u,shoulder],[v,shoulder],[v,h]]);
        face(a,tb,ta,shoulder,h,h,t,[[u,shoulder],[v,h],[u,h]]);material=m;distance+=len;
      }
    };
    function bridge(part){
      const [a,b]=part.points,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.01)return;
      const ux=dx/len,uy=dy/len,nx=-uy,ny=ux,half=part.width/2,wood=part.kind==='bridgeWood';
      const color=rgb(part.color),trim=wood?[.34,.22,.13]:[.27,.31,.34];
      const terrain=t=>altitude(a.x+dx*t,a.y+dy*t),start=terrain(0)+1.2,end=terrain(1)+1.2;
      const level=t=>Math.max(start+(end-start)*t,terrain(t)+part.height*.0325*Math.sin(Math.PI*t)**2);
      const at=(t,side)=>({x:a.x+dx*t+nx*side,y:a.y+dy*t+ny*side});
      const quad=(a,b,c,d,za,zb,zc,zd,t)=>{face(a,b,c,za,zb,zc,t,[[a.x,a.y],[b.x,b.y],[c.x,c.y]]);face(a,c,d,za,zc,zd,t,[[a.x,a.y],[c.x,c.y],[d.x,d.y]]);};
      const strip=(t,u,side0,side1,z0,z1,depth,tint,mat)=>{
        material=mat;const p=at(t,side0),q=at(u,side0),r=at(u,side1),s=at(t,side1);
        quad(p,q,r,s,z0,z1,z1,z0,tint);
        quad(s,r,q,p,z0-depth,z1-depth,z1-depth,z0-depth,tint);
        quad(p,q,q,p,z0,z1,z1-depth,z0-depth,tint);
        quad(s,r,r,s,z0-depth,z1-depth,z1,z0,tint);
      };
      const post=(t,side,bottom,top,radius,tint,mat)=>{
        if(top<=bottom)return;material=mat;const p=at(t,side),poly=[{x:p.x+ux*radius+nx*radius,y:p.y+uy*radius+ny*radius},{x:p.x-ux*radius+nx*radius,y:p.y-uy*radius+ny*radius},{x:p.x-ux*radius-nx*radius,y:p.y-uy*radius-ny*radius},{x:p.x+ux*radius-nx*radius,y:p.y+uy*radius-ny*radius}];
        prism(poly,top,tint,bottom,.12);
      };
      const n=Math.max(2,Math.min(60,Math.ceil(len/12)));
      for(let i=0;i<n;i++){
        const t=i/n,u=(i+1)/n,z=level(t),w=level(u);
        strip(t,u,-half,half,z,w,wood?1.4:1.1,color,wood?4:6);
        if(wood)strip(t,u,-half,half,z-.5,w-.5,.22,trim,4);
        for(const side of [-1,1]){
          const edge=side*half;
          strip(t,u,edge-.45,edge+.45,z+3.7,w+3.7,.55,trim,wood?4:6);
          if(!wood)strip(t,u,edge-.7,edge+.7,z-.65,w-.65,.65,trim,6);
        }
      }
      for(let i=0;i<=n;i+=Math.max(1,Math.round(n/Math.max(2,len/18))))for(const side of [-1,1]){const t=i/n,z=level(t);post(t,side*half,z,z+4,.4,trim,wood?4:6);}
      if(part.kind==='bridgeSuspension'){
        const tower=Math.max(7,Math.min(23,part.height*.6));
        const cable=t=>t<.18?level(0)+tower*t/.18:t>.82?level(1)+tower*(1-t)/.18:level(t)+tower*(.38+.62*(Math.abs(t-.5)/.32)**1.5);
        for(const side of [-1,1]){
          for(const t of [.18,.82])post(t,side*half,level(t),level(t)+tower,.8,trim,6);
          for(let i=0;i<n;i++){const t=i/n,u=(i+1)/n;strip(t,u,side*half-.22,side*half+.22,cable(t),cable(u),.4,trim,6);}
          for(let i=2;i<n;i+=2){const t=i/n;post(t,side*half,level(t)+3,cable(t),.18,trim,6);}
        }
      }else for(const t of [.2,.5,.8]){const z=level(t),g=terrain(t);if(z-g>2)for(const side of [-1,1])post(t,side*(half-.6),g,z,wood?.7:.55,trim,wood?4:6);}
    }
    for(const layer of layers)if(layer.visible!==false&&layer.opacity!==0)for(const part of layer.structures||[]){
      if(['bridgeWood','bridgeIron','bridgeSuspension'].includes(part.kind)){foundation=part.elevation||0;bridge(part);continue;}
      if(part.kind==='pit'&&part.fill)continue;
      if(part.kind&&!part.fill&&part.height===0)continue;
      const base=part.base||0,points=part.points,color=rgb(part.color),height=Math.max(0,Math.min(100,+part.height||.65));
      material=({tile:2,stone:3,wood:4,glass:5,metal:6})[part.material]||(part.fill?2:3);
      // A single level foundation prevents terrain samples from twisting floors and treads.
      foundation=0;
      const groundPoints=part.foundationPoints||points;
      for(let i=0;i<groundPoints.length;i++){const a=groundPoints[i],b=groundPoints[(i+1)%groundPoints.length],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/20);for(let j=0;j<=steps;j++){const t=j/(steps||1);foundation=Math.max(foundation,altitude(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t));}}
      if(part.fill||part.foundationPoints){
        const xs=groundPoints.map(p=>p.x),ys=groundPoints.map(p=>p.y);
        for(let y=Math.min(...ys);y<=Math.max(...ys);y+=24)for(let x=Math.min(...xs);x<=Math.max(...xs);x+=24)foundation=Math.max(foundation,altitude(x,y));
      }
      foundation+=part.elevation||0;
      if(part.fill&&part.kind==='pillar'){
        const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;
        const scaled=k=>points.map(p=>({x:cx+(p.x-cx)*k,y:cy+(p.y-cy)*k}));material=8;
        prism(points,2.2,color,0,.65);prism(scaled(.88),4,color,2, .55);
        prism(scaled(.70),height-2,color,3.6,.4);prism(scaled(.83),height,color,height-3,.65);prism(points,height+2,color,height-.2,.7);
      }else for(const span of wallSpans(part,height,base,openings)){
        const {poly,height:spanHeight,base:spanBase}=span;
        const m=material;if(part.kind==='stairs')material=8;
        prism(poly,spanHeight,color,spanBase,part.material==='glass'?.1:.65);material=m;
        if(!part.fill&&spanHeight===height&&height>=7&&material===3){
          material=8;prism(offsetPath(area(poly)<0?[...poly].reverse():poly,-.6),height+1.3,color,height-.5,.5);material=m;
        }
      }
    }
    return{vertices:new Float32Array(vertices),stride:15};
  }
  function shadows(layers){
    const c=document.createElement('canvas');c.width=1600;c.height=1100;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
    for(const layer of layers)if(layer.visible!==false&&layer.opacity!==0)for(const part of layer.structures||[]){
      if(part.height<3||part.base>3)continue;
      for(const poly of footprints(part)){
        g.save();g.globalAlpha=(layer.opacity??1)*.22;g.fillStyle='#252d38';g.shadowColor='#172333';g.shadowBlur=6;g.shadowOffsetX=part.height*.45;g.shadowOffsetY=part.height*.6;
        g.beginPath();poly.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();g.restore();
      }
    }
    return c;
  }
  // CPU textures have stable detail at every zoom; mipmaps remove distant grain and aliasing.
  let textureCache;
  const planPatterns=new Map();
  function textures(){
    if(textureCache)return textureCache;
    const size=512,canvases={};let seed=7291;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(const type of ['stone','tile','wood','trim']){
      const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle='#b9b9b9';g.fillRect(0,0,size,size);
      const block=(x,y,w,h)=>{
        const light=Math.round(213+random()*23),pad=type==='tile'?2.5:2;
        g.fillStyle=`rgb(${light},${light},${light})`;g.fillRect(x+pad,y+pad,w-pad*2,h-pad*2);
        const grad=g.createLinearGradient(x,y,x+w*.4,y+h);grad.addColorStop(0,'#ffffff25');grad.addColorStop(.2,'#ffffff08');grad.addColorStop(1,'#00000012');g.fillStyle=grad;g.fillRect(x+pad,y+pad,w-pad*2,h-pad*2);
        g.strokeStyle='#ffffff36';g.lineWidth=1;g.beginPath();g.moveTo(x+pad,y+h-pad);g.lineTo(x+pad,y+pad);g.lineTo(x+w-pad,y+pad);g.stroke();
        g.strokeStyle='#0000001a';g.beginPath();g.moveTo(x+w-pad,y+pad);g.lineTo(x+w-pad,y+h-pad);g.lineTo(x+pad,y+h-pad);g.stroke();
      };
      if(type==='stone'){for(let row=0;row<8;row++)for(let col=-1;col<4;col++)block(col*128+(row%2)*64,row*64,128,64);}
      else if(type==='tile'){for(let row=0;row<4;row++)for(let col=0;col<4;col++)block(col*128,row*128,128,128);}
      else if(type==='wood'){
        for(let i=0;i<8;i++){block(i*64,0,64,512);for(let j=0;j<28;j++){const x=i*64+5+random()*54;g.strokeStyle=`rgba(40,40,40,${.015+random()*.055})`;g.lineWidth=.5+random();g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x+random()*12-6,170,x+random()*12-6,340,x,512);g.stroke();}}
      }else{g.fillStyle='#e4e4e4';g.fillRect(0,0,512,512);}
      const data=g.getImageData(0,0,size,size),source=new Uint8ClampedArray(data.data);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=(y*size+x)*4,n=(random()-.5)*3.5+Math.sin(x*.057+y*.036)*1.2;
        const dx=source[(y*size+(x+1)%size)*4]-source[(y*size+(x+size-1)%size)*4],dy=source[(((y+1)%size)*size+x)*4]-source[(((y+size-1)%size)*size+x)*4];
        data.data[i]=Math.max(0,Math.min(255,source[i]+n));data.data[i+1]=128-dx*.6;data.data[i+2]=128-dy*.6;data.data[i+3]=255;
      }
      g.putImageData(data,0,0);canvases[type]=c;
    }
    return textureCache=canvases;
  }
  function paintPlan(g,parts){
    for(const part of parts){
      const type=part.material==='wood'?'wood':part.fill?'tile':'stone',key=type+part.color;
      if(!planPatterns.has(key)){
        const source=textures()[type],c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),data=source.getContext('2d').getImageData(0,0,512,512),tint=rgb(part.color);
        for(let i=0;i<data.data.length;i+=4){const light=data.data[i];data.data[i]=light*tint[0];data.data[i+1]=light*tint[1];data.data[i+2]=light*tint[2];}
        ctx.putImageData(data,0,0);planPatterns.set(key,c);if(planPatterns.size>48)planPatterns.delete(planPatterns.keys().next().value);
      }
      g.save();const pattern=g.createPattern(planPatterns.get(key),'repeat');pattern.setTransform(new DOMMatrix().scale((type==='tile'?96:64)/512));
      g.fillStyle=pattern;g.strokeStyle=pattern;g.lineWidth=part.width;g.lineJoin='miter';g.lineCap='butt';g.beginPath();part.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));if(part.close)g.closePath();if(part.fill)g.fill();else g.stroke();g.restore();
    }
  }
  function validate(items){
    if(!Array.isArray(items)||items.length>3000)throw Error('Construções 3D inválidas.');
    return items.map(item=>{
      if(!item||(item.groupId!==undefined&&(typeof item.groupId!=='string'||item.groupId.length>100))||(item.planDynamic!==undefined&&typeof item.planDynamic!=='boolean')||(item.foundationPoints!==undefined&&(!Array.isArray(item.foundationPoints)||item.foundationPoints.length<3||item.foundationPoints.length>128||item.foundationPoints.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>=1600||p.y<0||p.y>=1100)))||(item.elevation!==undefined&&(!Number.isFinite(item.elevation)||item.elevation< -100||item.elevation>500))||(item.base!==undefined&&(!Number.isFinite(item.base)||item.base<0||item.base>100))||(item.material!==undefined&&!['stone','tile','wood','glass','metal'].includes(item.material))||(item.kind!==undefined&&!['wall','room','corridor','floor','rect','rectFill','ellipse','ellipseFill','line','door','window','stairs','pillar','pit','bridgeWood','bridgeIron','bridgeSuspension'].includes(item.kind))||!Array.isArray(item.points)||item.points.length<2||item.points.length>128||item.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>=1600||p.y<0||p.y>=1100)||!Number.isFinite(item.width)||item.width<1||item.width>180||!Number.isFinite(item.height)||item.height< -100||item.height>100||typeof item.fill!=='boolean'||!/^#[0-9a-f]{6,8}$/i.test(item.color))throw Error('Construção 3D inválida.');
      return item;
    });
  }
  const segments=part=>part.points.slice(0,part.close?undefined:-1).map((p,i)=>[p,part.points[(i+1)%part.points.length]]);
  function touches(a,b){
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    return segments(a).some(([p,q])=>segments(b).some(([r,s])=>{
      const u=cross(p,q,r),v=cross(p,q,s),w=cross(r,s,p),z=cross(r,s,q);
      if(u*v<0&&w*z<0)return true;
      return Math.min(distance(p,r,s),distance(q,r,s),distance(r,p,q),distance(s,p,q))<=(a.width+b.width)/2+.5;
    }));
  }
  function connected(items,object,autoWalls=true){
    const result=new Set([object]),wall=p=>!p.fill&&['wall','room','corridor','rect','ellipse'].includes(p.kind);
    let added=true;while(added){added=false;for(const p of items)if(!result.has(p)&&[...result].some(q=>p.groupId&&p.groupId===q.groupId||!p.groupId&&!q.groupId&&p.kind===q.kind&&p.foundationPoints&&q.foundationPoints&&JSON.stringify(p.foundationPoints)===JSON.stringify(q.foundationPoints)||autoWalls&&wall(p)&&wall(q)&&touches(p,q))){result.add(p);added=true;}}
    return [...result];
  }
  // Legacy projects baked the architectural plan into the shared ink canvas.
  // Separate those footprints once before editing so moves never leave a ghost.
  function prepareEdit(layer){
    const legacy=(layer.structures||[]).filter(p=>!p.planDynamic);if(!legacy.length)return;
    if(layer.ink){const g=layer.ink.getContext('2d');g.save();g.globalCompositeOperation='destination-out';paintPlan(g,legacy);g.restore();}
    for(const p of legacy)p.planDynamic=true;
  }
  function drawPlan(g,items){paintPlan(g,(items||[]).filter(p=>p.planDynamic));}
  return{capture,build,validate,textures,shadows,paintPlan,drawPlan,prepareEdit,connected,touches,footprints};
})();

