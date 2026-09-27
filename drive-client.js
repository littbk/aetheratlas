'use strict';
class AtlasDriveClient {
  constructor({fetch:request=globalThis.fetch,session,onSession=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
    this.fetch=(...args)=>Reflect.apply(request,globalThis,args);this.session=session;this.onSession=onSession;this.wait=wait;this.token='';this.expires=0;
  }
  async authenticate(force=false){
    if(!force&&this.token&&Date.now()<this.expires)return;
    const s=await this.session();if(!s.configured||!s.connected)throw Error('Conecte sua conta Google Drive para continuar.');
    this.token=s.accessToken;this.expires=Date.now()+Math.max(30,(s.expiresIn||3600)-60)*1000;this.onSession(s);
  }
  async request(url,options={},retry=true){
    await this.authenticate();const send=()=>this.fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+this.token}});
    let response=await send();if(response.status===401&&retry){await this.authenticate(true);response=await send();}return response;
  }
  static escape(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  static async error(response,fallback){const data=await response.json().catch(()=>({}));return Error(data.error?.message||fallback+' (HTTP '+response.status+').');}
  async metadata(id){
    const r=await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?'+new URLSearchParams({fields:'id,name,mimeType,modifiedTime,parents,trashed,size,capabilities(canEdit)',supportsAllDrives:'true'}));
    if(!r.ok)throw await AtlasDriveClient.error(r,'Não foi possível acessar este arquivo');const file=await r.json();if(file.trashed)throw Error('Este arquivo está na lixeira.');return file;
  }
  async list({folder='',search='',pageToken='',folders=false}={}){
    const terms=['trashed = false',folders?"mimeType = 'application/vnd.google-apps.folder'":"(mimeType = 'application/json' or name contains '.json')"];
    if(folder)terms.push("'"+AtlasDriveClient.escape(folder)+"' in parents");
    if(search.trim())terms.push("name contains '"+AtlasDriveClient.escape(search.trim().slice(0,100))+"'");
    const params=new URLSearchParams({q:terms.join(' and '),orderBy:'folder,name',pageSize:'100',fields:'nextPageToken,files(id,name,mimeType,modifiedTime,parents,size,capabilities(canEdit))',spaces:'drive',includeItemsFromAllDrives:'true',supportsAllDrives:'true'});
    if(pageToken)params.set('pageToken',pageToken);
    const r=await this.request('https://www.googleapis.com/drive/v3/files?'+params);if(!r.ok)throw await AtlasDriveClient.error(r,'Não foi possível listar os mapas');return r.json();
  }
  async download(file){
    if(Number(file.size)>80*1024*1024)throw Error('Este projeto excede o limite de 80 MB.');
    const r=await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media&supportsAllDrives=true');
    if(!r.ok)throw await AtlasDriveClient.error(r,'Não foi possível baixar o mapa');const blob=await r.blob();if(blob.size>80*1024*1024)throw Error('Este projeto excede o limite de 80 MB.');return blob;
  }
  async createFolder(name,parent='root'){
    const r=await this.request('https://www.googleapis.com/drive/v3/files?fields=id,name,parents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent]})});
    if(!r.ok)throw await AtlasDriveClient.error(r,'Não foi possível criar a pasta');return r.json();
  }
  async upload({id='',name,blob,folder='',onProgress=()=>{}}){
    const metadata={name,mimeType:'application/json',appProperties:{aetherAtlas:'project'}};if(!id&&folder)metadata.parents=[folder];
    const url='https://www.googleapis.com/upload/drive/v3/files'+(id?'/'+encodeURIComponent(id):'')+'?'+new URLSearchParams({uploadType:'resumable',fields:'id,name,modifiedTime,parents,capabilities(canEdit)',supportsAllDrives:'true'});
    const start=await this.request(url,{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(metadata)});
    if(!start.ok)throw await AtlasDriveClient.error(start,'Não foi possível iniciar o salvamento');
    const location=start.headers.get('Location');let endpoint;try{endpoint=new URL(location);}catch{throw Error('O Drive não forneceu um endereço de envio válido.');}
    if(endpoint.origin!=='https://www.googleapis.com'||!/^\/(?:resumable\/)?upload\/drive\//.test(endpoint.pathname))throw Error('Endereço de envio do Drive inválido.');
    let offset=0,failures=0;const chunkSize=4*1024*1024;
    while(offset<blob.size){
      const end=Math.min(offset+chunkSize,blob.size);let response;
      try{
        response=await this.request(location,{method:'PUT',headers:{'Content-Type':'application/json','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end)},false);
        if(response.ok){onProgress(100);return response.json();}
        if(response.status===308){const range=response.headers.get('Range'),next=range?/^bytes=0-(\d+)$/.exec(range):null;const received=next?Number(next[1])+1:0;if(received<=offset)throw Error('O envio não avançou.');offset=received;failures=0;onProgress(Math.round(offset/blob.size*100));continue;}
        if(response.status!==401&&response.status!==429&&response.status<500)throw await AtlasDriveClient.error(response,'Não foi possível salvar o mapa');
      }catch(error){if(response&&response.status<500&&![401,429,308].includes(response.status))throw error;}
      if(++failures>3)throw Error('O envio foi interrompido. Suas alterações continuam abertas; tente salvar novamente.');
      await this.wait(500*2**(failures-1));if(response?.status===401)await this.authenticate(true);
      const status=await this.request(location,{method:'PUT',headers:{'Content-Range':'bytes */'+blob.size},body:''});
      if(status.ok){onProgress(100);return status.json();}
      if(status.status!==308)throw await AtlasDriveClient.error(status,'Não foi possível retomar o envio');
      const match=/^bytes=0-(\d+)$/.exec(status.headers.get('Range')||'');offset=match?Number(match[1])+1:0;onProgress(Math.round(offset/blob.size*100));
    }
    throw Error('O Drive não confirmou a conclusão do envio.');
  }
}
if(typeof module!=='undefined')module.exports=AtlasDriveClient;
