import {upload} from '@vercel/blob/client';
const $=id=>document.getElementById(id);
let user=null,mapId='',busy=false,config={};
const api=async(url,options)=>{const r=await fetch(url,{cache:'no-store',...options}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir.');return data;};
const bar=document.createElement('div');bar.className='account-bar';bar.innerHTML='<button id="googleLogin">Entrar com Google</button><button id="cloudMaps" hidden>Meus mapas</button><button id="cloudSave" hidden>Salvar na conta</button><button id="googleLogout" hidden>Sair</button><span id="accountName"></span>';
document.querySelector('header').after(bar);
const dialog=document.createElement('dialog');dialog.className='cloud-dialog';dialog.innerHTML='<div class="cloud-heading"><h2>Meus mapas</h2><button data-close aria-label="Fechar">×</button></div><p>Seus projetos são privados. Publique um mapa para criar um link para os jogadores.</p><p class="cloud-status" role="status"></p><div class="cloud-list"></div>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();
const status=text=>{dialog.querySelector('.cloud-status').textContent=text;};
function renderSession(){ $('googleLogin').hidden=!!user;for(const id of ['cloudMaps','cloudSave','googleLogout'])$(id).hidden=!user;$('accountName').textContent=user?user.name:'Projetos locais · entre para salvar e publicar';}
$('googleLogin').onclick=()=>{if(!config.configured){notify('O login Google ainda precisa ser configurado pelo responsável do site.');return;}const popup=window.open('/api/auth/login?popup=1','atlas-google-login','width=520,height=680');if(!popup){notify('Permita a janela de login do Google e tente novamente.');return;}const connected=async e=>{if(e.origin!==location.origin||e.source!==popup||e.data?.type!=='atlas-login-ready')return;window.removeEventListener('message',connected);config=await api('/api/account');user=config.user;mapId='';renderSession();notify('Conta Google conectada. Seu projeto continua aberto.');};window.addEventListener('message',connected);};
$('googleLogout').onclick=async()=>{try{await api('/api/account/logout',{method:'POST'});user=null;mapId='';renderSession();notify('Você saiu da conta.');}catch(e){notify(e.message);}};
async function saveCloud(publish=false){
 if(busy)return;if(!user){notify('Entre com o Google para salvar e publicar seus mapas.');return;}
 if(!config.storageConfigured){notify('O armazenamento do site ainda precisa ser configurado.');return;}
 end();busy=true;$('cloudSave').disabled=true;$('publishPlayers').disabled=true;
 try{const generation=driveGeneration,revision=driveRevision,owner=user.id,title=$('title').value,project=projectData(),blob=new Blob([JSON.stringify(project)],{type:'application/json'});if(blob.size>80*1024*1024)throw Error('O mapa deve ter até 80 MB.');
 const id=mapId||crypto.randomUUID(),path=`atlas/users/${user.id}/projects/${id}/${crypto.randomUUID()}.json`;notify('Salvando na sua conta…');
 await upload(path,blob,{access:'private',handleUploadUrl:'/api/cloud-upload',clientPayload:id,contentType:'application/json',multipart:blob.size>4*1024*1024});
 const {map}=await api('/api/world?id='+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectPath:path,title,publish})});if(generation!==driveGeneration||user?.id!==owner){notify('O mapa anterior foi salvo na conta. O projeto atual foi preservado.');return;}mapId=id;dirty=driveRevision!==revision;$('saved').textContent=dirty?'Novas alterações não salvas':publish?'Publicado para jogadores':'Salvo na sua conta';notify(publish?'Publicado! Copie o link em Meus mapas.':'Projeto salvo na sua conta.');
 if(publish){await showLibrary();}
 }catch(e){notify(e.message);}finally{busy=false;$('cloudSave').disabled=false;$('publishPlayers').disabled=false;}
}
async function showLibrary(){
 if(!user)return;if(!dialog.open)dialog.showModal();status('Carregando…');const list=dialog.querySelector('.cloud-list');list.replaceChildren();
 try{const {maps}=await api('/api/worlds');status(maps.length?'':'Você ainda não salvou mapas na sua conta.');
 for(const map of maps){const row=document.createElement('article'),title=document.createElement('strong'),note=document.createElement('small');title.textContent=map.title;note.textContent=map.published?'Publicado para jogadores':'Privado';row.append(title,note);
 const button=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){status(e.message);}finally{b.disabled=false;}};row.append(b);};
 button('Editar',async()=>{if(dirty&&!confirm('Abrir este mapa e descartar as alterações atuais?'))return;const data=await api('/api/world?id='+map.id);const opened=await $('file').onchange({target:{files:[new File([JSON.stringify(data)],map.title+'.json',{type:'application/json'})],value:''},discardConfirmed:true});if(opened){mapId=map.id;detachDriveProject();dirty=false;dialog.close();$('saved').textContent='Aberto da sua conta';}});
 if(map.shareUrl){const link=new URL(map.shareUrl,location.origin).href;button('Copiar link',async()=>{await navigator.clipboard.writeText(link);status('Link copiado. Envie aos jogadores.');});const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener';a.textContent='Visualizar';row.append(a);button('Retirar publicação',async()=>{await api('/api/world?id='+map.id,{method:'DELETE'});await showLibrary();});}
 list.append(row);}
 }catch(e){status(e.message);}
}
$('cloudSave').onclick=()=>saveCloud();$('cloudMaps').onclick=showLibrary;$('publishPlayers').onclick=()=>saveCloud(true);
// Opening a local file or creating a new world must not overwrite an earlier cloud map.
const localOpen=$('file').onchange;$('file').onchange=async e=>{const result=await localOpen(e);if(result)mapId='';return result;};
const newWorld=$('new').onclick;$('new').onclick=async e=>{const generation=driveGeneration;await newWorld(e);if(driveGeneration!==generation)mapId='';};
api('/api/account').then(data=>{config=data;user=data.user;renderSession();if(new URLSearchParams(location.search).get('login')==='ok'&&user)notify('Bem-vindo, '+user.name+'. Seus mapas ficam na sua conta.');}).catch(()=>{renderSession();});
