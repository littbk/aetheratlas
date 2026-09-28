'use strict';
const $=id=>document.getElementById(id), W=1600,H=1100;
const rollSetting=document.createElement('div');rollSetting.className='setting';
rollSetting.innerHTML='<label for="roll">Rotação Z <span id="rollValue">0°</span></label><input id="roll" type="range" min="-180" max="180" value="0">';
document.querySelector('label[for="tilt"]').closest('.setting').after(rollSetting);
const canvas=$('map'),ctx=canvas.getContext('2d');
const colors=[['Pradaria','#87a56b'],['Floresta','#336349'],['Areia','#d3c591'],['Montanha','#9aab9a'],['Neve','#dee3d4'],['Água','#347787'],['Lava','#d84a1c']];
const toolList=[['pan','✥','Navegar'],['select','↖','Seletor'],['orbit','⟳','Orbitar'],['player','⌖','LOCAL ATUAL'],['submap','↗','Entrada submapa'],['tunnel','∩','Túnel'],['brush','◉','Terreno'],['fog','☁','FOG'],['water','≈','Água'],['waterRemove','−','Remover água'],['seaErase','◌','Borracha do mar'],['raise','↟','Elevar'],['mountain','▲','Montanha'],['volcano','♨','Vulcão'],['lower','↧','Rebaixar'],['smooth','≋','Suavizar'],['blend','〰','Misturar bordas'],['plateau','▰','Platô'],['color','◌','Cor livre'],['river','≈','Rio'],['path','⌁','Caminho'],['marker','◇','Marcador'],['text','T','Texto'],['erase','▱','Borracha']];
const indoorToolList=[['wall','━','Muro'],['room','▣','Sala'],['corridor','▤','Corredor'],['floor','▦','Piso ladrilhado'],['rect','▱','Retângulo'],['rectFill','■','Piso quadrado'],['ellipse','◯','Círculo'],['ellipseFill','●','Círculo preenchido'],['line','╱','Linha'],['door','▯','Porta'],['window','⊞','Janela'],['stairs','▥','Escada'],['pillar','◉','Pilar'],['pit','⬭','Fosso']];
let layers=[],patches=[],playerLocation={x:4000,y:2200},active=0,tool='pan',zoom=1,ox=0,oy=0,grid=false,down=false,last=null,space=false,history=[],future=[],dirty=false,timer,submapEdit=null;
let selectedBiome='grass', selectedBuilding=null, strokeDistance=0;
const viewSettings=()=>({texture:$('textures').checked,shade:$('shade').checked,contours:$('contours').checked,altitude:$('altitude').checked,interval:+$('interval').value,planetGuides:planetGuide.marks,planetSpin:planetGuide.spinning,autoGroupWalls:$('architectureAutoGroup')?.checked!==false,planet:$('planetMode')?.checked||false});
let activeRoute=null,billboardHits=[];
const scene=new AtlasScene(), mapTexture=document.createElement('canvas');
mapTexture.width=W;mapTexture.height=H;
let flatRegion=null,flatCamera=null;
const worldMode=()=>layers.some(l=>l.planet?.enabled);
let textureDirty=true, yaw=matchMedia('(max-width:860px)').matches?-65:-12, tilt=matchMedia('(max-width:860px)').matches?28:38, roll=0, relief=1, tunnelStart=null;
const camera=()=>{const planet=worldMode()&&!flatRegion;return {yaw,tilt,roll,flatRegion,relief:planet||tilt||submapEdit?relief:0,zoom,cx:ox,cy:oy,planet};};
const navigation=new AtlasNavigation({canvas,stage:$('viewport'),read:camera,write:c=>{if(c.yaw!==undefined)yaw=c.yaw;if(c.tilt!==undefined)tilt=c.tilt;if(c.roll!==undefined)roll=c.roll;if(c.zoom!==undefined)zoom=c.zoom;if(c.cx!==undefined)ox=c.cx;if(c.cy!==undefined)oy=c.cy;},draw,scene,layers:()=>layers,location:()=>playerLocation});
const regionView=new AtlasRegionView({canvas,stage:$('viewport'),scene,read:camera,world:()=>worldMode()&&!!scene.gl,editable:true,active:()=>flatRegion,enter:enterFlatRegion,exit:leaveFlatRegion});
const planetGuide=new AtlasPlanetGuides({scene,read:camera,write:c=>{if(c.yaw!==undefined)yaw=c.yaw;if(c.tilt!==undefined)tilt=c.tilt;if(c.roll!==undefined)roll=c.roll;},redraw:draw,allowed:()=>camera().planet&&!!scene.gl&&!navigation.walking,marksButton:$('planetGuides'),spinButton:$('planetSpin'),settingsButton:$('planetAxis'),axisPanel:$('planetAxisPanel')});
function enterFlatRegion(region){if(!worldMode())return;if(navigation.walking)navigation.toggle(false);end();flatCamera={yaw,tilt,roll,relief,zoom,ox,oy};flatRegion={...region};yaw=0;tilt=38;roll=0;relief=1;navigation.panel.querySelector('[data-nav="walk"]').disabled=true;textureDirty=true;fit();regionView.sync();}
function leaveFlatRegion(){if(!flatRegion)return;end();flatRegion=null;if(flatCamera)({yaw,tilt,roll,relief,zoom,ox,oy}=flatCamera);flatCamera=null;navigation.panel.querySelector('[data-nav="walk"]').disabled=false;textureDirty=true;draw();regionView.sync();}
$('tilt').min=-180;$('tilt').max=180;
function drawLayer(g,l){g.drawImage(l.c,0,0);g.drawImage(Terrain.render(l.terrain,viewSettings()),0,0,W,H);MapPaths.draw(g,l.routes);if(l.ink)g.drawImage(l.ink,0,0);Structures.drawPlan(g,l.structures);for(const tunnel of l.tunnels)drawTunnel(g,tunnel);}
function drawTunnel(g,t){
  if(!$('underground').checked)return;
  g.save();g.lineCap='round';g.beginPath();g.moveTo(t.a.x,t.a.y);g.lineTo(t.b.x,t.b.y);
  g.strokeStyle='#102d3199';g.lineWidth=t.width+7;g.stroke();
  g.strokeStyle='#e6c48b';g.lineWidth=2;g.setLineDash([7,7]);g.stroke();g.restore();
}
function addTunnel(p){return atRegion(p,addTunnelLocal);}
function addTunnelLocal(p){
  const region=regionContext?WorldSurface.key(regionContext.gx,regionContext.gy):'0,0';if(tunnelStart&&tunnelStart.region!==region){tunnelStart=null;notify('As duas entradas do túnel devem estar na mesma região.');return;}
  if(!tunnelStart){tunnelStart={x:p.x,y:p.y,layer:active,region};notify('Entrada marcada. Toque no ponto de saída do túnel.');draw();return;}
  if(tunnelStart.layer!==active){tunnelStart=null;notify('Selecione as duas entradas na mesma camada.');return;}
  if(Math.hypot(p.x-tunnelStart.x,p.y-tunnelStart.y)<24){notify('A saída precisa estar um pouco mais distante.');return;}
  if(layers[active].tunnels.length>=1000){tunnelStart=null;notify('Limite de 1.000 túneis por camada.');return;}
  remember();layers[active].tunnels.push({a:{x:tunnelStart.x,y:tunnelStart.y},b:{x:p.x,y:p.y},width:Math.max(14,+$('size').value*.5),depth:Math.max(5,Math.min(500,Number($('tunnelDepth').value)||90)),hollow:true,route:[{x:tunnelStart.x,y:tunnelStart.y,z:-Math.max(5,Number($('tunnelDepth').value)||90)},{x:p.x,y:p.y,z:-Math.max(5,Number($('tunnelDepth').value)||90)}]});
  tunnelStart=null;changed();notify('Túnel construído. As duas entradas estão conectadas.');
}

