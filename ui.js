'use strict';
// Presentation only: move existing controls without replacing their listeners.
(()=>{
  const $=id=>document.getElementById(id);
  const paths={
    lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',unlock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8-1M12 14v3',viewOff:'M3 3l18 18M10 5c6-1 12 7 12 7l-4 4M6 6c-3 2-4 6-4 6s4 7 10 7l4-1',
    pan:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
    select:'m5 3 14 10-7 1-3 7Z',orbit:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 12h8M12 8c-2 2-2 6 0 8 2-2 2-6 0-8M20 8a9 9 0 1 0 1 7M20 3v5h-5',opposite:'M20 8a9 9 0 1 0 1 7M20 3v5h-5',player:'M12 3v3M12 18v3M3 12h3M18 12h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    fog:'M3 6h18M5 10h14M3 14h18M5 18h14',waterRemove:'M3 8c3-3 6 3 9 0s6-3 9 0M3 14c3-3 6 3 9 0M14 18h8',water:'M3 7c3-3 6 3 9 0s6-3 9 0M3 13c3-3 6 3 9 0s6-3 9 0M3 19c3-3 6 3 9 0s6-3 9 0',brush:'m14 4 6 6M9 15l10-12 3 3-12 11M9 15c-5-2-2 6-7 6 8 2 10-2 7-6',raise:'M4 18h16M12 15V4M7 9l5-5 5 5',lower:'M4 18h16M12 4v11M7 10l5 5 5-5',
    mountain:'m2 20 8-15 6 11 3-5 4 9ZM7 11l3 2 3-2',volcano:'m3 20 6-12h6l6 12ZM10 4l1-2M14 4l1-2M10 12h4',smooth:'M3 7c4-6 6 6 10 0s6 0 8 0M3 12c4-6 6 6 10 0s6 0 8 0M3 17c4-6 6 6 10 0s6 0 8 0',
    seaErase:'M3 6c3-3 6 3 9 0s6-3 9 0M3 12c3-3 6 3 9 0s6-3 9 0M5 19h14M9 16l6 6',blend:'M3 7c5-5 8 5 13 0M3 12c5-5 8 5 13 0M3 17c5-5 8 5 13 0M18 5l3 2-3 2M18 10l3 2-3 2M18 15l3 2-3 2',
    plateau:'m2 19 5-12h10l5 12M7 7h10',color:'M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12ZM9 16c0 2 1 3 3 3',river:'M7 2c12 5-8 7 4 12s-4 7-2 8M13 2c12 5-8 7 4 12s-4 7-2 8',path:'M5 3c16 3-14 9 6 12s-6 7-6 7',
    marker:'M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0ZM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0',text:'M4 5h16M12 5v16M8 21h8',erase:'m3 14 10-11 8 8-10 11H8ZM8 9l8 8M11 22h11',
    submap:'M4 20V4h9M9 15 21 3M15 3h6v6',tunnel:'M4 21V12a8 8 0 0 1 16 0v9M8 21v-9a4 4 0 0 1 8 0v9M2 21h8M14 21h8',settlement:'M2 21h20M4 12l8-7 8 7M6 11v10M18 11v10M9 21v-7h6v7M3 7l3-2M18 5l3 2',decorate:'M12 21V9M12 12c-5-7-10-4-7 0 2 3 5 1 7 0M12 12c5-7 10-4 7 0-2 3-5 1-7 0M7 21h10',
    wall:'M3 6h18v12H3ZM3 12h18M9 6v6M15 6v6M6 12v6M12 12v6M18 12v6',room:'M3 3h18v18h-6M9 21H3V3M9 21v-6h6',corridor:'M3 7h18M3 17h18M7 7v10M17 7v10',floor:'M3 3h18v18H3ZM9 3v18M15 3v18M3 9h18M3 15h18',
    rect:'M3 5h18v14H3Z',rectFill:'M3 5h18v14H3ZM6 8h12v8H6Z',ellipse:'M21 12a9 7 0 1 1-18 0 9 7 0 0 1 18 0',ellipseFill:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',line:'M4 20 20 4M3 3v4M3 3h4M21 21v-4M21 21h-4',
    door:'M5 21V3h14v18M5 21h14M15 12h1',window:'M4 4h16v16H4ZM12 4v16M4 12h16',stairs:'M3 21h5v-6h5V9h5V3h3M3 21V3',pillar:'M5 5h14M7 5v14M17 5v14M5 19h14M5 22h14M5 2h14',pit:'M21 6c0 2-4 4-9 4S3 8 3 6s4-4 9-4 9 2 9 4ZM3 6l4 12c2 3 8 3 10 0l4-12',bridgeWood:'M2 14h20M3 18h18M5 14V8M19 14V8M5 8h14M8 14v4M12 14v4M16 14v4',bridgeIron:'M2 17h20M3 13h18M5 13V5l7 8 7-8v8M5 5h14M8 17v3M16 17v3',bridgeSuspension:'M2 17h20M5 17V4M19 17V4M2 8c5 0 5 8 10 8s5-8 10-8M8 12v5M12 16v1M16 12v5',
    layers:'m12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5',camera:'M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',view:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    cloud:'M7 19a5 5 0 1 1 0-10 6 6 0 0 1 12-1 5 5 0 0 1 0 11Z',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-6 5-6 13 0 18 6-5 6-13 0-18',
    new:'M14 3H4v18h16V9M14 3v6h6M8 15h8M12 11v8',open:'M3 7V4h7l3 3h8v4M3 7v14h16l3-10H7Z',save:'M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8',upload:'M12 17V3M7 8l5-5 5 5M3 16v5h18v-5',download:'M12 3v14M7 12l5 5 5-5M3 16v5h18v-5',send:'m2 3 20 9-20 9 4-9Zm4 9h16',
    topView:'M12 3 22 12 12 21 2 12ZM7 12h10M12 8v8',gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',undo:'M9 4 3 10l6 6M3 10h10a7 7 0 0 1 0 14',redo:'m15 4 6 6-6 6M21 10H11a7 7 0 0 0 0 14',back:'M10 5 3 12l7 7M3 12h18',plus:'M12 4v16M4 12h16',minus:'M4 12h16',close:'M5 5l14 14M19 5 5 19',up:'m5 15 7-7 7 7',down:'m5 9 7 7 7-7',edit:'m3 17 12-12 4 4L7 21H3ZM15 5l3-3 4 4-3 3',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',copy:'M8 8h13v13H8ZM16 8V3H3v13h5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',forest:'m12 2 7 10h-4l5 6H4l5-6H5ZM12 18v4',fit:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',walk:'M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0M8 21l4-7 4 7M12 14V8M6 12l6-4 6 4'
  };
  const svg=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.view}"/></svg>`;
  paths.waterfall='M3 5h7v7c0 4 2 6 2 9M7 5v7c0 4 2 6 2 9M14 4v10M18 7v10M12 19c3-2 6 2 9 0M14 22h7';
  function iconButton(button,name,label){
    if(!button)return;
    button.classList.add('icon-button');button.dataset.uiIcon=name;
    button.setAttribute('aria-label',label);button.dataset.tooltip=label;
    if(!button.querySelector('.ui-icon'))button.insertAdjacentHTML('afterbegin',svg(name));
  }
  function section(title,...nodes){const el=document.createElement('section');el.className='ui-section';const h=document.createElement('h3');h.textContent=title;el.append(h,...nodes.filter(Boolean));return el;}
  const setting=id=>$(id)?.closest('.setting');
  const detail=id=>$(id)?.closest('details');
  function tabs(panel,items,initial){
    const bar=document.createElement('div');bar.className='ui-tabs';bar.setAttribute('role','tablist');
    const scroll=document.createElement('div');scroll.className='ui-scroll';
    const title=panel.querySelector('.ui-panel-heading');
    const groups=new Map();
    for(const [id,label,icon,nodes] of items){
      const group=document.createElement('div');group.id='ui-'+id;group.className='ui-tab-content';group.setAttribute('role','tabpanel');group.setAttribute('aria-labelledby','ui-tab-'+id);group.append(...nodes.filter(Boolean));groups.set(id,group);scroll.append(group);
      const button=document.createElement('button');button.id='ui-tab-'+id;button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls',group.id);iconButton(button,icon,label);button.onclick=()=>choose(id);bar.append(button);
      button.onkeydown=e=>{const buttons=[...bar.children],index=buttons.indexOf(button);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();}};
    }
    function choose(id){for(const [key,group] of groups){group.hidden=key!==id;const button=$('ui-tab-'+key);button.setAttribute('aria-selected',String(key===id));button.tabIndex=key===id?0:-1;}title.textContent=items.find(item=>item[0]===id)[1];scroll.scrollTop=0;}
    panel.append(bar,scroll);choose(initial);return choose;
  }
  function heading(panel,label){const oldClose=panel.querySelector('.close-panel'),head=document.createElement('div');head.className='ui-panel-head';const title=document.createElement('h2');title.className='ui-panel-heading';title.textContent=label;head.append(title);if(oldClose){iconButton(oldClose,'close','Fechar painel');head.append(oldClose);}return head;}
  const left=$('toolsPanel'),right=$('layersPanel');
  const leftHead=heading(left,'Navegação'),rightHead=heading(right,'Camadas');
  iconButton($('add'),'plus','Adicionar camada');rightHead.append($('add'));
  const mainTools=$('tools'),toolButtons=[...mainTools.children];mainTools.replaceChildren();
  const tools=ids=>{const grid=document.createElement('div');grid.className='tools ui-tool-grid';for(const id of ids){const button=toolButtons.find(b=>b.dataset.tool===id);if(button)grid.append(button);}return grid;};
  const explore=tools(['pan','select','orbit','player']);explore.id='tools';
  const terrain=tools(['brush','decorate','raise','lower','mountain','volcano','smooth','blend','plateau','water','waterRemove','river','waterfall','path','fog','seaErase','color','erase']);terrain.classList.add('ui-terrain-tools');
  const decoration=document.createElement('div');decoration.className='ui-decoration-settings';
  decoration.innerHTML='<p class="muted">Pinte detalhes 3D sobre o relevo. Arraste para espalhar; use o Seletor para mover, girar ou mudar a altura.</p><label for="decorType">Elemento</label><select id="decorType"><option value="grass">🌿 Grama</option><option value="flower">🌸 Flores</option><option value="rock">🪨 Pedras</option><option value="bush">🌳 Arbustos</option><option value="mushroom">🍄 Cogumelos</option></select><div class="setting"><label for="decorRadius">Área <output id="decorRadiusValue">48 px</output></label><input id="decorRadius" type="range" min="16" max="180" value="48"></div><div class="setting"><label for="decorDensity">Densidade <output id="decorDensityValue">3</output></label><input id="decorDensity" type="range" min="1" max="8" value="3"></div><div class="setting"><label for="decorColor">Cor</label><input id="decorColor" type="color" value="#73a45f"></div>';
  const decorThumbs=document.createElement('div');decorThumbs.className='ui-decor-thumbs';decorThumbs.setAttribute('role','group');decorThumbs.setAttribute('aria-label','Miniaturas dos objetos de decoração');
  const decorArt={grass:'<path d="M6 31Q8 17 4 11M8 31q2-16 11-23M16 31q-2-13-6-18m12 18q3-17 11-22m-7 22q-2-15-1-22m12 22q0-12 6-18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',flower:'<path d="M24 31V16M11 31V22M35 31V21" stroke="#57955b" stroke-width="2"/><circle cx="24" cy="12" r="5"/><circle cx="11" cy="18" r="4"/><circle cx="35" cy="17" r="4"/>',rock:'<path d="M4 30 10 18 23 13 37 17 44 29 32 33 13 33Z"/><path d="m10 18 13-5 9 18M23 13l14 4" fill="none" stroke="#e1ded0" stroke-width="1.5"/>',bush:'<path d="M8 28q-5-8 4-12 0-9 9-8 5-7 12 0 10-2 9 10 7 6 0 11Z"/><path d="M24 30v-9" stroke="#704f35" stroke-width="2"/>',mushroom:'<path d="M19 29V18h10v11q-4 4-10 0Z" fill="#e5d4af"/><path d="M8 19q2-14 16-14t16 14q-14 7-32 0Z"/><circle cx="19" cy="11" r="2" fill="#fff1dc"/><circle cx="30" cy="14" r="2" fill="#fff1dc"/>'};
  for(const [id,label,color] of [['grass','Grama','#73a45f'],['flower','Flores','#d880a7'],['rock','Pedras','#929990'],['bush','Arbustos','#4f8458'],['mushroom','Cogumelos','#c78355']]){const button=document.createElement('button');button.type='button';button.dataset.decor=id;button.setAttribute('aria-label',label);button.innerHTML=`<svg viewBox="0 0 48 36" style="color:${color}" aria-hidden="true">${decorArt[id]}</svg><small>${label}</small>`;button.onclick=()=>{const select=$('decorType');select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));};decorThumbs.append(button);}
  decoration.querySelector('#decorType').after(decorThumbs);
  for(const id of ['decorRadius','decorDensity'])decoration.querySelector('#'+id).oninput=e=>$(id+'Value').value=e.target.value+(id==='decorRadius'?' px':'');
  decoration.querySelector('#decorType').onchange=e=>{$('decorColor').value=({grass:'#73a45f',flower:'#e7a6c3',rock:'#929990',bush:'#4f8458',mushroom:'#d4aa77'})[e.target.value];for(const button of decorThumbs.children)button.classList.toggle('selected',button.dataset.decor===e.target.value);};
  decorThumbs.firstElementChild.classList.add('selected');
  const places=tools(['marker','text','tunnel','settlement']);places.classList.add('ui-places-tools');
  const worldTools=tools(['submap']);
  const waterSettings=document.createElement('div');waterSettings.innerHTML='<label><input id="waterAuto" type="checkbox" checked> Preencher até a borda</label><label for="lakeColor">Cor desta água</label><input id="lakeColor" type="color" value="#347787"><label><input id="waterRecolor" type="checkbox"> Recolorir lago existente ao clicar</label><label for="waterLevel">Nível manual da água</label><input id="waterLevel" type="number" min="-500" max="3000" step="1" value="0" disabled><p class="muted">Selecione Água e clique no fundo de um buraco. O preenchimento fica limitado à região atual. Selecione Remover água e clique no lago para apagar a região inteira, sem alterar o terreno.</p>';waterSettings.querySelector('#waterAuto').onchange=e=>waterSettings.querySelector('#waterLevel').disabled=e.target.checked;
  const smart=detail('soft'),sculpt=detail('amount'),forest=detail('forestType'),world=detail('planetMode'),colors=detail('grassColor'),tunnels=detail('tunnelDepth');
  [tunnels,colors].forEach(el=>{if(el)el.open=false;});world.open=true;
  const indoor=$('indoorTools'),palette=$('palette'),buildings=$('buildings');
  const size=setting('size'),color=setting('color');
  const architectureSettings=document.createElement('div');architectureSettings.className='ui-architecture-settings';
  architectureSettings.innerHTML='<div class="setting"><label for="architectureMaterial">Material</label><select id="architectureMaterial"><option value="limestone">Calcário</option><option value="slate">Ardósia</option><option value="sandstone">Arenito</option><option value="brick">Tijolo</option><option value="wood">Madeira</option></select></div><div class="setting"><label for="architectureColor">Cor do material</label><input id="architectureColor" type="color" value="#b6ad98"></div><div class="setting"><label for="architectureHeight">Altura <output id="architectureHeightValue">26</output></label><input id="architectureHeight" type="range" min="6" max="64" value="26"></div><div class="setting"><label for="architectureWidth">Espessura <output id="architectureWidthValue">10</output></label><input id="architectureWidth" type="range" min="3" max="32" value="10"></div>';
  architectureSettings.insertAdjacentHTML('beforeend','<label><input id="architectureAutoGroup" type="checkbox" checked> Agrupar muros ao encostar</label><p class="muted">Muros conectados da mesma camada e região se movem juntos com o seletor.</p>');
  architectureSettings.insertAdjacentHTML('beforeend','<p class="muted">Pontes: arraste entre as duas margens. Espessura define a largura do tablado; Altura ajusta a folga sobre o terreno no vão. As pontas acompanham a elevação das margens.</p>');
  architectureSettings.querySelector('#architectureAutoGroup').onchange=()=>{Selector.clear();changed();};
  const materialPicker=architectureSettings.querySelector('#architectureMaterial');materialPicker.replaceChildren();
  for(const [key,preset] of Object.entries(Structures.materials))materialPicker.add(new Option(preset.name,key));
  materialPicker.addEventListener('change',e=>{$('architectureColor').value=Structures.materials[e.target.value].color;});
  for(const id of ['architectureHeight','architectureWidth'])architectureSettings.querySelector('#'+id).addEventListener('input',e=>$(id+'Value').value=e.target.value);
  // Keep references before section() detaches the controls from the document.
  const iconSizeControl=setting('iconSize'),rotationControl=setting('rotation');
  const placeControls=section('Opções do local',iconSizeControl,rotationControl,$('marker'),$('label'));
  const settlementSettings=document.createElement('div');settlementSettings.className='ui-settlement-settings';settlementSettings.innerHTML='<label for="settlementType">Pintar</label><select id="settlementType"><option value="house">Casas</option><option value="village">Vilas</option></select><div class="setting"><label for="settlementRadius">Área do pincel <output id="settlementRadiusValue">80 px</output></label><input id="settlementRadius" type="range" min="35" max="220" value="80"></div><div class="setting"><label for="settlementDensity">Densidade <output id="settlementDensityValue">2</output></label><input id="settlementDensity" type="range" min="1" max="5" value="2"></div><p class="muted">Arraste para distribuir construções sobre um calçamento 3D. O tamanho de cada casa ou vila usa “Tamanho do ícone”.</p>';for(const id of ['settlementRadius','settlementDensity'])settlementSettings.querySelector('#'+id).oninput=e=>$(id+'Value').value=e.target.value+(id==='settlementRadius'?' px':'');
  const buildingsSection=section('Construções',buildings),settlementSection=section('Pintar povoado',settlementSettings);
  function syncLocationPanels(){const activeTool=document.querySelector('#toolsPanel [data-tool].active')?.dataset.tool||document.querySelector('[data-tool].active')?.dataset.tool||tool;buildingsSection.hidden=activeTool!=='marker';settlementSection.hidden=activeTool!=='settlement';placeControls.hidden=!['marker','text'].includes(activeTool);tunnels.hidden=activeTool!=='tunnel';iconSizeControl.hidden=!['marker','text'].includes(activeTool);rotationControl.hidden=activeTool!=='marker';$('marker').hidden=activeTool!=='marker'||!!selectedBuilding;$('label').hidden=!['marker','text'].includes(activeTool);}
  window.syncLocationPanels=syncLocationPanels;
  const waterSection=section('Preencher com água',waterSettings),fogSection=section('FOG · visibilidade dos jogadores',(()=>{const panel=document.createElement('div');panel.innerHTML='<label><input id="fogReveal" type="checkbox"> Revelar área (remover FOG)</label><p class="muted">Pinte para esconder a área dos jogadores. Use o tamanho do pincel para ajustar a cobertura. No editor a máscara é translúcida. Ctrl+Z desfaz.</p>';return panel;})());
  const propertyPanel=section('Ajustes da ferramenta');propertyPanel.classList.add('ui-terrain-properties');
  const waterfallSettings=document.createElement('div');
  waterfallSettings.innerHTML='<div class="setting"><label for="waterfallWidth">Largura da queda <output id="waterfallWidthValue">24 px</output></label><input id="waterfallWidth" type="range" min="4" max="90" value="24"></div><label><input id="waterfallSnap" type="checkbox" checked> Encaixar em rios, lagos e mar próximos</label><p class="muted">Clique na origem e depois na saída abaixo dela. A queda segue o relevo, conecta a água próxima e cria espuma na chegada. Esc cancela a origem.</p>';
  waterfallSettings.querySelector('#waterfallWidth').oninput=e=>$('waterfallWidthValue').value=e.target.value+' px';
  const propertyTitle=propertyPanel.querySelector('h3'),propertyHint=document.createElement('p');propertyHint.className='ui-tool-hint';propertyPanel.append(propertyHint);
  const soft=$('soft').closest('label'),integrate=$('integrate').closest('label'),strength=setting('strength'),amount=setting('amount'),targetSetting=setting('target');
  const treeColors=forest.querySelector('.world-colors'),treeColorsPanel=section('Cores das árvores',treeColors);treeColorsPanel.classList.add('ui-tree-colors');
  const controls={palette,size,color,soft,integrate,strength,amount,target:targetSetting,decoration,water:waterSection,fog:fogSection,treeColors:treeColorsPanel,waterfall:waterfallSettings};
  propertyPanel.append(size,strength,soft,integrate,amount,targetSetting,color,treeColorsPanel,palette,decoration,waterSection,fogSection,waterfallSettings);
  smart.remove();sculpt.remove();forest.hidden=true;propertyPanel.append(forest);
  const propertyMap={brush:['palette','size','strength','soft','integrate'],decorate:['decoration'],raise:['size','amount','strength','soft'],lower:['size','amount','strength','soft'],mountain:['size','amount','strength','soft'],volcano:['size','amount','strength','soft'],smooth:['size','strength','soft'],blend:['size','strength','soft'],plateau:['size','target','strength','soft'],water:['water'],waterRemove:[],river:['size'],path:['size'],fog:['size','fog'],seaErase:['size'],color:['size','color'],erase:['size']};
  const propertyHints={brush:'Escolha um bioma e pinte o terreno.',decorate:'Escolha um objeto e arraste para espalhar.',raise:'Arraste para elevar o terreno.',lower:'Arraste para rebaixar o terreno.',mountain:'Arraste para formar montanhas.',volcano:'Arraste para formar vulcões.',smooth:'Arraste para suavizar o relevo.',blend:'Arraste para unir as bordas do terreno.',plateau:'Defina a altitude e pinte um platô.',water:'Clique numa depressão para preenchê-la.',waterRemove:'Clique em um lago para removê-lo.',river:'Desenhe o curso do rio no mapa.',path:'Desenhe um caminho no mapa.',fog:'Pinte para ocultar ou revelar uma área.',seaErase:'Arraste para abrir espaço no mar.',color:'Escolha uma cor e pinte livremente.',erase:'Arraste para apagar terreno e objetos.'};
  const syncPropertyPanels=()=>{
    const selected=document.querySelector('[data-tool].active')?.dataset.tool,keys=new Set(propertyMap[selected]||[]),name=toolList.find(item=>item[0]===selected)?.[2];
    propertyTitle.textContent=name?`Ajustes · ${name}`:'Escolha uma ferramenta';
    propertyHint.textContent=propertyHints[selected]||'Escolha uma ferramenta de terreno para ver seus ajustes.';
    if(selected==='brush'&&['forest','palms','pines','magic','autumn','jungle','snowForest'].includes(selectedBiome))keys.add('treeColors');
    for(const [key,node] of Object.entries(controls))node.hidden=!keys.has(key);
    const level=$('waterLevel'),levelLabel=waterSettings.querySelector('label[for="waterLevel"]');level.hidden=levelLabel.hidden=$('waterAuto').checked;
    size.querySelector('label').firstChild.textContent=selected==='river'?'Largura do rio ':selected==='path'?'Largura do caminho ':'Tamanho do pincel ';
    $('sizeValue').textContent=(selected==='river'?Math.max(2,+$('size').value/2):selected==='path'?Math.max(3,+$('size').value/5):+$('size').value)+' px';
    amount.querySelector('label').firstChild.textContent=selected==='lower'?'Rebaixamento por aplicação ':selected==='mountain'||selected==='volcano'?'Altura da formação ':'Elevação por aplicação ';
    $('amountValue').textContent=(selected==='mountain'||selected==='volcano'?Math.max(250,+$('amount').value*6):+$('amount').value)+' m';
    $('strengthValue').textContent=$('strength').value+'%';
  };
  propertyMap.waterfall=['waterfall'];propertyHints.waterfall='Marque a origem alta e a chegada da água em dois cliques.';
  waterSettings.querySelector('#waterAuto').addEventListener('change',syncPropertyPanels);
  for(const control of [size,amount,strength])control.querySelector('input').addEventListener('input',syncPropertyPanels);
  const leftItems=[
    ['terrain','Terreno','mountain',[section('Ferramentas de terreno',terrain),propertyPanel]],
    ['architecture','Arquitetura','wall',[section('Ambientes e formas',indoor),section('Construção',architectureSettings)]],
    ['places','Locais','marker',[section('Ferramentas de local',places),buildingsSection,settlementSection,placeControls,tunnels]],
    ['world','Mundo e submapas','world',[section('Entrada de submapa',worldTools),world,colors]]
  ];
  const pinnedNavigation=document.createElement('div');pinnedNavigation.className='ui-pinned-navigation';pinnedNavigation.setAttribute('role','group');pinnedNavigation.setAttribute('aria-label','Navegação do mapa');pinnedNavigation.append(explore);
  left.replaceChildren(leftHead,pinnedNavigation);
  const chooseLeft=tabs(left,leftItems,'terrain');
  const leftTab=id=>{chooseLeft(id);if(id==='terrain')syncPropertyPanels();};
  for(const [id] of leftItems)$('ui-tab-'+id).onclick=()=>leftTab(id);
  const layerList=$('layers'),layerActions=right.querySelector('.layer-actions'),opacity=setting('opacity'),selection=right.querySelector('.selection-panel');
  const cameraPanel=right.querySelector('.camera-panel'),viewPanel=right.querySelector('.terrain-view'),drive=right.querySelector('.drive-panel');
  drive.remove();drive.open=true;
  right.replaceChildren(rightHead);
  const chooseRight=tabs(right,[['layers','Camadas','layers',[layerList,layerActions,opacity]],['camera','Câmera','camera',[cameraPanel]],['view','Visualização','view',[viewPanel]],['drive','Google Drive','cloud',[drive]]],'layers');
  if(selection)right.querySelector('.ui-scroll').prepend(selection);
  const toolGroups={};for(const [id] of leftItems)for(const b of $('ui-'+id).querySelectorAll('[data-tool]'))toolGroups[b.dataset.tool]=id;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b){const group=toolGroups[b.dataset.tool];if(group)leftTab(group);if(b.dataset.tool==='select')chooseRight('layers');syncPropertyPanels();syncLocationPanels();if(group==='terrain'&&innerWidth<=860)requestAnimationFrame(()=>propertyPanel.scrollIntoView({block:'start',behavior:'smooth'}));}});syncPropertyPanels();syncLocationPanels();
  for(const button of document.querySelectorAll('[data-tool]'))iconButton(button,button.dataset.tool,button.textContent.trim().replace(/^[^\p{L}]+/u,''));
  for(const button of terrain.children){const caption=document.createElement('small');caption.textContent=button.getAttribute('aria-label');button.append(caption);}
  for(const button of palette.children){const name=button.textContent.trim();button.classList.add('icon-button','ui-swatch');button.setAttribute('aria-label',name);button.dataset.tooltip=name;}
  for(const button of buildings.querySelectorAll('.building-button')){const name=button.dataset.name;button.setAttribute('aria-label',name);button.dataset.tooltip=name;}
  const actions={new:['new','Novo mapa'],open:['open','Abrir projeto'],save:['save','Salvar projeto JSON'],driveConnect:['cloud','Conectar Google Drive'],driveSave:['upload','Salvar no Drive'],publishPlayers:['send','Enviar aos jogadores'],exportImage:['download','Exportar imagem'],finishSubmap:['back','Salvar submapa e voltar ao mundo'],undo:['undo','Desfazer · Ctrl+Z'],redo:['redo','Refazer · Ctrl+Y'],grid:['grid','Mostrar grade'],planetGuides:['world','Mostrar polos, eixo e equador'],planetSpin:['orbit','Ligar ou desligar rotação do planeta'],planetAxis:['gear','Configurar eixo da rotação'],mobileTools:['brush','Ferramentas'],mobileLayers:['layers','Camadas'],viewTop:['topView','Vista de cima'],view3d:['mountain','Relevo 3D'],turnLeft:['undo','Girar à esquerda'],turnRight:['redo','Girar à direita'],minus:['minus','Afastar'],plus:['plus','Aproximar'],fit:['fit','Enquadrar mapa'],add:['plus','Adicionar camada'],up:['up','Subir camada'],down:['down','Descer camada'],rename:['edit','Renomear camada'],delete:['trash','Excluir camada'],resetCamera:['player','Orientar ao norte'],viewExport:['camera','Exportar perspectiva'],export:['download','Exportar planta'],heightExport:['layers','Exportar mapa de altura'],migrateProject:['open','Encaixar mapa antigo'],placeSubmapEntry:['marker','Fixar entrada no planeta'],createSubmap:['new','Criar submapa plano'],editSubmap:['edit','Editar submapa selecionado'],removePatch:['trash','Remover mapa encaixado'],paintForest:['forest','Pintar vegetação'],selectionMove:['pan','Aplicar posição'],selectionTransfer:['layers','Mover para outra camada'],selectionClear:['close','Limpar seleção'],driveBrowse:['open','Abrir mapas do Drive'],driveCopy:['copy','Salvar cópia'],driveSetCurrentDefault:['star','Usar mapa atual como padrão'],driveClearDefault:['close','Remover mapa padrão']};
  document.querySelector('.view-switch').prepend($('grid'));
  for(const [id,[icon,label]] of Object.entries(actions))iconButton($(id),icon,label);
  for(const [name,icon] of [['opposite','opposite'],['focus','player'],['walk','walk']]){const b=document.querySelector('[data-nav="'+name+'"]');iconButton(b,icon,b.getAttribute('aria-label'));}
  const updateLayers=()=>{for(const button of layerList.querySelectorAll('button'))iconButton(button,button.title.toLowerCase().includes('bloque')?(button.title.startsWith('Des')?'unlock':'lock'):(button.title.startsWith('Mostrar')?'viewOff':'view'),button.title);};
  updateLayers();new MutationObserver(updateLayers).observe(layerList,{childList:true});
  // Drive updates its button label after connecting. Restore the icon without altering its behavior.
  new MutationObserver(()=>{const b=$('driveConnect');if(!b.querySelector('.ui-icon'))iconButton(b,'cloud',b.textContent.trim());}).observe($('driveConnect'),{childList:true});
  const tooltip=document.createElement('div');tooltip.id='uiTooltip';tooltip.className='ui-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  let timer,target;
  function hide(){clearTimeout(timer);tooltip.hidden=true;if(target)target.removeAttribute('aria-describedby');target=null;}
  function show(button){hide();if(!button)return;target=button;timer=setTimeout(()=>{if(!button.isConnected)return;tooltip.textContent=button.dataset.tooltip||button.getAttribute('aria-label')||button.title;tooltip.hidden=false;button.setAttribute('aria-describedby',tooltip.id);const r=button.getBoundingClientRect(),t=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+r.width/2-t.width/2))+'px';tooltip.style.top=(r.bottom+t.height+12<innerHeight?r.bottom+8:Math.max(8,r.top-t.height-8))+'px';},250);}
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const b=e.target.closest('.icon-button');if(b&&b!==target)show(b);});
  document.addEventListener('pointerout',e=>{if(target&&!target.contains(e.relatedTarget))hide();});
  document.addEventListener('focusin',e=>show(e.target.closest('.icon-button')));
  document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
  const brushQuick=document.createElement('div');brushQuick.className='mobile-brush';brushQuick.setAttribute('role','group');brushQuick.setAttribute('aria-label','Tamanho rápido do pincel');
  brushQuick.innerHTML='<button type="button" data-step="-1" aria-label="Diminuir pincel">−</button><output aria-live="off"></output><button type="button" data-step="1" aria-label="Aumentar pincel">+</button>';
  $('viewport').append(brushQuick);
  const brushTools=new Set(['brush','fog','seaErase','raise','lower','mountain','volcano','smooth','blend','plateau','color','river','path','erase']);
  const syncBrushQuick=()=>{const current=document.querySelector('[data-tool].active')?.dataset.tool;brushQuick.hidden=!brushTools.has(current);brushQuick.querySelector('output').textContent=$('size').value+' px';};
  for(const button of brushQuick.querySelectorAll('button'))button.onclick=()=>{const input=$('size'),step=button.dataset.step==='1'?8:-8;input.value=Math.max(+input.min,Math.min(+input.max,+input.value+step));input.dispatchEvent(new Event('input',{bubbles:true}));syncBrushQuick();};
  $('size').addEventListener('input',syncBrushQuick);
  document.addEventListener('click',e=>{if(e.target.closest('[data-tool]'))syncBrushQuick();});
  syncBrushQuick();
  document.body.classList.add('compact-ui');document.documentElement.classList.remove('ui-loading');
  window.dispatchEvent(new Event('resize'));
})();
