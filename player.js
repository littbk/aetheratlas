import {MapViewer} from './mapa-rpg/viewer.js';
const $=id=>document.getElementById(id),share=new URLSearchParams(location.search).get('share');let viewer,version='',busy=false;
const api=async url=>{const r=await fetch(url,{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível abrir.');return data;};
const admin=$('adminDialog');admin.remove();$('adminOpen').textContent='Criar meus mapas';$('adminOpen').onclick=()=>location.href='/';
$('help').onclick=()=>$('guide').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function empty(title,note){$('viewer').hidden=true;$('empty').hidden=false;$('emptyTitle').textContent=title;$('emptyNote').textContent=note;}
async function load(){if(busy)return;busy=true;try{
 if(!share){empty('Explore o mundo da sua campanha.','Peça ao mestre o link do mapa ou crie seus próprios mapas no editor.');return;}
 const {map}=await api('/api/map?share='+encodeURIComponent(share));if(version===map.updatedAt)return;empty('Carregando o mundo…','Preparando relevo e construções.');
 const project=await api(map.projectUrl);$('viewer').hidden=false;$('empty').hidden=true;
 if(!viewer)viewer=new MapViewer($('mapCanvas'),$('stage'),(c,gl)=>{$('zoomRead').textContent=Math.round(c.zoom*100)+'%';$('viewStatus').textContent=gl?'MAPA DA CAMPANHA · SOMENTE VISUALIZAÇÃO':'VISUALIZAÇÃO PLANA';$('tilt').value=c.tilt;$('roll').value=c.roll;$('tiltRead').textContent=Math.round(c.tilt)+'°';$('rollRead').textContent=Math.round(c.roll)+'°';});
 viewer.onReturnToMain=async()=>{viewer.sessionSubmapId=null;localStorage.removeItem(viewerSessionKey);await viewer.load(project);saveViewerSession();};await viewer.load(project);await restoreViewerSession();version=map.updatedAt;$('mapTitle').textContent=map.title;$('mapNote').textContent=map.note;$('updated').textContent='Atualizado em '+new Date(map.updatedAt).toLocaleDateString('pt-BR');
 }catch(e){empty('Mapa indisponível.',e.message);$('retry').hidden=false;}finally{busy=false;}}
$('retry').onclick=()=>{version='';load();};
for(const [id,fn] of Object.entries({zoomIn:()=>viewer?.zoom(1.2),zoomOut:()=>viewer?.zoom(.82),reset:()=>viewer?.fit(true),rotateLeft:()=>viewer?.rotate(-15),rotateRight:()=>viewer?.rotate(15),viewTop:()=>viewer?.tilt(0),view3d:()=>viewer?.tilt(38)}))$(id).onclick=fn;
$('tilt').oninput=()=>viewer?.tilt(+$('tilt').value);$('roll').oninput=()=>viewer?.rotateRoll(+$('roll').value);
for(const [id,mode] of [['modePan','pan'],['modeOrbit','orbit']])$(id).onclick=()=>{if(viewer)viewer.mode=mode;$('modePan').classList.toggle('active',mode==='pan');$('modeOrbit').classList.toggle('active',mode==='orbit');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen();}catch{}};
load();setInterval(()=>{if(!document.hidden)load();},60000);

const viewerSessionKey='aether-atlas-viewer:'+location.pathname+location.search;
async function restoreViewerSession(){try{const state=JSON.parse(localStorage.getItem(viewerSessionKey)||'null');if(!state)return;if(state.submapId){const patch=viewer.patches.find(p=>p.id===state.submapId);if(patch)await viewer.openSubmap(patch);}if(state.flatRegion)viewer.enterFlatRegion(state.flatRegion);if(state.flatCamera)viewer.flatCamera=state.flatCamera;if(state.camera&&['yaw','tilt','roll','relief','zoom','cx','cy'].every(k=>Number.isFinite(state.camera[k]))){Object.assign(viewer.c,state.camera,{cx:state.camera.cx*viewer.stage.clientWidth,cy:state.camera.cy*viewer.stage.clientHeight});viewer.draw();}}catch{}}
function saveViewerSession(){if(!viewer||busy)return;try{localStorage.setItem(viewerSessionKey,JSON.stringify({camera:{...viewer.c,cx:viewer.c.cx/viewer.stage.clientWidth,cy:viewer.c.cy/viewer.stage.clientHeight},flatRegion:viewer.flatRegion,flatCamera:viewer.flatCamera,submapId:viewer.sessionSubmapId||null}));}catch{}}
setInterval(saveViewerSession,500);window.addEventListener('pagehide',saveViewerSession);
