'use strict';
// Flat, camera-facing artwork, projected from world anchors after drawing the terrain.
// These objects never enter the terrain texture; their labels stay horizontal.
const Billboards=(()=>{
  function validate(objects){
    if(!Array.isArray(objects)||objects.length>2000)throw Error('Marcadores inválidos.');
    return objects.map(o=>{
      if(!o||!['building','marker','text','tree','decor'].includes(o.kind)||![o.x,o.y,o.size,o.rotation].every(Number.isFinite)||o.x<0||o.y<0||o.x>=1600||o.y>=1100||o.size<8||o.size>160||Math.abs(o.rotation)>360||typeof o.text!=='string'||o.text.length>240||!/^#[0-9a-f]{6}$/i.test(o.color))throw Error('Marcador inválido.');
      if(o.elevation!==undefined&&(!Number.isFinite(o.elevation)||o.elevation< -100||o.elevation>500))throw Error('Altura do objeto inválida.');
      if(o.kind==='tree'&&(!['forest','palms','pines','magic','autumn','jungle','snowForest'].includes(o.species)||!/^#[0-9a-f]{6}$/i.test(o.trunkColor)||!Number.isFinite(o.seed)||o.seed<0||o.seed>1))throw Error('Árvore inválida.');
      if(o.kind==='decor'&&(!['grass','flower','rock','bush','mushroom'].includes(o.decor)||!Number.isFinite(o.seed)||o.seed<0||o.seed>1))throw Error('Decoração inválida.');
      if(o.kind==='building'&&!Object.hasOwn(Buildings.names,o.building))throw Error('Construção inválida.');
      if(o.kind==='marker'&&!['◇','♜','▲','✦','♣'].includes(o.symbol))throw Error('Símbolo inválido.');
      return {kind:o.kind,x:o.x,y:o.y,size:o.size,rotation:o.rotation,text:o.text,color:o.color,...(o.elevation!==undefined?{elevation:o.elevation}:{}),...(o.kind==='tree'?{species:o.species,trunkColor:o.trunkColor,seed:o.seed}:{}),...(o.kind==='decor'?{decor:o.decor,seed:o.seed}:{}),...(o.kind==='building'?{building:o.building}:{}),...(o.kind==='marker'?{symbol:o.symbol}:{})};
    });
  }
  function collect(layers,underground){
    const entries=[];
    for(let i=0;i<layers.length;i++){
      const layer=layers[i];if(!layer.visible||layer.opacity<=0)continue;
      for(const object of layer.objects)if(object.kind!=='tree'&&object.kind!=='decor')entries.push({object,layer:i,opacity:layer.opacity});
      for(const tunnel of layer.tunnels){
        for(const p of [tunnel.a,tunnel.b])entries.push({object:{kind:'building',building:'tunnel',x:p.x,y:p.y,size:tunnel.width*2.1,rotation:0,text:'',color:'#f4e6bf'},layer:i,opacity:layer.opacity,tunnel});
        if(underground)entries.push({object:{kind:'text',x:(tunnel.a.x+tunnel.b.x)/2,y:(tunnel.a.y+tunnel.b.y)/2,size:20,rotation:0,text:'Túnel · −'+tunnel.depth+' m',color:'#ecd6aa'},layer:i,opacity:layer.opacity,tunnel});
      }
    }
    if(typeof WorldSurface!=='undefined'&&layers.some(l=>l.planet?.enabled))for(const region of WorldSurface.groups(layers))if(region.gx||region.gy)for(const entry of collect(region.layers,underground)){entries.push({...entry,originalObject:entry.object,region:{gx:region.gx,gy:region.gy},object:{...entry.object,x:entry.object.x+region.gx*1600,y:entry.object.y+region.gy*1100}});}
    return entries;
  }
  function surfaceHeight(x,y,layers){
    const x0=Math.floor(x/20)*20,y0=Math.floor(y/20)*20,u=(x-x0)/20,v=(y-y0)/20;
    const h=(x,y)=>Math.max(0,Terrain.sample(layers,layers.some(l=>l.planet?.enabled)?x:Math.min(x,1599),layers.some(l=>l.planet?.enabled)?y:Math.min(y,1099))||0)*.065;
    const a=h(x0,y0),b=h(x0+20,y0),c=h(x0,y0+20),d=h(x0+20,y0+20);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  function layout(entries,scene,camera,layers){
    return entries.map(entry=>{
      const o=entry.object,z=o.kind==='building'&&!entry.tunnel&&Buildings3D.types.has(o.building)?Buildings3D.ground(o,layers,entry.originalObject||o).highest+.8+(o.elevation||0):surfaceHeight(o.x,o.y,layers)+(o.elevation||0),p=scene.project(o.x,o.y,z,camera);
      const scale=Math.pow(camera.zoom/Math.max(.2,p.w),.7)*(camera.planet?.5:1);
      const size=Math.min(camera.planet?56:80,Math.max(3,o.size*scale));
      return {...entry,anchor:p,size,scale};
    }).filter(item=>item.anchor.visible!==false).sort((a,b)=>b.anchor.w-a.anchor.w||a.layer-b.layer);
  }
  function draw(g,entries,scene,camera,layers,width,height){
    const items=layout(scene.fogViewer?entries.filter(e=>!Terrain.fogAt(layers,e.object.x,e.object.y)):entries,scene,camera,layers),hits=[];
    const occupied=items.filter(i=>i.object.kind!=='text'&&i.size>=6).map(i=>({x:i.anchor.x-i.size*.72,y:i.anchor.y-i.size*1.3-3,w:i.size*1.44,h:i.size*1.4}));
    for(const item of items){
      const o=item.object,p=item.anchor,size=item.size;
      if(size<6||p.x<-200||p.x>width+200||p.y<-200||p.y>height+200)continue;
      const icon=o.kind!=='text',lift=icon?size*.6+3:5,model=o.kind==='building'&&!item.tunnel&&Buildings3D.near(o,camera,scene);
      g.save();g.globalAlpha=item.opacity;
      if(icon&&!model){
        g.fillStyle='#102c394a';g.beginPath();g.ellipse(p.x,p.y+1,size*.28,Math.max(2,size*.07),0,0,Math.PI*2);g.fill();
        g.strokeStyle='#f1dcad66';g.lineWidth=1;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-5);g.stroke();
        g.save();g.shadowColor='#10252a99';g.shadowBlur=4;g.shadowOffsetY=2;
        if(o.kind==='building')Buildings.draw(g,p.x,p.y-lift,o.building,size,o.rotation);
        else{
          const cy=p.y-lift;g.fillStyle='#193d48ee';g.strokeStyle='#efd9a5';g.lineWidth=1.5;g.beginPath();g.arc(p.x,cy,size*.39,0,Math.PI*2);g.fill();g.stroke();
          g.shadowBlur=0;g.shadowOffsetY=0;g.fillStyle='#ffebbc';g.font=Math.round(size*.58)+'px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillText(o.symbol,p.x,cy+1);
        }
        g.restore();
        hits.push({...item,box:{x:p.x-size*.72,y:p.y-lift-size*.7,w:size*1.44,h:size*1.4}});
      }
      if(model)hits.push({...item,box:{x:p.x-size*.8,y:p.y-size*1.4,w:size*1.6,h:size*1.8}});
      if(o.text&&(!icon||size>=14)){
        const font=icon?Math.max(8,Math.min(22,size*.32)):Math.max(8,Math.min(38,size*.65));
        g.font=(icon?'500 ':'italic ')+font+'px Georgia';g.textAlign='center';g.textBaseline='middle';
        const textWidth=Math.min(width-24,g.measureText(o.text).width),pad=5,h=font+8;
        const below=p.y+font*.7+5,above=p.y-lift-(icon?size*.8:0)-font;
        const candidates=[{x:p.x,y:icon?below:p.y-8},{x:p.x,y:above},
          {x:p.x,y:below+font+9},{x:p.x,y:above-font-9},
          {x:p.x+size*.8+textWidth/2+8,y:p.y-lift},{x:p.x-size*.8-textWidth/2-8,y:p.y-lift},
          {x:p.x,y:below+font*2+18},{x:p.x,y:above-font*2-18}];
        let x=p.x,y=below,box,best=Infinity;
        for(let n=0;n<candidates.length;n++){
          const candidate=candidates[n],cx=Math.max(textWidth/2+8,Math.min(width-textWidth/2-8,candidate.x));
          const cy=Math.max(h/2+4,Math.min(height-h/2-4,candidate.y)),test={x:cx-textWidth/2-pad,y:cy-h/2,w:textWidth+pad*2,h};
          const overlap=occupied.reduce((sum,b)=>sum+Math.max(0,Math.min(test.x+test.w,b.x+b.w)-Math.max(test.x,b.x))*Math.max(0,Math.min(test.y+test.h,b.y+b.h)-Math.max(test.y,b.y)),0);
          const score=overlap*100+n;
          if(score<best){best=score;x=cx;y=cy;box=test;}
          if(!overlap)break;
        }
        occupied.push(box);hits.push({...item,box});
        g.lineJoin='round';g.strokeStyle='#142f39e8';g.lineWidth=3.5;g.strokeText(o.text,x,y,Math.max(1,width-24));
        g.fillStyle=o.color;g.fillText(o.text,x,y,Math.max(1,width-24));
      }
      g.restore();
    }
    return hits;
  }
  function drawPlayerPivot(g,scene,camera,location,width,height,layers=[]){
    if(!location)return;
    const localX=location.x-AtlasScene.REGION_X,localY=location.y-AtlasScene.REGION_Y;if(scene.fogViewer&&Terrain.fogAt(layers,localX,localY))return;
    const z=layers.length&&localX>=0&&localX<1600&&localY>=0&&localY<1100?surfaceHeight(localX,localY,layers):0;
    const p=camera.planet?scene.project(location.x,location.y,z,camera,true):scene.project(localX,localY,z,camera);
    if(p.visible===false||p.x<-80||p.x>width+80||p.y<-80||p.y>height+80)return;
    const size=Math.max(9,Math.min(26,16*Math.pow(camera.zoom,.45)));
    g.save();g.translate(p.x,p.y);g.shadowColor='#071923';g.shadowBlur=7;g.lineWidth=2;
    g.fillStyle='#173b47';g.strokeStyle='#ffe2a0';g.beginPath();g.arc(0,0,size,0,Math.PI*2);g.fill();g.stroke();
    g.shadowBlur=0;g.strokeStyle='#fff1c9';g.beginPath();g.moveTo(-size*.45,0);g.lineTo(size*.45,0);g.moveTo(0,-size*.45);g.lineTo(0,size*.45);g.stroke();
    g.fillStyle='#ffe2a0';g.beginPath();g.arc(0,0,Math.max(2,size*.16),0,Math.PI*2);g.fill();
    g.font='bold 11px system-ui';g.textAlign='center';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='#0a2630';g.strokeText('LOCAL ATUAL',0,-size-8);g.fillStyle='#fff1c9';g.fillText('LOCAL ATUAL',0,-size-8);g.restore();
  }
  function submapPosition(patch,scene,camera){return scene.project(patch.entry.x,patch.entry.y,0,camera,true);}
  function drawSubmapEntries(g,patches,scene,camera,width,height){
    for(const patch of patches){if(patch.kind!=='submap'||!patch.entry)continue;if(scene.fogViewer&&Terrain.fogAt(scene.fogLayers||[],patch.entry.x-3200,patch.entry.y-1650))continue;const p=submapPosition(patch,scene,camera);
      if(p.visible===false||p.x<-50||p.x>width+50||p.y<-50||p.y>height+50)continue;
      const r=Math.max(7,Math.min(16,11*Math.pow(camera.zoom,.45)));g.save();g.translate(p.x,p.y);g.shadowColor='#071923';g.shadowBlur=6;g.fillStyle='#214b58';g.strokeStyle='#ffe2a0';g.lineWidth=2;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#fff1c9';g.font='bold '+Math.max(9,Math.round(r*1.2))+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('↗',0,0);g.font='11px system-ui';g.textBaseline='top';g.lineWidth=3;g.strokeStyle='#0a2630';g.strokeText(patch.name,0,r+3);g.fillStyle='#fff1c9';g.fillText(patch.name,0,r+3);g.restore();
    }
  }
  function hitSubmap(x,y,patches,scene,camera){
    for(const patch of patches){if(patch.kind!=='submap'||!patch.entry)continue;if(scene.fogViewer&&Terrain.fogAt(scene.fogLayers||[],patch.entry.x-3200,patch.entry.y-1650))continue;const p=submapPosition(patch,scene,camera),r=Math.max(18,28*camera.zoom/Math.max(.2,p.w));if(p.visible!==false&&Math.hypot(x-p.x,y-p.y)<=r)return patch;}
    return null;
  }
  return {validate,collect,layout,draw,drawPlayerPivot,drawSubmapEntries,hitSubmap,surfaceHeight};
})();
