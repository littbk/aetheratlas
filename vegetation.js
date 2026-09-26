'use strict';
// Low-poly tree meshes in map coordinates: trunks, crowns and palm fronds.
const Vegetation=(()=>{
  const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  function build(layers,planet){
    const vertices=[],theme=Terrain.getTheme(),counts={};let count=0;
    const color=key=>theme[key].slice(1).match(/../g).map(v=>parseInt(v,16)/255);
    const sample=(x,y)=>Math.max(0,Terrain.sample(layers,x,y)||0)*.065;
    const surface=(x,y)=>{
      const dx=planet?8000/192:20,dy=planet?4400/96:20,ox=planet?3200:0,oy=planet?1650:0;
      const x0=Math.floor((x+ox)/dx)*dx-ox,y0=Math.floor((y+oy)/dy)*dy-oy,u=(x-x0)/dx,v=(y-y0)/dy;
      const a=sample(x0,y0),b=sample(x0+dx,y0),c=sample(x0,y0+dy),d=sample(x0+dx,y0+dy);
      return (u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v))+.2;
    };
    for(let gy=15;gy<1090;gy+=27)for(let gx=15;gx<1590;gx+=27){
      const n=random(gx,gy);if(n<.22||count>=2200)continue;
      const x=gx+(random(gx+8,gy)-.5)*14,y=gy+(random(gx,gy+9)-.5)*14,i=Terrain.index(x,y);
      let type=0;
      for(const l of layers)if(l.visible&&l.terrain.coverage[i]/255*l.opacity>.35)type=l.terrain.biomes[i];
      if(type!==2&&type<8)continue;
      const base=surface(x,y),scale=planet?.37:1,key=type===2?'trees':Terrain.biomes[type],leaf=color(key),trunk=color('trunk');
      const h=(type===8?31:type===9?28:20)*(0.8+n*.45),r=(type===12?10:7)*(0.85+n*.3);
      const vertex=(p,tint,shade)=>{
        const wx=x+p[0]+(planet?3200:0),wy=y+p[1]+(planet?1650:0);
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
      }else if(type===9){
        for(let j=0;j<3;j++)rings([[h*(.25+j*.18),r*(1-j*.23)],[h*(.67+j*.18),0]],6,leaf);
      }else if(type===10){
        rings([[h*.37,0],[h*.72,r],[h*1.2,0]],5,leaf);
      }else{
        rings([[h*.42,0],[h*.57,r*.83],[h*.82,r],[h*1.05,r*.45],[h*1.14,0]],7,leaf);
        if(type===12)rings([[h*.35,0,4],[h*.5,r*.7,4],[h*.77,r*.65,4],[h*.9,0,4]],6,leaf);
      }
      count++;counts[key]=(counts[key]||0)+1;
    }
    return {vertices:new Float32Array(vertices),count,counts};
  }
  return {build};
})();
