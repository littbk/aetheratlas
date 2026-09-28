'use strict';
// Meshes for the existing building markers. Geometry is generated from saved marker data.
const Buildings3D=(()=>{
  const types=new Set(['house','village','tower','castle','temple','bridge','camp','ruin','windmill','tunnel','cave']);
  const footprints={house:[31,29],village:[70,62],tower:[27,27],castle:[76,70],temple:[55,47],bridge:[62,22],camp:[37,35],ruin:[43,40],windmill:[38,38],tunnel:[41,35],cave:[41,35]};
  const colors={stone:[.75,.72,.61],plaster:[.84,.77,.62],roof:[.57,.29,.21],roofDark:[.38,.20,.17],wood:[.31,.22,.16],door:[.18,.27,.25],paving:[.58,.57,.51],trim:[.86,.79,.61]};
  let groundCache=new WeakMap();
  function ground(o,layers,key=o){
    const cached=groundCache.get(key);
    if(cached&&cached.layers===layers&&cached.x===o.x&&cached.y===o.y&&cached.size===o.size&&cached.rotation===o.rotation)return cached.result;
    const global=layers.some(l=>l.planet?.enabled),altitude=(x,y)=>Math.max(0,Terrain.sample(layers,global?x:Math.max(0,Math.min(1599,x)),global?y:Math.max(0,Math.min(1099,y)))||0)*.065;
    const scale=o.size/80,angle=o.rotation*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),[width,depth]=footprints[o.building];
    const stepsX=Math.max(4,Math.ceil(width*scale/6)),stepsY=Math.max(4,Math.ceil(depth*scale/6));
    let highest=0,lowest=Infinity;
    for(let iy=0;iy<=stepsY;iy++)for(let ix=0;ix<=stepsX;ix++){
      const x=(ix/stepsX-.5)*width*scale,y=(iy/stepsY-.5)*depth*scale;
      const h=altitude(o.x+x*ca-y*sa,o.y+x*sa+y*ca);
      highest=Math.max(highest,h);lowest=Math.min(lowest,h);
    }
    const result={highest,lowest};groundCache.set(key,{layers,x:o.x,y:o.y,size:o.size,rotation:o.rotation,result});return result;
  }
  function near(o,camera,scene){
    if(!scene.gl||!types.has(o.building)||camera.relief<.1)return false;
    const p=scene.project(o.x,o.y,0,camera);
    if(p.visible===false)return false;
    const pixels=scene.firstPerson?o.size*scene.firstPerson.focal/Math.max(1,p.w):o.size*camera.zoom/Math.max(.2,p.w)*(camera.planet?.5:1);
    return pixels>=36;
  }
  function build(layers,planet){
    Terrain.freezeLayers(layers);
    const vertices=[],entries=[];
    for(let layer=0;layer<layers.length;layer++){
      const source=layers[layer];if(source.visible===false||source.opacity===0)continue;
      for(const o of source.objects||[]){if(o.kind!=='building'||!types.has(o.building))continue;
        const first=vertices.length/15,scale=o.size/80,angle=o.rotation*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),planetScale=planet?.37:1;
        const {highest,lowest}=ground(o,layers);
        const base=highest+.8+(o.elevation||0),foundationDepth=Math.min(80,highest-lowest);
        const world=p=>({x:o.x+(p[0]*ca-p[1]*sa)*scale,y:o.y+(p[0]*sa+p[1]*ca)*scale,z:base+p[2]*scale});
        const vertex=(p,tint,material,normal,uv)=>{const wx=p.x+(planet?3200:0),wy=p.y+(planet?1650:0);vertices.push(wx,wy,base,wx/(planet?8000:1600),wy/(planet?4400:1100),material,...tint,(p.z-base)*planetScale,...normal,...uv);};
        const triangle=(a,b,c,tint,material,uv)=>{
          const p=world(a),q=world(b),r=world(c),u=[q.x-p.x,q.y-p.y,q.z-p.z],v=[r.x-p.x,r.y-p.y,r.z-p.z];
          const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal)||1;
          for(let i=0;i<3;i++)normal[i]/=length;
          [p,q,r].forEach((point,i)=>vertex(point,tint,material,normal,uv?.[i]||[point.x,point.y]));
        };
        const quad=(a,b,c,d,tint,material)=>{triangle(a,b,c,tint,material);triangle(a,c,d,tint,material);};
        const box=(x,y,w,d,z,h,tint,material)=>{
          const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],A=[a[0],a[1],z+h],B=[b[0],b[1],z+h],C=[c[0],c[1],z+h],E=[e[0],e[1],z+h];
          quad(A,B,C,E,tint,material);quad(a,b,B,A,tint,material);quad(b,c,C,B,tint,material);quad(c,e,E,C,tint,material);quad(e,a,A,E,tint,material);
        };
        const roof=(x,y,w,d,z,rise,tint)=>{
          const l=y-d/2,r=y+d/2,m=y;
          quad([x-w/2,l,z],[x+w/2,l,z],[x+w/2,m,z+rise],[x-w/2,m,z+rise],tint,2);
          quad([x-w/2,m,z+rise],[x+w/2,m,z+rise],[x+w/2,r,z],[x-w/2,r,z],tint,2);
          triangle([x-w/2,l,z],[x-w/2,m,z+rise],[x-w/2,r,z],colors.roofDark,3);
          triangle([x+w/2,r,z],[x+w/2,m,z+rise],[x+w/2,l,z],colors.roofDark,3);
        };
        const paving=(x,y,w,d)=>{
          if(foundationDepth>.5)box(x,y,w,d,-foundationDepth/scale,.1+foundationDepth/scale,colors.stone,3);
          box(x,y,w,d,.1,.55,colors.paving,2);
          for(let v=-d/2+5;v<d/2;v+=7)box(x,y+v,w-.7,.45,.67,.12,colors.trim,8);
        };
        const column=(x,y,r,z,h,sides,tint,mat)=>{
          const ring=(i,level)=>[x+Math.cos(i*Math.PI*2/sides)*r,y+Math.sin(i*Math.PI*2/sides)*r,level];
          for(let i=0;i<sides;i++)quad(ring(i,z),ring(i+1,z),ring(i+1,z+h),ring(i,z+h),tint,mat);
          for(let i=1;i<sides-1;i++)triangle(ring(0,z+h),ring(i,z+h),ring(i+1,z+h),tint,mat);
        };
        const house=(x,y,s=1)=>{
          box(x,y,21*s,17*s,.6,15*s,colors.plaster,3);
          roof(x,y,25*s,21*s,.6+15*s,8*s,colors.roof);
          box(x,y-8.6*s,5*s,1*s,.6,8*s,colors.door,4);
          for(const side of [-1,1])box(x+side*7*s,y-8.7*s,3.2*s,.8*s,8*s,3.6*s,colors.roofDark,5);
        };
        const tower=(x,y,s=1)=>{
          box(x,y,15*s,15*s,.6,31*s,colors.stone,3);
          box(x,y,19*s,19*s,30*s,3*s,colors.trim,8);
          for(const dx of [-7,0,7])for(const dy of [-7,7])box(x+dx*s,y+dy*s,4*s,4*s,33*s,4*s,colors.stone,3);
          box(x,y-7.8*s,4*s,.8*s,.6,8*s,colors.door,4);
          box(x,y-7.9*s,3*s,.9*s,18*s,4*s,colors.roofDark,5);
        };
        if(o.building==='house'){paving(0,0,31,29);house(0,0);}
        if(o.building==='village'){
          paving(0,0,70,62);house(-19,-14,.85);house(18,-13,.9);house(-17,15,.78);house(18,16,.82);
          box(0,0,9,60,.7,.12,colors.trim,8);box(0,0,67,8,.7,.12,colors.trim,8);
        }
        if(o.building==='tower'){paving(0,0,27,27);tower(0,0);}
        if(o.building==='castle'){
          paving(0,0,76,70);box(0,0,52,43,.6,17,colors.stone,3);
          box(0,0,56,47,17,2,colors.trim,8);
          for(const x of [-27,27])for(const y of [-23,23])tower(x,y,.78);
          box(0,-22,8,1,.6,13,colors.door,4);
          box(0,5,23,22,19,18,colors.plaster,3);roof(0,5,27,26,37,10,colors.roofDark);
        }
        if(o.building==='temple'){
          paving(0,0,55,47);box(0,3,43,30,.7,2,colors.stone,3);
          for(const x of [-17,-6,6,17])for(const y of [-13,17])column(x,y,1.7,2.7,19,8,colors.trim,3);
          box(0,2,49,38,22,3,colors.trim,8);roof(0,2,52,41,25,12,colors.roofDark);
          box(0,-14,7,1,2,14,colors.door,4);
        }
        if(o.building==='bridge'){
          for(let i=0;i<6;i++){const x=-25+i*10;box(x,0,10,16,3+Math.sin((i+.5)/6*Math.PI)*2,1.3,colors.wood,4);}
          for(const y of [-9,9]){box(0,y,58,1.4,4,2,colors.stone,3);for(const x of [-25,-13,0,13,25])box(x,y,2,2,4,7,colors.stone,3);}
          paving(-26,0,10,22);paving(26,0,10,22);
        }
        if(o.building==='camp'){
          paving(0,0,37,35);const fabric=[.70,.49,.31];
          quad([-15,-11,.8],[15,-11,.8],[15,0,20],[-15,0,20],fabric,2);
          quad([-15,0,20],[15,0,20],[15,11,.8],[-15,11,.8],fabric,2);
          triangle([-15,-11,.8],[0,0,20],[-15,11,.8],colors.roofDark,2);
          triangle([15,11,.8],[0,0,20],[15,-11,.8],colors.roofDark,2);
          box(0,-11.2,7,.5,.8,8,colors.door,4);
        }
        if(o.building==='ruin'){
          paving(0,0,43,40);box(-15,-7,5,26,.7,17,colors.stone,3);box(12,-11,5,18,.7,12,colors.stone,3);
          box(-4,11,34,5,.7,8,colors.stone,3);box(0,-17,24,4,.7,6,colors.stone,3);
          for(const [x,y,h] of [[-15,-7,4],[12,-11,5],[-4,11,3]])box(x,y,7,7,h,2,colors.trim,8);
        }
        if(o.building==='windmill'){
          paving(0,0,38,38);column(0,0,10,.7,30,10,colors.plaster,3);
          for(let i=0;i<10;i++)triangle([0,0,42],[Math.cos(i*Math.PI/5)*12,Math.sin(i*Math.PI/5)*12,30],[Math.cos((i+1)*Math.PI/5)*12,Math.sin((i+1)*Math.PI/5)*12,30],colors.roof,2);
          box(0,-10.2,5,.8,.7,8,colors.door,4);
          for(let i=0;i<4;i++){const a=i*Math.PI/2,c=Math.cos(a),s=Math.sin(a),p=(r,w)=>[c*r-s*w,-12,s*r+c*w+28];quad(p(3,-1.2),p(22,-3),p(22,3),p(3,1.2),colors.trim,4);}
        }
        if(o.building==='tunnel'||o.building==='cave'){
          paving(0,4,41,27);const rock=o.building==='cave'?[.44,.50,.45]:colors.stone;
          box(-13,0,11,22,.7,19,rock,3);box(13,0,11,22,.7,19,rock,3);
          box(0,0,19,22,16,9,rock,3);box(0,-11.4,14,.6,.7,16,colors.door,8);
          for(const x of [-18,18])box(x,-10,3,3,.7,6,colors.wood,4);
        }
        entries.push({object:o,layer,first,count:vertices.length/15-first});
      }
    }
    return{vertices:new Float32Array(vertices),entries};
  }
  return{build,ground,near,types,invalidate(){groundCache=new WeakMap();}};
})();
