import { upload } from '@vercel/blob/client';
import { MapViewer } from './viewer.js';
import { validateProject, MAX_PROJECT_BYTES } from './schema.js';

const $ = id => document.getElementById(id);
let viewer, loadedVersion = '', refreshing = false;
function ensureViewer() {
  if (!viewer) viewer = new MapViewer($('mapCanvas'), $('stage'), (camera, webgl) => {
    $('zoomRead').textContent = `${Math.round(camera.zoom*100)}%`;
    $('tilt').value = camera.tilt; $('tiltRead').textContent = `${Math.round(camera.tilt)}°`;
    $('viewTop').classList.toggle('active',camera.tilt===0);$('view3d').classList.toggle('active',camera.tilt>0);
    document.querySelector('.compass').style.transform = `rotate(${camera.yaw}deg)`;
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
function showAdmin(admin){$('loginPanel').hidden=admin;$('publishPanel').hidden=!admin;}
$('retry').onclick=()=>loadMap(true);
$('help').onclick=()=>$('guide').showModal();
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('adminOpen').onclick=async()=>{showAdmin(false);$('adminDialog').showModal();try{showAdmin((await request('/api/session')).admin);}catch{showAdmin(false);}};
$('loginForm').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter||event.currentTarget.querySelector('button');button.disabled=true;$('loginStatus').textContent='';
  try{await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';showAdmin(true);}
  catch(error){$('loginStatus').textContent=error.message;}finally{button.disabled=false;}
};
$('logout').onclick=async()=>{try{await request('/api/logout',{method:'POST'});showAdmin(false);}catch(error){$('adminStatus').textContent=error.message;}};
$('publishForm').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=$('publish');button.disabled=true;$('removeMap').disabled=true;
  try{
    const file=form.elements.project.files[0];
    if(!file||file.size>MAX_PROJECT_BYTES)throw new Error('Escolha um projeto JSON de até 80 MB.');
    $('adminStatus').textContent='Conferindo o projeto…';
    const project=validateProject(JSON.parse(await file.text()));
    const pathname=`atlas-do-reino/projects/${crypto.randomUUID()}.json`;
    await upload(pathname,new Blob([JSON.stringify(project)],{type:'application/json'}),{
      access:'private',handleUploadUrl:'/api/upload',contentType:'application/json',multipart:file.size>4*1024*1024,
      onUploadProgress:({percentage})=>{$('adminStatus').textContent=`Enviando mapa: ${Math.round(percentage)}%`;}
    });
    $('adminStatus').textContent='Publicando o mundo…';
    await request('/api/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectPath:pathname,title:form.elements.title.value,note:form.elements.note.value})});
    $('adminStatus').textContent='Mapa 3D publicado para os jogadores.';form.reset();await loadMap(true);
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
for(const [id,mode] of [['modePan','pan'],['modeOrbit','orbit']])$(id).onclick=()=>{
  if(viewer)viewer.mode=mode;$('modePan').classList.toggle('active',mode==='pan');$('modeOrbit').classList.toggle('active',mode==='orbit');
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen();}catch{}};
loadMap();setInterval(()=>{if(!document.hidden&&!$('adminDialog').open)loadMap();},60000);
