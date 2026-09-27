'use strict';
const Selector=(()=>{
  let selected=null,drag=null;
  const panel=document.createElement('section');panel.className='selection-panel';panel.hidden=true;
  panel.innerHTML='<h3>OBJETO SELECIONADO</h3><strong id="selectionName"></strong><p class="muted">Arraste no mapa ou informe a posição.</p><div class="selection-position"><label>X <input id="selectionX" type="number" min="0" max="1599" step="1"></label><label>Y <input id="selectionY" type="number" min="0" max="1099" step="1"></label></div><button id="selectionMove" type="button">Aplicar posição</button><label for="selectionLayer">Camada de destino</label><select id="selectionLayer"></select><button id="selectionTransfer" type="button">Mover para camada</button><div id="selectionTint"><label>Cor <input id="selectionColor" type="color"></label><label id="selectionTrunkLabel">Tronco <input id="selectionTrunk" type="color"></label></div><button id="selectionClear" type="button">Limpar seleção</button>';
  document.querySelector('#layersPanel .section-title').after(panel);
  const valid=()=>{
    if(!selected)return false;const l=layers[selected.layer];
    if(!l||!l.visible||(selected.region?WorldSurface.child(l,selected.region.gx,selected.region.gy):l)!==selected.source)return false;const storage=selected.source;
    if(selected.generated)return !storage.terrain.treeExclusions.has(selected.entry.index)&&(storage.terrain.biomes[selected.entry.index]===2||storage.terrain.biomes[selected.entry.index]>=8);
    return storage[selected.collection].includes(selected.object);
  };
  function clear(){selected=null;drag=null;panel.hidden=true;draw();}
  const members=()=>selected.members||[selected.object];
  const points=()=>selected.collection==='structures'?[...new Set(members().flatMap(o=>[...o.points,...(o.foundationPoints||[])]))]:selected.generated?[{x:selected.entry.localX??selected.entry.x,y:selected.entry.localY??selected.entry.y}]:selected.collection==='routes'?selected.object.points:selected.collection==='tunnels'?[selected.object.a,selected.object.b]:[selected.object];
  function bounds(){const p=points(),xs=p.map(p=>p.x),ys=p.map(p=>p.y);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};}
  function center(){const b=bounds();return {x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2};}
  function sync(){
    if(!valid()){selected=null;panel.hidden=true;return;}
    panel.hidden=tool!=='select';
    const o=selected.object||selected.entry,c=center(),tree=selected.generated||o.kind==='tree';
    const species={forest:'Floresta de copas',palms:'Coqueiro',pines:'Pinheiro',magic:'Árvore mágica',autumn:'Árvore outonal',jungle:'Árvore de selva',snowForest:'Pinheiro nevado'};
    $('selectionName').textContent=tree?(species[o.species||Terrain.biomes[o.type]]||'Árvore'):o.text||({building:Buildings.names[o.building],marker:'Marcador',text:'Texto',river:'Rio',path:'Caminho'}[o.kind])||(selected.collection==='tunnels'?'Túnel':'Objeto');
    if(selected.collection==='structures')$('selectionName').textContent=({wall:'Muro',room:'Sala',corridor:'Corredor',floor:'Piso',stairs:'Escada',door:'Porta',window:'Janela',pillar:'Pilar',pit:'Fosso'}[o.kind]||'Arquitetura')+(members().length>1?' · '+members().length+' peças':'');
    $('selectionX').value=Math.round(c.x);$('selectionY').value=Math.round(c.y);
    $('selectionLayer').replaceChildren();layers.forEach((l,i)=>{const option=new Option(l.name+(l.locked?' · bloqueada':''),i);option.disabled=l.locked; $('selectionLayer').add(option);});$('selectionLayer').value=selected.layer;
    $('selectionTint').hidden=!['objects','structures'].includes(selected.collection)&&!selected.generated;
    $('selectionTrunkLabel').hidden=!tree;
    $('selectionColor').value=selected.generated?o.foliage:o.color||'#ffffff';$('selectionTrunk').value=selected.generated?o.trunk:o.trunkColor||'#70503b';
    const locked=layers[selected.layer].locked;panel.querySelectorAll('input,select,button').forEach(el=>el.disabled=locked&&el.id!=='selectionClear');
  }
  function treeBox(entry){
    const c=camera(),tc={...c,relief:1},z=entry.base*c.relief;
    const samples=[[entry.x,entry.y,z],[entry.x,entry.y,z+entry.height],[entry.x-entry.radius,entry.y,z+entry.height*.7],[entry.x+entry.radius,entry.y,z+entry.height*.7],[entry.x,entry.y-entry.radius,z+entry.height*.7],[entry.x,entry.y+entry.radius,z+entry.height*.7]].map(p=>scene.project(...p,tc));
    if(samples[0].visible===false)return null;
    const xs=samples.map(p=>p.x),ys=samples.map(p=>p.y);return {x:Math.min(...xs)-4,y:Math.min(...ys)-4,w:Math.max(...xs)-Math.min(...xs)+8,h:Math.max(...ys)-Math.min(...ys)+8,depth:samples[0].w};
  }
  function structureFaces(object,region){
    const gx=(region?.gx||0)*1600,gy=(region?.gy||0)*1100,c=camera(),tc={...c,relief:1};
    const ground=Math.max(0,...(object.foundationPoints||object.points).map(p=>Billboards.surfaceHeight(p.x+gx,p.y+gy,layers)));
    const project=(p,h)=>scene.project(p.x+gx,p.y+gy,ground+(h||0)*(c.planet?.37:1),tc);
    return Structures.footprints(object).flatMap(poly=>{const bottom=poly.map(p=>project(p,object.base)),top=poly.map(p=>project(p,object.height));return [top,bottom,...poly.map((_,i)=>[bottom[i],bottom[(i+1)%poly.length],top[(i+1)%poly.length],top[i]])];});
  }
  function hitStructures(x,y){
    const inside=poly=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
    let best=null;
    for(let i=layers.length-1;i>=0;i--){const parent=layers[i];if(!parent.visible||parent.opacity<=0)continue;
      const sources=worldMode()?[{source:parent,region:{gx:0,gy:0}},...(parent.tiles||[]).map(source=>({source,region:{gx:source.gx,gy:source.gy}}))]:[{source:parent,region:null}];
      for(const {source,region} of sources)for(const object of [...(source.structures||[])].reverse())for(const face of structureFaces(object,region)){
        if(face.some(p=>p.visible===false)||!inside(face))continue;const depth=face.reduce((n,p)=>n+(p.w||0),0)/face.length;
        if(!best||depth<best.depth)best={layer:i,collection:'structures',object,region,depth};
      }
    }
    return best;
  }
  function hit(e){
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    const icons=[...billboardHits].reverse();
    for(const h of icons)if(x>=h.box.x&&x<=h.box.x+h.box.w&&y>=h.box.y&&y<=h.box.y+h.box.h)return {layer:h.layer,collection:h.tunnel?'tunnels':'objects',object:h.tunnel||h.originalObject||h.object,region:h.region};
    let tree=null;
    for(const entry of scene.vegetation?.entries||[]){const box=treeBox(entry);if(box&&x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h&&(!tree||box.depth<tree.depth))tree={entry,depth:box.depth};}
    if(tree)return {layer:tree.entry.layer,collection:'objects',object:tree.entry.object,entry:tree.entry,generated:!tree.entry.object,region:tree.entry.region};
    const architecture=hitStructures(x,y);if(architecture)return architecture;
    const original=point(e);if(!original.inside)return null;const region=worldMode()?WorldSurface.locate(original.x,original.y):null,p={x:original.x-(region?.gx||0)*1600,y:original.y-(region?.gy||0)*1100},regionLayers=region?WorldSurface.group(layers,region.gx,region.gy):layers;
    for(let i=layers.length-1;i>=0;i--){const l=regionLayers[i];if(!l.visible||l.opacity<=0)continue;
      for(const t of l.tunnels)if(MapPaths.distance(p,t.a,t.b)<t.width/2+6)return {layer:i,collection:'tunnels',object:t,region};
      for(const route of [...l.routes].reverse())for(let n=1;n<route.points.length;n++)if(MapPaths.distance(p,route.points[n-1],route.points[n])<route.width/2+6)return {layer:i,collection:'routes',object:route,region};
    }
    return null;
  }
  function pick(e){
    const item=hit(e);if(!item){clear();return;}
    selected={...item,source:item.region?WorldSurface.child(layers[item.layer],item.region.gx,item.region.gy):layers[item.layer]};if(item.collection==='structures')selected.members=Structures.connected(selected.source.structures,item.object,$('architectureAutoGroup')?.checked!==false);active=item.layer;
    const p=point(e),c=center();drag={id:e.pointerId,start:p.inside?{x:p.x-(selected.region?.gx||0)*1600,y:p.y-(selected.region?.gy||0)*1100}:c,center:c,moved:false};
    render();if(layers[selected.layer].locked)notify('Camada bloqueada: desbloqueie para editar este objeto.');
  }
  function editable(){if(!valid())return false;if(layers[selected.layer].locked){notify('Desbloqueie a camada do objeto para editá-lo.');return false;}if(selected.generated&&selected.source.objects.length>=2000){notify('Limite de objetos da camada atingido.');return false;}return true;}
  function detach(){
    if(selected.collection==='structures')Structures.prepareEdit(selected.source);
    if(!selected.generated)return;
    const e=selected.entry,l=selected.source;
    const object={kind:'tree',species:Terrain.biomes[e.type],x:e.localX??e.x,y:e.localY??e.y,size:e.size,rotation:0,text:'',color:e.foliage,trunkColor:e.trunk,seed:e.n};
    l.terrain.treeExclusions.add(e.index);l.terrain.dirty=true;l.objects.push(object);selected.object=object;selected.generated=false;
  }
  function shiftTo(x,y){
    const b=bounds(),c=center(),dx=Math.max(-b.x0,Math.min(1599.999-b.x1,x-c.x)),dy=Math.max(-b.y0,Math.min(1099.999-b.y1,y-c.y));
    for(const p of points()){p.x+=dx;p.y+=dy;}
    if(selected.collection==='tunnels'&&Array.isArray(selected.object.route))for(const p of selected.object.route){p.x+=dx;p.y+=dy;}
  }
  function move(e){
    if(!drag||drag.id!==e.pointerId||!editable())return;
    const p=point(e);if(!p.inside)return;
    const dx=p.x-(selected.region?.gx||0)*1600-drag.start.x,dy=p.y-(selected.region?.gy||0)*1100-drag.start.y;if(!drag.moved&&Math.hypot(dx,dy)*zoom<3)return;
    if(!drag.moved){remember();detach();drag.moved=true;}
    shiftTo(drag.center.x+dx,drag.center.y+dy);textureDirty=true;draw();sync();
  }
  function finish(){if(drag?.moved)changed();drag=null;}
  function moveTo(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||!editable())return;remember();detach();shiftTo(x,y);changed();}
  function transfer(index){
    if(!editable()||index===selected.layer)return;
    const parent=layers[index],dest=parent&&(selected.region?WorldSurface.child(parent,selected.region.gx,selected.region.gy,true):parent);if(!dest||parent.locked){notify('Escolha uma camada desbloqueada.');return;}
    const limit=selected.collection==='structures'?3000:selected.collection==='tunnels'?1000:2000;if(dest[selected.collection].length+members().length>limit){notify('Limite de objetos da camada de destino atingido.');return;}
    remember();detach();const source=selected.source,collection=selected.collection,object=selected.object;
    if(collection==='structures')Structures.prepareEdit(dest);for(const item of members()){source[collection].splice(source[collection].indexOf(item),1);dest[collection].push(item);}selected.layer=index;selected.source=dest;active=index;changed();
  }
  function recolor(color,trunk){
    if(!/^#[0-9a-f]{6}$/i.test(color)||!editable())return;
    remember();detach();for(const item of members())item.color=color;if(selected.object.kind==='tree'&&/^#[0-9a-f]{6}$/i.test(trunk))selected.object.trunkColor=trunk;changed();
  }
  function drawOutline(g){
    if(tool!=='select'||!valid())return;
    let box;
    if(selected.collection==='structures'){const ps=members().flatMap(o=>structureFaces(o,selected.region).flat()).filter(p=>p.visible!==false);if(ps.length){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);box={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}}else if(selected.generated||selected.object?.kind==='tree'){
      const e=(scene.vegetation?.entries||[]).find(e=>selected.generated?e.layer===selected.layer&&e.index===selected.entry.index:e.object===selected.object);if(e)box=treeBox(e);
    }else{
      const hit=billboardHits.find(h=>h.layer===selected.layer&&(h.tunnel===selected.object||h.originalObject===selected.object||h.object===selected.object));box=hit?.box;
      if(!box){const points2d=points().map(p=>scene.project(p.x+(selected.region?.gx||0)*1600,p.y+(selected.region?.gy||0)*1100,Billboards.surfaceHeight(p.x+(selected.region?.gx||0)*1600,p.y+(selected.region?.gy||0)*1100,layers),camera())).filter(p=>p.visible!==false);if(!points2d.length)return;const xs=points2d.map(p=>p.x),ys=points2d.map(p=>p.y);box={x:Math.min(...xs)-6,y:Math.min(...ys)-6,w:Math.max(...xs)-Math.min(...xs)+12,h:Math.max(...ys)-Math.min(...ys)+12};}
    }
    if(!box)return;g.save();g.strokeStyle='#fff19a';g.lineWidth=2;g.setLineDash([5,3]);g.strokeRect(box.x-3,box.y-3,box.w+6,box.h+6);g.setLineDash([]);g.fillStyle='#fff19a';for(const x of [box.x-3,box.x+box.w+3])for(const y of [box.y-3,box.y+box.h+3])g.fillRect(x-3,y-3,6,6);g.restore();
  }
  $('selectionMove').onclick=()=>moveTo(Number($('selectionX').value),Number($('selectionY').value));
  $('selectionTransfer').onclick=()=>transfer(Number($('selectionLayer').value));
  $('selectionColor').onchange=() => recolor($('selectionColor').value,$('selectionTrunk').value);
  $('selectionTrunk').onchange=() => recolor($('selectionColor').value,$('selectionTrunk').value);
  $('selectionClear').onclick=clear;
  const oldDown=canvas.onpointerdown,oldMove=canvas.onpointermove,oldUp=canvas.onpointerup,oldCancel=canvas.onpointercancel;
  canvas.onpointerdown=e=>{oldDown(e);if(tool==='select'&&!panning&&!orbiting&&!navigation.walking&&pointers.size===1)pick(e);else if(pointers.size>1)finish();};
  canvas.onpointermove=e=>{if(tool==='select'&&drag&&pointers.size===1&&!panning&&!orbiting){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});move(e);}else oldMove(e);};
  canvas.onpointerup=e=>{finish();oldUp(e);};canvas.onpointercancel=e=>{finish();oldCancel(e);};
  canvas.addEventListener('lostpointercapture',finish);window.addEventListener('blur',finish);
  $('tools').addEventListener('click',finish,true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
  window.syncSelection=sync;window.drawSelection=drawOutline;
  return {pick,move,finish,moveTo,transfer,recolor,clear,treeBox,get selected(){return selected;}};
})();