function ink(l){if(!l.ink){l.ink=document.createElement('canvas');l.ink.width=W;l.ink.height=H;}return l.ink;}
function layer(name){const c=document.createElement('canvas');c.width=W;c.height=H;return{id:crypto.randomUUID(),name,visible:true,locked:false,opacity:1,planet:{enabled:$('planetMode')?.checked||false},c,ink:null,objects:[],routes:[],tunnels:[],structures:[],terrain:Terrain.create()};}
function notify(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function changed(){if(regionContext){regionContext.changed=true;textureDirty=true;return;}driveRevision++;textureDirty=true;dirty=true;$('saved').textContent='Alterações não salvas';render();scheduleDriveSave();}
function snapshot(){return layers.map(l=>({id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,planet:structuredClone(l.planet||{enabled:false}),terrain:Terrain.copy(l.terrain),tunnels:structuredClone(l.tunnels),objects:structuredClone(l.objects),routes:structuredClone(l.routes),structures:structuredClone(l.structures||[]),tiles:WorldSurface.snapshot(l.tiles),ink:l.ink?.getContext('2d').getImageData(0,0,W,H)||null,data:l.c.getContext('2d').getImageData(0,0,W,H)}));}
function patchSnapshot(){return patches.map(p=>({...p}));}
function remember(){if(regionContext){const local=layers;const context=regionContext;layers=context.root;regionContext=null;try{return remember();}finally{layers=local;regionContext=context;}}history.push({layers:snapshot(),patches:patchSnapshot(),playerLocation:{...playerLocation},active});if(history.length>20)history.shift();future=[];}
function restore(s){tunnelStart=null;activeRoute=null;layers=s.layers.map(v=>{let l=layer(v.name);Object.assign(l,{id:v.id||crypto.randomUUID(),visible:v.visible,locked:v.locked,opacity:v.opacity,planet:structuredClone(v.planet||{enabled:false})});l.c.getContext('2d').putImageData(v.data,0,0);l.terrain=Terrain.restore(v.terrain);l.tunnels=structuredClone(v.tunnels||[]);l.objects=structuredClone(v.objects||[]);l.routes=structuredClone(v.routes||[]);l.structures=structuredClone(v.structures||[]);l.tiles=WorldSurface.recover(v.tiles);if(v.ink)ink(l).getContext('2d').putImageData(v.ink,0,0);return l;});patches=s.patches||[];playerLocation=s.playerLocation||{x:4000,y:2200};active=s.active;refreshPatches();changed();}
function undo(redo=false){let src=redo?future:history,dst=redo?history:future;if(!src.length)return;dst.push({layers:snapshot(),patches:patchSnapshot(),playerLocation:{...playerLocation},active});restore(src.pop());}
function render(){window.syncSelection?.();window.syncVegetationColors?.();document.querySelector('.map-tag').firstChild.textContent=$('title').value||'MEU MUNDO';draw();$('layers').replaceChildren();[...layers.keys()].reverse().forEach(i=>{const l=layers[i],row=document.createElement('div');row.className='layer'+(active===i?' selected':'');const eye=document.createElement('button');eye.textContent=l.visible?'◉':'○';eye.title=l.visible?'Ocultar camada':'Mostrar camada';eye.onclick=e=>{e.stopPropagation();remember();l.visible=!l.visible;changed();};const name=document.createElement('span');name.className='name';name.textContent=l.name;const small=document.createElement('small');small.textContent=Math.round(l.opacity*100)+'% · '+(l.locked?'Bloqueada':'Editável');name.append(small);const lock=document.createElement('button');lock.textContent=l.locked?'▣':'▢';lock.title=l.locked?'Desbloquear':'Bloquear';lock.onclick=e=>{e.stopPropagation();remember();l.locked=!l.locked;changed();};row.append(eye,name,lock);row.onclick=()=>{tunnelStart=null;active=i;render();};$('layers').append(row);});$('opacity').value=layers[active].opacity*100;$('opacityValue').textContent=$('opacity').value+'%';$('count').textContent=layers.length+' camadas';if($('worldSize'))$('worldSize').textContent=submapEdit?'1.600 × 1.100 px':'8.000 × 4.400 px';$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function compose(){
  const g=mapTexture.getContext('2d');g.clearRect(0,0,W,H);
  for(const l of layers)if(l.visible){g.globalAlpha=l.opacity;drawLayer(g,l);}g.globalAlpha=1;
  if(grid){g.strokeStyle='#f4edcf38';g.lineWidth=1;g.beginPath();for(let x=0;x<=W;x+=50){g.moveTo(x,0);g.lineTo(x,H);}for(let y=0;y<=H;y+=50){g.moveTo(0,y);g.lineTo(W,y);}g.stroke();}
  scene.update(mapTexture,layers,{...camera(),terrainView:viewSettings()},patches);textureDirty=false;
}
function draw(decorations=true){
  if(regionContext)return;
  regionView.sync();
  if(navigation.walking)navigation.center();
  const r=$('viewport').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(!r.width||!r.height)return;
  if(canvas.width!==Math.round(r.width*d)||canvas.height!==Math.round(r.height*d)){canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);}
  ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);
  if(textureDirty)compose();
  const result=scene.draw(r.width,r.height,d,camera());
  if(result)ctx.drawImage(result,0,0,r.width,r.height);
  else{tilt=0;ctx.save();ctx.translate(ox,oy);ctx.rotate((yaw+roll)*Math.PI/180);ctx.scale(zoom,zoom);ctx.drawImage(mapTexture,-W/2,-H/2);ctx.translate(-W/2,-H/2);Terrain.drawFog(ctx,layers,.35);ctx.restore();$('cameraNote').textContent='Vista plana: aceleração 3D indisponível neste navegador.';}
  if(decorations)planetGuide.draw(ctx);else planetGuide.sync();
  billboardHits=Billboards.draw(ctx,Billboards.collect(layers,$('underground').checked),scene,camera(),layers,r.width,r.height);
  if(!navigation.walking)Billboards.drawPlayerPivot(ctx,scene,camera(),playerLocation,r.width,r.height,layers);
  Billboards.drawSubmapEntries(ctx,patches,scene,camera(),r.width,r.height);
  drawConstructionPreview(ctx);
  navigation.drawCharacter(ctx);if(decorations)window.drawSelection?.(ctx);
  if(decorations&&tunnelStart){const h=Math.max(0,Terrain.sample(layers,tunnelStart.x,tunnelStart.y)||0)*.065,p=scene.project(tunnelStart.x,tunnelStart.y,h,camera());ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.strokeStyle='#ffe1a5';ctx.lineWidth=2;ctx.stroke();}
  $('zoom').textContent=Math.round(zoom*100)+'%';$('bearingValue').textContent=Math.round(yaw)+'°';$('bearing').value=yaw;
  $('tiltValue').textContent=Math.round(tilt)+'°';$('tilt').value=tilt;
  $('rollValue').textContent=Math.round(roll)+'°';$('roll').value=roll;
  document.querySelector('.compass').style.transform='rotate('+(camera().planet?roll:yaw+roll)+'deg)';
  $('viewTop').classList.toggle('active',tilt===0);$('view3d').classList.toggle('active',tilt!==0);
}
function fit(){
  const r=$('viewport').getBoundingClientRect(),c={...camera(),cx:0,cy:0,zoom:1};
  if(c.planet){zoom=Math.min(r.width,r.height)/1168*.87;ox=r.width/2;oy=r.height/2;draw();return;}
  const corners=flatRegion?[[flatRegion.x,flatRegion.y],[flatRegion.x+flatRegion.width,flatRegion.y],[flatRegion.x,flatRegion.y+flatRegion.height],[flatRegion.x+flatRegion.width,flatRegion.y+flatRegion.height]].map(([x,y])=>scene.project(x-3200,y-1650,0,c)):layers.some(l=>l.planet?.enabled)?Array.from({length:32},(_,i)=>{const a=i*Math.PI*2/32;return scene.project(800+800*Math.cos(a),550+550*Math.sin(a),0,c);}):[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>scene.project(x,y,0,c));
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
  let p=scene.gl?scene.pick(sx,sy,tool==='water'||tool==='waterRemove'||tool==='seaErase'):null;
  if(!scene.gl){const a=-(yaw+roll)*Math.PI/180,x=(sx-ox)/zoom,y=(sy-oy)/zoom;if(camera().planet){const radius=470*zoom,lon=((x/radius-yaw*Math.PI/180)/(Math.PI*2)+.5)*AtlasScene.WORLD_WIDTH,lat=(.5-y/radius)*AtlasScene.WORLD_HEIGHT;p={worldX:lon,worldY:lat,x:lon-AtlasScene.REGION_X,y:lat-AtlasScene.REGION_Y};}else p={x:W/2+x*Math.cos(a)-y*Math.sin(a),y:H/2+x*Math.sin(a)+y*Math.cos(a)};}
  const hit=tool==='erase'?[...billboardHits].reverse().find(h=>h.layer===active&&sx>=h.box.x&&sx<=h.box.x+h.box.w&&sy>=h.box.y&&sy<=h.box.y+h.box.h):null;
  if(hit)p={x:hit.object.x,y:hit.object.y,worldX:hit.object.x+3200,worldY:hit.object.y+1650};
  return {x:p?.x??-1,y:p?.y??-1,worldX:p?.worldX??(p?(submapEdit?p.x:AtlasScene.REGION_X+p.x):null),worldY:p?.worldY??(p?(submapEdit?p.y:AtlasScene.REGION_Y+p.y):null),sx:e.clientX,sy:e.clientY,hit,inside:!!p&&(worldMode()?p.worldX>=0&&p.worldX<8000&&p.worldY>=0&&p.worldY<4400:p.x>=0&&p.y>=0&&p.x<W&&p.y<H)};
}
let regionContext=null;
function inRegion(gx,gy,callback){
  const root=layers,local=WorldSurface.group(root,gx,gy,active),previous=regionContext;regionContext={root,gx,gy,changed:false};layers=local;
  try{return callback();}finally{
    for(const l of local)if(l.source)for(const name of ['ink','c','terrain','objects','routes','tunnels','structures'])l.source[name]=l[name];
    const changedHere=regionContext.changed;layers=root;regionContext=previous;if(changedHere)changed();
  }
}
function atRegion(p,callback){if(!worldMode())return callback(p);const {gx,gy}=WorldSurface.locate(p.x,p.y);return inRegion(gx,gy,()=>callback({...p,x:p.x-gx*W,y:p.y-gy*H,hit:p.hit?{...p.hit,object:p.hit.originalObject||p.hit.object}:null}));}
function paint(a,b){
  if(!worldMode())return paintLocal(a,b);
  let dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>4000)dx-=Math.sign(dx)*8000;
  const spacing=Math.max(2,+$('size').value*.13),steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/spacing)),radius=+$('size').value/2;
  for(let i=0;i<=steps;i++){
    const p={...b,x:((a.x+dx*i/steps+3200)%8000+8000)%8000-3200,y:a.y+dy*i/steps};
    if(tool==='river'||tool==='path'){
      const {gx,gy}=WorldSurface.locate(p.x,p.y),key=WorldSurface.key(gx,gy);if(activeRoute?.region!==key)activeRoute=null;
      inRegion(gx,gy,()=>{paintLocal({...p,x:p.x-gx*W,y:p.y-gy*H},{...p,x:p.x-gx*W,y:p.y-gy*H});if(activeRoute)activeRoute.region=key;});
    }else {const stretch=Math.min(12,1/Math.max(.08,Math.cos((.5-(p.y+1650)/4400)*Math.PI)));for(const r of WorldSurface.affected(p.x,p.y,radius,stretch))inRegion(r.gx,r.gy,()=>{regionContext.stretch=stretch;const q={...p,x:r.x,y:r.y,hit:p.hit?{...p.hit,object:p.hit.originalObject||p.hit.object}:null};paintLocal(q,q);});}
  }
  draw();
}
function paintLocal(a,b){
  textureDirty=true;
  if(tool==='fog'){const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/Math.max(2,+$('size').value*.15)));for(let i=0;i<=steps;i++)Terrain.fogStamp(layers[active].terrain,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,+$('size').value,$('fogReveal').checked,regionContext?.stretch||1);draw();return;}
  if(tool==='seaErase'){const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/Math.max(2,+$('size').value*.15)));for(let i=0;i<=steps;i++)Terrain.seaErase(layers,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,+$('size').value,regionContext?.stretch||1);for(const layer of layers)if(!layer.locked){for(const surface of [layer.c,layer.ink])if(surface){const g=surface.getContext('2d');g.save();g.globalCompositeOperation='destination-out';g.lineCap='round';g.lineWidth=+$('size').value;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x+.001,b.y);g.stroke();g.restore();}}draw();return;}
  if(tool==='river'||tool==='path'){extendRoute(b);draw();return;}
  if(tool==='erase'&&b.hit){const l=layers[active];if(b.hit.tunnel)l.tunnels=l.tunnels.filter(t=>t!==b.hit.tunnel);else l.objects=l.objects.filter(o=>o!==b.hit.object);draw();return;}
  const smart=['brush','raise','mountain','volcano','lower','smooth','blend','plateau','erase'].includes(tool);
  if(smart){
    const spacing=Math.max(2,+$('size').value*.13),distance=Math.hypot(b.x-a.x,b.y-a.y);
    const stamp=p=>Terrain.stamp(layers,active,p.x,p.y,{mode:tool,biome:selectedBiome,stretch:regionContext?.stretch||1,size:+$('size').value,strength:tool==='erase'?1:+$('strength').value/100,soft:$('soft').checked,integrate:$('integrate').checked,amount:tool==='mountain'||tool==='volcano'?Math.max(250,+$('amount').value*6):+$('amount').value,target:Math.max(-500,Math.min(3000,Number($('target').value)||0))});
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
const architectureOptions=()=>({color:$('architectureColor')?.value||'#b6ad98',height:+$('architectureHeight')?.value||26,material:$('architectureMaterial')?.value||'limestone'});
const architectureSize=()=>($('architectureWidth')?+$('architectureWidth').value/.32:+$('size').value);
function indoorParts(kind,a,b){
  const color=architectureOptions().color,thickness=Math.max(3,architectureSize()*.32),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=len>1?dx/len:1,uy=len>1?dy/len:0,nx=-uy,ny=ux;
  if(len<8){b={x:a.x+48,y:a.y+32};}
  const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y),w=Math.max(8,x1-x0),h=Math.max(8,y1-y0),cx=(x0+x1)/2,cy=(y0+y1)/2;
  const poly=(points,style={})=>({points:points.map(p=>Array.isArray(p)?{x:p[0],y:p[1]}:p),close:false,color,...style}),box=(fill=false,stroke=color,width=Math.max(2,+$('size').value*.12),fillColor=color)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],{close:true,fill:fill?fillColor:null,stroke,lineWidth:width});
  const ellipse=(cx,cy,rx,ry,steps=48)=>Array.from({length:steps},(_,i)=>{const t=i*Math.PI*2/steps;return{x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};});
  const parallel=(offset)=>[{x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset}];
  const parts=[];
  switch(kind){
    case 'line':parts.push(poly([a,b],{stroke:color,lineWidth:Math.max(2,+$('size').value*.12)}));break;
    case 'wall':parts.push(poly([a,b],{stroke:'#242c2b',lineWidth:thickness+5,cap:'square'}),poly([a,b],{stroke:color,lineWidth:thickness,cap:'square'}));for(let t=36;t<len;t+=36){const x=a.x+ux*t,y=a.y+uy*t;parts.push(poly([{x:x+nx*thickness*.52,y:y+ny*thickness*.52},{x:x-nx*thickness*.52,y:y-ny*thickness*.52}],{stroke:'#252d2b',lineWidth:2}));}break;
    case 'rect':parts.push(box(false,color,Math.max(2,+$('size').value*.12)));break;
    case 'rectFill':parts.push(box(true,color,2));break;
    case 'ellipse':parts.push(poly(ellipse(cx,cy,w/2,h/2),{close:true,stroke:color,lineWidth:Math.max(2,+$('size').value*.12)}));break;
    case 'ellipseFill':parts.push(poly(ellipse(cx,cy,w/2,h/2),{close:true,fill:color,stroke:'#26302d',lineWidth:2}));break;
    case 'room':parts.push(box(true,color,2),box(false,'#202927',thickness+5),box(false,'#d4c8a2',thickness));for(const [x,y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y1]])parts.push(poly([{x:x-3,y:y-3},{x:x+3,y:y+3}],{stroke:'#29322f',lineWidth:3}));break;
    case 'corridor':{const half=thickness*1.8,band=[{x:a.x+nx*half,y:a.y+ny*half},{x:b.x+nx*half,y:b.y+ny*half},{x:b.x-nx*half,y:b.y-ny*half},{x:a.x-nx*half,y:a.y-ny*half}];parts.push(poly(band,{close:true,fill:color,stroke:'#202927',lineWidth:thickness*.55}),poly(parallel(half*.7),{stroke:'#d4c8a2',lineWidth:2}),poly(parallel(-half*.7),{stroke:'#d4c8a2',lineWidth:2}));break;}
    case 'floor':{parts.push(box(true,color,2));for(let x=x0+32;x<x1;x+=32)parts.push(poly([{x,y:y0},{x,y:y1}],{stroke:'#26302d88',lineWidth:1}));for(let y=y0+32;y<y1;y+=32)parts.push(poly([{x:x0,y},{x:x1,y}],{stroke:'#26302d88',lineWidth:1}));parts.push(box(false,'#e0d3b0',2));break;}
    case 'door':parts.push(poly([a,b],{stroke:'#46392e',lineWidth:thickness+4,cap:'square'}),poly([a,b],{stroke:'#96653e',lineWidth:Math.max(3,thickness*.6),cap:'square'}));break;
    case 'window':{const gap=thickness*.55;parts.push(poly([a,b],{stroke:'#252c29',lineWidth:thickness+5,cap:'square'}),poly([a,b],{stroke:'#75b7bd',lineWidth:gap,cap:'square'}),poly(parallel(gap*.7),{stroke:'#e3d5b3',lineWidth:2}),poly(parallel(-gap*.7),{stroke:'#e3d5b3',lineWidth:2}));for(const t of [.25,.75]){const x=a.x+dx*t,y=a.y+dy*t;parts.push(poly([{x:x+nx*gap,y:y+ny*gap},{x:x-nx*gap,y:y-ny*gap}],{stroke:'#e4d4ad',lineWidth:2}));}break;}
    case 'stairs':{parts.push(box(true,'#8e8974',2,'#8e8974'));const count=Math.max(3,Math.min(12,Math.round(Math.max(w,h)/20)));if(w>=h){for(let i=1;i<count;i++){const x=x0+w*i/count;parts.push(poly([{x,y:y0},{x,y:y1}],{stroke:'#e1d4b2',lineWidth:2}));}}else{for(let i=1;i<count;i++){const y=y0+h*i/count;parts.push(poly([{x:x0,y},{x:x1,y}],{stroke:'#e1d4b2',lineWidth:2}));}}parts.push(box(false,'#252d2b',3));break;}
    case 'pillar':parts.push(poly(ellipse(cx,cy,w/2,h/2),{close:true,fill:color,stroke:'#202927',lineWidth:3}),poly(ellipse(cx,cy,w*.36,h*.36),{close:true,stroke:'#e9ddb9',lineWidth:2}));break;
    case 'pit':parts.push(poly(ellipse(cx,cy,w/2,h/2),{close:true,fill:'#252c2d',stroke:color,lineWidth:Math.max(3,thickness*.35)}),poly(ellipse(cx,cy,w*.38,h*.38),{close:true,stroke:'#090f12',lineWidth:4}),poly(ellipse(cx,cy,w*.28,h*.28),{close:true,stroke:'#75807a',lineWidth:1}));break;
  }
  for(const part of parts)part.material=kind==='door'?'wood':kind==='window'?'glass':part.fill?'tile':'stone';
  return parts;
}
function carvePit(layer,parts){const outline=parts[0]?.points||[],xs=outline.map(p=>p.x),ys=outline.map(p=>p.y);if(!xs.length)return;const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.max(4,(x1-x0)/2),ry=Math.max(4,(y1-y0)/2),depth=45,t=layer.terrain;for(let j=Math.max(0,Math.floor(y0/4));j<=Math.min(274,Math.ceil(y1/4));j++)for(let i=Math.max(0,Math.floor(x0/4));i<=Math.min(399,Math.ceil(x1/4));i++){const px=i*4+2,py=j*4+2,d=Math.hypot((px-cx)/rx,(py-cy)/ry);if(d>=1)continue;const k=j*400+i,base=Terrain.sample(layers,px,py)??0,fall=(1-d*d)**2;t.heights[k]=Math.max(-500,base-depth*fall);t.coverage[k]=255;t.biomes[k]=4;}t.dirty=true;}
function finishConstruction(a,b){
  if(!worldMode())return finishConstructionLocal(a,b);
  if(!a?.inside||!b?.inside)return false;
  const parts=indoorParts(tool,a,b),geometry=Structures.capture(tool,parts,architectureSize(),architectureOptions());
  for(let gy=-2;gy<=2;gy++)for(let gx=-2;gx<=2;gx++){
    const pieces=WorldSurface.geometry(geometry,gx,gy);if(!pieces.length)continue;
    inRegion(gx,gy,()=>{const l=layers[active];if(l.structures.length+pieces.length>3000)return;if(tool==='pit')carvePit(l,pieces);l.structures.push(...pieces);});
  }
  constructionStart=null;constructionPreview=null;changed();return true;
}
function finishConstructionLocal(a,b){if(!layers[active]||!a?.inside||!b?.inside)return false;const parts=indoorParts(tool,a,b),layer=layers[active],geometry=Structures.capture(tool,parts,architectureSize(),architectureOptions());if(layer.structures.length+geometry.length>3000){notify('Limite de 3.000 peças arquitetônicas por camada.');return false;}if(tool==='pit')carvePit(layer,parts);layer.structures.push(...geometry);textureDirty=true;constructionStart=null;constructionPreview=null;changed();return true;}
function drawConstructionPreview(g){if(!constructionPreview)return;const {tool,a,b}=constructionPreview,c=camera();g.save();g.globalAlpha=.65;g.setLineDash([5,4]);const meshes=Structures.capture(tool,indoorParts(tool,a,b),architectureSize(),architectureOptions());for(const part of meshes){const lift=part.height*(c.planet?.37:1),points=part.points.map(p=>scene.project(p.x,p.y,Math.max(0,Terrain.sample(layers,p.x,p.y)||0)*.065+lift,c));if(points.some(p=>p.visible===false))continue;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));if(part.close)g.closePath();if(part.fill){g.fillStyle=part.color;g.fill();}else{g.strokeStyle=part.color;g.lineWidth=part.width*zoom;g.stroke();}}g.restore();}
function placeMarker(p){return atRegion(p,placeMarkerLocal);}
function placeMarkerLocal(p){
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
function finishRoute(){for(const l of layers){l.routes=l.routes.filter(r=>r.points.length>1);for(const tile of l.tiles||[])tile.routes=tile.routes.filter(r=>r.points.length>1);}activeRoute=null;}
let panning=false,orbiting=false,pending=null,strokeStarted=false,gesture=null,constructionStart=null,constructionPreview=null;
const pointers=new Map();
let projectBundle={format:'aether-atlas-world',version:1,submaps:[]};
function beginPaint(p){
  if(tool==='select')return false;
  if(tool==='submap'){
    const selected=selectedPatch();if(!selected||selected.kind!=='submap'||!Number.isFinite(p.worldX)||!Number.isFinite(p.worldY)||p.worldX<0||p.worldX>8000||p.worldY<0||p.worldY>4400){notify('Selecione um submapa plano e clique sobre a superfície visível do planeta.');return false;}
    remember();selected.entry={x:p.worldX,y:p.worldY};changed();notify('Entrada do submapa fixada.');return false;
  }
  if(tool==='player'){
    if(!Number.isFinite(p.worldX)||!Number.isFinite(p.worldY)||p.worldX<0||p.worldX>8000||p.worldY<0||p.worldY>4400)return false;
    remember();playerLocation={x:p.worldX,y:p.worldY};changed();notify('LOCAL ATUAL definido. O visualizador abrirá neste ponto.');return false;
  }
  if(!p.inside)return false;
  if(layers[active].locked||!layers[active].visible){notify('Selecione uma camada visível e desbloqueada.');return false;}
  if(tool==='waterRemove'){
    let count=0;atRegion(p,q=>{const t=layers[active].terrain,cells=Terrain.waterRegion(t,q.x,q.y);if(!cells.length)return;remember();for(const k of cells){delete t.waterLevels[k];delete t.waterColors[k];}t.dirty=true;count=cells.length;});
    if(count){changed();notify('Região de água removida. O terreno foi preservado. Ctrl+Z para desfazer.');}else notify('Clique numa região de água da camada selecionada.');return false;
  }
  if(tool==='water'){
    if($('waterRecolor').checked){let count=0;atRegion(p,q=>{const t=layers[active].terrain,cells=Terrain.waterRegion(t,q.x,q.y);if(!cells.length)return;remember();for(const k of cells)t.waterColors[k]=$('lakeColor').value;t.dirty=true;count=cells.length;});if(count){changed();notify('Cor da água alterada. Ctrl+Z desfaz.');}else notify('Clique em um lago da camada selecionada.');return false;}
    let filled=null;atRegion(p,q=>{filled=Terrain.waterFill(layers,q.x,q.y,$('waterAuto').checked?null:Number($('waterLevel').value));if(!filled.cells.length)return;remember();const t=layers[active].terrain;for(const k of filled.cells){t.waterLevels[k]=filled.level;t.waterColors[k]=$('lakeColor').value;}t.dirty=true;});
    if(filled?.cells.length){changed();notify('Água adicionada até o nível '+Math.round(filled.level)+'. Ctrl+Z para desfazer.');}else notify('Clique no fundo de uma depressão ou escolha um nível de água mais alto.');return false;
  }
  if(tool==='tunnel'){addTunnel(p);return false;}
  if(tool==='text'&&!$('label').value.trim()){notify('Digite o nome ou texto no painel Ferramentas.');return false;}
  if(['marker','text'].includes(tool)&&layers[active].objects.length>=2000){notify('Limite de 2.000 marcadores por camada.');return false;}
  if(['river','path'].includes(tool)&&layers[active].routes.length>=2000){notify('Limite de trajetos atingido nesta camada.');return false;}
  if(indoorToolList.some(([id])=>id===tool)){remember();strokeStarted=true;constructionStart=p;constructionPreview={tool,a:p,b:p};draw();return true;}
  remember();strokeStarted=true;strokeDistance=0;activeRoute=null;
  if(tool==='marker')placeMarker(p);
  else if(tool==='text')atRegion(p,q=>layers[active].objects.push({kind:'text',x:q.x,y:q.y,size:Math.max(16,+$('iconSize').value*.65),rotation:0,text:$('label').value.trim().slice(0,240),color:$('color').value}));
  else paint(p,p);
  changed();return true;
}
function gestureState(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x)};}
canvas.onpointerdown=e=>{
  if(planetGuide.spinning)planetGuide.setSpinning(false);
  if(![0,1,2].includes(e.button))return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>1){pending=null;finishRoute();if(strokeStarted&&!constructionStart)changed();strokeStarted=false;constructionStart=null;constructionPreview=null;down=false;gesture=gestureState();return;}
  const p=point(e);orbiting=(tool==='orbit'||e.altKey||e.button===2)&&!space&&e.button!==1;panning=!orbiting&&(tool==='pan'||space||e.button===1||navigation.walking);
  down=true;last=p;strokeStarted=false;
  if(!panning&&!orbiting){if(e.pointerType==='touch')pending=p;else beginPaint(p);}
};
canvas.onpointermove=e=>{
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){
    const next=gestureState(),r=canvas.getBoundingClientRect();
    if(gesture){const f=next.d/Math.max(1,gesture.d),z=Math.max(.08,Math.min(5,zoom*f));
      ox=next.x-r.left-(gesture.x-r.left-ox)*z/zoom;oy=next.y-r.top-(gesture.y-r.top-oy)*z/zoom;zoom=z;
      roll=normalizeAngle(roll+Math.atan2(Math.sin(next.a-gesture.a),Math.cos(next.a-gesture.a))*180/Math.PI);
      if(tool==='orbit'){yaw=normalizeAngle(yaw+(next.x-gesture.x)*.35);tilt=AtlasNavigation.pitch(tilt-(next.y-gesture.y)*.25,camera().planet);}draw();}
    gesture=next;return;
  }
  const p=point(e);$('coords').textContent=p.inside?`X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`:'Fora do mapa';
  const h=p.inside?Terrain.sample(layers,p.x,p.y):null;
  $('altitudeReadout').textContent=h===null?'— m':Math.round(h)+' m';$('terrainReadout').textContent=h===null?'Passe sobre uma área de terreno':h<0?'Abaixo do nível do mar':h<70?'Costa e baixada':h<700?'Planície e colinas':h<1900?'Montanha':'Alta montanha';
  if(!down||!pointers.has(e.pointerId))return;
  if(orbiting){if(e.shiftKey)roll=normalizeAngle(roll+(p.sx-last.sx)*.35);else{yaw=normalizeAngle(yaw+(p.sx-last.sx)*.35);tilt=AtlasNavigation.pitch(tilt-(p.sy-last.sy)*.25,camera().planet);}draw();}
  else if(panning){ox+=p.sx-last.sx;oy+=p.sy-last.sy;draw();}
  else if(constructionStart){constructionPreview={tool,a:constructionStart,b:p};draw();}
  else{
    if(pending&&Math.hypot(p.sx-pending.sx,p.sy-pending.sy)>5){if(!['water','waterRemove','tunnel','marker','text','player','submap',...indoorToolList.map(v=>v[0])].includes(tool)){beginPaint(pending);pending=null;}}
    if(strokeStarted&&p.inside&&!['marker','text','tunnel'].includes(tool))paint(last.inside?last:p,p);
    if(!p.inside&&activeRoute){finishRoute();}
  }
  last=p;
};
function end(e){
  if(activeRoute&&e?.type==='pointerup'){const p=point(e);if(p.inside)paint(p,p);}
  finishRoute();
  if(constructionStart){if(e?.type==='pointerup'){const p=point(e);if(p.inside)finishConstruction(constructionStart,p);else{constructionStart=null;constructionPreview=null;strokeStarted=false;}}else{constructionStart=null;constructionPreview=null;strokeStarted=false;}}
  if(e){pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  else pointers.clear();
  if(gesture){if(pointers.size===0)gesture=null;pending=null;down=false;last=null;return;}
  if(pending&&e?.type==='pointerup'&&indoorToolList.some(([id])=>id===tool)){const p=point(e),start=pending;pending=null;if(start.inside&&p.inside&&beginPaint(start))finishConstruction(start,p);}
  else if(pending&&e?.type==='pointerup'&&Math.hypot(e.clientX-pending.sx,e.clientY-pending.sy)<12)beginPaint(pending);
  finishRoute();if(strokeStarted)changed();pending=null;strokeStarted=false;down=false;last=null;
}
canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=e=>{if(pointers.has(e.pointerId))end(e);};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();magnify(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
function normalizeAngle(v){return ((v+180)%360+360)%360-180;}
toolList.forEach(([id,icon,name])=>{let b=document.createElement('button');b.innerHTML=`<span>${icon}</span>${name}`;b.dataset.tool=id;b.className=id===tool?'active':'';b.onclick=()=>{end();tunnelStart=null;tool=id;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===id));$('toolName').textContent=name;canvas.style.cursor=['pan','orbit'].includes(id)?'grab':'crosshair';$('status').textContent=id==='tunnel'?'Toque na entrada e depois na saída':id==='submap'?'Clique no planeta para fixar a entrada do submapa':name;draw();};$('tools').append(b);});
indoorToolList.forEach(([id,icon,name])=>{const b=document.createElement('button');b.innerHTML=`<span>${icon}</span>${name}`;b.dataset.tool=id;b.title=name+' · arraste para desenhar';b.className='indoor-tool';b.onclick=()=>{end();selectedBuilding=null;tunnelStart=null;tool=id;document.querySelectorAll('[data-tool]').forEach(v=>v.classList.toggle('active',v===b));$('toolName').textContent=name;$('status').textContent=`${name}: arraste para definir tamanho e orientação`;canvas.style.cursor='crosshair';draw();};$('indoorTools').append(b);});
colors.forEach(([name,color],i)=>{const b=document.createElement('button');b.className='swatch'+(!i?' selected':'');b.innerHTML=`<i style="background:${color}"></i>${name}`;b.onclick=()=>{$('color').value=color;selectedBiome=['grass','forest','sand','rock','snow','water','lava'][i];if(i===1)selectedBiome=$('forestType')?.value||'forest';document.querySelectorAll('.swatch').forEach(v=>v.classList.remove('selected'));b.classList.add('selected');document.querySelector('[data-tool="brush"]').click();};$('palette').append(b);});
$('grassColor').oninput=$('treeColor').oninput=$('waterColor').oninput=$('lavaColor').oninput=$('sandColor').oninput=$('rockColor').oninput=$('snowColor').oninput=$('forestColor').oninput=()=>{Terrain.freezeLayers(layers);Terrain.setTheme({...Terrain.getTheme(),grass:$('grassColor').value,trees:$('treeColor').value,water:$('waterColor').value,lava:$('lavaColor').value,sand:$('sandColor').value,rock:$('rockColor').value,snow:$('snowColor').value,forest:$('forestColor').value});changed();};
$('planetMode').onchange=()=>{leaveFlatRegion();remember();layers.forEach(l=>l.planet={enabled:$('planetMode').checked});textureDirty=true;changed();notify($('planetMode').checked?'Planeta ativado. Os dados e marcadores do mapa foram preservados.':'Superfície plana restaurada.');fit();};
function selectedPatch(){return patches.find(p=>p.id===$('patchSelect').value);}
function refreshPatches(selected=patches.at(-1)?.id){
  const list=$('patchSelect');list.replaceChildren(new Option('Nenhum',''));
  for(const p of patches)list.add(new Option(p.name,p.id));
  list.value=selected||'';if(!list.value&&patches.length)list.value=patches.at(-1).id;
  const p=selectedPatch(),disabled=!p;
  for(const id of ['patchLon','patchLat','patchScale','removePatch'])$(id).disabled=disabled;
  for(const id of ['patchLon','patchLat','patchScale'])$(id).closest('.setting').hidden=p?.kind==='submap';
  $('submapLockControl').hidden=p?.kind!=='submap';$('submapLocked').checked=!!p?.locked;$('submapLocked').disabled=!!submapEdit||p?.kind!=='submap';
  $('placeSubmapEntry').disabled=!p||p.kind!=='submap';
  $('editSubmap').disabled=!!submapEdit||!p||p.kind!=='submap';
  $('createSubmap').disabled=!!submapEdit||!$('planetMode').checked;
  if(p){$('patchLon').value=Math.round((p.x+p.width/2)/8000*360-180);$('patchLat').value=Math.round(90-(p.y+p.height/2)/4400*180);$('patchScale').value=Math.round(p.width/1600*100);}
  $('patchLonValue').textContent=$('patchLon').value+'°';$('patchLatValue').textContent=$('patchLat').value+'°';$('patchScaleValue').textContent=$('patchScale').value+'%';
}
function placePatch(p){
  const aspect=p.height/p.width;p.width=1600*(+$('patchScale').value/100);p.height=p.width*aspect;
  if(p.height>4400){p.width*=4400/p.height;p.height=4400;}
  p.x=Math.max(0,Math.min(8000-p.width,(+$('patchLon').value+180)/360*8000-p.width/2));
  p.y=Math.max(0,Math.min(4400-p.height,(90-+$('patchLat').value)/180*4400-p.height/2));
  $('patchLonValue').textContent=$('patchLon').value+'°';$('patchLatValue').textContent=$('patchLat').value+'°';$('patchScaleValue').textContent=$('patchScale').value+'%';changed();
}
$('patchSelect').onchange=()=>refreshPatches($('patchSelect').value);
$('submapLocked').onchange=()=>{const p=selectedPatch();if(!p||p.kind!=='submap')return;remember();p.locked=$('submapLocked').checked;refreshPatches(p.id);changed();};
$('placeSubmapEntry').onclick=()=>{const p=selectedPatch();if(!p||p.kind!=='submap')return;document.querySelector('[data-tool="submap"]').click();notify('Clique no ponto do planeta onde os jogadores entrarão no submapa.');};
for(const id of ['patchLon','patchLat','patchScale']){$(id).onpointerdown=()=>{if(selectedPatch())remember();};$(id).oninput=()=>{const p=selectedPatch();if(p)placePatch(p);};}
$('removePatch').onclick=()=>{const p=selectedPatch();if(!p)return;remember();patches=patches.filter(v=>v!==p);refreshPatches();changed();};
async function decodeImage(source){const image=new Image();image.src=source;await image.decode();return image;}
function setThemeInputs(theme){$('grassColor').value=theme.grass;$('forestColor').value=theme.forest||theme.trees;$('treeColor').value=theme.trees;$('sandColor').value=theme.sand;$('rockColor').value=theme.rock;$('snowColor').value=theme.snow;$('waterColor').value=theme.water;$('lavaColor').value=theme.lava;}
async function hydrateSubmap(project,patch){
  if(project&&project.format==='aether-atlas'&&Array.isArray(project.layers)&&project.layers.length&&project.layers.length<=16){
    Terrain.setTheme(project.theme||Terrain.defaultTheme);setThemeInputs(Terrain.getTheme());const result=[];
    for(const v of project.layers){if(typeof v.image!=='string'||!v.image.startsWith('data:image/png;base64,'))throw Error('Imagem de camada do submapa inválida.');const image=await decodeImage(v.image);if(image.width!==W||image.height!==H)throw Error('Dimensões de camada do submapa inválidas.');const l=layer(v.name||'Camada');l.c.getContext('2d').drawImage(image,0,0);l.visible=v.visible!==false;l.locked=!!v.locked;l.opacity=Number.isFinite(v.opacity)?v.opacity:1;l.planet={enabled:false};l.terrain=project.version>=2?Terrain.validate(v.terrain):Terrain.create();l.routes=MapPaths.validate(v.routes??[]);l.objects=Billboards.validate(v.objects??[]);l.tunnels=v.tunnels??[];l.structures=Structures.validate(v.structures??[]);if(v.overlay){const overlay=await decodeImage(v.overlay);l.ink=document.createElement('canvas');l.ink.width=W;l.ink.height=H;l.ink.getContext('2d').drawImage(overlay,0,0);}result.push(l);}
    return{layers:result,project};
  }
  const image=patch.image instanceof HTMLImageElement?patch.image:await decodeImage(patch.data);const base=layer('Mapa base');base.planet={enabled:false};base.c.getContext('2d').drawImage(image,0,0,W,H);return{layers:[base],project:null};
}
async function enterSubmap(patch,initial=null){
  leaveFlatRegion();
  if(submapEdit||!patch||patch.kind!=='submap')return;
  end();const parentProject=submapEdit?.parentProject||serializeCurrent(),theme=Terrain.getTheme();let mapProject=patch.project;if(patch.projectId)mapProject=projectBundle.submaps.find(v=>v.id===patch.projectId)?.project||null;let loaded;try{loaded=initial||await hydrateSubmap(mapProject,patch);}catch(error){Terrain.setTheme(theme);setThemeInputs(theme);throw error;}
  submapEdit={patch,parentProject,layers,patches,playerLocation,active,yaw,tilt,roll,relief,zoom,ox,oy,grid,tool,title:$('title').value,planetMode:$('planetMode').checked,theme,history,future,view:{textures:$('textures').checked,shade:$('shade').checked,contours:$('contours').checked,altitude:$('altitude').checked,interval:$('interval').value,underground:$('underground').checked}};
  layers=loaded.layers;patches=[];playerLocation={x:800,y:550};active=0;history=[];future=[];grid=false;$('grid').classList.remove('active');tunnelStart=null;activeRoute=null;
  $('planetMode').checked=false;$('planetMode').disabled=true;$('importSubmap').disabled=true;$('migrateProject').disabled=true;$('title').value=patch.name;tool='pan';document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool==='pan'));$('toolName').textContent='Submapa plano';$('finishSubmap').hidden=false;document.querySelector('.map-tag').classList.add('submap-edit-tag');
  ({yaw,tilt,roll,relief}=AtlasNavigation.submapCamera(loaded.project?.camera));$('relief').value=relief;
  $('textures').checked=loaded.project?.view?.texture!==false;$('shade').checked=loaded.project?.view?.shade!==false;$('contours').checked=!!loaded.project?.view?.contours;$('altitude').checked=!!loaded.project?.view?.altitude;
  $('interval').value=[50,100,250,500].includes(loaded.project?.view?.interval)?loaded.project.view.interval:100;
  refreshPatches();render();fit();changed();notify('Editando submapa plano. Use as ferramentas normalmente; ao terminar, salve e volte ao planeta.');
}
async function leaveSubmap(){
  if(!submapEdit)return;end();const edit=submapEdit,child=serializeCurrent(),image=renderSubmapPreview(),patch=edit.patches.find(p=>p.id===edit.patch.id);if(!patch)return;
  patch.name=$('title').value.trim()||patch.name;patch.data=image;patch.image=await decodeImage(image);
  if(patch.projectId){let entry=projectBundle.submaps.find(v=>v.id===patch.projectId);if(!entry){entry={id:patch.projectId,name:patch.name,project:null};projectBundle.submaps.push(entry);}entry.name=patch.name;entry.project=child;}else{patch.project=child;}
  submapEdit=null;layers=edit.layers;patches=edit.patches;playerLocation=edit.playerLocation;active=edit.active;yaw=edit.yaw;tilt=edit.tilt;roll=edit.roll;relief=edit.relief;zoom=edit.zoom;ox=edit.ox;oy=edit.oy;grid=edit.grid;$('grid').classList.toggle('active',grid);tool=edit.tool;history=edit.history;future=edit.future;
  $('title').value=edit.title;$('planetMode').checked=edit.planetMode;$('planetMode').disabled=false;$('importSubmap').disabled=false;$('migrateProject').disabled=false;Terrain.setTheme(edit.theme);setThemeInputs(edit.theme);$('textures').checked=edit.view.textures;$('shade').checked=edit.view.shade;$('contours').checked=edit.view.contours;$('altitude').checked=edit.view.altitude;$('interval').value=edit.view.interval;$('underground').checked=edit.view.underground;$('finishSubmap').hidden=true;document.querySelector('.map-tag').classList.remove('submap-edit-tag');document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('toolName').textContent=document.querySelector(`[data-tool="${tool}"]`)?.textContent.trim()||'Navegar';
  refreshPatches(patch.id);textureDirty=true;changed();fit();notify('Submapa salvo no planeta.');
}
$('createSubmap').onclick=async()=>{if(submapEdit)return;if(patches.filter(p=>p.kind==='submap').length>=16){notify('Limite de 16 submapas por planeta.');return;}const name=$('submapName').value;if(!name?.trim()){notify('Digite o nome do submapa.');$('submapName').focus();return;}remember();const blank=document.createElement('canvas');blank.width=W;blank.height=H;const g=blank.getContext('2d');g.fillStyle=Terrain.getTheme().water;g.fillRect(0,0,W,H);const data=blank.toDataURL('image/png'),image=await decodeImage(data),id=crypto.randomUUID(),patch={id,name:name.trim(),x:3200,y:1650,width:1600,height:1100,kind:'submap',entry:{...playerLocation},data,image,projectId:id};patches.push(patch);if(!projectBundle.submaps.some(v=>v.id===id))projectBundle.submaps.push({id,name:patch.name,project:null});refreshPatches(patch.id);const base=layer('Terreno');base.planet={enabled:false};base.c.getContext('2d').drawImage(blank,0,0);const detail=layer('Detalhes');detail.planet={enabled:false};const marks=layer('Marcadores');marks.planet={enabled:false};await enterSubmap(patch,{layers:[base,detail,marks],project:null});};
$('editSubmap').onclick=()=>{const patch=selectedPatch();if(patch)enterSubmap(patch).catch(error=>notify("Não foi possível abrir o submapa: "+error.message));};$('finishSubmap').onclick=leaveSubmap;
async function legacyRaster(file){
  if(file.type==='image/png'||/\.png$/i.test(file.name)){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});const image=await decodeImage(data);return{data,image};}
  const d=JSON.parse(await file.text());if(d.format!=='aether-atlas'||![1,2,3,4].includes(d.version)||d.width!==1600||d.height!==1100||!Array.isArray(d.layers)||!d.layers.length||d.layers.length>16)throw Error('Projeto antigo incompatível.');
  const c=document.createElement('canvas');c.width=1600;c.height=1100;const g=c.getContext('2d'),oldTheme=Terrain.getTheme();
  try{
    Terrain.setTheme(d.theme||Terrain.defaultTheme);
    const imported=[];
    for(const v of d.layers){if(typeof v.image!=='string'||!v.image.startsWith('data:image/png;base64,'))throw Error('Imagem de camada inválida.');const image=await decodeImage(v.image);if(image.width!==1600||image.height!==1100)throw Error('Dimensões de camada inválidas.');const l={visible:v.visible,opacity:v.opacity,c:image,terrain:d.version>=2?Terrain.validate(v.terrain):Terrain.create(),routes:MapPaths.validate(v.routes??[]),objects:Billboards.validate(v.objects??[]),tunnels:v.tunnels??[],structures:Structures.validate(v.structures??[]),ink:v.overlay?await decodeImage(v.overlay):null};imported.push(l);if(!l.visible)continue;g.globalAlpha=l.opacity;g.drawImage(image,0,0);g.drawImage(Terrain.render(l.terrain,viewSettings()),0,0);MapPaths.draw(g,l.routes);if(l.ink)g.drawImage(l.ink,0,0);}
    g.globalAlpha=1;Billboards.draw(g,Billboards.collect(imported,false),scene,{yaw:0,tilt:0,relief:0,zoom:1,cx:800,cy:550,planet:false},imported,1600,1100);
    const data=c.toDataURL('image/png');return{data,image:await decodeImage(data)};
  }finally{Terrain.setTheme(oldTheme);}
}
$('migrateProject').onclick=()=>$('legacyFile').click();
$('legacyFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>80*1024*1024)throw Error('Arquivo muito grande (máximo 80 MB).');const raster=await legacyRaster(file);remember();if(!$('planetMode').checked){$('planetMode').checked=true;layers.forEach(l=>l.planet={enabled:true});}
  const width=1600,height=width*raster.image.height/raster.image.width;if(height>4400)throw Error('Imagem muito alta para encaixar no planeta.');const x=Math.max(0,Math.min(8000-width,4800+(patches.length%3)*400)),y=Math.max(0,(4400-height)/2);
  const p={id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),x,y,width,height,...(document.getElementById('importSubmap').checked?{kind:'submap',entry:{x:4000,y:2200}}:{kind:'image'}),...raster};patches.push(p);refreshPatches(p.id);changed();fit();notify(p.kind==='submap'?'Submapa plano importado. Fixe o ponto de entrada no planeta.':'Mapa encaixado. Ajuste longitude, latitude e escala.');
}catch(err){notify('Não foi possível importar: '+err.message);}finally{e.target.value='';}};
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+' px';};$('opacity').onpointerdown=()=>remember();$('opacity').onkeydown=e=>{if(e.key.startsWith('Arrow'))remember();};$('opacity').oninput=()=>{layers[active].opacity=+$('opacity').value/100;changed();};$('color').oninput=()=>{document.querySelectorAll('.swatch').forEach(b=>b.classList.remove('selected'));document.querySelector('[data-tool="color"]').click();};
$('add').onclick=()=>{if(layers.length>=16){notify('Limite de 16 camadas por projeto.');return;}remember();tunnelStart=null;layers.push(layer('Camada '+(layers.length+1)));active=layers.length-1;changed();};$('rename').onclick=()=>{const name=prompt('Nome da camada:',layers[active].name);if(name?.trim()){remember();layers[active].name=name.trim();changed();}};$('delete').onclick=()=>{if(layers.length===1)return notify('Mantenha ao menos uma camada.');if(!confirm('Excluir a camada '+layers[active].name+'?'))return;remember();tunnelStart=null;layers.splice(active,1);active=Math.max(0,active-1);changed();};
function reorder(n){const next=active+n;if(next<0||next>=layers.length)return;remember();tunnelStart=null;[layers[active],layers[next]]=[layers[next],layers[active]];active=next;changed();}$('up').onclick=()=>reorder(1);$('down').onclick=()=>reorder(-1);$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);$('plus').onclick=()=>magnify(1.2);$('minus').onclick=()=>magnify(1/1.2);$('fit').onclick=fit;$('grid').onclick=()=>{grid=!grid;textureDirty=true;$('grid').classList.toggle('active',grid);draw();};
function download(blob,ext){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=($('title').value.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'mapa')+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function serializeCurrent(){return {format:'aether-atlas',version:4,world:{type:layers.some(l=>l.planet?.enabled)?'planet':'flat',width:8000,height:4400,playerLocation:{...playerLocation},patches:patches.map(({id,name,x,y,width,height,kind,entry,locked,data,project,projectId})=>({id,name,x,y,width,height,...(kind==='submap'?{kind,entry,locked:!!locked,...(projectId?{projectId}:{})}:{}),...(project?{project}:{}),image:data}))},camera:flatRegion&&flatCamera?{yaw:flatCamera.yaw,tilt:flatCamera.tilt,roll:flatCamera.roll,relief:flatCamera.relief}:{yaw,tilt,roll,relief},width:W,height:H,title:$('title').value,view:viewSettings(),theme:Terrain.getTheme(),layers:layers.map(l=>({id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,planet:l.planet||{enabled:false},terrain:Terrain.serialize(l.terrain),tunnels:l.tunnels,objects:l.objects,routes:l.routes,structures:l.structures||[],tiles:WorldSurface.serialize(l.tiles),overlay:l.ink?.toDataURL()||null,image:l.c.toDataURL()}))};}
function renderSubmapPreview(){if(textureDirty)compose();const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle=Terrain.getTheme().water;g.fillRect(0,0,W,H);g.drawImage(mapTexture,0,0);Billboards.draw(g,Billboards.collect(layers,true),scene,{yaw:0,tilt:0,roll:0,relief:0,zoom:1,cx:W/2,cy:H/2,planet:false},layers,W,H);return c.toDataURL('image/png');}
function projectData(){const current=serializeCurrent();if(!submapEdit){const main={...current,world:{...current.world,submaps:projectBundle.submaps.map(({id,name})=>({id,name}))}};return projectBundle.submaps.length?{format:'aether-atlas-world',version:1,title:main.title,main,submaps:projectBundle.submaps}:main;}const image=renderSubmapPreview(),edit=submapEdit,world=edit.parentProject.world,id=edit.patch.projectId||edit.patch.id,patches=world.patches.map(p=>p.id===edit.patch.id?{...p,name:edit.patch.name,projectId:id,image}:p),child={...current,title:edit.patch.name,world:{...current.world,type:'flat',patches:[]}},submaps=projectBundle.submaps.filter(v=>v.id!==id).concat({id,name:edit.patch.name,project:child}),main={...edit.parentProject,world:{...world,patches,submaps:submaps.map(({id,name})=>({id,name}))}};return{format:'aether-atlas-world',version:1,title:main.title,main,submaps};}
$('save').onclick=()=>{end();download(new Blob([JSON.stringify(projectData())],{type:'application/json'}),'.json');dirty=false;$('saved').textContent='Projeto exportado · arquivo JSON';notify('Projeto salvo com todas as camadas.');};
$('publishPlayers').onclick=()=>notify('Entre com o Google para publicar o mapa no visualizador deste site.');
$('export').onclick=()=>{
  end();if(textureDirty)compose();const planet=camera().planet,c=document.createElement('canvas');c.width=planet?8000:W;c.height=planet?4400:H;const g=c.getContext('2d');
  if(planet){g.fillStyle=Terrain.getTheme().water;g.fillRect(0,0,c.width,c.height);for(const p of patches)if(p.kind!=='submap')g.drawImage(p.image,p.x,p.y,p.width,p.height);g.drawImage(mapTexture,AtlasScene.REGION_X,AtlasScene.REGION_Y);for(const region of WorldSurface.groups(layers))if(region.gx||region.gy){const tile=document.createElement('canvas');tile.width=W;tile.height=H;const tg=tile.getContext('2d');for(const l of region.layers)if(l.visible){tg.globalAlpha=l.opacity;drawLayer(tg,l);}g.drawImage(tile,region.x,region.y);}}else g.drawImage(mapTexture,0,0);
  Billboards.draw(g,Billboards.collect(layers,$('underground').checked),planet?{project:(x,y)=>({x:x+3200,y:y+1650,w:1})}:scene,{yaw:0,tilt:0,relief:0,zoom:1,cx:W/2,cy:H/2,planet:false},layers,c.width,c.height);
  Billboards.drawPlayerPivot(g,scene,{yaw:0,tilt:0,roll:0,relief:0,zoom:1,cx:planet?4000:800,cy:planet?2200:550,planet:false},playerLocation,c.width,c.height,layers);
  c.toBlob(b=>{if(b){download(b,'.png');notify(`Planta exportada: ${c.width} × ${c.height} px.`);}else notify('Não foi possível exportar a planta.');});
};
function exportImage(){
  end();if(textureDirty)compose();const viewport=$('viewport').getBoundingClientRect(),limit=Math.min(4096,scene.gl?.getParameter(scene.gl.MAX_RENDERBUFFER_SIZE)||4096),scale=limit/Math.max(viewport.width,viewport.height);
  const c=document.createElement('canvas');c.width=Math.round(viewport.width*scale);c.height=Math.round(viewport.height*scale);const g=c.getContext('2d');
  const background=g.createRadialGradient(c.width*.45,c.height*.4,0,c.width*.45,c.height*.4,Math.max(c.width,c.height)*.8);
  background.addColorStop(0,'#304e59');background.addColorStop(1,'#152c39');g.fillStyle=background;g.fillRect(0,0,c.width,c.height);
  const exportCamera={...camera(),zoom:zoom*scale,cx:ox*scale,cy:oy*scale},result=scene.draw(c.width,c.height,1,exportCamera);
  if(result)g.drawImage(result,0,0);else{g.save();g.translate(exportCamera.cx,exportCamera.cy);g.rotate((yaw+roll)*Math.PI/180);g.scale(exportCamera.zoom,exportCamera.zoom);g.drawImage(mapTexture,-W/2,-H/2);g.restore();}
  Billboards.draw(g,Billboards.collect(layers,$('underground').checked),scene,exportCamera,layers,c.width,c.height);
  Billboards.drawPlayerPivot(g,scene,exportCamera,playerLocation,c.width,c.height,layers);
  draw();c.toBlob(b=>{if(b){download(b,'-perspectiva.png');notify(`Vista exportada: ${c.width} × ${c.height} px.`);}else notify('Não foi possível exportar a vista.');});
}
$('exportImage').onclick=exportImage;
$('open').onclick=()=>{if(submapEdit){notify("Salve o submapa e volte ao planeta antes de abrir outro projeto.");return;}$('file').click();};$('file').onchange=async e=>{leaveFlatRegion();const f=e.target.files[0];if(!f)return;try{if(f.size>80*1024*1024)throw Error('Arquivo muito grande (máximo 80 MB).');let d=JSON.parse(await f.text());if(d.format==='aether-atlas-world'&&d.version===1&&d.main?.format==='aether-atlas'){projectBundle={format:d.format,version:1,submaps:Array.isArray(d.submaps)?d.submaps:[]};d=d.main;}else projectBundle={format:'aether-atlas-world',version:1,submaps:[]};if(d.format!=='aether-atlas'||![1,2,3,4].includes(d.version)||d.width!==W||d.height!==H||!Array.isArray(d.layers)||!d.layers.length||d.layers.length>16)throw Error('Projeto incompatível.');const imported=await Promise.all(d.layers.map(async v=>{if(typeof v.name!=='string'||typeof v.visible!=='boolean'||typeof v.locked!=='boolean'||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||typeof v.image!=='string'||!v.image.startsWith('data:image/png;base64,'))throw Error('Camada inválida.');const im=new Image();im.src=v.image;await im.decode();if(im.width!==W||im.height!==H)throw Error('Dimensões de camada inválidas.');const l=layer(v.name);l.id=typeof v.id==='string'&&v.id.length<=64?v.id:crypto.randomUUID();l.planet=typeof v.planet?.enabled==='boolean'?{enabled:v.planet.enabled}:{enabled:d.world?.type==='planet'};l.visible=v.visible;l.locked=v.locked;l.opacity=v.opacity;if(d.version>=2&&v.terrain)l.terrain=Terrain.validate(v.terrain);l.c.getContext('2d').drawImage(im,0,0);l.objects=Billboards.validate(v.objects??[]);l.routes=MapPaths.validate(v.routes??[]);
if(v.overlay){if(typeof v.overlay!=='string'||!v.overlay.startsWith('data:image/png;base64,'))throw Error('Pintura inválida.');const overlay=new Image();overlay.src=v.overlay;await overlay.decode();if(overlay.width!==W||overlay.height!==H)throw Error('Dimensões de pintura inválidas.');ink(l).getContext('2d').drawImage(overlay,0,0);}
if(v.tunnels!==undefined){if(!Array.isArray(v.tunnels)||v.tunnels.length>1000)throw Error('Túneis inválidos.');for(const t of v.tunnels){if(!t||![t.a,t.b].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<W&&p.y<H)||!Number.isFinite(t.width)||t.width<1||t.width>200||!Number.isFinite(t.depth)||t.depth<5||t.depth>500)throw Error('Túnel inválido.');}l.tunnels=v.tunnels;}if(v.structures!==undefined)l.structures=Structures.validate(v.structures);l.tiles=await WorldSurface.restore(v.tiles);return l;}));if(e.canApply&&!e.canApply())return false;if(dirty&&!e.discardConfirmed&&!confirm('Substituir o projeto com alterações não salvas?'))return;end();layers=imported;activeRoute=null;tunnelStart=null;Terrain.setTheme(d.theme||Terrain.defaultTheme);const theme=Terrain.getTheme();$('grassColor').value=theme.grass;$('forestColor').value=theme.forest||theme.trees;$('treeColor').value=theme.trees;$('sandColor').value=theme.sand;$('rockColor').value=theme.rock;$('snowColor').value=theme.snow;$('waterColor').value=theme.water;$('lavaColor').value=theme.lava;$('planetMode').checked=d.world?.type==='planet'||layers.some(l=>l.planet?.enabled);textureDirty=true;if(d.camera){roll=normalizeAngle(Number.isFinite(d.camera.roll)?d.camera.roll:0);yaw=normalizeAngle((Number.isFinite(d.camera.yaw)?d.camera.yaw:0));tilt=AtlasNavigation.pitch((Number.isFinite(d.camera.tilt)?d.camera.tilt:0),layers.some(l=>l.planet?.enabled));relief=Math.max(0,Math.min(2,(Number.isFinite(d.camera.relief)?d.camera.relief:1)));$('relief').value=relief;}planetGuide.setSpinning(false);planetGuide.marks=d.view?.planetGuides!==false;if($('architectureAutoGroup'))$('architectureAutoGroup').checked=d.view?.autoGroupWalls!==false;if(d.view){for(const [id,key] of [['textures','texture'],['shade','shade'],['contours','contours'],['altitude','altitude']])if(typeof d.view[key]==='boolean')$(id).checked=d.view[key];if([50,100,250,500].includes(d.view.interval))$('interval').value=d.view.interval;}active=layers.length-1;history=[];future=[];$('title').value=typeof d.title==='string'?d.title:'Mapa importado';dirty=false;$('saved').textContent='Projeto importado';render();fit();if(!e.fromDrive){detachDriveProject();driveRevision++;dirty=true;$('saved').textContent='JSON local · ainda não salvo no Drive';driveStatus('JSON local aberto. Clique em Salvar no Drive agora para criar uma cópia e vinculá-la à API.');}notify('Projeto aberto.');return true;}catch(err){notify('Não foi possível abrir: '+err.message);return false;}finally{e.target.value='';}};
const openProject=$('file').onchange;
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return false;let data;try{data=JSON.parse(await file.text());if(data.format==='aether-atlas-world'&&data.version===1)data=data.main;}catch{return openProject(e);}const opened=await openProject(e);if(!opened)return false;
  roll=normalizeAngle(Number.isFinite(data.camera?.roll)?data.camera.roll:0);
  const location=data.world?.playerLocation;playerLocation=location&&Number.isFinite(location.x)&&Number.isFinite(location.y)&&location.x>=0&&location.x<=8000&&location.y>=0&&location.y<=4400?{x:location.x,y:location.y}:{x:4000,y:2200};
  try{const list=data.world?.patches??[];if(!Array.isArray(list)||list.length>16)throw Error('Mapas encaixados inválidos.');const loaded=[];
    for(const p of list){if(!p||typeof p.name!=='string'||p.name.length>120||typeof p.image!=='string'||!p.image.startsWith('data:image/png;base64,')||![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.width<100||p.height<100||p.x<0||p.y<0||p.x+p.width>8000||p.y+p.height>4400||(p.kind!==undefined&&!['image','submap'].includes(p.kind))||(p.locked!==undefined&&typeof p.locked!=='boolean')||(p.kind==='submap'&&(!p.entry||!Number.isFinite(p.entry.x)||!Number.isFinite(p.entry.y)||p.entry.x<0||p.entry.x>8000||p.entry.y<0||p.entry.y>4400))||(p.project!==undefined&&(!p.project||p.project.world?.type!=='flat'||(p.project.world?.patches?.length??0)>0)))throw Error('Mapa encaixado inválido.');loaded.push({id:typeof p.id==='string'?p.id:crypto.randomUUID(),name:p.name,x:p.x,y:p.y,width:p.width,height:p.height,kind:p.kind||'image',...(p.kind==='submap'?{entry:{...p.entry},locked:!!p.locked,...(p.projectId?{projectId:p.projectId}:{})}:{}),...(p.project?{project:p.project}:{}),data:p.image,image:await decodeImage(p.image)});}
    projectBundle=Array.isArray(data.submaps)?{format:'aether-atlas-world',version:1,submaps:data.submaps}:projectBundle;
    patches=loaded.map(p=>{if(!p.projectId&&p.kind==='submap'&&p.project?.format==='aether-atlas'){p.projectId=p.id;if(!projectBundle.submaps.some(v=>v.id===p.id))projectBundle.submaps.push({id:p.id,name:p.name,project:p.project});delete p.project;}if(p.projectId){const item=projectBundle.submaps.find(v=>v.id===p.projectId);if(item){p.name=item.name||p.name;p.project=item.project||null;}}return p;});refreshPatches();textureDirty=true;draw();return true;
  }catch(err){patches=[];refreshPatches();textureDirty=true;draw();notify('Projeto aberto sem mapas encaixados: '+err.message);return true;}
};
$('new').onclick=()=>{leaveFlatRegion();if(submapEdit){notify("Salve o submapa e volte ao planeta antes de criar outro mundo.");return;}if(!confirm('Criar um planeta de água vazio? Salve o projeto atual antes de continuar.'))return;remember();detachDriveProject();tunnelStart=null;patches=[];projectBundle={format:'aether-atlas-world',version:1,submaps:[]};playerLocation={x:4000,y:2200};roll=0;$('planetMode').checked=true;layers=[layer('Terreno'),layer('Detalhes'),layer('Marcadores')];active=0;refreshPatches();$('title').value='Meu novo mundo';changed();fit();};$('title').oninput=()=>{if(submapEdit)submapEdit.patch.name=$('title').value;changed();};

