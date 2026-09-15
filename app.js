'use strict';
const $=id=>document.getElementById(id), W=1600,H=1100;
const canvas=$('map'),ctx=canvas.getContext('2d');
const colors=[['Pradaria','#87a56b'],['Floresta','#336349'],['Areia','#d3c591'],['Montanha','#9aab9a'],['Neve','#dee3d4'],['Água','#347787'],['Lava','#d84a1c']];
const toolList=[['pan','✥','Navegar'],['orbit','⟳','Orbitar'],['tunnel','∩','Túnel'],['brush','◉','Terreno'],['raise','↟','Elevar'],['lower','↧','Rebaixar'],['smooth','≋','Suavizar'],['plateau','▰','Platô'],['color','◌','Cor livre'],['river','≈','Rio'],['path','⌁','Caminho'],['marker','◇','Marcador'],['text','T','Texto'],['erase','▱','Borracha']];
let layers=[],active=0,tool='pan',zoom=1,ox=0,oy=0,grid=false,down=false,last=null,space=false,history=[],future=[],dirty=false,timer;
let selectedBiome='grass', selectedBuilding=null, strokeDistance=0;
const viewSettings=()=>({texture:$('textures').checked,shade:$('shade').checked,contours:$('contours').checked,altitude:$('altitude').checked,interval:+$('interval').value});
let activeRoute=null,billboardHits=[];
const scene=new AtlasScene(), mapTexture=document.createElement('canvas');
mapTexture.width=W;mapTexture.height=H;
let textureDirty=true, yaw=matchMedia('(max-width:860px)').matches?-65:-12, tilt=matchMedia('(max-width:860px)').matches?28:38, relief=1, tunnelStart=null;
const camera=()=>({yaw,tilt,relief:tilt?relief:0,zoom,cx:ox,cy:oy});
function drawLayer(g,l){g.drawImage(l.c,0,0);g.drawImage(Terrain.render(l.terrain,viewSettings()),0,0,W,H);MapPaths.draw(g,l.routes);if(l.ink)g.drawImage(l.ink,0,0);for(const tunnel of l.tunnels)drawTunnel(g,tunnel);}
function drawTunnel(g,t){
  if(!$('underground').checked)return;
  g.save();g.lineCap='round';g.beginPath();g.moveTo(t.a.x,t.a.y);g.lineTo(t.b.x,t.b.y);
  g.strokeStyle='#102d3199';g.lineWidth=t.width+7;g.stroke();
  g.strokeStyle='#e6c48b';g.lineWidth=2;g.setLineDash([7,7]);g.stroke();g.restore();
}
function addTunnel(p){
  if(!tunnelStart){tunnelStart={x:p.x,y:p.y,layer:active};notify('Entrada marcada. Toque no ponto de saída do túnel.');draw();return;}
  if(tunnelStart.layer!==active){tunnelStart=null;notify('Selecione as duas entradas na mesma camada.');return;}
  if(Math.hypot(p.x-tunnelStart.x,p.y-tunnelStart.y)<24){notify('A saída precisa estar um pouco mais distante.');return;}
  if(layers[active].tunnels.length>=1000){tunnelStart=null;notify('Limite de 1.000 túneis por camada.');return;}
  remember();layers[active].tunnels.push({a:{x:tunnelStart.x,y:tunnelStart.y},b:{x:p.x,y:p.y},width:Math.max(14,+$('size').value*.5),depth:Math.max(5,Math.min(500,Number($('tunnelDepth').value)||90))});
  tunnelStart=null;changed();notify('Túnel construído. As duas entradas estão conectadas.');
}

