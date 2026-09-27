(() => {
 'use strict';
 if(location.protocol==='file:'||new URLSearchParams(location.search).get('embed')==='1')return;
 const viewer=document.body.classList.contains('modern-viewer'),name=viewer?'Atlas do Reino':'Atlas Editor';
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const button=document.createElement('button');button.type='button';button.className='install-app';button.textContent='Instalar app';button.setAttribute('aria-label','Instalar '+name+' no dispositivo');button.hidden=standalone();
 (document.querySelector('header .header-actions')||document.querySelector('header nav')||document.querySelector('header')).append(button);
 const dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.innerHTML=`<img src="/icons/atlas-192.png" alt="" width="72" height="72"><h2>Instalar ${name}</h2><p>Tenha um atalho na tela inicial e abra em uma janela própria.</p><p>No Chrome para Android, abra o menu <b>⋮</b> e escolha <b>Adicionar à tela inicial</b> → <b>Instalar</b>. Se estiver em um navegador de outro aplicativo, abra este site no Chrome primeiro.</p><p class="install-note">No iPhone ou iPad: Compartilhar → Adicionar à Tela de Início.</p><button type="button">Entendi</button>`;document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
 let promptEvent=null;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;if(!standalone())button.hidden=false;});
 window.addEventListener('appinstalled',()=>{promptEvent=null;button.hidden=true;if(dialog.open)dialog.close();});
 button.onclick=async()=>{if(!promptEvent){dialog.showModal();return;}const event=promptEvent;promptEvent=null;button.disabled=true;try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')button.hidden=true;}catch{dialog.showModal();}finally{button.disabled=false;}};
 if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>console.warn('Instalação offline indisponível:',error.name));
})();