for(const [id,unit] of [['strength','%'],['amount',' m'],['iconSize',' px'],['rotation','°']])$(id).oninput=()=>$(id+'Value').textContent=$(id).value+unit;
for(const id of ['textures','shade','contours','altitude','interval'])$(id).onchange=changed;
Object.entries(Buildings.names).forEach(([id,name])=>{const b=document.createElement('button'),preview=document.createElement('canvas');preview.width=76;preview.height=70;Buildings.draw(preview.getContext('2d'),38,36,id,42);b.append(preview,document.createTextNode(name));b.title='Inserir '+name.toLowerCase();b.onclick=()=>{selectedBuilding=id;document.querySelectorAll('#buildings button').forEach(v=>v.classList.toggle('selected',v===b));document.querySelector('[data-tool="marker"]').click();};$('buildings').append(b);});
$('marker').onchange=()=>{selectedBuilding=null;document.querySelectorAll('#buildings button').forEach(v=>v.classList.remove('selected'));document.querySelector('[data-tool="marker"]').click();};
$('heightExport').onclick=()=>{const c=document.createElement('canvas');c.width=400;c.height=275;const g=c.getContext('2d'),im=g.createImageData(400,275);for(let y=0;y<275;y++)for(let x=0;x<400;x++){const h=Terrain.sample(layers,x*4+2,y*4+2),k=(y*400+x)*4,v=Math.round(((h??0)+500)/3500*255);im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=h===null?0:255;}g.putImageData(im,0,0);c.toBlob(b=>{if(b)download(b,'-altura.png');});notify('Altura: preto = −500 m; branco = 3.000 m.');};