function ink(l){if(!l.ink){l.ink=document.createElement('canvas');l.ink.width=W;l.ink.height=H;}return l.ink;}
function layer(name){const c=document.createElement('canvas');c.width=W;c.height=H;return{name,visible:true,locked:false,opacity:1,c,ink:null,objects:[],routes:[],tunnels:[],terrain:Terrain.create()};}
function notify(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function changed(){driveRevision++;textureDirty=true;dirty=true;$('saved').textContent='Alterações não salvas';render();scheduleDriveSave();}
function snapshotBytes(){return layers.reduce((sum,l)=>sum+W*H*4*(l.ink?2:1)+Terrain.length*6,0);}
function snapshot(){return layers.map(l=>({name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,terrain:Terrain.copy(l.terrain),tunnels:structuredClone(l.tunnels),objects:structuredClone(l.objects),routes:structuredClone(l.routes),ink:l.ink?.getContext('2d').getImageData(0,0,W,H)||null,data:l.c.getContext('2d').getImageData(0,0,W,H)}));}
function remember(){history.push({layers:snapshot(),active});const bytes=snapshotBytes();while(history.length>1&&history.length*bytes>96*1024*1024)history.shift();if(history.length>12)history.shift();future=[];}
function restore(s){tunnelStart=null;activeRoute=null;layers=s.layers.map(v=>{let l=layer(v.name);Object.assign(l,{visible:v.visible,locked:v.locked,opacity:v.opacity});l.c.getContext('2d').putImageData(v.data,0,0);l.terrain=Terrain.restore(v.terrain);l.tunnels=structuredClone(v.tunnels||[]);l.objects=structuredClone(v.objects||[]);l.routes=structuredClone(v.routes||[]);if(v.ink)ink(l).getContext('2d').putImageData(v.ink,0,0);return l;});active=s.active;changed();}
function undo(redo=false){let src=redo?future:history,dst=redo?history:future;if(!src.length)return;dst.push({layers:snapshot(),active});restore(src.pop());}
function render(){document.querySelector('.map-tag').firstChild.textContent=$('title').value||'MEU MUNDO';draw();$('layers').replaceChildren();[...layers.keys()].reverse().forEach(i=>{const l=layers[i],row=document.createElement('div');row.className='layer'+(active===i?' selected':'');const eye=document.createElement('button');eye.textContent=l.visible?'◉':'○';eye.title=l.visible?'Ocultar camada':'Mostrar camada';eye.onclick=e=>{e.stopPropagation();remember();l.visible=!l.visible;changed();};const name=document.createElement('span');name.className='name';name.textContent=l.name;const small=document.createElement('small');small.textContent=Math.round(l.opacity*100)+'% · '+(l.locked?'Bloqueada':'Editável');name.append(small);const lock=document.createElement('button');lock.textContent=l.locked?'▣':'▢';lock.title=l.locked?'Desbloquear':'Bloquear';lock.onclick=e=>{e.stopPropagation();remember();l.locked=!l.locked;changed();};row.append(eye,name,lock);row.onclick=()=>{tunnelStart=null;active=i;render();};$('layers').append(row);});$('opacity').value=layers[active].opacity*100;$('opacityValue').textContent=$('opacity').value+'%';$('count').textContent=layers.length+' camadas';$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function compose(){
  const g=mapTexture.getContext('2d');g.clearRect(0,0,W,H);
  for(const l of layers)if(l.visible){g.globalAlpha=l.opacity;drawLayer(g,l);}g.globalAlpha=1;
  if(grid){g.strokeStyle='#f4edcf38';g.lineWidth=1;g.beginPath();for(let x=0;x<=W;x+=50){g.moveTo(x,0);g.lineTo(x,H);}for(let y=0;y<=H;y+=50){g.moveTo(0,y);g.lineTo(W,y);}g.stroke();}
  scene.update(mapTexture,layers);textureDirty=false;
}
function draw(decorations=true){
  const r=$('viewport').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(!r.width||!r.height)return;
  if(canvas.width!==Math.round(r.width*d)||canvas.height!==Math.round(r.height*d)){canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);}
  ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);
  if(textureDirty)compose();
  const result=scene.draw(r.width,r.height,d,camera());
  if(result)ctx.drawImage(result,0,0,r.width,r.height);
  else{tilt=0;ctx.save();ctx.translate(ox,oy);ctx.rotate(yaw*Math.PI/180);ctx.scale(zoom,zoom);ctx.drawImage(mapTexture,-W/2,-H/2);ctx.restore();$('cameraNote').textContent='Vista plana: aceleração 3D indisponível neste navegador.';}
  billboardHits=Billboards.draw(ctx,Billboards.collect(layers,$('underground').checked),scene,camera(),layers,r.width,r.height);
  if(decorations&&tunnelStart){const h=Math.max(0,Terrain.sample(layers,tunnelStart.x,tunnelStart.y)||0)*.065,p=scene.project(tunnelStart.x,tunnelStart.y,h,camera());ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.strokeStyle='#ffe1a5';ctx.lineWidth=2;ctx.stroke();}
  $('zoom').textContent=Math.round(zoom*100)+'%';$('bearingValue').textContent=Math.round(yaw)+'°';$('bearing').value=yaw;
  $('tiltValue').textContent=Math.round(tilt)+'°';$('tilt').value=tilt;
  document.querySelector('.compass').style.transform='rotate('+yaw+'deg)';
  $('viewTop').classList.toggle('active',tilt===0);$('view3d').classList.toggle('active',tilt>0);
}
function fit(){
  const r=$('viewport').getBoundingClientRect(),c={...camera(),cx:0,cy:0,zoom:1};
  const corners=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>scene.project(x,y,0,c));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  zoom=Math.min(r.width/(maxX-minX),r.height/(maxY-minY))*.87;
  ox=r.width/2-(minX+maxX)*zoom/2;oy=r.height/2-(minY+maxY)*zoom/2;draw();
}
function magnify(f,x=$('viewport').clientWidth/2,y=$('viewport').clientHeight/2){const z=Math.max(.08,Math.min(5,zoom*f));ox=x-(x-ox)*z/zoom;oy=y-(y-oy)*z/zoom;zoom=z;draw();}
function island(c,cx,cy,rx,ry,seed){const pts=[];for(let i=0;i<96;i++){const a=i/96*Math.PI*2,rr=1+.12*Math.sin(a*7+seed)+.055*Math.sin(a*17+seed);pts.push([cx+Math.cos(a)*rx*rr,cy+Math.sin(a)*ry*rr]);}c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.lineJoin='round';c.strokeStyle='#75a6a4';c.lineWidth=30;c.stroke();c.strokeStyle='#c7c999';c.lineWidth=13;c.stroke();c.fillStyle='#91ae7b';c.fill();return pts;}
function demo(){textureDirty=true;activeRoute=null;tunnelStart=null;layers=[layer('Océan'),layer('Reliefs & prairies'),layer('Rivières & chemins'),layer('Lieux & découvertes')];layers[0].name='Oceano';layers[1].name='Relevo e pradarias';layers[2].name='Rios e caminhos';layers[3].name='Locais e descobertas';const sea=layers[0].c.getContext('2d');const ocean=sea.createLinearGradient(0,0,W,H);ocean.addColorStop(0,'#183d50');ocean.addColorStop(.5,'#285e69');ocean.addColorStop(1,'#112f44');sea.fillStyle=ocean;sea.fillRect(0,0,W,H);for(let y=0;y<H;y+=32)for(let x=0;x<W;x+=52){sea.strokeStyle='#b5d4c00b';sea.beginPath();sea.arc(x,y,12,0,Math.PI);sea.stroke();}const c=layers[1].c.getContext('2d');island(c,730,510,435,355,2);island(c,1270,835,160,140,5);island(c,280,865,125,87,3);island(c,1320,260,97,145,7);c.save();c.beginPath();c.ellipse(730,510,350,285,0,0,Math.PI*2);c.clip();for(let i=0;i<125;i++){let x=410+(Math.sin(i*29)*.5+.5)*640,y=270+(Math.cos(i*17)*.5+.5)*450;c.fillStyle=i%3?'#729b70':'#648c69';c.beginPath();c.ellipse(x,y,30+i%40,15+i%22,i,0,Math.PI*2);c.fill();}for(let i=0;i<18;i++){let x=620+i*16,y=350+Math.sin(i*.6)*43;c.fillStyle='#788d7b';c.beginPath();c.moveTo(x-35,y+40);c.lineTo(x,y-40);c.lineTo(x+39,y+40);c.fill();c.fillStyle='#bcc5a6';c.beginPath();c.moveTo(x,y-40);c.lineTo(x+5,y+23);c.lineTo(x-35,y+40);c.fill();c.fillStyle='#e1dfc5';c.beginPath();c.moveTo(x,y-40);c.lineTo(x+13,y-13);c.lineTo(x+1,y-20);c.lineTo(x-10,y-15);c.fill();}c.restore();const r=layers[2].c.getContext('2d');r.lineCap='round';r.beginPath();r.moveTo(845,440);r.bezierCurveTo(980,590,640,500,735,730);r.bezierCurveTo(770,780,850,730,905,837);r.strokeStyle='#c5d0a6';r.lineWidth=22;r.stroke();r.strokeStyle='#548e9a';r.lineWidth=13;r.stroke();r.beginPath();r.moveTo(480,520);r.bezierCurveTo(590,600,830,610,1010,500);r.strokeStyle='#dfcf9b';r.lineWidth=5;r.setLineDash([9,7]);r.stroke();layers[3].objects=[
{kind:'building',building:'village',x:580,y:550,size:55,rotation:0,text:'CIDADE DE AURÉLIA',color:'#f3e9c9'},
{kind:'building',building:'tower',x:985,y:490,size:45,rotation:0,text:'Templo dos Ventos',color:'#f3e9c9'},
{kind:'building',building:'temple',x:1270,y:835,size:50,rotation:0,text:'Ilhas da Alvorada',color:'#f3e9c9'},
{kind:'marker',symbol:'◇',x:515,y:700,size:36,rotation:0,text:'Bosque Esmeralda',color:'#f3e9c9'},
{kind:'text',x:755,y:245,size:30,rotation:0,text:'Cordilheira dos Ecos',color:'#f0ecd4'},
{kind:'text',x:1210,y:625,size:28,rotation:0,text:'Mar das Estrelas',color:'#c9ded5'}];Terrain.seed(layers[1].terrain,layers[1].c);layers[2].tunnels.push({a:{x:650,y:365},b:{x:850,y:400},width:19,depth:90});active=1;history=[];future=[];dirty=false;$('saved').textContent='Mapa de exemplo · salve para guardar';render();fit();}
function point(e){
  const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
  let p=scene.gl?scene.pick(sx,sy):null;
  if(!scene.gl){const a=-yaw*Math.PI/180,x=(sx-ox)/zoom,y=(sy-oy)/zoom;p={x:W/2+x*Math.cos(a)-y*Math.sin(a),y:H/2+x*Math.sin(a)+y*Math.cos(a)};}
  const hit=tool==='erase'?[...billboardHits].reverse().find(h=>h.layer===active&&sx>=h.box.x&&sx<=h.box.x+h.box.w&&sy>=h.box.y&&sy<=h.box.y+h.box.h):null;
  if(hit)p={x:hit.object.x,y:hit.object.y};
  return {x:p?.x??-1,y:p?.y??-1,sx:e.clientX,sy:e.clientY,hit,inside:!!p&&p.x>=0&&p.y>=0&&p.x<W&&p.y<H};
}
function paint(a,b){
  textureDirty=true;
  if(tool==='river'||tool==='path'){extendRoute(b);draw();return;}
  if(tool==='erase'&&b.hit){const l=layers[active];if(b.hit.tunnel)l.tunnels=l.tunnels.filter(t=>t!==b.hit.tunnel);else l.objects=l.objects.filter(o=>o!==b.hit.object);draw();return;}
  const smart=['brush','raise','lower','smooth','plateau','erase'].includes(tool);
  if(smart){
    const spacing=Math.max(2,+$('size').value*.13),distance=Math.hypot(b.x-a.x,b.y-a.y);
    const stamp=p=>Terrain.stamp(layers,active,p.x,p.y,{mode:tool,biome:selectedBiome,size:+$('size').value,strength:tool==='erase'?1:+$('strength').value/100,soft:$('soft').checked,integrate:$('integrate').checked,amount:+$('amount').value,target:Math.max(-500,Math.min(3000,Number($('target').value)||0))});
    if(!distance)stamp(b);
    else {let at=spacing-strokeDistance;for(;at<=distance;at+=spacing)stamp({x:a.x+(b.x-a.x)*at/distance,y:a.y+(b.y-a.y)*at/distance});strokeDistance=(strokeDistance+distance)%spacing;}
    if(tool!=='erase'){draw();return;}
    layers[active].routes=MapPaths.erase(layers[active].routes,a,b,+$('size').value/2);
    layers[active].objects=layers[active].objects.filter(o=>MapPaths.distance(o,a,b)>+$('size').value/2);
    layers[active].tunnels=layers[active].tunnels.filter(t=>{const dx=t.b.x-t.a.x,dy=t.b.y-t.a.y,q=Math.max(0,Math.min(1,((b.x-t.a.x)*dx+(b.y-t.a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(b.x-t.a.x-q*dx,b.y-t.a.y-q*dy)>+$('size').value/2;});
  }
  const c=ink(layers[active]).getContext('2d');c.save();c.globalCompositeOperation=tool==='erase'?'destination-out':'source-over';
  c.strokeStyle=$('color').value;c.lineWidth=+$('size').value;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x+.001,b.y);c.stroke();c.restore();
  if(tool==='erase'){const base=layers[active].c.getContext('2d');base.save();base.globalCompositeOperation='destination-out';base.lineCap='round';base.lineWidth=+$('size').value;base.beginPath();base.moveTo(a.x,a.y);base.lineTo(b.x+.001,b.y);base.stroke();base.restore();}
  draw();
}
function placeMarker(p){
  layers[active].objects.push({kind:selectedBuilding?'building':'marker',x:p.x,y:p.y,size:+$('iconSize').value,rotation:+$('rotation').value,text:$('label').value.trim().slice(0,240),color:'#f3e9c9',...(selectedBuilding?{building:selectedBuilding}:{symbol:$('marker').value})});
}
function extendRoute(p){
  if(!activeRoute){
    const route={kind:tool,width:tool==='river'?Math.max(2,+$('size').value/2):Math.max(3,+$('size').value/5),points:[{x:p.x,y:p.y}]};
    layers[active].routes.push(route);activeRoute={layer:active,route};return;
  }
  const previous=activeRoute.route.points.at(-1);
  if(Math.hypot(p.x-previous.x,p.y-previous.y)>=.75)activeRoute.route.points.push({x:p.x,y:p.y});
}
function finishRoute(){for(const l of layers)l.routes=l.routes.filter(r=>r.points.length>1);activeRoute=null;}
let panning=false,orbiting=false,pending=null,strokeStarted=false,gesture=null;
const pointers=new Map();
function beginPaint(p){
  if(!p.inside)return false;
  if(layers[active].locked||!layers[active].visible){notify('Selecione uma camada visível e desbloqueada.');return false;}
  if(tool==='tunnel'){addTunnel(p);return false;}
  if(tool==='text'&&!$('label').value.trim()){notify('Digite o nome ou texto no painel Ferramentas.');return false;}
  if(['marker','text'].includes(tool)&&layers[active].objects.length>=2000){notify('Limite de 2.000 marcadores por camada.');return false;}
  if(['river','path'].includes(tool)&&layers[active].routes.length>=2000){notify('Limite de trajetos atingido nesta camada.');return false;}
  remember();strokeStarted=true;strokeDistance=0;activeRoute=null;
  if(tool==='marker')placeMarker(p);
  else if(tool==='text')layers[active].objects.push({kind:'text',x:p.x,y:p.y,size:Math.max(16,+$('iconSize').value*.65),rotation:0,text:$('label').value.trim().slice(0,240),color:$('color').value});
  else paint(p,p);
  changed();return true;
}
function gestureState(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x)};}
canvas.onpointerdown=e=>{
  if(![0,1,2].includes(e.button))return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>1){pending=null;finishRoute();if(strokeStarted)changed();strokeStarted=false;down=false;gesture=gestureState();return;}
  const p=point(e);panning=tool==='pan'||space||e.button===1;orbiting=tool==='orbit'||e.altKey||e.button===2;
  down=true;last=p;strokeStarted=false;
  if(!panning&&!orbiting){if(e.pointerType==='touch')pending=p;else beginPaint(p);}
};
canvas.onpointermove=e=>{
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){
    const next=gestureState(),r=canvas.getBoundingClientRect();
    if(gesture){const f=next.d/Math.max(1,gesture.d),z=Math.max(.08,Math.min(5,zoom*f));
      ox=next.x-r.left-(gesture.x-r.left-ox)*z/zoom;oy=next.y-r.top-(gesture.y-r.top-oy)*z/zoom;zoom=z;
      yaw=normalizeAngle(yaw+Math.atan2(Math.sin(next.a-gesture.a),Math.cos(next.a-gesture.a))*180/Math.PI);draw();}
    gesture=next;return;
  }
  const p=point(e);$('coords').textContent=p.inside?`X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`:'Fora do mapa';
  const h=p.inside?Terrain.sample(layers,p.x,p.y):null;
  $('altitudeReadout').textContent=h===null?'— m':Math.round(h)+' m';$('terrainReadout').textContent=h===null?'Passe sobre uma área de terreno':h<0?'Abaixo do nível do mar':h<70?'Costa e baixada':h<700?'Planície e colinas':h<1900?'Montanha':'Alta montanha';
  if(!down||!pointers.has(e.pointerId))return;
  if(orbiting){yaw=normalizeAngle(yaw+(p.sx-last.sx)*.35);tilt=Math.max(0,Math.min(65,tilt+(p.sy-last.sy)*.25));draw();}
  else if(panning){ox+=p.sx-last.sx;oy+=p.sy-last.sy;draw();}
  else{
    if(pending&&Math.hypot(p.sx-pending.sx,p.sy-pending.sy)>5){if(!['tunnel','marker','text'].includes(tool)){beginPaint(pending);pending=null;}}
    if(strokeStarted&&p.inside&&!['marker','text','tunnel'].includes(tool))paint(last.inside?last:p,p);
    if(!p.inside&&activeRoute){finishRoute();}
  }
  last=p;
};
function end(e){
  if(activeRoute&&e?.type==='pointerup'){const p=point(e);if(p.inside)extendRoute(p);}
  finishRoute();
  if(e){pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  else pointers.clear();
  if(gesture){if(pointers.size===0)gesture=null;pending=null;down=false;last=null;return;}
  if(pending&&e?.type==='pointerup'&&Math.hypot(e.clientX-pending.sx,e.clientY-pending.sy)<12)beginPaint(pending);
  finishRoute();if(strokeStarted)changed();pending=null;strokeStarted=false;down=false;last=null;
}
canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=e=>{if(pointers.has(e.pointerId))end(e);};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();magnify(e.deltaY<0?1.12:1/1.12,e.clientX-r.left,e.clientY-r.top);},{passive:false});
function normalizeAngle(v){return ((v+180)%360+360)%360-180;}
toolList.forEach(([id,icon,name])=>{let b=document.createElement('button');b.innerHTML=`<span>${icon}</span>${name}`;b.dataset.tool=id;b.className=id===tool?'active':'';b.onclick=()=>{end();tunnelStart=null;tool=id;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===id));$('toolName').textContent=name;canvas.style.cursor=['pan','orbit'].includes(id)?'grab':'crosshair';$('status').textContent=id==='tunnel'?'Toque na entrada e depois na saída':name;draw();};$('tools').append(b);});
colors.forEach(([name,color],i)=>{const b=document.createElement('button');b.className='swatch'+(!i?' selected':'');b.innerHTML=`<i style="background:${color}"></i>${name}`;b.onclick=()=>{$('color').value=color;selectedBiome=['grass','forest','sand','rock','snow','water','lava'][i];document.querySelectorAll('.swatch').forEach(v=>v.classList.remove('selected'));b.classList.add('selected');document.querySelector('[data-tool="brush"]').click();};$('palette').append(b);});
$('grassColor').oninput=$('treeColor').oninput=$('waterColor').oninput=$('lavaColor').oninput=()=>{Terrain.setTheme({grass:$('grassColor').value,trees:$('treeColor').value,water:$('waterColor').value,lava:$('lavaColor').value});changed();};
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+' px';};$('opacity').onpointerdown=()=>remember();$('opacity').onkeydown=e=>{if(e.key.startsWith('Arrow'))remember();};$('opacity').oninput=()=>{layers[active].opacity=+$('opacity').value/100;changed();};$('color').oninput=()=>{document.querySelectorAll('.swatch').forEach(b=>b.classList.remove('selected'));document.querySelector('[data-tool="color"]').click();};
$('add').onclick=()=>{if(layers.length>=16){notify('Limite de 16 camadas por projeto.');return;}remember();tunnelStart=null;layers.push(layer('Camada '+(layers.length+1)));active=layers.length-1;changed();};$('rename').onclick=()=>{const name=prompt('Nome da camada:',layers[active].name);if(name?.trim()){remember();layers[active].name=name.trim();changed();}};$('delete').onclick=()=>{if(layers.length===1)return notify('Mantenha ao menos uma camada.');if(!confirm('Excluir a camada '+layers[active].name+'?'))return;remember();tunnelStart=null;layers.splice(active,1);active=Math.max(0,active-1);changed();};
function reorder(n){const next=active+n;if(next<0||next>=layers.length)return;remember();tunnelStart=null;[layers[active],layers[next]]=[layers[next],layers[active]];active=next;changed();}$('up').onclick=()=>reorder(1);$('down').onclick=()=>reorder(-1);$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);$('plus').onclick=()=>magnify(1.2);$('minus').onclick=()=>magnify(1/1.2);$('fit').onclick=fit;$('grid').onclick=()=>{grid=!grid;textureDirty=true;$('grid').classList.toggle('active',grid);draw();};
function download(blob,ext){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=($('title').value.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'mapa')+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function projectData(){return {format:'aether-atlas',version:4,camera:{yaw,tilt,relief},width:W,height:H,title:$('title').value,view:viewSettings(),theme:Terrain.getTheme(),layers:layers.map(l=>({name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,terrain:Terrain.serialize(l.terrain),tunnels:l.tunnels,objects:l.objects,routes:l.routes,overlay:l.ink?.toDataURL()||null,image:l.c.toDataURL()}))};}
$('save').onclick=()=>{end();download(new Blob([JSON.stringify(projectData())],{type:'application/json'}),'.json');dirty=false;$('saved').textContent='Projeto exportado · arquivo JSON';notify('Projeto salvo com todas as camadas.');};
// Google Drive uses OAuth in the browser. Tokens stay in memory; only the chosen
// file id and the public OAuth Client ID are remembered on this device.
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
let driveToken='',driveFileId=localStorage.getItem('aether-atlas-drive-file')||'',driveTimer=0,driveBusy=false,driveServerSession=false;
$('driveClientId').value=localStorage.getItem('aether-atlas-drive-client-id')||'';
$('driveAutosave').checked=localStorage.getItem('aether-atlas-drive-autosave')!=='false';
let driveLocalProject=false,driveRevision=0;
const driveDebug=document.createElement('details');
driveDebug.innerHTML='<summary>Console do Drive</summary><button type="button" id="driveCheck">Verificar sessão</button><pre id="driveLog" aria-live="polite"></pre>';
document.querySelector('.drive-panel').append(driveDebug);
$('driveLog').style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;font-size:11px';
function driveLog(message){const line=new Date().toLocaleTimeString()+' '+message;console.info('[Drive] '+message);$('driveLog').textContent=($('driveLog').textContent+'\n'+line).split('\n').slice(-60).join('\n');}
function driveStatus(text){$('driveHelp').textContent=text;driveLog(text);}
$('driveCheck').onclick=async()=>{try{const s=await serverDriveSession();driveLog('Servidor configurado: '+!!s.configured+' | Sessão conectada: '+!!s.connected+' | Arquivo na API: '+(s.fileId||'nenhum')+' | Arquivo atual: '+(driveFileId||'novo')+' | Importação local: '+driveLocalProject);}catch{driveLog('Não foi possível consultar a API de sessão.');}};
function revealDriveSetup(){document.querySelector('.drive-panel').open=true;if(matchMedia('(max-width:860px)').matches){closePanels();document.body.classList.add('show-layers');$('mobileLayers').setAttribute('aria-expanded','true');$('panelBackdrop').hidden=false;}setTimeout(()=>$('driveClientId').focus(),0);}
async function serverDriveSession(){const response=await fetch('/api/drive/session',{credentials:'same-origin'});if(!response.ok)throw Error('sessão indisponível');return response.json();}
function loadGoogleIdentity(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar o login do Google.'));document.head.append(s);});}
async function requestDriveToken(prompt){await loadGoogleIdentity();const clientId=$('driveClientId').value.trim();return new Promise((resolve,reject)=>{const tc=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:DRIVE_SCOPE,callback:r=>r.error?reject(Error(r.error)):resolve(r.access_token)});tc.requestAccessToken({prompt});});}
async function connectDrive(){
  $('driveConnect').disabled=true;
  try{
    const server=await serverDriveSession();
    if(!server.configured){revealDriveSetup();throw Error('Configure a sessão persistente do Drive no Vercel.');}
    if(!server.connected){if(driveLocalProject||dirty){driveStatus('Conecte antes de importar: guarde o JSON local, conecte o Drive e abra o JSON novamente.');return;}location.assign('/api/drive/connect');return;}
    driveServerSession=true;driveToken=server.accessToken;
    if(!driveLocalProject)driveFileId=await resolveDriveFile(server.fileId);
    $('driveConnect').textContent='Drive conectado';
    if(driveLocalProject){driveStatus('Conectado. Clique em Salvar no Drive agora para enviar o JSON local.');return;}
    if(driveFileId)await openLastDriveProject();
    else driveStatus('Conectado. Use Salvar no Drive para guardar este mapa.');
  }catch(err){driveStatus(err.message);notify('Google Drive: '+err.message);}
  finally{$('driveConnect').disabled=false;}
}
async function resolveDriveFile(serverId){
  if(serverId)return serverId;
  const remembered=localStorage.getItem('aether-atlas-drive-file');
  if(remembered){
    const check=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(remembered)+'?fields=id,trashed',{headers:{Authorization:'Bearer '+driveToken}});
    if(check.ok){const file=await check.json();if(!file.trashed)return file.id;}
    else if(![403,404].includes(check.status))throw Error('Não foi possível localizar o último arquivo ('+check.status+').');
  }
  const params=new URLSearchParams({q:"trashed = false and mimeType = 'application/json' and name contains '.aether-atlas.json'",orderBy:'modifiedTime desc',pageSize:'100',fields:'files(id,name)'});
  const response=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+driveToken}});
  if(!response.ok)throw Error('Não foi possível consultar os projetos do Drive ('+response.status+').');
  const data=await response.json();
  return data.files?.find(f=>f.name.endsWith('.aether-atlas.json'))?.id||'';
}
async function openLastDriveProject(){
  if(!driveToken||!driveFileId)return false;
  driveBusy=true;clearTimeout(driveTimer);
  driveStatus('Abrindo o último projeto salvo…');
  try{
    const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(driveFileId)+'?alt=media',{headers:{Authorization:'Bearer '+driveToken}});
    if(!response.ok)throw Error(response.status===404?'arquivo não encontrado':'erro '+response.status);
    const file=new File([await response.blob()],'ultimo-projeto.aether-atlas.json',{type:'application/json'});
    const opened=await $('file').onchange({target:{files:[file],value:''},fromDrive:true});
    if(!opened)throw Error('A abertura foi cancelada ou o projeto é inválido.');
    localStorage.setItem('aether-atlas-drive-file',driveFileId);
    if(driveServerSession){
      const stored=await fetch('/api/drive/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:driveFileId})});
      if(!stored.ok)throw Error('Mapa aberto, mas não foi possível memorizar o arquivo.');
    }
    $('saved').textContent='Projeto aberto do Google Drive';
    driveStatus('Último projeto aberto.');return true;
  }finally{driveBusy=false;}
}
async function restoreDriveSession(){
  try{
    const server=await serverDriveSession();
    if(server.configured){
      if(!server.connected){driveStatus('Conecte o Google Drive para abrir seu projeto.');return;}
      driveServerSession=true;driveToken=server.accessToken;
      driveFileId=await resolveDriveFile(server.fileId);
      $('driveConnect').textContent='Drive conectado';
      if(driveLocalProject)return;
      if(driveFileId)await openLastDriveProject();
      else{driveStatus('Nenhum projeto salvo foi encontrado nesta conta.');notify('Nenhum projeto encontrado no Drive.');}
      return;
    }
    if(driveFileId)driveStatus('Conecte o Drive para abrir o último projeto.');
  }catch(err){driveStatus('Não foi possível restaurar o projeto: '+err.message);notify('Não foi possível abrir o mapa do Drive: '+err.message);}
}
async function saveToDrive(){
  end();if(driveBusy){driveLog('Aguarde a operação atual terminar.');return;}
  driveBusy=true;$('driveSave').disabled=true;
  const revision=driveRevision;
  try{
    const session=await serverDriveSession();
    if(!session.configured||!session.connected)throw Error('Conecte o Drive antes de importar o JSON local. O mapa atual continua aberto.');
    driveToken=session.accessToken;driveServerSession=true;
    const data=JSON.stringify(projectData()),name=($('title').value.trim()||'mapa')+'.aether-atlas.json';
    const metadata={name,mimeType:'application/json'},boundary='atlas'+Date.now();
    const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+data+'\r\n--'+boundary+'--';
    const fileId=driveLocalProject?'':driveFileId;
    driveStatus(fileId?'Atualizando arquivo '+fileId+'…':'Criando cópia do mapa no Drive…');
    const response=await fetch('https://www.googleapis.com/upload/drive/v3/files'+(fileId?'/'+encodeURIComponent(fileId):'')+'?uploadType=multipart&fields=id',{
      method:fileId?'PATCH':'POST',headers:{Authorization:'Bearer '+driveToken,'Content-Type':'multipart/related; boundary='+boundary},body
    });
    if(!response.ok)throw Error('Upload recusado pelo Drive (HTTP '+response.status+').');
    const result=await response.json();if(!result.id)throw Error('Drive não retornou o ID do arquivo.');
    driveFileId=result.id;driveLocalProject=false;localStorage.setItem('aether-atlas-drive-file',driveFileId);
    driveLog('Upload concluído. ID: '+driveFileId);
    const stored=await fetch('/api/drive/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:driveFileId})});
    if(!stored.ok)throw Error('Arquivo salvo, mas a API não registrou o ID (HTTP '+stored.status+'). Tente salvar novamente.');
    driveLog('API registrou o arquivo para a próxima abertura: '+driveFileId);
    dirty=driveRevision!==revision;
    $('saved').textContent=dirty?'Novas alterações pendentes':'Salvo no Google Drive';
    driveStatus('Mapa salvo e vinculado à sessão. Ao recarregar, este arquivo será aberto.');
  }catch(err){driveStatus('Falha ao salvar: '+err.message);notify(err.message);}
  finally{driveBusy=false;$('driveSave').disabled=false;if(driveRevision!==revision)scheduleDriveSave();}
}
function scheduleDriveSave(){clearTimeout(driveTimer);if(driveToken&&$('driveAutosave').checked)driveTimer=setTimeout(saveToDrive,1400);}
$('driveConnect').onclick=connectDrive;$('driveSave').onclick=saveToDrive;$('driveAutosave').onchange=()=>{localStorage.setItem('aether-atlas-drive-autosave',$('driveAutosave').checked);if($('driveAutosave').checked)scheduleDriveSave();};
$('export').onclick=()=>{
  end();const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  for(const l of layers)if(l.visible){g.globalAlpha=l.opacity;drawLayer(g,l);}g.globalAlpha=1;
  Billboards.draw(g,Billboards.collect(layers,$('underground').checked),scene,{yaw:0,tilt:0,relief:0,zoom:1,cx:W/2,cy:H/2},layers,W,H);
  c.toBlob(b=>{if(b){download(b,'.png');notify('Planta exportada em PNG.');}});
};
function exportImage(){
  end();draw(false);
  const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
  const g=c.getContext('2d'),background=g.createRadialGradient(c.width*.45,c.height*.4,0,c.width*.45,c.height*.4,Math.max(c.width,c.height)*.8);
  background.addColorStop(0,'#304e59');background.addColorStop(1,'#152c39');g.fillStyle=background;g.fillRect(0,0,c.width,c.height);g.drawImage(canvas,0,0);
  draw();c.toBlob(b=>{if(b){download(b,'-perspectiva.png');notify('Imagem exportada com a rotação e perspectiva atuais.');}});
}
$('exportImage').onclick=exportImage;
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>80*1024*1024)throw Error('Arquivo muito grande (máximo 80 MB).');const d=JSON.parse(await f.text());if(d.format!=='aether-atlas'||![1,2,3,4].includes(d.version)||d.width!==W||d.height!==H||!Array.isArray(d.layers)||!d.layers.length||d.layers.length>16)throw Error('Projeto incompatível.');const imported=await Promise.all(d.layers.map(async v=>{if(typeof v.name!=='string'||typeof v.visible!=='boolean'||typeof v.locked!=='boolean'||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||typeof v.image!=='string'||!v.image.startsWith('data:image/png;base64,'))throw Error('Camada inválida.');const im=new Image();im.src=v.image;await im.decode();if(im.width!==W||im.height!==H)throw Error('Dimensões de camada inválidas.');const l=layer(v.name);l.visible=v.visible;l.locked=v.locked;l.opacity=v.opacity;if(d.version>=2)l.terrain=Terrain.validate(v.terrain);l.c.getContext('2d').drawImage(im,0,0);l.objects=Billboards.validate(v.objects??[]);l.routes=MapPaths.validate(v.routes??[]);
if(v.overlay){if(typeof v.overlay!=='string'||!v.overlay.startsWith('data:image/png;base64,'))throw Error('Pintura inválida.');const overlay=new Image();overlay.src=v.overlay;await overlay.decode();if(overlay.width!==W||overlay.height!==H)throw Error('Dimensões de pintura inválidas.');ink(l).getContext('2d').drawImage(overlay,0,0);}
if(v.tunnels!==undefined){if(!Array.isArray(v.tunnels)||v.tunnels.length>1000)throw Error('Túneis inválidos.');for(const t of v.tunnels){if(!t||![t.a,t.b].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<W&&p.y<H)||!Number.isFinite(t.width)||t.width<1||t.width>200||!Number.isFinite(t.depth)||t.depth<5||t.depth>500)throw Error('Túnel inválido.');}l.tunnels=v.tunnels;}return l;}));if(dirty&&!confirm('Substituir o projeto com alterações não salvas?'))return;end();layers=imported;activeRoute=null;tunnelStart=null;Terrain.setTheme(d.theme||Terrain.defaultTheme);const theme=Terrain.getTheme();$('grassColor').value=theme.grass;$('treeColor').value=theme.trees;$('waterColor').value=theme.water;$('lavaColor').value=theme.lava;textureDirty=true;if(d.camera){yaw=normalizeAngle((Number.isFinite(d.camera.yaw)?d.camera.yaw:0));tilt=Math.max(0,Math.min(65,(Number.isFinite(d.camera.tilt)?d.camera.tilt:0)));relief=Math.max(0,Math.min(2,(Number.isFinite(d.camera.relief)?d.camera.relief:1)));$('relief').value=relief;}if(d.view){for(const [id,key] of [['textures','texture'],['shade','shade'],['contours','contours'],['altitude','altitude']])if(typeof d.view[key]==='boolean')$(id).checked=d.view[key];if([50,100,250,500].includes(d.view.interval))$('interval').value=d.view.interval;}active=layers.length-1;history=[];future=[];$('title').value=typeof d.title==='string'?d.title:'Mapa importado';dirty=false;$('saved').textContent='Projeto importado';render();fit();if(!e.fromDrive){driveLocalProject=true;driveFileId='';clearTimeout(driveTimer);driveRevision++;dirty=true;$('saved').textContent='JSON local · ainda não salvo no Drive';driveStatus('JSON local aberto. Clique em Salvar no Drive agora para criar uma cópia e vinculá-la à API.');}notify('Projeto aberto.');return true;}catch(err){notify('Não foi possível abrir: '+err.message);return false;}finally{e.target.value='';}};
$('new').onclick=()=>{if(!confirm('Criar um mapa vazio? Salve o projeto atual antes de continuar.'))return;remember();tunnelStart=null;layers=[layer('Terreno'),layer('Detalhes'),layer('Marcadores')];active=0;$('title').value='Meu novo mundo';changed();fit();};$('title').oninput=changed;

