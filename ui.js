'use strict';
// Presentation only: move existing controls without replacing their listeners.
(()=>{
  const $=id=>document.getElementById(id);
  const paths={
    lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',unlock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8-1M12 14v3',viewOff:'M3 3l18 18M10 5c6-1 12 7 12 7l-4 4M6 6c-3 2-4 6-4 6s4 7 10 7l4-1',
    pan:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
    select:'m5 3 14 10-7 1-3 7Z',orbit:'M20 8a9 9 0 1 0 1 7M20 3v5h-5',player:'M12 3v3M12 18v3M3 12h3M18 12h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    brush:'m14 4 6 6M9 15l10-12 3 3-12 11M9 15c-5-2-2 6-7 6 8 2 10-2 7-6',raise:'M4 18h16M12 15V4M7 9l5-5 5 5',lower:'M4 18h16M12 4v11M7 10l5 5 5-5',
    mountain:'m2 20 8-15 6 11 3-5 4 9ZM7 11l3 2 3-2',volcano:'m3 20 6-12h6l6 12ZM10 4l1-2M14 4l1-2M10 12h4',smooth:'M3 7c4-6 6 6 10 0s6 0 8 0M3 12c4-6 6 6 10 0s6 0 8 0M3 17c4-6 6 6 10 0s6 0 8 0',
    plateau:'m2 19 5-12h10l5 12M7 7h10',color:'M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12ZM9 16c0 2 1 3 3 3',river:'M7 2c12 5-8 7 4 12s-4 7-2 8M13 2c12 5-8 7 4 12s-4 7-2 8',path:'M5 3c16 3-14 9 6 12s-6 7-6 7',
    marker:'M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0ZM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0',text:'M4 5h16M12 5v16M8 21h8',erase:'m3 14 10-11 8 8-10 11H8ZM8 9l8 8M11 22h11',
    submap:'M4 20V4h9M9 15 21 3M15 3h6v6',tunnel:'M4 21V12a8 8 0 0 1 16 0v9M8 21v-9a4 4 0 0 1 8 0v9M2 21h8M14 21h8',
    wall:'M3 6h18v12H3ZM3 12h18M9 6v6M15 6v6M6 12v6M12 12v6M18 12v6',room:'M3 3h18v18h-6M9 21H3V3M9 21v-6h6',corridor:'M3 7h18M3 17h18M7 7v10M17 7v10',floor:'M3 3h18v18H3ZM9 3v18M15 3v18M3 9h18M3 15h18',
    rect:'M3 5h18v14H3Z',rectFill:'M3 5h18v14H3ZM6 8h12v8H6Z',ellipse:'M21 12a9 7 0 1 1-18 0 9 7 0 0 1 18 0',ellipseFill:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',line:'M4 20 20 4M3 3v4M3 3h4M21 21v-4M21 21h-4',
    door:'M5 21V3h14v18M5 21h14M15 12h1',window:'M4 4h16v16H4ZM12 4v16M4 12h16',stairs:'M3 21h5v-6h5V9h5V3h3M3 21V3',pillar:'M5 5h14M7 5v14M17 5v14M5 19h14M5 22h14M5 2h14',pit:'M21 6c0 2-4 4-9 4S3 8 3 6s4-4 9-4 9 2 9 4ZM3 6l4 12c2 3 8 3 10 0l4-12',
    layers:'m12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5',camera:'M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',view:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    cloud:'M7 19a5 5 0 1 1 0-10 6 6 0 0 1 12-1 5 5 0 0 1 0 11Z',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-6 5-6 13 0 18 6-5 6-13 0-18',
    new:'M14 3H4v18h16V9M14 3v6h6M8 15h8M12 11v8',open:'M3 7V4h7l3 3h8v4M3 7v14h16l3-10H7Z',save:'M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8',upload:'M12 17V3M7 8l5-5 5 5M3 16v5h18v-5',download:'M12 3v14M7 12l5 5 5-5M3 16v5h18v-5',send:'m2 3 20 9-20 9 4-9Zm4 9h16',
    topView:'M12 3 22 12 12 21 2 12ZM7 12h10M12 8v8',gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',undo:'M9 4 3 10l6 6M3 10h10a7 7 0 0 1 0 14',redo:'m15 4 6 6-6 6M21 10H11a7 7 0 0 0 0 14',back:'M10 5 3 12l7 7M3 12h18',plus:'M12 4v16M4 12h16',minus:'M4 12h16',close:'M5 5l14 14M19 5 5 19',up:'m5 15 7-7 7 7',down:'m5 9 7 7 7-7',edit:'m3 17 12-12 4 4L7 21H3ZM15 5l3-3 4 4-3 3',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',copy:'M8 8h13v13H8ZM16 8V3H3v13h5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',forest:'m12 2 7 10h-4l5 6H4l5-6H5ZM12 18v4',fit:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',walk:'M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0M8 21l4-7 4 7M12 14V8M6 12l6-4 6 4'
  };
  const svg=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.view}"/></svg>`;
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
  const mainTools=$('tools'),toolButtons=[...mainTools.children];mainTools.replaceChildren();
  const tools=ids=>{const grid=document.createElement('div');grid.className='tools ui-tool-grid';for(const id of ids){const button=toolButtons.find(b=>b.dataset.tool===id);if(button)grid.append(button);}return grid;};
  const explore=tools(['pan','select','orbit','player']);explore.id='tools';
  const terrain=tools(['brush','raise','lower','mountain','volcano','smooth','plateau','color','river','path','erase']);
  const places=tools(['marker','text','tunnel']);
  const worldTools=tools(['submap']);
  const smart=detail('soft'),sculpt=detail('amount'),forest=detail('forestType'),world=detail('planetMode'),colors=detail('grassColor'),tunnels=detail('tunnelDepth');
  [smart,sculpt,forest,tunnels,colors].forEach(el=>{if(el)el.open=false;});world.open=true;
  const indoor=$('indoorTools'),palette=$('palette'),buildings=$('buildings');
  const size=setting('size'),color=setting('color');
  const common=section('Pincel',size,color);common.classList.add('ui-common-controls');
  const architectureSettings=document.createElement('div');architectureSettings.className='ui-architecture-settings';
  architectureSettings.innerHTML='<div class="setting"><label for="architectureMaterial">Material</label><select id="architectureMaterial"><option value="limestone">Calcário</option><option value="slate">Ardósia</option><option value="sandstone">Arenito</option><option value="brick">Tijolo</option><option value="wood">Madeira</option></select></div><div class="setting"><label for="architectureColor">Cor do material</label><input id="architectureColor" type="color" value="#b6ad98"></div><div class="setting"><label for="architectureHeight">Altura <output id="architectureHeightValue">26</output></label><input id="architectureHeight" type="range" min="6" max="64" value="26"></div><div class="setting"><label for="architectureWidth">Espessura <output id="architectureWidthValue">10</output></label><input id="architectureWidth" type="range" min="3" max="32" value="10"></div>';
  architectureSettings.insertAdjacentHTML('beforeend','<label><input id="architectureAutoGroup" type="checkbox" checked> Agrupar muros ao encostar</label><p class="muted">Muros conectados da mesma camada e região se movem juntos com o seletor.</p>');
  architectureSettings.querySelector('#architectureAutoGroup').onchange=()=>{Selector.clear();changed();};
  architectureSettings.querySelector('select').addEventListener('change',e=>{$('architectureColor').value=({limestone:'#b6ad98',slate:'#697784',sandstone:'#c3a476',brick:'#ac7561',wood:'#94704e'})[e.target.value];});
  for(const id of ['architectureHeight','architectureWidth'])architectureSettings.querySelector('#'+id).addEventListener('input',e=>$(id+'Value').value=e.target.value);
  const placeControls=section('Marcador',setting('iconSize'),setting('rotation'),$('marker'),$('label'));
  const leftItems=[
    ['terrain','Terreno','mountain',[section('Esculpir e pintar',terrain),section('Biomas',palette),smart,sculpt,forest]],
    ['architecture','Arquitetura','wall',[section('Ambientes e formas',indoor),section('Construção',architectureSettings)]],
    ['places','Locais','marker',[section('Locais e passagens',places),section('Construções',buildings),placeControls,tunnels]],
    ['world','Mundo e submapas','world',[section('Entrada de submapa',worldTools),world,colors]]
  ];
  const pinnedNavigation=document.createElement('div');pinnedNavigation.className='ui-pinned-navigation';pinnedNavigation.setAttribute('role','group');pinnedNavigation.setAttribute('aria-label','Navegação do mapa');pinnedNavigation.append(explore);
  left.replaceChildren(leftHead,pinnedNavigation);
  const chooseLeft=tabs(left,leftItems,'terrain');
  left.querySelector('.ui-scroll').append(common);common.hidden=false;
  const leftTab=id=>{chooseLeft(id);common.hidden=id!=='terrain';};
  for(const [id] of leftItems)$('ui-tab-'+id).onclick=()=>leftTab(id);
  const layerList=$('layers'),layerActions=right.querySelector('.layer-actions'),opacity=setting('opacity'),selection=right.querySelector('.selection-panel');
  const cameraPanel=right.querySelector('.camera-panel'),viewPanel=right.querySelector('.terrain-view'),drive=right.querySelector('.drive-panel');
  drive.remove();drive.open=true;
  right.replaceChildren(rightHead);
  const chooseRight=tabs(right,[['layers','Camadas','layers',[layerList,layerActions,opacity]],['camera','Câmera','camera',[cameraPanel]],['view','Visualização','view',[viewPanel]],['drive','Google Drive','cloud',[drive]]],'layers');
  if(selection)right.querySelector('.ui-scroll').prepend(selection);
  const toolGroups={};for(const [id] of leftItems)for(const b of $('ui-'+id).querySelectorAll('[data-tool]'))toolGroups[b.dataset.tool]=id;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b){if(toolGroups[b.dataset.tool])leftTab(toolGroups[b.dataset.tool]);if(b.dataset.tool==='select')chooseRight('layers');}});
  for(const button of document.querySelectorAll('[data-tool]'))iconButton(button,button.dataset.tool,button.textContent.trim().replace(/^[^\p{L}]+/u,''));
  for(const button of palette.children){const name=button.textContent.trim();button.classList.add('icon-button','ui-swatch');button.setAttribute('aria-label',name);button.dataset.tooltip=name;}
  for(const button of buildings.children){const name=button.textContent.trim();button.classList.add('icon-button','ui-building');button.setAttribute('aria-label',name);button.dataset.tooltip='Inserir '+name;}
  const actions={new:['new','Novo mapa'],open:['open','Abrir projeto'],save:['save','Salvar projeto JSON'],driveConnect:['cloud','Conectar Google Drive'],driveSave:['upload','Salvar no Drive'],publishPlayers:['send','Enviar aos jogadores'],exportImage:['download','Exportar imagem'],finishSubmap:['back','Salvar submapa e voltar ao mundo'],undo:['undo','Desfazer · Ctrl+Z'],redo:['redo','Refazer · Ctrl+Y'],grid:['grid','Mostrar grade'],planetGuides:['world','Mostrar polos, eixo e equador'],planetSpin:['orbit','Ligar ou desligar rotação do planeta'],planetAxis:['gear','Configurar eixo da rotação'],mobileTools:['brush','Ferramentas'],mobileLayers:['layers','Camadas'],viewTop:['topView','Vista de cima'],view3d:['mountain','Relevo 3D'],turnLeft:['undo','Girar à esquerda'],turnRight:['redo','Girar à direita'],minus:['minus','Afastar'],plus:['plus','Aproximar'],fit:['fit','Enquadrar mapa'],add:['plus','Adicionar camada'],up:['up','Subir camada'],down:['down','Descer camada'],rename:['edit','Renomear camada'],delete:['trash','Excluir camada'],resetCamera:['player','Orientar ao norte'],viewExport:['camera','Exportar perspectiva'],export:['download','Exportar planta'],heightExport:['layers','Exportar mapa de altura'],migrateProject:['open','Encaixar mapa antigo'],placeSubmapEntry:['marker','Fixar entrada no planeta'],createSubmap:['new','Criar submapa plano'],editSubmap:['edit','Editar submapa selecionado'],removePatch:['trash','Remover mapa encaixado'],paintForest:['forest','Pintar vegetação'],selectionMove:['pan','Aplicar posição'],selectionTransfer:['layers','Mover para outra camada'],selectionClear:['close','Limpar seleção'],driveBrowse:['open','Abrir mapas do Drive'],driveCopy:['copy','Salvar cópia'],driveSetCurrentDefault:['star','Usar mapa atual como padrão'],driveClearDefault:['close','Remover mapa padrão']};
  document.querySelector('.view-switch').prepend($('grid'));
  for(const [id,[icon,label]] of Object.entries(actions))iconButton($(id),icon,label);
  for(const [name,icon] of [['opposite','orbit'],['focus','player'],['walk','walk']]){const b=document.querySelector('[data-nav="'+name+'"]');iconButton(b,icon,b.getAttribute('aria-label'));}
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
  document.body.classList.add('compact-ui');document.documentElement.classList.remove('ui-loading');
  window.dispatchEvent(new Event('resize'));
})();
