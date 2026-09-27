'use strict';
// Current editing target and automatic-opening preference are independent.
let driveToken='',driveFileId='',driveTimer=0,driveBusy=false,driveServerSession=false;
let driveLocalProject=false,driveRevision=0,driveGeneration=0,driveCurrent=null,driveDefaultId='',driveDefaultName='';
let driveFolder='',driveFiles=[],driveNextPage='',driveFolderPage='',driveListSerial=0,driveSearchTimer=0;
const drivePath=[],drivePanel=document.querySelector('.drive-panel');
drivePanel.innerHTML='<summary>GOOGLE DRIVE</summary><p id="driveCurrent">Arquivo atual: nenhum</p><p id="driveDefault">Abertura automática: nenhum</p><div class="drive-actions"><button id="driveBrowse">▱ Meus mapas</button><button id="driveCopy">Salvar cópia…</button><button id="driveSetCurrentDefault">★ Usar atual como padrão</button><button id="driveClearDefault">Remover padrão</button></div><label class="check"><input id="driveAutosave" type="checkbox"> Salvar alterações automaticamente</label><p class="muted" id="driveHelp" role="status">Verificando conexão…</p><progress id="driveProgress" max="100" value="0" hidden aria-label="Progresso de envio ao Drive"></progress><input id="driveClientId" hidden><details><summary>Histórico da conexão</summary><pre id="driveLog"></pre></details>';
const driveDialog=document.createElement('dialog');driveDialog.id='driveDialog';driveDialog.className='drive-dialog';
driveDialog.innerHTML='<div class="drive-dialog-heading"><div><h2>Mapas do Google Drive</h2><p class="muted">Escolha um mapa para editar ou marcar como padrão.</p></div><button id="driveClose" aria-label="Fechar biblioteca">×</button></div><div class="drive-browser-tools"><input id="driveSearch" type="search" placeholder="Buscar mapa pelo nome" aria-label="Buscar mapa"><button id="driveRefresh">Atualizar</button><button id="driveReconnect">Atualizar acesso ao Drive</button><button id="driveNewFolder">Nova pasta</button></div><nav id="driveBreadcrumb" aria-label="Pastas do Drive"></nav><p id="driveListStatus" role="status"></p><div id="driveFileList"></div><button id="driveMore" hidden>Carregar mais arquivos</button><div class="drive-copy-options" id="driveCopyOptions" hidden><label>Nome da cópia <input id="driveCopyName" maxlength="160"></label><label class="check"><input id="driveCopyDefault" type="checkbox"> Abrir esta cópia sempre que iniciar o editor</label><button id="driveCreateCopy" class="primary">Salvar cópia nesta pasta</button><p class="muted">O arquivo original é preservado. A cópia passa a ser o mapa em edição.</p></div><p class="muted">São exibidos os mapas e pastas autorizados para o Aether Atlas nesta conta.</p>';
document.body.append(driveDialog);
const driveUnsaved=document.createElement('dialog');driveUnsaved.className='drive-unsaved';
driveUnsaved.innerHTML='<h2>Há alterações neste mapa</h2><p>Salve suas alterações antes de abrir outro arquivo.</p><div class="drive-actions"><button data-decision="save" class="primary">Salvar e abrir</button><button data-decision="discard">Abrir sem salvar</button><button data-decision="cancel">Cancelar</button></div>';
document.body.append(driveUnsaved);
$('driveAutosave').checked=localStorage.getItem('aether-atlas-drive-autosave')!=='false';
function driveLog(message){$('driveLog').textContent=($('driveLog').textContent+'\n'+new Date().toLocaleTimeString()+' '+message).split('\n').slice(-30).join('\n');}
function driveStatus(message){$('driveHelp').textContent=message;driveLog(message);}
function updateDriveUI(){
  $('driveCurrent').textContent='Arquivo atual: '+(driveCurrent?.name||'mapa ainda não salvo no Drive');
  $('driveDefault').textContent='Abertura automática: '+(driveDefaultId?(driveDefaultName||'mapa padrão definido'):'nenhum mapa definido');
  for(const id of ['driveSave','driveCopy','driveBrowse','driveSetCurrentDefault','driveClearDefault','driveCreateCopy','driveNewFolder'])$(id).disabled=driveBusy;
  $('driveSetCurrentDefault').disabled=driveBusy||!driveFileId;
  $('driveClearDefault').disabled=driveBusy||!driveDefaultId;
  $('driveConnect').textContent=driveToken?'Mapas do Drive':'Conectar Drive';
}
async function serverDriveSession(){const r=await fetch('/api/drive/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Não foi possível consultar a conexão com o Drive.');return r.json();}
const driveClient=new AtlasDriveClient({session:serverDriveSession,onSession:s=>{driveToken=s.accessToken;driveServerSession=true;driveDefaultId=Object.hasOwn(s,'defaultFileId')?s.defaultFileId||'':localStorage.getItem('aether-atlas-drive-default')||s.fileId||'';driveDefaultName=localStorage.getItem('aether-atlas-drive-default-name')||'';updateDriveUI();}});
async function persistDrivePreference(body){
  const r=await fetch('/api/drive/file',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Não foi possível memorizar a escolha no Drive.');
}
async function setDriveDefault(file){
  if(driveBusy)return false;
  try{await driveClient.authenticate();if(file)await driveClient.metadata(file.id);await persistDrivePreference({defaultFileId:file?.id||null});driveDefaultId=file?.id||'';driveDefaultName=file?.name||'';
    if(file){localStorage.setItem('aether-atlas-drive-default',file.id);localStorage.setItem('aether-atlas-drive-default-name',file.name);}else{localStorage.removeItem('aether-atlas-drive-default');localStorage.removeItem('aether-atlas-drive-default-name');}
    updateDriveUI();renderDriveFiles();driveStatus(file?'Mapa padrão definido. Ele será aberto ao iniciar o editor.':'Abertura automática desativada.');return true;
  }catch(error){driveStatus(error.message);notify(error.message);return false;}
}
function detachDriveProject(){clearTimeout(driveTimer);driveGeneration++;driveFileId='';driveCurrent=null;driveLocalProject=true;updateDriveUI();}
function unsavedDecision(){
  return new Promise(resolve=>{const finish=value=>{driveUnsaved.close();driveUnsaved.oncancel=null;resolve(value);};driveUnsaved.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>finish(b.dataset.decision));driveUnsaved.oncancel=e=>{e.preventDefault();finish('cancel');};driveUnsaved.showModal();});
}
async function openDriveProject(id,{automatic=false}={}){
  if(driveBusy)return false;clearTimeout(driveTimer);
  if(automatic&&(dirty||driveLocalProject))return false;
  if(dirty){const decision=await unsavedDecision();if(decision==='cancel'){scheduleDriveSave();return false;}if(decision==='save'&&!await saveToDrive())return false;}
  const revision=driveRevision,generation=driveGeneration;driveBusy=true;updateDriveUI();driveStatus('Baixando e preparando o mapa…');
  try{
    const file=await driveClient.metadata(id),blob=await driveClient.download(file);
    if(driveRevision!==revision||driveGeneration!==generation)throw Error('O mapa atual recebeu novas alterações durante o carregamento. Abra o arquivo novamente quando terminar.');
    const opened=await $('file').onchange({target:{files:[new File([blob],file.name,{type:'application/json'})],value:''},fromDrive:true,discardConfirmed:true,canApply:()=>driveRevision===revision&&driveGeneration===generation});
    if(!opened)throw Error('O arquivo não foi aberto: projeto inválido ou abertura cancelada.');
    driveGeneration++;driveFileId=file.id;driveCurrent=file;driveLocalProject=false;localStorage.setItem('aether-atlas-drive-file',file.id);
    try{await persistDrivePreference({fileId:file.id});}catch(error){driveLog(error.message);}
    if(driveDefaultId===file.id){driveDefaultName=file.name;localStorage.setItem('aether-atlas-drive-default-name',file.name);}
    $('saved').textContent=file.capabilities?.canEdit===false?'Drive · somente leitura':'Projeto aberto do Google Drive';
    driveStatus('Aberto: '+file.name+(file.capabilities?.canEdit===false?'. Use Salvar cópia para editar seu próprio arquivo.':'. As alterações serão salvas neste arquivo.'));
    if(driveDialog.open)driveDialog.close();return true;
  }catch(error){driveStatus(error.message);notify(error.message);return false;}
  finally{driveBusy=false;updateDriveUI();}
}
async function saveToDrive({copy=false,name='',folder='',makeDefault=false,automatic=false}={}){
  end();if(driveBusy)return false;
  if(automatic&&(!driveFileId||driveLocalProject||driveCurrent?.capabilities?.canEdit===false))return false;
  if(!copy&&driveCurrent?.capabilities?.canEdit===false){driveStatus('Este arquivo é somente leitura. Use Salvar cópia para guardar suas alterações.');return false;}
  const revision=driveRevision,generation=driveGeneration,target=copy||driveLocalProject?'':driveFileId;
  driveBusy=true;clearTimeout(driveTimer);updateDriveUI();$('driveProgress').hidden=false;$('driveProgress').value=0;
  let success=false;
  try{
    const base=(name||$('title').value.trim()||'Meu mapa').replace(/\.aether-atlas\.json$/i,'');
    const result=await driveClient.upload({id:target,name:base+'.aether-atlas.json',folder,blob:new Blob([JSON.stringify(projectData())],{type:'application/json'}),onProgress:percent=>{$('driveProgress').value=percent;driveStatus('Salvando no Drive: '+percent+'%');}});
    if(!result.id)throw Error('O Drive não confirmou o arquivo salvo.');
    success=true;
    if(generation!==driveGeneration){notify('O mapa anterior foi salvo no Drive. O novo mapa continua aberto.');return true;}
    driveFileId=result.id;driveCurrent={...result,name:result.name||base+'.aether-atlas.json'};driveLocalProject=false;localStorage.setItem('aether-atlas-drive-file',result.id);
    dirty=driveRevision!==revision;$('saved').textContent=dirty?'Novas alterações pendentes':'Salvo no Google Drive';
    try{await persistDrivePreference({fileId:result.id});}catch(error){driveLog('Arquivo salvo. '+error.message);}
    if(makeDefault){await persistDrivePreference({defaultFileId:result.id});driveDefaultId=result.id;driveDefaultName=driveCurrent.name;localStorage.setItem('aether-atlas-drive-default',result.id);localStorage.setItem('aether-atlas-drive-default-name',driveCurrent.name);}
    driveStatus('Salvo: '+driveCurrent.name+(dirty?'. Há novas alterações aguardando envio.':'.'));if(!automatic)notify('Salvo no Google Drive: '+driveCurrent.name);if(copy&&driveDialog.open)driveDialog.close();return true;
  }catch(error){driveStatus((success?'Mapa salvo, mas a preferência não foi registrada: ':'Falha ao salvar: ')+error.message);notify(error.message);return success;}
  finally{driveBusy=false;$('driveProgress').hidden=true;updateDriveUI();if(success&&driveRevision!==revision)scheduleDriveSave();}
}
function scheduleDriveSave(){clearTimeout(driveTimer);if(driveToken&&!driveBusy&&driveFileId&&!driveLocalProject&&driveCurrent?.capabilities?.canEdit!==false&&$('driveAutosave').checked)driveTimer=setTimeout(()=>saveToDrive({automatic:true}),2500);}
function renderDriveBreadcrumb(){
  const nav=$('driveBreadcrumb');nav.replaceChildren();const add=(name,action)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;nav.append(b);};
  add('Todos os mapas',()=>{drivePath.length=0;driveFolder='';loadDriveFiles();});add('Meu Drive',()=>{drivePath.length=0;driveFolder='root';loadDriveFiles();});
  drivePath.forEach((f,i)=>add(f.name,()=>{driveFolder=f.id;drivePath.splice(i+1);loadDriveFiles();}));
}
function renderDriveFiles(){
  const list=$('driveFileList');list.replaceChildren();
  for(const file of driveFiles){const row=document.createElement('div');row.className='drive-file-row';const isFolder=file.mimeType==='application/vnd.google-apps.folder';
    const info=document.createElement('div'),name=document.createElement('strong'),note=document.createElement('small');name.textContent=(isFolder?'▱ ':'')+file.name;
    note.textContent=isFolder?'Pasta':(file.id===driveDefaultId?'★ Abre automaticamente · ':'')+(file.id===driveFileId?'Em edição · ':'')+(file.capabilities?.canEdit===false?'Somente leitura · ':'')+(file.modifiedTime?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(file.modifiedTime)):'');info.append(name,note);row.append(info);
    const button=document.createElement('button');button.textContent=isFolder?'Entrar':'Abrir';button.disabled=driveBusy;button.onclick=()=>{if(isFolder){driveFolder=file.id;drivePath.push(file);loadDriveFiles();}else openDriveProject(file.id);};row.append(button);
    if(!isFolder){const pin=document.createElement('button');pin.textContent=file.id===driveDefaultId?'★ Padrão':'☆ Usar como padrão';pin.disabled=driveBusy;pin.onclick=()=>setDriveDefault(file);row.append(pin);}list.append(row);
  }
}
async function loadDriveFiles(more=false){
  const serial=++driveListSerial;renderDriveBreadcrumb();$('driveListStatus').textContent='Buscando mapas…';$('driveMore').disabled=true;
  try{
    const [maps,folders]=await Promise.all([more&&!driveNextPage?Promise.resolve({files:[]}):driveClient.list({folder:driveFolder,search:$('driveSearch').value,pageToken:more?driveNextPage:''}),more&&!driveFolderPage?Promise.resolve({files:[]}):driveClient.list({folder:driveFolder||'root',folders:true,pageToken:more?driveFolderPage:''})]);
    if(serial!==driveListSerial)return;
    driveFiles=more?[...driveFiles,...(folders.files||[]),...(maps.files||[])]:[...folders.files||[],...maps.files||[]];driveFiles=[...new Map(driveFiles.map(file=>[file.id,file])).values()];driveNextPage=maps.nextPageToken||'';driveFolderPage=folders.nextPageToken||'';renderDriveFiles();$('driveMore').hidden=!(driveNextPage||driveFolderPage);$('driveListStatus').textContent=driveFiles.length?'Escolha um mapa ou entre em uma pasta.':'Nenhum mapa encontrado. Você pode salvar o mapa atual nesta pasta.';
  }catch(error){if(serial===driveListSerial){$('driveListStatus').textContent=error.message;$('driveFileList').replaceChildren();}}
  finally{if(serial===driveListSerial)$('driveMore').disabled=false;}
}
async function showDriveLibrary(copy=false){
  if(!driveDialog.open)driveDialog.showModal();$('driveCopyOptions').hidden=!copy;if(copy){$('driveCopyName').value=($('title').value.trim()||'Meu mapa')+' — cópia';$('driveCopyDefault').checked=false;}loadDriveFiles();
}
async function connectDrive(renew=false,{save=false}={}){
  if(driveBusy)return;
  if(driveToken&&!renew)return save?saveToDrive():showDriveLibrary();
  const generation=driveGeneration;
  if(location.protocol==='file:'){driveStatus('A conexão com o Google Drive está disponível na versão online do editor.');notify('Use a versão online para salvar no Drive.');return;}
  const popup=window.open('/api/drive/connect?popup=1','aether-drive-connect','width=560,height=720');if(!popup){driveStatus('Permita a janela de conexão do Google e tente novamente.');notify('Permita a janela de conexão do Google e tente novamente.');return;}
  $('driveConnect').disabled=true;
  const listener=async event=>{if(event.origin!==location.origin||event.source!==popup||event.data?.type!=='aether-drive-connected')return;cleanup();try{await driveClient.authenticate(true);driveStatus('Drive conectado. Seu mapa atual foi preservado.');if(save){if(driveGeneration!==generation){notify('Drive conectado. O mapa mudou durante a conexão; clique em Salvar no Drive para salvar o mapa atual.');return;}await saveToDrive();}else showDriveLibrary();}catch(error){driveStatus(error.message);notify(error.message);}};
  const timer=setInterval(()=>{if(popup.closed)cleanup();},1000);const cleanup=()=>{clearInterval(timer);window.removeEventListener('message',listener);$('driveConnect').disabled=false;};window.addEventListener('message',listener);
}
async function restoreDriveSession(){
  try{await driveClient.authenticate();if(driveDefaultId&&!dirty&&!driveLocalProject)await openDriveProject(driveDefaultId,{automatic:true});else driveStatus('Drive conectado. Abra Meus mapas para escolher o arquivo que deseja editar.');}
  catch{driveStatus(location.protocol==='file:'?'Use a versão online para abrir e salvar mapas no Google Drive.':'Conecte sua conta para abrir e salvar mapas no Google Drive.');}
  updateDriveUI();
}
$('driveReconnect').onclick=()=>connectDrive(true);$('driveConnect').onclick=()=>connectDrive();$('driveSave').onclick=()=>driveToken?saveToDrive():connectDrive(false,{save:true});$('driveBrowse').onclick=()=>driveToken?showDriveLibrary():connectDrive();$('driveCopy').onclick=()=>showDriveLibrary(true);
$('driveSetCurrentDefault').onclick=()=>setDriveDefault(driveCurrent);$('driveClearDefault').onclick=()=>setDriveDefault(null);
$('driveClose').onclick=()=>driveDialog.close();$('driveRefresh').onclick=()=>loadDriveFiles();$('driveMore').onclick=()=>loadDriveFiles(true);
$('driveSearch').oninput=()=>{clearTimeout(driveSearchTimer);driveSearchTimer=setTimeout(loadDriveFiles,300);};
$('driveCreateCopy').onclick=()=>saveToDrive({copy:true,name:$('driveCopyName').value,folder:driveFolder||'root',makeDefault:$('driveCopyDefault').checked});
$('driveNewFolder').onclick=async()=>{const name=prompt('Nome da nova pasta:');if(!name?.trim())return;try{const folder=await driveClient.createFolder(name.trim().slice(0,160),driveFolder||'root');drivePath.push(folder);driveFolder=folder.id;loadDriveFiles();}catch(error){$('driveListStatus').textContent=error.message;}};
$('driveAutosave').onchange=()=>{localStorage.setItem('aether-atlas-drive-autosave',$('driveAutosave').checked);scheduleDriveSave();};
updateDriveUI();restoreDriveSession();