for(const [id,unit] of [['strength','%'],['amount',' m'],['iconSize',' px'],['rotation','°']])$(id).oninput=()=>$(id+'Value').textContent=$(id).value+unit;
for(const id of ['textures','shade','contours','altitude','interval'])$(id).onchange=changed;
Object.entries(Buildings.names).forEach(([id,name])=>{const b=document.createElement('button'),preview=document.createElement('canvas');preview.width=76;preview.height=70;Buildings.draw(preview.getContext('2d'),38,36,id,42);b.append(preview,document.createTextNode(name));b.title='Inserir '+name.toLowerCase();b.onclick=()=>{selectedBuilding=id;document.querySelectorAll('#buildings button').forEach(v=>v.classList.toggle('selected',v===b));document.querySelector('[data-tool="marker"]').click();};$('buildings').append(b);});
$('marker').onchange=()=>{selectedBuilding=null;document.querySelectorAll('#buildings button').forEach(v=>v.classList.remove('selected'));document.querySelector('[data-tool="marker"]').click();};
$('heightExport').onclick=()=>{const c=document.createElement('canvas');c.width=400;c.height=275;const g=c.getContext('2d'),im=g.createImageData(400,275);for(let y=0;y<275;y++)for(let x=0;x<400;x++){const h=Terrain.sample(layers,x*4+2,y*4+2),k=(y*400+x)*4,v=Math.round(((h??0)+500)/3500*255);im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=h===null?0:255;}g.putImageData(im,0,0);c.toBlob(b=>{if(b)download(b,'-altura.png');});notify('Altura: preto = −500 m; branco = 3.000 m.');};