window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='Escape'){tunnelStart=null;end();closePanels();draw();}if(e.code==='Space'){space=true;e.preventDefault();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}});window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;end();});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});new ResizeObserver(()=>{if(!layers.length)return;fit();}).observe($('viewport'));
$('bearing').oninput=()=>{yaw=+$('bearing').value;draw();};
$('tilt').oninput=()=>{tilt=AtlasNavigation.pitch(+$('tilt').value,camera().planet);draw();};
$('roll').oninput=()=>{roll=+$('roll').value;draw();};
$('relief').oninput=()=>{relief=+$('relief').value;draw();};
$('viewTop').onclick=()=>{tilt=0;fit();};$('view3d').onclick=()=>{tilt=48;fit();};
$('resetCamera').onclick=()=>{yaw=0;tilt=0;roll=0;fit();};
$('cameraNote').textContent='Botão direito: orbitar livremente · Shift: rotação Z · Espaço: mover · Lado oposto: girar 180°. Clique no mapa para usar o teclado.';
$('turnLeft').onclick=()=>{yaw=normalizeAngle(yaw-30);draw();};$('turnRight').onclick=()=>{yaw=normalizeAngle(yaw+30);draw();};
$('underground').onchange=()=>{textureDirty=true;draw();};
$('viewExport').onclick=exportImage;
function closePanels(){document.body.classList.remove('show-tools','show-layers');for(const id of ['mobileTools','mobileLayers'])$(id).setAttribute('aria-expanded','false');$('panelBackdrop').hidden=true;}
for(const [id,cls] of [['mobileTools','show-tools'],['mobileLayers','show-layers']])$(id).onclick=()=>{const open=document.body.classList.contains(cls);closePanels();if(!open){document.body.classList.add(cls);$(id).setAttribute('aria-expanded','true');$('panelBackdrop').hidden=false;}};
document.querySelectorAll('.close-panel').forEach(b=>b.onclick=closePanels);$('panelBackdrop').onclick=closePanels;
layers=[layer('Terreno'),layer('Detalhes'),layer('Marcadores')];active=0;refreshPatches();render();fit();
