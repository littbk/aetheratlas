'use strict';
const Selector=(()=>{
  let selected=null,drag=null,gizmo=null,attachEnd=null;
  const panel=document.createElement('section');panel.className='selection-panel';panel.hidden=true;
  panel.innerHTML='<h3>OBJETO SELECIONADO</h3><strong id="selectionName"></strong><p class="muted">Arraste no mapa ou informe a posição.</p><div class="selection-position"><label>X <input id="selectionX" type="number" min="0" max="1599" step="1"></label><label>Y <input id="selectionY" type="number" min="0" max="1099" step="1"></label></div><button id="selectionMove" type="button">Aplicar posição</button><div id="selectionBuildingStyle" hidden><label for="selectionBuildingVariant">Arquitetura</label><select id="selectionBuildingVariant"></select><label for="selectionBuildingPalette">Paleta</label><select id="selectionBuildingPalette"></select></div><div id="selectionEnds" hidden><p class="muted">Arraste A/B livremente ou use as setas: X largura, Y profundidade, Z altura.</p><div id="selectionEndRows"></div></div><label for="selectionLayer">Camada de destino</label><select id="selectionLayer"></select><button id="selectionTransfer" type="button">Mover para camada</button><div id="selectionTint"><label>Cor <input id="selectionColor" type="color"></label><label id="selectionTrunkLabel">Tronco <input id="selectionTrunk" type="color"></label></div><button id="selectionDelete" type="button">Excluir seleção</button><button id="selectionClear" type="button">Limpar seleção</button>';
  document.querySelector('#layersPanel .section-title').after(panel);
  Buildings3D.paletteNames.forEach((name,index)=>$('selectionBuildingPalette').add(new Option(name,index)));
  const materialPanel=document.createElement('div');materialPanel.id='selectionArchitectureStyle';materialPanel.hidden=true;
  materialPanel.innerHTML='<label for="selectionArchitectureMaterial">Material da arquitetura</label><select id="selectionArchitectureMaterial"></select><p class="muted">Aplica ao objeto ou grupo selecionado. A cor pode ser ajustada abaixo.</p>';
  $('selectionBuildingStyle').after(materialPanel);
  $('selectionArchitectureMaterial').add(new Option('Personalizado / materiais diferentes',''));
  for(const [key,preset] of Object.entries(Structures.materials))$('selectionArchitectureMaterial').add(new Option(preset.name,key));
  for(let i=0;i<2;i++){const row=document.createElement('div');row.className='selection-end';row.innerHTML=`<strong>Ponto ${i?'B':'A'}</strong><div class="selection-position"><label>X <input data-end="${i}" data-axis="x" type="number" min="0" max="1599.999" step="0.1"></label><label>Y <input data-end="${i}" data-axis="y" type="number" min="0" max="1099.999" step="0.1"></label></div><label class="selection-end-height">Altura adicional do ponto <input data-end="${i}" data-axis="height" type="number" min="-100" max="500" step="0.1"></label><button data-apply-end="${i}" type="button">Aplicar ponto ${i?'B':'A'}</button><button data-attach-end="${i}" type="button">Fixar ${i?'B':'A'} em outro objeto</button>`;$('selectionEndRows').append(row);}
  const valid=()=>{
    if(!selected)return false;const l=layers[selected.layer];
    if(!l||!l.visible||(selected.region?WorldSurface.child(l,selected.region.gx,selected.region.gy):l)!==selected.source)return false;const storage=selected.source;
    if(selected.generated)return !storage.terrain.treeExclusions.has(selected.entry.index)&&(storage.terrain.biomes[selected.entry.index]===2||storage.terrain.biomes[selected.entry.index]>=8);
    return storage[selected.collection].includes(selected.object);
  };
  function clear(){selected=null;drag=null;gizmo=null;attachEnd=null;panel.hidden=true;draw();}
  const members=()=>selected.members||[selected.object];
  const is3D=()=>selected&&(selected.collection==='structures'||selected.generated||selected.object?.kind==='tree'||selected.object?.kind==='decor'||selected.object?.kind==='building'&&Buildings3D.types.has(selected.object.building));
  const points=()=>selected.collection==='structures'?[...new Set(members().flatMap(o=>[...o.points,...(o.foundationPoints||[])]))]:selected.generated?[{x:selected.entry.localX??selected.entry.x,y:selected.entry.localY??selected.entry.y}]:selected.collection==='routes'?selected.object.points:selected.collection==='tunnels'?[selected.object.a,selected.object.b]:[selected.object];
  function bounds(){const p=points(),xs=p.map(p=>p.x),ys=p.map(p=>p.y);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};}
  function center(){const b=bounds();return {x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2};}
  function sync(){
    if(!valid()){selected=null;panel.hidden=true;return;}
    panel.hidden=tool!=='select';
    const o=selected.object||selected.entry,c=center(),tree=selected.generated||o.kind==='tree';
    const species={forest:'Floresta de copas',palms:'Coqueiro',pines:'Pinheiro',magic:'Árvore mágica',autumn:'Árvore outonal',jungle:'Árvore de selva',snowForest:'Pinheiro nevado'};
    $('selectionName').textContent=tree?(species[o.species||Terrain.biomes[o.type]]||'Árvore'):o.text||({building:Buildings.names[o.building],marker:'Marcador',text:'Texto',river:'Rio',path:'Caminho'}[o.kind])||(selected.collection==='tunnels'?'Túnel':'Objeto');
    if(o.kind==='decor')$('selectionName').textContent=({grass:'Grama',flower:'Flores',rock:'Pedras',bush:'Arbusto',mushroom:'Cogumelos'})[o.decor];
    if(o.kind==='waterfall')$('selectionName').textContent='Cachoeira';
    if(selected.collection==='structures')$('selectionName').textContent=({wall:'Muro',room:'Sala',corridor:'Corredor',floor:'Piso',stairs:'Escada',door:'Porta',window:'Janela',pillar:'Pilar',pit:'Fosso',bridgeWood:'Ponte de madeira',bridgeIron:'Ponte de ferro',bridgeSuspension:'Ponte suspensa'}[o.kind]||'Arquitetura')+(members().length>1?' · '+members().length+' peças':'');
    $('selectionDelete').textContent=selected.members?.length>1?'Excluir grupo selecionado':'Excluir seleção';
    const building=selected.collection==='objects'&&o.kind==='building';$('selectionBuildingStyle').hidden=!building;
    if(building){$('selectionBuildingVariant').replaceChildren();Buildings3D.styles[o.building].forEach((name,index)=>$('selectionBuildingVariant').add(new Option(name,index)));$('selectionBuildingVariant').value=o.buildingStyle||0;$('selectionBuildingPalette').value=o.buildingPalette||0;}
    materialPanel.hidden=selected.collection!=='structures';
    if(!materialPanel.hidden){const preset=Structures.materialOf(o);$('selectionArchitectureMaterial').value=members().every(part=>Structures.materialOf(part)===preset)?preset:'';}
    $('selectionX').value=Math.round(c.x);$('selectionY').value=Math.round(c.y);
    const twoPoints=selected.collection==='structures'&&o.points.length===2&&!o.close&&!o.fill;
    $('selectionEnds').hidden=!twoPoints;
    if(twoPoints)for(let i=0;i<2;i++){const row=$('selectionEndRows').children[i],p=o.points[i];row.querySelector('[data-axis=x]').value=+p.x.toFixed(2);row.querySelector('[data-axis=y]').value=+p.y.toFixed(2);row.querySelector('[data-axis=height]').value=+((o.kind?.startsWith('bridge')?o.bridgeEndHeights?.[i]:o.endHeights?.[i])||0).toFixed(2);row.querySelector('[data-attach-end]').hidden=!o.kind?.startsWith('bridge');}
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
    if(object.kind?.startsWith('bridge')){
      const [a,b]=object.points,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.01)return[];
      const nx=-dy/len,ny=dx/len,half=object.width/2;
      const ground=t=>Billboards.surfaceHeight(a.x+dx*t+gx,a.y+dy*t+gy,layers);
      const start=ground(0)+1.2+(object.bridgeEndHeights?.[0]||0),end=ground(1)+1.2+(object.bridgeEndHeights?.[1]||0);
      const level=t=>Math.max(start+(end-start)*t,ground(t)+object.height*.0325*Math.sin(Math.PI*t)**2)+(object.elevation||0);
      const at=(t,side,z)=>scene.project(a.x+dx*t+nx*side+gx,a.y+dy*t+ny*side+gy,z*(c.planet?.37:1),tc);
      const faces=[],count=Math.max(2,Math.min(60,Math.ceil(len/12)));
      for(let i=0;i<count;i++){const t=i/count,u=(i+1)/count,z=level(t),w=level(u);faces.push([at(t,-half,z),at(u,-half,w),at(u,half,w),at(t,half,z)]);}
      return faces;
    }
    const ground=Math.max(0,...(object.foundationPoints||object.points).map(p=>Billboards.surfaceHeight(p.x+gx,p.y+gy,layers)))+(object.elevation||0);
    const endLift=p=>{if(!object.endHeights||object.points.length!==2)return 0;const [a,b]=object.points,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return object.endHeights[0]+(object.endHeights[1]-object.endHeights[0])*t;};
    const project=(p,h)=>scene.project(p.x+gx,p.y+gy,ground+((h||0)+endLift(p))*(c.planet?.37:1),tc);
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
    attachEnd=null;
    const item=hit(e);if(!item){clear();return;}
    selected={...item,source:item.region?WorldSurface.child(layers[item.layer],item.region.gx,item.region.gy):layers[item.layer]};if(item.collection==='structures')selected.members=Structures.connected(selected.source.structures,item.object,$('architectureAutoGroup')?.checked!==false);active=item.layer;
    const p=point(e),c=center();drag={id:e.pointerId,mode:'move',start:p.inside?{x:p.x-(selected.region?.gx||0)*1600,y:p.y-(selected.region?.gy||0)*1100}:c,center:c,moved:false};
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
  function finish(){if(drag?.moved)changed();drag=null;if(tool==='select')canvas.style.cursor='crosshair';}
  function moveTo(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||!editable())return;remember();detach();shiftTo(x,y);changed();}
  function setEnd(index,x,y,height){
    if(!editable()||selected.collection!=='structures'||selected.object.points.length!==2||![x,y,height].every(Number.isFinite)||x<0||x>=1600||y<0||y>=1100||height< -100||height>500||![0,1].includes(index))return;
    const part=selected.object,bridge=part.kind?.startsWith('bridge');
    const key=bridge?'bridgeEndHeights':'endHeights';
    if(Math.hypot(x-part.points[index].x,y-part.points[index].y)<.001&&Math.abs(height-(part[key]?.[index]||0))<.001)return;
    remember();detach();part.points[index].x=x;part.points[index].y=y;
    part[key]=[...(part[key]||[0,0])];part[key][index]=height;
    changed();
  }
  function setBuildingAppearance(style,palette){
    if(!editable()||selected.collection!=='objects'||selected.object.kind!=='building'||!Number.isInteger(style)||style<0||style>2||!Number.isInteger(palette)||palette<0||palette>2)return;
    if((selected.object.buildingStyle||0)===style&&(selected.object.buildingPalette||0)===palette)return;
    remember();selected.object.buildingStyle=style;selected.object.buildingPalette=palette;changed();
  }
  function setArchitectureMaterial(key){
    if(!Object.hasOwn(Structures.materials,key)||!editable()||selected.collection!=='structures')return;
    if(members().every(part=>part.materialPreset===key&&part.color===Structures.materials[key].color))return;
    remember();detach();for(const part of members())Structures.applyMaterial(part,key);changed();
  }
  function attachTo(e){
    if(attachEnd===null||!editable())return;
    const target=hit(e),part=selected.object,index=attachEnd;
    if(!target||target.object===part||!['structures','objects'].includes(target.collection)){notify('Clique em outro objeto 3D para fixar o apoio.');return;}
    if((target.region?.gx||0)!==(selected.region?.gx||0)||(target.region?.gy||0)!==(selected.region?.gy||0)){notify('O apoio precisa estar na mesma região da ponte.');return;}
    const other=target.object,structure=target.collection==='structures',building=other?.kind==='building'&&Buildings3D.types.has(other.building);
    if(!structure&&!building){notify('Escolha uma construção 3D ou outro segmento de ponte.');return;}
    const at=point(e),local={x:at.x-(selected.region?.gx||0)*1600,y:at.y-(selected.region?.gy||0)*1100};
    const targetPoint=structure?other.points.reduce((best,p)=>Math.hypot(p.x-local.x,p.y-local.y)<Math.hypot(best.x-local.x,best.y-local.y)?p:best,other.points[0]):other;
    const gx=targetPoint.x+(selected.region?.gx||0)*1600,gy=targetPoint.y+(selected.region?.gy||0)*1100;
    let top;
    if(structure){const ground=Math.max(...(other.foundationPoints||other.points).map(p=>Billboards.surfaceHeight(p.x+(selected.region?.gx||0)*1600,p.y+(selected.region?.gy||0)*1100,layers)));top=ground+(other.elevation||0)+(other.kind?.startsWith('bridge')?1.2+(other.bridgeEndHeights?.[other.points.indexOf(targetPoint)]||0):other.height);}
    else top=Billboards.surfaceHeight(gx,gy,layers)+(other.elevation||0)+.8;
    const height=Math.max(-100,Math.min(500,top-Billboards.surfaceHeight(gx,gy,layers)-1.2-(part.elevation||0)));
    setEnd(index,targetPoint.x,targetPoint.y,height);attachEnd=null;notify(`Apoio ${index?'B':'A'} fixado. Ajuste a altura fina no painel, se necessário.`);
  }
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
  function startHandle(e,handle){
    if(!editable())return false;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    drag={id:e.pointerId,mode:handle.mode,startScreen:{x,y},centerScreen:handle.center,moved:false};
    if(handle.mode==='endpoint'||handle.mode==='endpoint-axis'){const p=selected.object.points[handle.index],ground=point(e),key=selected.object.kind?.startsWith('bridge')?'bridgeEndHeights':'endHeights';drag.index=handle.index;drag.axis=handle.axis;drag.start={x:ground.x-(selected.region?.gx||0)*1600,y:ground.y-(selected.region?.gy||0)*1100};drag.origin={x:p.x,y:p.y,height:selected.object[key]?.[handle.index]||0};drag.center={x:p.x,y:p.y};}
    canvas.style.cursor=handle.mode==='rotate'?'crosshair':handle.mode==='height'||handle.axis==='z'||handle.axis==='y'?'ns-resize':handle.axis==='x'?'ew-resize':'nwse-resize';return true;
  }
  function moveEnd(e){
    if(!drag||drag.id!==e.pointerId||!editable())return;
    const rect=canvas.getBoundingClientRect(),sx=e.clientX-rect.left,sy=e.clientY-rect.top,dist=Math.hypot(sx-drag.startScreen.x,sy-drag.startScreen.y);
    if(!drag.moved&&dist<3)return;
    const p=drag.axis==='z'?null:point(e);if(p&&!p.inside)return;
    const localX=p?p.x-(selected.region?.gx||0)*1600:drag.start.x,localY=p?p.y-(selected.region?.gy||0)*1100:drag.start.y;
    const x=drag.axis==='y'||drag.axis==='z'?drag.origin.x:drag.origin.x+localX-drag.start.x,y=drag.axis==='x'||drag.axis==='z'?drag.origin.y:drag.origin.y+localY-drag.start.y;
    const c=camera(),pixels=Math.max(.2,(c.zoom||1)*Math.max(.3,Math.sin(Math.abs(c.tilt||35)*Math.PI/180))*(c.planet?.37:1));
    const height=drag.axis==='z'?drag.origin.height+(drag.startScreen.y-sy)/pixels:drag.origin.height;
    if(x<0||x>=1600||y<0||y>=1100||height< -100||height>500)return;
    if(!drag.moved){remember();detach();drag.moved=true;}
    Object.assign(selected.object.points[drag.index],{x,y});
    if(drag.axis==='z'){const key=selected.object.kind?.startsWith('bridge')?'bridgeEndHeights':'endHeights';selected.object[key]=[...(selected.object[key]||[0,0])];selected.object[key][drag.index]=height;}
    textureDirty=true;draw();sync();
  }
  function adjustHandle(e){
    if(!drag||drag.id!==e.pointerId||!editable())return;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,start=drag.startScreen,screenCenter=drag.centerScreen;
    if(!drag.moved&&Math.hypot(x-start.x,y-start.y)<3)return;
    if(!drag.moved){
      remember();detach();drag.moved=true;
      if(selected.collection==='structures'){
        const pivot=center(),parts=members(),vertices=parts.flatMap(p=>[...p.points,...(p.foundationPoints||[])]);
        drag.origin={pivot,vertices:vertices.map(point=>({point,x:point.x,y:point.y})),parts:parts.map(part=>({part,width:part.width,height:part.height,base:part.base||0,elevation:part.elevation||0}))};
      }else drag.origin={size:selected.object.size,rotation:selected.object.rotation||0,elevation:selected.object.elevation||0};
    }
    let factor=1,angle=0,offset=0;
    if(drag.mode==='scale')factor=Math.max(.1,Math.min(4,Math.hypot(x-screenCenter.x,y-screenCenter.y)/Math.max(12,Math.hypot(start.x-screenCenter.x,start.y-screenCenter.y))));
    if(drag.mode==='rotate')angle=Math.atan2(y-screenCenter.y,x-screenCenter.x)-Math.atan2(start.y-screenCenter.y,start.x-screenCenter.x);
    if(drag.mode==='height'){const c=camera(),pixels=Math.max(.2,(c.zoom||1)*Math.max(.3,Math.sin(Math.abs(c.tilt||35)*Math.PI/180))*(c.planet?.37:1));offset=(start.y-y)/pixels;}
    const origin=drag.origin;
    if(selected.collection==='structures'){
      const {pivot,vertices,parts}=origin,ca=Math.cos(angle),sa=Math.sin(angle);
      const transformed=vertices.map(v=>({x:pivot.x+((v.x-pivot.x)*ca-(v.y-pivot.y)*sa)*factor,y:pivot.y+((v.x-pivot.x)*sa+(v.y-pivot.y)*ca)*factor}));
      if(transformed.some(p=>p.x<0||p.x>=1600||p.y<0||p.y>=1100)||parts.some(({width,height,base,elevation})=>width*factor<1||width*factor>180||Math.abs(height*factor)>100||base*factor>100||elevation+offset< -100||elevation+offset>500))return;
      vertices.forEach((v,i)=>Object.assign(v.point,transformed[i]));
      for(const {part,width,height,base,elevation} of parts){part.width=width*factor;part.height=height*factor;if(part.base)part.base=base*factor;part.elevation=elevation+offset;}
    }else{
      if(origin.size*factor<8||origin.size*factor>160||origin.elevation+offset< -100||origin.elevation+offset>500)return;
      selected.object.size=origin.size*factor;selected.object.rotation=((origin.rotation+angle*180/Math.PI+180)%360+360)%360-180;selected.object.elevation=origin.elevation+offset;
    }
    $('status').textContent=drag.mode==='scale'?`Escala ${Math.round(factor*100)}%`:drag.mode==='rotate'?`Rotação ${Math.round(angle*180/Math.PI)}°`:`Altura ${Math.round((selected.object?.elevation??origin.parts?.[0]?.part.elevation)||0)} m`;
    textureDirty=true;draw();
  }
  function remove(){
    if(!valid())return;
    if(layers[selected.layer].locked){notify('Desbloqueie a camada do objeto para excluí-lo.');return;}
    finish();remember();const source=selected.source;
    if(selected.generated){source.terrain.treeExclusions.add(selected.entry.index);source.terrain.dirty=true;}
    else{
      if(selected.collection==='structures')Structures.prepareEdit(source);
      for(const item of members()){const index=source[selected.collection].indexOf(item);if(index>=0)source[selected.collection].splice(index,1);}
    }
    textureDirty=true;clear();changed();notify('Seleção excluída. Ctrl+Z para desfazer.');
  }
  function screenBox(){
    if(tool!=='select'||!valid())return null;
    let box;
    if(selected.collection==='structures'){const ps=members().flatMap(o=>structureFaces(o,selected.region).flat()).filter(p=>p.visible!==false);if(ps.length){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);box={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}}else if(selected.generated||selected.object?.kind==='tree'||selected.object?.kind==='decor'){
      const e=(scene.vegetation?.entries||[]).find(e=>selected.generated?e.layer===selected.layer&&e.index===selected.entry.index:e.object===selected.object);if(e)box=treeBox(e);
    }else{
      const hit=billboardHits.find(h=>h.layer===selected.layer&&(h.tunnel===selected.object||h.originalObject===selected.object||h.object===selected.object));box=hit?.box;
      if(!box){const points2d=points().map(p=>scene.project(p.x+(selected.region?.gx||0)*1600,p.y+(selected.region?.gy||0)*1100,Billboards.surfaceHeight(p.x+(selected.region?.gx||0)*1600,p.y+(selected.region?.gy||0)*1100,layers),camera())).filter(p=>p.visible!==false);if(!points2d.length)return null;const xs=points2d.map(p=>p.x),ys=points2d.map(p=>p.y);box={x:Math.min(...xs)-6,y:Math.min(...ys)-6,w:Math.max(...xs)-Math.min(...xs)+12,h:Math.max(...ys)-Math.min(...ys)+12};}
    }
    return box;
  }
  function drawOutline(g){
    gizmo=null;const box=screenBox();if(!box)return;
    g.save();g.strokeStyle='#fff19a';g.lineWidth=2;g.setLineDash([5,3]);g.strokeRect(box.x-3,box.y-3,box.w+6,box.h+6);g.setLineDash([]);g.fillStyle='#fff19a';for(const x of [box.x-3,box.x+box.w+3])for(const y of [box.y-3,box.y+box.h+3])g.fillRect(x-3,y-3,6,6);
    if(is3D()&&!layers[selected.layer].locked&&camera().relief>.1){
      const center={x:box.x+box.w/2,y:box.y+box.h/2};
      const handles=[{mode:'scale',x:box.x+box.w+20,y:box.y+box.h+20,label:'↗',caption:'Escala',color:'#9adbc8'},
        {mode:'rotate',x:box.x+box.w+22,y:box.y-22,label:'↻',caption:'Girar',color:'#f3ca82'},
        {mode:'height',x:box.x-22,y:box.y-22,label:'↑',caption:'Altura',color:'#b8b2ff'}];
      if(selected.collection==='structures'&&selected.object.points.length===2&&!selected.object.close&&!selected.object.fill){
        for(let i=0;i<2;i++){const p=selected.object.points[i],gx=p.x+(selected.region?.gx||0)*1600,gy=p.y+(selected.region?.gy||0)*1100;
          const part=selected.object,bridge=part.kind?.startsWith('bridge'),c=camera(),tc={...c,relief:1},ground=bridge?Billboards.surfaceHeight(gx,gy,layers):Math.max(...part.points.map(v=>Billboards.surfaceHeight(v.x+(selected.region?.gx||0)*1600,v.y+(selected.region?.gy||0)*1100,layers)));
          const lift=bridge?1.2+(part.bridgeEndHeights?.[i]||0)+(part.elevation||0):part.height+(part.endHeights?.[i]||0)+(part.elevation||0),z=ground+lift*(c.planet?.37:1);
          const screen=scene.project(gx,gy,z,tc);if(screen.visible===false)continue;
          handles.push({mode:'endpoint',index:i,x:screen.x,y:screen.y,label:i?'B':'A',caption:'Ponto '+(i?'B':'A'),color:'#7ce2ff'});
          for(const [axis,color,delta] of [['x','#ff8b82',[35,0,0]],['y','#8cdda6',[0,35,0]],['z','#a9b9ff',[0,0,20]]]){
            const tip=scene.project(gx+delta[0],gy+delta[1],z+delta[2],tc),dx=tip.x-screen.x,dy=tip.y-screen.y,len=Math.hypot(dx,dy)||1;
            const ux=axis==='z'&&len<2?0:dx/len,uy=axis==='z'&&len<2?-1:dy/len;
            handles.push({mode:'endpoint-axis',index:i,axis,x:screen.x+ux*39,y:screen.y+uy*39,origin:{x:screen.x,y:screen.y},label:axis.toUpperCase(),caption:'',color});
          }
        }
      }
      gizmo={center,handles};g.font='bold 17px system-ui';g.textAlign='center';g.textBaseline='middle';
      for(const h of handles){if(h.mode==='endpoint-axis'){const dx=h.x-h.origin.x,dy=h.y-h.origin.y,len=Math.hypot(dx,dy)||1;g.beginPath();g.moveTo(h.origin.x+dx*12/len,h.origin.y+dy*12/len);g.lineTo(h.x-dx*11/len,h.y-dy*11/len);g.strokeStyle=h.color;g.lineWidth=3;g.stroke();}g.beginPath();g.arc(h.x,h.y,12,0,Math.PI*2);g.fillStyle='#17212bee';g.fill();g.strokeStyle=h.color;g.lineWidth=2;g.stroke();g.fillStyle=h.color;g.fillText(h.label,h.x,h.y+1);if(h.caption){g.font='10px system-ui';g.fillStyle='#fff9dc';g.fillText(h.caption,h.x,h.y+23);g.font='bold 17px system-ui';}}
    }
    g.restore();
  }
  function gizmoHit(e){
    if(!gizmo||!is3D())return null;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,r=e.pointerType==='touch'?22:16;
    const handle=gizmo.handles.filter(h=>h.mode==='endpoint-axis').find(h=>Math.hypot(x-h.x,y-h.y)<=r)||gizmo.handles.find(h=>Math.hypot(x-h.x,y-h.y)<=r);
    return handle?{...handle,center:gizmo.center}:null;
  }
  $('selectionMove').onclick=()=>moveTo(Number($('selectionX').value),Number($('selectionY').value));
  $('selectionBuildingVariant').onchange=()=>setBuildingAppearance(+$('selectionBuildingVariant').value,+$('selectionBuildingPalette').value);
  $('selectionBuildingPalette').onchange=()=>setBuildingAppearance(+$('selectionBuildingVariant').value,+$('selectionBuildingPalette').value);
  $('selectionArchitectureMaterial').onchange=e=>setArchitectureMaterial(e.target.value);
  $('selectionEndRows').addEventListener('click',e=>{const button=e.target.closest('[data-apply-end]');if(!button)return;const i=Number(button.dataset.applyEnd),row=button.parentElement;setEnd(i,Number(row.querySelector('[data-axis=x]').value),Number(row.querySelector('[data-axis=y]').value),Number(row.querySelector('[data-axis=height]').value));});
  $('selectionEndRows').addEventListener('click',e=>{const button=e.target.closest('[data-attach-end]');if(!button||!editable())return;attachEnd=Number(button.dataset.attachEnd);notify(`Clique no objeto que receberá o apoio ${attachEnd?'B':'A'}. Esc cancela.`);});
  $('selectionTransfer').onclick=()=>transfer(Number($('selectionLayer').value));
  $('selectionColor').onchange=() => recolor($('selectionColor').value,$('selectionTrunk').value);
  $('selectionTrunk').onchange=() => recolor($('selectionColor').value,$('selectionTrunk').value);
  $('selectionClear').onclick=clear;
  $('selectionDelete').onclick=remove;
  const oldDown=canvas.onpointerdown,oldMove=canvas.onpointermove,oldUp=canvas.onpointerup,oldCancel=canvas.onpointercancel;
  canvas.onpointerdown=e=>{oldDown(e);if(tool==='select'&&!panning&&!orbiting&&!navigation.walking&&pointers.size===1){if(attachEnd!==null)attachTo(e);else{const handle=gizmoHit(e);if(!handle||!startHandle(e,handle))pick(e);}}else if(pointers.size>1)finish();};
  canvas.onpointermove=e=>{if(tool==='select'&&drag&&pointers.size===1&&!panning&&!orbiting){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(drag.mode==='move')move(e);else if(drag.mode==='endpoint'||drag.mode==='endpoint-axis')moveEnd(e);else adjustHandle(e);}else{oldMove(e);if(tool==='select'&&!pointers.size){const handle=gizmoHit(e);canvas.style.cursor=handle?(handle.mode==='height'||handle.axis==='z'?'ns-resize':handle.axis==='x'?'ew-resize':handle.axis==='y'?'ns-resize':handle.mode==='scale'?'nwse-resize':'crosshair'):'crosshair';}}};
  canvas.onpointerup=e=>{finish();oldUp(e);};canvas.onpointercancel=e=>{finish();oldCancel(e);};
  canvas.addEventListener('lostpointercapture',finish);window.addEventListener('blur',finish);
  $('tools').addEventListener('click',finish,true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(attachEnd!==null){attachEnd=null;notify('Fixação cancelada.');}else clear();}if(e.key==='Delete'&&tool==='select'&&valid()&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.closest?.('input,textarea,select,[contenteditable]')){e.preventDefault();remove();}});
  window.syncSelection=sync;window.drawSelection=drawOutline;
  return {pick,move,finish,moveTo,setEnd,setBuildingAppearance,setArchitectureMaterial,transfer,recolor,remove,clear,treeBox,get selected(){return selected;},get gizmo(){return gizmo;}};
})();