window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='Escape'){tunnelStart=null;end();closePanels();draw();}if(e.code==='Space'){space=true;e.preventDefault();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}});window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;end();});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});new ResizeObserver(()=>{if(!layers.length)return;fit();}).observe($('viewport'));
$('bearing').oninput=()=>{yaw=+$('bearing').value;draw();};
$('tilt').oninput=()=>{tilt=+$('tilt').value;draw();};
$('relief').oninput=()=>{relief=+$('relief').value;draw();};
$('viewTop').onclick=()=>{tilt=0;fit();};$('view3d').onclick=()=>{tilt=48;fit();};
$('resetCamera').onclick=()=>{yaw=0;tilt=0;fit();};
$('turnLeft').onclick=()=>{yaw=normalizeAngle(yaw-30);draw();};$('turnRight').onclick=()=>{yaw=normalizeAngle(yaw+30);draw();};
$('underground').onchange=()=>{textureDirty=true;draw();};
$('viewExport').onclick=exportImage;
function closePanels(){document.body.classList.remove('show-tools','show-layers');for(const id of ['mobileTools','mobileLayers'])$(id).setAttribute('aria-expanded','false');$('panelBackdrop').hidden=true;}
for(const [id,cls] of [['mobileTools','show-tools'],['mobileLayers','show-layers']])$(id).onclick=()=>{const open=document.body.classList.contains(cls);closePanels();if(!open){document.body.classList.add(cls);$(id).setAttribute('aria-expanded','true');$('panelBackdrop').hidden=false;}};
document.querySelectorAll('.close-panel').forEach(b=>b.onclick=closePanels);$('panelBackdrop').onclick=closePanels;
demo();
restoreDriveSession();
