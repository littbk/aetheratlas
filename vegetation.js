'use strict';
// Low-poly tree meshes in map coordinates: trunks, crowns and palm fronds.
const Vegetation=(()=>{
  const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  function build(layers,planet,include=null){
    if(!include)Terrain.freezeLayers(layers);
    const groundCover={20:['rock','#a7a193'],21:['flower','#d8be78'],22:['grass','#5c8665'],23:['grass','#a9a052']};
    const vertices=[],theme=Terrain.getTheme(),counts={},entries=[],candidates=[];let count=0;
    const color=value=>value.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
    const sample=(x,y)=>Math.max(0,Terrain.sample(layers,x,y)||0)*.065;
    const surface=(x,y)=>{
      const dx=planet?8000/192:20,dy=planet?4400/96:20,ox=planet?3200:0,oy=planet?1650:0;
      const x0=Math.floor((x+ox)/dx)*dx-ox,y0=Math.floor((y+oy)/dy)*dy-oy,u=(x-x0)/dx,v=(y-y0)/dy;
      const a=sample(x0,y0),b=sample(x0+dx,y0),c=sample(x0,y0+dy),d=sample(x0+dx,y0+dy);
      return (u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v))+.2;
    };
    for(let gy=15;gy<1090;gy+=27)for(let gx=15;gx<1590;gx+=27){
      const n=random(gx,gy);if(n<.22||candidates.length>=2200)continue;
      const x=gx+(random(gx+8,gy)-.5)*14,y=gy+(random(gx,gy+9)-.5)*14,i=Terrain.index(x,y);
      if(include&&!include({x,y,size:40},'vegetation'))continue;
      let type=0,layer=-1;
      layers.forEach((l,j)=>{if(l.visible&&l.terrain.coverage[i]/255*l.opacity>.35){type=l.terrain.biomes[i];layer=j;}});
      if(!Terrain.isTreeBiome(type)){
        const cover=groundCover[type];if(cover&&n>.56){const object={kind:'decor',decor:cover[0],color:cover[1],seed:n,size:12,rotation:n*360,elevation:0};candidates.push({x,y,n,type,layer,index:i,object,size:object.size});}
        continue;
      }
      const t=layers[layer].terrain;if(t.treeExclusions.has(i))continue;
      const style=t.treeStyles[t.treeStyleIds[i]-1];
      candidates.push({x,y,n,type,layer,index:i,foliage:style.foliage,trunk:style.trunk,size:40});
    }
    layers.forEach((l,layer)=>{if(l.visible&&l.opacity>.05)for(const object of l.objects||[])if(object.kind==='tree')candidates.push({x:object.x,y:object.y,n:object.seed??random(object.x,object.y),type:Terrain.biomes.indexOf(object.species),layer,object,foliage:object.color,trunk:object.trunkColor,size:object.size});});
    layers.forEach((l,layer)=>{if(l.visible&&l.opacity>.05)for(const object of l.objects||[])if(object.kind==='decor')candidates.push({x:object.x,y:object.y,n:object.seed,layer,object,size:object.size});});
    for(const entry of candidates){
      if(include&&!include(entry.object||{x:entry.x,y:entry.y,size:entry.size},'vegetation'))continue;
      if(entry.object?.kind==='decor'){
        const o=entry.object,{x,y}=entry,base=surface(x,y)+(o.elevation||0),s=o.size/12,scale=planet?.37:1,turn=o.rotation*Math.PI/180,cs=Math.cos(turn),sn=Math.sin(turn);
        entry.base=base;entry.height=(o.decor==='bush'?12:o.decor==='rock'?9:8)*s*scale;entry.radius=7*s;entries.push(entry);
        const vertex=(p,tint,shade=1)=>{const wx=x+(p[0]*cs-p[1]*sn)+(planet?3200:0),wy=y+(p[0]*sn+p[1]*cs)+(planet?1650:0);vertices.push(wx,wy,base,wx/(planet?8000:1600),wy/(planet?4400:1100),1,...tint.map(v=>Math.max(0,Math.min(1,v*shade))),p[2]*scale);};
        const tri=(a,b,c,tint,shade=1)=>{vertex(a,tint,shade);vertex(b,tint,shade);vertex(c,tint,shade);};
        const rgb=value=>color(value),green=rgb('#59934d'),stem=rgb('#47744a'),tint=rgb(o.color),cream=rgb('#f0d7a0');
        if(o.decor==='grass'||o.decor==='flower'){
          for(let j=0;j<(o.decor==='grass'?7:5);j++){const a=j*2.399+o.seed*5,reach=(j%3)*1.4*s,px=Math.cos(a)*reach,py=Math.sin(a)*reach,h=(3.8+j%3*1.5)*s;
            const lean=[Math.cos(a)*1.4*s,Math.sin(a)*1.4*s];tri([px-.8*s,py,0],[px+.8*s,py,0],[px+lean[0],py+lean[1],h],j%2?green:tint,.85+j*.04);
          }
          if(o.decor==='flower')for(let j=0;j<3;j++){const px=(j-1)*2.5*s,py=(j%2)*2*s,h=(5+j%2)*s;tri([px,py,h-1*s],[px,py,h+2*s],[px+1*s,py,h],stem);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;tri([px,py,h+2*s],[px+Math.cos(a)*2.2*s,py+Math.sin(a)*2.2*s,h+1.7*s],[px+Math.cos(a+.9)*2.2*s,py+Math.sin(a+.9)*2.2*s,h+1.7*s],tint,1+(k%2)*.12);}tri([px-.7*s,py,h+2.1*s],[px+.7*s,py,h+2.1*s],[px,py+.7*s,h+2.1*s],cream);}
        }else if(o.decor==='rock'){
          const top=[0,0,7*s],mid=[[-5,-3,2],[-3,4,3],[3,5,2],[6,0,3],[3,-5,2]].map(p=>p.map(v=>v*s));
          for(let j=0;j<5;j++){const a=mid[j],b=mid[(j+1)%5];tri(a,b,top,tint,.73+j*.085);tri([a[0]*1.15,a[1]*1.15,0],[b[0]*1.15,b[1]*1.15,0],b,tint,.58+j*.05);tri([a[0]*1.15,a[1]*1.15,0],b,a,tint,.63+j*.05);}
        }else if(o.decor==='bush'){
          for(let j=0;j<3;j++){const px=(j-1)*3*s,py=(j%2)*2*s,r=(4.5+j%2)*s,h=(5+j%2*2)*s;
            for(let k=0;k<6;k++){const a=k*Math.PI/3,b=(k+1)*Math.PI/3;tri([px+Math.cos(a)*r,py+Math.sin(a)*r,1*s],[px+Math.cos(b)*r,py+Math.sin(b)*r,1*s],[px,py,h+4*s],j===1?green:tint,.75+k*.055);}
          }
        }else if(o.decor==='mushroom'){
          for(let j=0;j<3;j++){const px=(j-1)*3.7*s,py=(j%2)*2*s,h=(3+j%2)*s,r=(2.5+j%2)*s;
            for(let k=0;k<6;k++){const a=k*Math.PI/3,b=(k+1)*Math.PI/3;tri([px+Math.cos(a)*.5*s,py+Math.sin(a)*.5*s,0],[px+Math.cos(b)*.5*s,py+Math.sin(b)*.5*s,0],[px,py,h],cream,.83);tri([px+Math.cos(a)*r,py+Math.sin(a)*r,h],[px+Math.cos(b)*r,py+Math.sin(b)*r,h],[px,py,h+2*s],tint,.8+k*.055);}
          }
        }
        count++;counts.decor=(counts.decor||0)+1;continue;
      }
      const {x,y,n,type}=entry,base=surface(x,y)+(entry.object?.elevation||0),scale=planet?.37:1,key=type===2?'trees':Terrain.biomes[type],leaf=color(entry.foliage),trunk=color(entry.trunk),factor=entry.size/40;
      const h=(type===8?31:type===24?36:type===9||type===13||type===26?28:20)*(0.8+n*.45)*factor,r=(type===12||type===27?10:7)*(0.85+n*.3)*factor;
      entry.base=base;entry.height=h*1.2*scale;entry.radius=r*(type===8?1.8:1.1);entries.push(entry);
      const turn=(entry.object?.rotation||0)*Math.PI/180,cs=Math.cos(turn),sn=Math.sin(turn);
      const vertex=(p,tint,shade)=>{
        const wx=x+p[0]*cs-p[1]*sn+(planet?3200:0),wy=y+p[0]*sn+p[1]*cs+(planet?1650:0);
        vertices.push(wx,wy,base,wx/(planet?8000:1600),wy/(planet?4400:1100),1,...tint.map(v=>Math.max(0,Math.min(1,v*shade))),p[2]*scale);
      };
      const triangle=(a,b,c,tint,shade=1)=>{vertex(a,tint,shade);vertex(b,tint,shade);vertex(c,tint,shade);};
      const rings=(levels,sides,tint)=>{
        for(let j=1;j<levels.length;j++)for(let k=0;k<sides;k++){
          const point=(l,a)=>[Math.cos(a)*l[1]+(l[2]||0),Math.sin(a)*l[1],l[0]];
          const a=k/sides*Math.PI*2,b=(k+1)/sides*Math.PI*2;
          const p=point(levels[j-1],a),q=point(levels[j-1],b),s=point(levels[j],a),t=point(levels[j],b);
          const shade=.72+.32*(Math.cos(a-2.4)*.5+.5)+(j/levels.length)*.1;
          triangle(p,q,s,tint,shade);triangle(q,t,s,tint,shade);
        }
      };
      rings([[0,1.2],[h*(type===8?.95:.68),1,type===8?3:0]],5,trunk);
      if(type===8){
        const top=[3,0,h*.95];
        for(let k=0;k<7;k++){
          const a=k/7*Math.PI*2+n,b=[top[0]+Math.cos(a)*r*.65,Math.sin(a)*r*.65,h*1.06],end=[top[0]+Math.cos(a)*r*1.75,Math.sin(a)*r*1.75,h*.72];
          const left=[b[0]-Math.sin(a)*2.1,b[1]+Math.cos(a)*2.1,b[2]],right=[b[0]+Math.sin(a)*2.1,b[1]-Math.cos(a)*2.1,b[2]];
          triangle(top,left,right,leaf,.9);triangle(left,end,right,leaf,1.18);
        }
        rings([[h*.8,0,3],[h*.85,2.2,3],[h*.9,0,3]],5,trunk);
      }else if(type===9||type===13||type===24||type===26){
        for(let j=0;j<3;j++){
          const bottom=h*(.25+j*.18),top=h*(.67+j*.18),radius=r*(1-j*.23);
          rings([[bottom,radius],[top,0]],8,leaf);
          if(type===13){const snow=color(theme.snow);rings([[bottom+(top-bottom)*.16,radius*.85+.12],[top+.25,0]],8,snow);}
        }
      }else if(type===10){
        rings([[h*.37,0],[h*.72,r],[h*1.2,0]],5,leaf);
      }else{
        rings([[h*.42,0],[h*.57,r*.83],[h*.82,r],[h*1.05,r*.45],[h*1.14,0]],7,leaf);
        if(type===12)rings([[h*.35,0,4],[h*.5,r*.7,4],[h*.77,r*.65,4],[h*.9,0,4]],6,leaf);
      }
      count++;counts[key]=(counts[key]||0)+1;
    }
    return {vertices:new Float32Array(vertices),count,counts,entries};
  }
  return {build};
})();
