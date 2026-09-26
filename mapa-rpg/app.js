import { upload } from '@vercel/blob/client';
import { MapViewer } from './viewer.js';
import { validateProject, MAX_PROJECT_BYTES } from './schema.js';

const $ = id => document.getElementById(id);
const EDITOR_ORIGIN = 'https://aetheratlas.vercel.app';
let viewer, loadedVersion = '', refreshing = false;
function ensureViewer() {
  if (!viewer) viewer = new MapViewer($('mapCanvas'), $('stage'), (camera, webgl) => {
    $('zoomRead').textContent = `${Math.round(camera.zoom*100)}%`;
    $('tilt').value = camera.tilt; $('tiltRead').textContent = `${Math.round(camera.tilt)}°`;
    $('roll').value = camera.roll; $('rollRead').textContent = `${Math.round(camera.roll)}°`;
    $('viewTop').classList.toggle('active',camera.tilt===0);$('view3d').classList.toggle('active',camera.tilt>0);
    document.querySelector('.compass').style.transform = `rotate(${viewer.camera().planet?camera.roll:camera.yaw+camera.roll}deg)`;
    $('viewStatus').textContent = webgl ? 'SOMENTE VISUALIZAÇÃO · RELEVO 3D' : 'VISUALIZAÇÃO PLANA · 3D INDISPONÍVEL NESTE NAVEGADOR';
  });
  return viewer;
}
async function request(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
function empty(title,note,retry=false) {
  $('viewer').hidden=true;$('empty').hidden=false;$('emptyTitle').textContent=title;$('emptyNote').textContent=note;$('retry').hidden=!retry;
}
async function loadMap(force=false) {
  if(refreshing)return;refreshing=true;
  try {
    const { map }=await request('/api/map');
    if(!map){loadedVersion='';empty('O mundo aguarda seus viajantes.','O mestre da campanha ainda não publicou um mapa.');return;}
    if(!force&&map.updatedAt===loadedVersion)return;
    empty('Carregando o mundo…','Preparando relevo, construções e caminhos.');
    const project=await request(`${map.projectUrl}?v=${encodeURIComponent(map.updatedAt)}`);
    $('viewer').hidden=false;$('empty').hidden=true;
    await ensureViewer().load(project);
    loadedVersion=map.updatedAt;$('mapTitle').textContent=map.title;$('mapNote').textContent=map.note;
    $('updated').textContent=`ATUALIZADO EM ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(map.updatedAt))}`;
  } catch(error){empty('Não foi possível abrir o mapa.',error.message,true);}
  finally{refreshing=false;}
}
function showAdmin(admin){$('loginPanel').hidden=admin;$('publishPanel').hidden=!admin;if(admin)queueMicrotask(applyEditorPublish);}
$('retry').onclick=()=>loadMap(true);
$('help').onclick=()=>$('guide').showModal();
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('adminOpen').onclick=async()=>{showAdmin(false);$('adminDialog').showModal();try{showAdmin((await request('/api/session')).admin);}catch{showAdmin(false);}};
$('loginForm').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter||event.currentTarget.querySelector('button');button.disabled=true;$('loginStatus').textContent='';
  try{await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';showAdmin(true);window.opener?.postMessage({type:'aether-atlas-admin-ready'},EDITOR_ORIGIN);}
  catch(error){$('loginStatus').textContent=error.message;}finally{button.disabled=false;}
};
let pendingEditorPublish=null;
window.addEventListener('message',event=>{
  if(event.origin!==EDITOR_ORIGIN||event.data?.type!=='aether-atlas-publish')return;
  pendingEditorPublish=event.data;
  if(!$('publishPanel').hidden){applyEditorPublish();return;}
  if(!$('adminDialog').open)$('adminDialog').showModal();
  showAdmin(false);$('loginStatus').textContent='Entre como mestre para receber o mapa do editor.';
});
function applyEditorPublish(){
  if(!pendingEditorPublish)return;
  const {bundle,fileName,title}=pendingEditorPublish;
  const file=new File([JSON.stringify(bundle)],fileName||'mapa-aether-atlas.json',{type:'application/json'});
  const transfer=new DataTransfer();transfer.items.add(file);
  $('publishForm').elements.project.files=transfer.files;
  $('publishForm').elements.title.value=title||'';
  $('adminStatus').textContent='Mapa recebido do editor. Confira o título e clique em Publicar para jogadores.';
  pendingEditorPublish=null;
}
$('logout').onclick=async()=>{try{await request('/api/logout',{method:'POST'});showAdmin(false);}catch(error){$('adminStatus').textContent=error.message;}};
$('publishForm').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=$('publish');button.disabled=true;$('removeMap').disabled=true;
  try{
    const file=form.elements.project.files[0];
    if(!file||file.size>MAX_PROJECT_BYTES)throw new Error('Escolha um projeto JSON de até 80 MB.');
    $('adminStatus').textContent='Conferindo o projeto…';
    const input=JSON.parse(await file.text());let project;
    if(input?.format==='aether-atlas-patch'&&input.version===1){
      const {map}=await request('/api/map');
      if(!map)throw new Error('Publique primeiro um mapa completo para criar a base do pacote incremental.');
      const base=await request(`${map.projectUrl}?v=${encodeURIComponent(map.updatedAt)}`);
      const ids=base.layers.map((layer,index)=>layer.id||`legacy-${index}-${layer.name}`);
      if(JSON.stringify(ids)!==JSON.stringify(input.baseLayerIds))throw new Error('A base publicada mudou desde a criação deste pacote. Gere um novo envio incremental.');
      if(!Array.isArray(input.layerOrder)||!Array.isArray(input.project?.layers))throw new Error('Pacote incremental inválido.');
      const changes=new Map(input.project.layers.map(layer=>[layer.id,layer]));
      if(changes.size!==input.project.layers.length||[...changes.keys()].some(id=>!input.layerOrder.includes(id)))throw new Error('Camadas alteradas inválidas.');
      const baseById=new Map(base.layers.map((layer,index)=>[layer.id||`legacy-${index}-${layer.name}`,layer]));
      if(input.layerOrder.length!==base.layers.length||input.layerOrder.some(id=>!baseById.has(id)))throw new Error('A estrutura de camadas mudou; gere um envio completo.');
      const layers=input.layerOrder.map(id=>{const layer=changes.get(id)||baseById.get(id);if(layer&&!layer.id)layer.id=id;return layer;});
      project=validateProject({...base,...input.project,layers});
    }else project=validateProject(input);
    const pathname=`atlas-do-reino/projects/${crypto.randomUUID()}.json`;
    await upload(pathname,new Blob([JSON.stringify(project)],{type:'application/json'}),{
      access:'private',handleUploadUrl:'/api/upload',contentType:'application/json',multipart:file.size>4*1024*1024,
      onUploadProgress:({percentage})=>{$('adminStatus').textContent=`Enviando mapa: ${Math.round(percentage)}%`;}
    });
    $('adminStatus').textContent='Publicando o mundo…';
    await request('/api/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectPath:pathname,title:form.elements.title.value,note:form.elements.note.value})});
    $('adminStatus').textContent='Mapa 3D publicado para os jogadores.';form.reset();await loadMap(true);
    if(window.opener&&!window.opener.closed)window.opener.postMessage({type:'aether-atlas-published',project},EDITOR_ORIGIN);
  }catch(error){$('adminStatus').textContent=error.message;}
  finally{button.disabled=false;$('removeMap').disabled=false;}
};
$('removeMap').onclick=async()=>{
  if(!confirm('Retirar o mapa da visualização dos jogadores? O arquivo permanece guardado no armazenamento.'))return;
  try{await request('/api/map',{method:'DELETE'});$('adminDialog').close();await loadMap(true);}catch(error){$('adminStatus').textContent=error.message;}
};
$('zoomIn').onclick=()=>viewer?.zoom(1.2);$('zoomOut').onclick=()=>viewer?.zoom(.82);$('reset').onclick=()=>viewer?.fit(true);
$('rotateLeft').onclick=()=>viewer?.rotate(-15);$('rotateRight').onclick=()=>viewer?.rotate(15);
$('tilt').oninput=()=>viewer?.tilt(+$('tilt').value);$('viewTop').onclick=()=>viewer?.tilt(0);$('view3d').onclick=()=>viewer?.tilt(38);
$('roll').oninput=()=>viewer?.rotateRoll(+$('roll').value);
for(const [id,mode] of [['modePan','pan'],['modeOrbit','orbit']])$(id).onclick=()=>{
  if(viewer)viewer.mode=mode;$('modePan').classList.toggle('active',mode==='pan');$('modeOrbit').classList.toggle('active',mode==='orbit');
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen();}catch{}};
loadMap();setInterval(()=>{if(!document.hidden&&!$('adminDialog').open)loadMap();},60000);
